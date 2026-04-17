import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin } from './helpers/setup.js';

test('users: unauthenticated GET /api/users returns 401', async () => {
  const { status, data } = await request('/api/users?page=1&pageSize=5');
  assert.equal(status, 401, `expected 401 for unauthenticated users list, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('users: unauthenticated GET /api/users/:id returns 401', async () => {
  const { status, data } = await request('/api/users/1');
  assert.equal(status, 401, `expected 401 for unauthenticated user fetch, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
});

test('users: unauthenticated POST /api/users/:id/reset-password returns 401', async () => {
  const { status, data } = await request('/api/users/1/reset-password', {
    method: 'POST',
    body: { password: 'NewPass@123456' }
  });
  assert.equal(status, 401, `expected 401 for unauthenticated reset-password, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
});

test('users: Admin can GET /api/users with pagination - returns rows array and pagination object', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users?page=1&pageSize=10', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for admin users list, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(
    data.pagination || data.total !== undefined || data.totalCount !== undefined,
    `response must have pagination object or total count, got: ${JSON.stringify(data)}`
  );
  if (data.pagination) {
    assert.equal(typeof data.pagination, 'object', 'pagination must be an object');
  }
});

test('users: Admin can GET /api/users/:id - response has user object with required fields', async () => {
  const adminToken = await loginAdmin();

  // Create a user to fetch by ID
  const created = await createUser(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(`/api/users/${created.id}`, {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for admin GET user by id, got ${status}: ${JSON.stringify(data)}`);

  // The response might be the user object directly or nested under a 'user' key
  const user = data.user || data;
  assert.ok(user, 'response must contain user data');
  assert.ok(
    user.username !== undefined,
    `user object must have username field, got: ${JSON.stringify(user)}`
  );
  assert.ok(
    user.role !== undefined || user.role_name !== undefined,
    `user object must have role or role_name field, got: ${JSON.stringify(user)}`
  );
  assert.ok(
    user.location_code !== undefined,
    `user object must have location_code field, got: ${JSON.stringify(user)}`
  );
  assert.ok(
    user.department_code !== undefined,
    `user object must have department_code field, got: ${JSON.stringify(user)}`
  );
  assert.ok(
    user.status !== undefined,
    `user object must have status field, got: ${JSON.stringify(user)}`
  );
});

test('users: GET /api/users/999999 returns 404', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users/999999', {
    token: adminToken
  });

  assert.equal(status, 404, `expected 404 for nonexistent user, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'not found response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('users: Admin can PUT /api/users/:id to update role/location/department/status - returns 200', async () => {
  const adminToken = await loginAdmin();

  const created = await createUser(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(`/api/users/${created.id}`, {
    method: 'PUT',
    token: adminToken,
    body: {
      role_name: 'Coordinator',
      location_code: 'HQ',
      department_code: 'OPS',
      status: 'active'
    }
  });

  assert.equal(status, 200, `expected 200 for admin user update, got ${status}: ${JSON.stringify(data)}`);
});

test('users: Admin can POST /api/users/:id/reset-password with strong password - returns 200', async () => {
  const adminToken = await loginAdmin();

  const created = await createUser(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(`/api/users/${created.id}/reset-password`, {
    method: 'POST',
    token: adminToken,
    body: { password: 'NewStrongPass@7788' }
  });

  assert.equal(status, 200, `expected 200 for admin password reset, got ${status}: ${JSON.stringify(data)}`);
});

test('users: weak password on reset-password returns 400 with error about complexity', async () => {
  const adminToken = await loginAdmin();

  const created = await createUser(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(`/api/users/${created.id}/reset-password`, {
    method: 'POST',
    token: adminToken,
    body: { password: 'weak' }
  });

  assert.equal(status, 400, `expected 400 for weak password reset, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
  // Error should mention something about password complexity (length, characters, etc.)
  const errorText = data.error.toLowerCase();
  const mentionsComplexity =
    errorText.includes('password') ||
    errorText.includes('complex') ||
    errorText.includes('chars') ||
    errorText.includes('length') ||
    errorText.includes('character') ||
    errorText.includes('strong') ||
    errorText.includes('require');
  assert.ok(mentionsComplexity, `error message should mention password complexity, got: "${data.error}"`);
});

test('users: Coordinator gets 403 on GET /api/users (user management endpoints)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/users?page=1&pageSize=5', {
    token: coordToken
  });

  assert.equal(status, 403, `expected 403 for Coordinator on /api/users, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('users: Coordinator gets 403 on GET /api/users/:id', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/users/1', {
    token: coordToken
  });

  assert.equal(status, 403, `expected 403 for Coordinator on /api/users/:id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
});

test('users: Coordinator gets 403 on POST /api/users/:id/reset-password', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/users/1/reset-password', {
    method: 'POST',
    token: coordToken,
    body: { password: 'AnyPass@123456' }
  });

  assert.equal(
    status,
    403,
    `expected 403 for Coordinator on reset-password, got ${status}: ${JSON.stringify(data)}`
  );
  assert.ok(data.error, 'forbidden response must include an error field');
});

test('users: GET /api/users supports filtering by role query param', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users?page=1&pageSize=10&role=Coordinator', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for role-filtered users list, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);

  // All returned rows should match the requested role (if rows exist)
  for (const user of data.rows) {
    const userRole = user.role || user.role_name;
    assert.ok(
      userRole === 'Coordinator' || userRole === undefined,
      `user role should be Coordinator when filtering, got: ${userRole}`
    );
  }
});

