import Router from 'koa-router';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { config } from '../config.js';
import { generateToken, hashPassword, validatePasswordComplexity } from '../utils/crypto.js';
import { authRequired } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';
import { detectPrivilegeEscalation } from '../services/securityMonitorService.js';
import { safeLog } from '../utils/redaction.js';

const router = new Router({ prefix: '/api/auth' });

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// username -> { count: number, lockedUntil: number }
const loginAttempts = new Map();

function isLockedOut(username) {
  const entry = loginAttempts.get(username);
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(username);
  }
  return false;
}

function recordFailedAttempt(username) {
  const entry = loginAttempts.get(username) || { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  loginAttempts.set(username, entry);
}

function clearAttempts(username) {
  loginAttempts.delete(username);
}

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body || {};
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const lockoutKey = normalizedUsername.toLowerCase();
  if (!normalizedUsername || !password) {
    ctx.status = 400;
    ctx.body = { error: 'username and password are required' };
    return;
  }

  if (isLockedOut(lockoutKey)) {
    await query(
      `INSERT INTO security_alerts (actor_user_id, alert_type, severity, details)
       VALUES (NULL, 'account_locked_login_attempt', 'high', ?)`,
      [JSON.stringify({ username: normalizedUsername, ip: ctx.ip })]
    );
    ctx.status = 429;
    ctx.body = { error: 'Account temporarily locked due to too many failed login attempts' };
    return;
  }

  const users = await query(
    `SELECT u.id, u.username, u.password_hash, u.password_salt, u.full_name,
            u.location_code, u.department_code, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = ? AND u.is_active = 1`,
    [normalizedUsername]
  );

  if (!users.length) {
    recordFailedAttempt(lockoutKey);
    ctx.status = 401;
    ctx.body = { error: 'Invalid credentials' };
    return;
  }

  const user = users[0];
  let valid = false;
  try {
    valid = bcrypt.compareSync(password, user.password_hash);
  } catch (error) {
    safeLog('bcrypt_compare_failed', {
      username: normalizedUsername,
      error: error.message
    });
    ctx.status = 500;
    ctx.body = { error: 'Credential verification failed' };
    return;
  }

  if (!valid) {
    recordFailedAttempt(lockoutKey);
    ctx.status = 401;
    ctx.body = { error: 'Invalid credentials' };
    return;
  }

  clearAttempts(lockoutKey);

  const token = generateToken();
  const ttlHours = config.sessionTtlHours;
  await query(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))`,
    [user.id, token, ttlHours]
  );

  await logAuditEvent({
    actorUserId: user.id,
    actorRole: user.role_name,
    action: 'auth.login',
    targetTable: 'sessions',
    targetRecordId: user.id,
    locationCode: user.location_code,
    departmentCode: user.department_code,
    details: { username: user.username }
  });

  ctx.body = {
    token,
    expiresInHours: ttlHours,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_name,
      locationCode: user.location_code,
      departmentCode: user.department_code
    }
  };
});

router.get('/me', authRequired, async (ctx) => {
  ctx.body = { user: ctx.state.user };
});

router.post('/logout', authRequired, async (ctx) => {
  await query('UPDATE sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL', [ctx.state.user.sessionId]);
  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'auth.logout',
    targetTable: 'sessions',
    targetRecordId: ctx.state.user.sessionId,
    locationCode: ctx.state.user.locationCode,
    departmentCode: ctx.state.user.departmentCode
  });
  ctx.body = { success: true };
});

router.post('/register', authRequired, async (ctx) => {
  if (ctx.state.user.role !== 'Administrator') {
    ctx.status = 403;
    ctx.body = { error: 'Only administrators can create users' };
    return;
  }

  const {
    username,
    full_name,
    password,
    role_name,
    location_code,
    department_code,
    email
  } = ctx.request.body || {};

  if (!username || !full_name || !password || !role_name || !location_code || !department_code) {
    ctx.status = 400;
    ctx.body = { error: 'Missing required fields' };
    return;
  }

  if (!validatePasswordComplexity(password)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Password must be at least 12 chars and include uppercase, lowercase, number, special char'
    };
    return;
  }

  const roles = await query('SELECT id FROM roles WHERE name = ?', [role_name]);
  if (!roles.length) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid role_name' };
    return;
  }

  const { salt, hash } = hashPassword(password);
  await query(
    `INSERT INTO users
      (username, email, full_name, password_hash, password_salt, role_id, location_code, department_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, email || null, full_name, hash, salt, roles[0].id, location_code, department_code]
  );

  await logAuditEvent({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'iam.user.create',
    targetTable: 'users',
    targetRecordId: username,
    locationCode: location_code,
    departmentCode: department_code,
    details: { createdBy: ctx.state.user.username, assignedRole: role_name }
  });

  await detectPrivilegeEscalation({
    actorUserId: ctx.state.user.id,
    actorRole: ctx.state.user.role,
    action: 'iam.user.create',
    targetUserId: username,
    assignedRole: role_name
  });

  ctx.status = 201;
  ctx.body = { success: true };
});

export default router;
