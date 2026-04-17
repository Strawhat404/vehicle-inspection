import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUserAndLogin } from './helpers/setup.js';

test('auth: unauthenticated request to protected route returns 401', async () => {
  const { status } = await request('/api/users?page=1&pageSize=5');
  assert.equal(status, 401);
});

test('auth: successful admin login returns token and user fields', async () => {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin@123456' }
  });
  assert.equal(status, 200, `login failed: ${JSON.stringify(data)}`);
  assert.ok(data.token, 'response must include a token');
  assert.equal(typeof data.token, 'string', 'token must be a string');
  assert.ok(data.token.length > 0, 'token must not be empty');
  // Verify user identity fields are present
  assert.ok(data.user || data.username || data.role, 'response should include user identity information');
});

test('auth: password complexity rejection returns 400 with descriptive error', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: {
      username: `short_pw_${Date.now()}`,
      full_name: 'Short Password User',
      password: 'Weak1!',
      role_name: 'Coordinator',
      location_code: 'HQ',
      department_code: 'OPS',
      email: `short_pw_${Date.now()}@roadsafe.internal`
    }
  });
  assert.equal(status, 400, `expected 400 for weak password, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'response must include an error field');
  assert.match(String(data.error), /at least 12 chars/i, `error message should mention 12 chars, got: ${data.error}`);
});

test('auth: coordinator token is rejected when scheduling outside own scope (403)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordinatorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: {
      customer_id: 1,
      location_code: 'OTHER',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: '2026-12-01T10:00:00Z',
      notes: 'cross scope auth test'
    }
  });
  assert.equal(status, 403, `expected 403 for cross-scope scheduling, got ${status}: ${JSON.stringify(data)}`);
});