test('users: GET /api/users with status=Active filter returns only active users', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users?page=1&pageSize=25&status=Active', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for status-filtered users list, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);
  assert.equal(typeof data.pagination.page, 'number', 'pagination.page must be a number');
  assert.equal(typeof data.pagination.pageSize, 'number', 'pagination.pageSize must be a number');
  assert.equal(typeof data.pagination.total, 'number', 'pagination.total must be a number');
  assert.equal(typeof data.pagination.totalPages, 'number', 'pagination.totalPages must be a number');

  // All returned users must be active
  for (const user of data.rows) {
    assert.equal(
      user.status,
      'Active',
      `status filter must only return Active users, got status="${user.status}" for user id=${user.id}`
    );
    assert.equal(
      user.is_active,
      true,
      `is_active must be true for Active users, got is_active=${user.is_active} for user id=${user.id}`
    );
  }
});

test('users: GET /api/users with combined role + location filters narrows results correctly', async () => {
  const adminToken = await loginAdmin();

  // Create a Coordinator at a known location to ensure at least one match
  await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/users?page=1&pageSize=25&role=Coordinator&location=HQ', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for combined filter, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);

  for (const user of data.rows) {
    const userRole = user.role || user.role_name;
    assert.equal(userRole, 'Coordinator', `combined filter must return Coordinators only, got: ${userRole}`);
    assert.equal(
      user.location_code,
      'HQ',
      `combined filter must return HQ users only, got location_code=${user.location_code}`
    );
  }
});

test('users: GET /api/users with pageSize > 100 caps at 100', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users?page=1&pageSize=999', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for oversized pageSize, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);
  assert.ok(
    data.pagination.pageSize <= 100,
    `pageSize must be capped at 100, got: ${data.pagination.pageSize}`
  );
});

test('users: PUT self-deactivation blocked — admin updating own account to Inactive returns 400', async () => {
  const adminToken = await loginAdmin();

  // Fetch the admin user's own id via /api/users with username filter
  const listRes = await request('/api/users?page=1&pageSize=5&q=admin', { token: adminToken });
  assert.equal(listRes.status, 200, `could not list users: ${listRes.status}`);
  const adminUser = (listRes.data.rows || []).find((u) => u.username === 'admin');
  assert.ok(adminUser, 'admin user must be found in the user list');

  const { status, data } = await request(`/api/users/${adminUser.id}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Inactive' }
  });

  assert.equal(
    status,
    400,
    `self-deactivation must return 400, got ${status}: ${JSON.stringify(data)}`
  );
  assert.ok(data.error, 'response must include an error field');
  assert.ok(
    data.error.toLowerCase().includes('deactivat') || data.error.toLowerCase().includes('own') || data.error.toLowerCase().includes('administrator'),
    `error message should mention self-deactivation restriction, got: "${data.error}"`
  );
});

test('users: PUT no-op update (same values) returns { success: true, updated: false }', async () => {
  const adminToken = await loginAdmin();

  const created = await createUser(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Send the exact same role/location/department — no actual change
  const { status, data } = await request(`/api/users/${created.id}`, {
    method: 'PUT',
    token: adminToken,
    body: {
      role_name: 'Inspector',
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });

  assert.equal(status, 200, `no-op update must return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.equal(data.success, true, `no-op update response must have success: true, got: ${JSON.stringify(data)}`);
  assert.equal(data.updated, false, `no-op update response must have updated: false, got: ${JSON.stringify(data)}`);
  assert.ok(data.user, `no-op update response must include user object, got: ${JSON.stringify(data)}`);
});

test('users: POST /api/users/:id/reset-password on nonexistent user returns 404', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users/999999/reset-password', {
    method: 'POST',
    token: adminToken,
    body: { password: 'NewStrongPass@7788' }
  });

  assert.equal(status, 404, `expected 404 for reset-password on nonexistent user, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'not-found response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('users: POST reset-password then login with new password succeeds', async () => {
  const adminToken = await loginAdmin();

  const created = await createUser(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const newPassword = 'ResetVerify@9912';

  const { status: resetStatus, data: resetData } = await request(
    `/api/users/${created.id}/reset-password`,
    {
      method: 'POST',
      token: adminToken,
      body: { password: newPassword }
    }
  );

  assert.equal(
    resetStatus,
    200,
    `reset-password must return 200, got ${resetStatus}: ${JSON.stringify(resetData)}`
  );
  assert.equal(resetData.success, true, `reset-password response must have success: true, got: ${JSON.stringify(resetData)}`);

  // Login with the new password must succeed
  const { status: loginStatus, data: loginData } = await request('/api/auth/login', {
    method: 'POST',
    body: { username: created.username, password: newPassword }
  });

  assert.equal(
    loginStatus,
    200,
    `login after password reset must succeed with 200, got ${loginStatus}: ${JSON.stringify(loginData)}`
  );
  assert.ok(loginData.token, `login after password reset must return a token, got: ${JSON.stringify(loginData)}`);
  assert.equal(typeof loginData.token, 'string', 'returned token must be a string');
  assert.ok(loginData.token.length > 0, 'returned token must not be empty');
});
