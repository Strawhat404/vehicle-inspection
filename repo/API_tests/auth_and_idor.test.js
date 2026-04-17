import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin } from './helpers/setup.js';

test('unauthenticated requests to protected routes return 401', async () => {
  const routes = [
    '/api/users?page=1&pageSize=5',
    '/api/coordinator/bay-utilization',
    '/api/coordinator/waiting-room/seats',
    '/api/search/vehicles?page=1',
    '/api/messages/inbox',
    '/api/audit/events'
  ];

  for (const route of routes) {
    const { status } = await request(route);
    assert.equal(status, 401, `expected 401 for ${route}, got ${status}`);
  }
});

test('non-admin cannot register users (403)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/auth/register', {
    method: 'POST',
    token: coordToken,
    body: {
      username: `should_fail_${Date.now()}`,
      full_name: 'Should Fail',
      password: 'ShouldFail@123',
      role_name: 'Inspector',
      location_code: 'HQ',
      department_code: 'OPS',
      email: `fail_${Date.now()}@roadsafe.internal`
    }
  });
  assert.equal(status, 403, `expected 403 for non-admin register, got ${status}: ${JSON.stringify(data)}`);
});

test('invalid credentials return 401', async () => {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'WrongPassword!' }
  });
  assert.equal(status, 401, `expected 401 for bad credentials, got ${status}: ${JSON.stringify(data)}`);
});

test('missing required fields on register return 400 with error detail', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: { username: 'incomplete_user' }
  });
  assert.equal(status, 400, `expected 400 for incomplete register payload, got ${status}`);
  assert.ok(data.error, 'response must include an error field describing the missing fields');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('IDOR: coordinator cannot access admin-only users list (403)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/users?page=1&pageSize=5', { token: coordToken });
  assert.equal(status, 403, `expected 403 for coordinator accessing admin users list, got ${status}: ${JSON.stringify(data)}`);
});

test('IDOR: seat assignment with out-of-scope appointment_id returns 403', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/waiting-room/assign-seat', {
    method: 'POST',
    token: coordToken,
    body: { seat_id: 1, appointment_id: 999999, location_code: 'HQ', department_code: 'OPS' }
  });
  assert.equal(status, 403, `expected 403 for out-of-scope seat assignment, got ${status}: ${JSON.stringify(data)}`);
});

test('cross-scope scheduling returns 403', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordToken,
    body: {
      customer_id: 1,
      location_code: 'BRANCH',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: '2027-01-01T10:00:00Z',
      notes: 'cross scope test'
    }
  });
  assert.equal(status, 403, `expected 403 for cross-scope scheduling, got ${status}: ${JSON.stringify(data)}`);
});

test('logout invalidates session token', async () => {
  const adminToken = await loginAdmin();
  const { token } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const logoutRes = await request('/api/auth/logout', { method: 'POST', token });
  assert.equal(logoutRes.status, 200, `logout should return 200, got ${logoutRes.status}: ${JSON.stringify(logoutRes.data)}`);

  // Token should now be invalid
  const afterLogout = await request('/api/auth/me', { token });
  assert.equal(afterLogout.status, 401, `token should be invalid after logout, got ${afterLogout.status}`);
});
