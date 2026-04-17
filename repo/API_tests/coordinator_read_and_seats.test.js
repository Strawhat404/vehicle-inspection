import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// GET /api/coordinator/bay-utilization
// ---------------------------------------------------------------------------

test('bay-utilization: coordinator success 200 with { rows } array', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/bay-utilization', { token: coordToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('rows' in data, 'response must have a rows field');
  assert.ok(Array.isArray(data.rows), 'rows must be an array');
});

test('bay-utilization: admin success 200 with explicit location/department params', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request(
    '/api/coordinator/bay-utilization?location=HQ&department=OPS',
    { token: adminToken }
  );
  assert.equal(status, 200, `expected 200 for admin, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('rows' in data, 'response must have a rows field');
  assert.ok(Array.isArray(data.rows), 'rows must be an array');
});

test('bay-utilization: unauthenticated returns 401', async () => {
  const { status } = await request('/api/coordinator/bay-utilization');
  assert.equal(status, 401, `expected 401 for unauthenticated, got ${status}`);
});

test('bay-utilization: cross-scope coordinator with location=BRANCH returns 403', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(
    '/api/coordinator/bay-utilization?location=BRANCH',
    { token: coordToken }
  );
  assert.equal(status, 403, `expected 403 for cross-scope, got ${status}: ${JSON.stringify(data)}`);
});

// ---------------------------------------------------------------------------
// GET /api/coordinator/waiting-room/seats
// ---------------------------------------------------------------------------

test('waiting-room/seats GET: coordinator success 200 with { seats } array', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/waiting-room/seats', { token: coordToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('seats' in data, 'response must have a seats field');
  assert.ok(Array.isArray(data.seats), 'seats must be an array');
});

test('waiting-room/seats GET: admin success 200 with { seats } array', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/coordinator/waiting-room/seats', { token: adminToken });
  assert.equal(status, 200, `expected 200 for admin, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('seats' in data, 'response must have a seats field');
  assert.ok(Array.isArray(data.seats), 'seats must be an array');
});

test('waiting-room/seats GET: unauthenticated returns 401', async () => {
  const { status } = await request('/api/coordinator/waiting-room/seats');
  assert.equal(status, 401, `expected 401 for unauthenticated, got ${status}`);
});

test('waiting-room/seats GET: cross-scope coordinator with location=BRANCH returns 403', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(
    '/api/coordinator/waiting-room/seats?location=BRANCH',
    { token: coordToken }
  );
  assert.equal(status, 403, `expected 403 for cross-scope, got ${status}: ${JSON.stringify(data)}`);
});

// ---------------------------------------------------------------------------
// PUT /api/coordinator/waiting-room/seats
// ---------------------------------------------------------------------------

test('waiting-room/seats PUT: coordinator with valid payload returns exactly { success: true }', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const payload = {
    location_code: 'HQ',
    department_code: 'OPS',
    seats: [{ seat_label: 'T1', x_pos: 0, y_pos: 0 }]
  };

  const { status, data } = await request('/api/coordinator/waiting-room/seats', {
    method: 'PUT',
    token: coordToken,
    body: payload
  });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.deepEqual(data, { success: true }, `expected exactly { success: true }, got ${JSON.stringify(data)}`);
});

test('waiting-room/seats PUT: empty seats array returns { success: true } (not 400)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const payload = {
    location_code: 'HQ',
    department_code: 'OPS',
    seats: []
  };

  const { status, data } = await request('/api/coordinator/waiting-room/seats', {
    method: 'PUT',
    token: coordToken,
    body: payload
  });
  assert.equal(status, 200, `expected 200 for empty seats array, got ${status}: ${JSON.stringify(data)}`);
  assert.deepEqual(data, { success: true }, `expected exactly { success: true }, got ${JSON.stringify(data)}`);
});

test('waiting-room/seats PUT: Customer gets 403', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const payload = {
    location_code: 'HQ',
    department_code: 'OPS',
    seats: [{ seat_label: 'T1', x_pos: 0, y_pos: 0 }]
  };

  const { status, data } = await request('/api/coordinator/waiting-room/seats', {
    method: 'PUT',
    token: customerToken,
    body: payload
  });
  assert.equal(status, 403, `expected 403 for Customer, got ${status}: ${JSON.stringify(data)}`);
});

test('waiting-room/seats PUT: cross-scope coordinator (location_code BRANCH) returns 403', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const payload = {
    location_code: 'BRANCH',
    department_code: 'OPS',
    seats: [{ seat_label: 'T1', x_pos: 0, y_pos: 0 }]
  };

  const { status, data } = await request('/api/coordinator/waiting-room/seats', {
    method: 'PUT',
    token: coordToken,
    body: payload
  });
  assert.equal(status, 403, `expected 403 for cross-scope, got ${status}: ${JSON.stringify(data)}`);
});

test('waiting-room/seats PUT: unauthenticated returns 401', async () => {
  const payload = {
    location_code: 'HQ',
    department_code: 'OPS',
    seats: [{ seat_label: 'T1', x_pos: 0, y_pos: 0 }]
  };
  const { status } = await request('/api/coordinator/waiting-room/seats', {
    method: 'PUT',
    body: payload
  });
  assert.equal(status, 401, `expected 401 for unauthenticated, got ${status}`);
});

// ---------------------------------------------------------------------------
// GET /api/coordinator/open-appointments
// ---------------------------------------------------------------------------

test('open-appointments: coordinator 200 with { appointments } array', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/open-appointments', { token: coordToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('appointments' in data, 'response must have an appointments field');
  assert.ok(Array.isArray(data.appointments), 'appointments must be an array');
});

test('open-appointments: unauthenticated returns 401', async () => {
  const { status } = await request('/api/coordinator/open-appointments');
  assert.equal(status, 401, `expected 401 for unauthenticated, got ${status}`);
});

// ---------------------------------------------------------------------------
// GET /api/coordinator/maintenance-windows
// ---------------------------------------------------------------------------

test('maintenance-windows: coordinator 200 with { windows } array', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/maintenance-windows', { token: coordToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('windows' in data, 'response must have a windows field');
  assert.ok(Array.isArray(data.windows), 'windows must be an array');
});

test('maintenance-windows: unauthenticated returns 401', async () => {
  const { status } = await request('/api/coordinator/maintenance-windows');
  assert.equal(status, 401, `expected 401 for unauthenticated, got ${status}`);
});
