import http from 'http';
import assert from 'node:assert/strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let _server = null;
let _baseUrl = null;

/**
 * Start the real Koa app on an ephemeral port.
 * The app runs against the configured database — no mocks.
 * Call stopTestServer() after tests complete.
 */
export async function startTestServer() {
  if (_server) return _baseUrl;

  // Set non-production env so TLS is not required
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.TLS_ENABLED = 'false';

  const { createApp } = await import('../../backend/src/app.js');
  const app = createApp();

  return new Promise((resolve, reject) => {
    _server = http.createServer(app.callback());
    _server.listen(0, '127.0.0.1', () => {
      const { port } = _server.address();
      _baseUrl = `http://127.0.0.1:${port}`;
      resolve(_baseUrl);
    });
    _server.on('error', reject);
  });
}

export async function stopTestServer() {
  if (!_server) return;
  return new Promise((resolve) => {
    _server.close(() => {
      _server = null;
      _baseUrl = null;
      resolve();
    });
  });
}

/**
 * Resolve the API base URL.
 * Prefers a self-bootstrapped in-process server.
 * Falls back to API_BASE_URL env or localhost candidates if the app
 * cannot be imported (e.g. missing DB config in CI).
 */
export async function resolveBase() {
  // If we already have a running in-process server, use it
  if (_baseUrl) return _baseUrl;

  // Try to self-bootstrap
  try {
    return await startTestServer();
  } catch {
    // Self-bootstrap failed (likely no DB connection). Fall back to external server.
  }

  // Fall back to externally running server
  const candidates = [process.env.API_BASE_URL, 'https://localhost:4000', 'http://localhost:4000'].filter(Boolean);
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        _baseUrl = base;
        return base;
      }
    } catch {
      // continue
    }
  }
  throw new Error(
    'API server is not reachable. Tests require either a running backend or ' +
    'a configured database for self-bootstrap. Set API_BASE_URL or start the server.'
  );
}

export async function request(path, { method = 'GET', token = '', body } = {}) {
  const base = await resolveBase();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, 'X-CSRF-Token': token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

export async function loginAs(username, password) {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password }
  });
  assert.equal(status, 200, `login failed for ${username}: ${JSON.stringify(data)}`);
  assert.ok(data.token, `no token returned for ${username}`);
  return data.token;
}

export async function loginAdmin() {
  return loginAs('admin', 'Admin@123456');
}

export async function createUser(adminToken, overrides = {}) {
  const ts = Date.now();
  const defaults = {
    username: `test_user_${ts}`,
    full_name: `Test User ${ts}`,
    password: 'TestPass@12345',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `test_${ts}@roadsafe.internal`
  };
  const payload = { ...defaults, ...overrides };

  const { status, data } = await request('/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: payload
  });
  assert.equal(status, 201, `register failed for ${payload.username}: ${JSON.stringify(data)}`);

  const list = await request(
    `/api/users?page=1&pageSize=5&q=${encodeURIComponent(payload.username)}`,
    { token: adminToken }
  );
  assert.equal(list.status, 200);
  const found = (list.data.rows || []).find((u) => u.username === payload.username);
  assert.ok(found, `user not found after create: ${payload.username}`);

  return { id: found.id, username: payload.username, password: payload.password, token: null };
}

export async function createUserAndLogin(adminToken, overrides = {}) {
  const user = await createUser(adminToken, overrides);
  user.token = await loginAs(user.username, user.password);
  return user;
}

export function futureSlot(daysFromNow, hour, minute = 0) {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}
