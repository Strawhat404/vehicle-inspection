import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUserAndLogin } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// users.js edge cases
// ---------------------------------------------------------------------------

test('users: PUT /api/users/abc (non-numeric id) returns 400 with invalid id error', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users/abc', {
    method: 'PUT',
    token: adminToken,
    body: { role_name: 'Coordinator' }
  });

  assert.equal(status, 400,
    `expected 400 for non-numeric user id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.match(data.error, /invalid/i, 'error message should mention invalid id');
});

test('users: PUT /api/users/999999 (non-existent id) returns 404 with user not found error', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users/999999', {
    method: 'PUT',
    token: adminToken,
    body: { role_name: 'Coordinator' }
  });

  assert.equal(status, 404,
    `expected 404 for non-existent user id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('users: POST /api/users/1/reset-password with empty body returns 400 (password complexity failure)', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/users/1/reset-password', {
    method: 'POST',
    token: adminToken,
    body: {}
  });

  // Empty body means password is '' which fails complexity validation
  assert.equal(status, 400,
    `expected 400 for empty body on reset-password, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

// ---------------------------------------------------------------------------
// coordinator.js edge cases
// ---------------------------------------------------------------------------

test('coordinator: POST /api/coordinator/appointments/schedule without customer_id returns 400', async () => {
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
      location_code: 'HQ',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  });

  // customer_id is required; handler returns 400 when it is missing
  assert.equal(status, 400,
    `expected 400 for missing customer_id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.match(data.error, /customer_id/i, 'error message must mention customer_id');
});

test('coordinator: POST /api/coordinator/appointments/schedule with missing scheduled_at returns 500 (invalid date throws)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Create a customer to supply a valid customer_id
  const { id: customerId } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordToken,
    body: {
      customer_id: customerId,
      location_code: 'HQ',
      department_code: 'OPS',
      vehicle_type: 'light'
      // scheduled_at intentionally omitted
    }
  });

  // normalizeSlotStart(undefined) -> new Date(undefined) -> NaN -> throws Error('Invalid scheduled_at')
  // The global error handler catches it and returns 500.
  assert.equal(status, 500,
    `expected 500 for missing scheduled_at (throws Invalid scheduled_at), got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
});

test('coordinator: PUT /api/coordinator/waiting-room/seats without seats body field succeeds with empty update (200)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/coordinator/waiting-room/seats', {
    method: 'PUT',
    token: coordToken,
    body: {
      location_code: 'HQ',
      department_code: 'OPS'
      // seats field intentionally omitted
    }
  });

  // The handler defaults seats to [] when body.seats is not an array,
  // then iterates over nothing — upsertSeats succeeds with zero operations.
  assert.equal(status, 200,
    `expected 200 for missing seats field (defaults to empty array), got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.success === true, `response must have success: true, got: ${JSON.stringify(data)}`);
});

// ---------------------------------------------------------------------------
// inspections.js edge cases
// ---------------------------------------------------------------------------

test('inspections: POST /api/inspections/results with missing appointment_id returns 400', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/results', {
    method: 'POST',
    token: inspectorToken,
    body: {
      outcome: 'pass',
      score: 90
    }
  });

  assert.equal(status, 400,
    `expected 400 for missing appointment_id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.match(data.error, /appointment_id/i, 'error message must mention appointment_id');
});

test('inspections: POST /api/inspections/results with non-existent appointment_id returns 404', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/results', {
    method: 'POST',
    token: inspectorToken,
    body: {
      appointment_id: 999999,
      outcome: 'invalid_outcome',
      score: 90
    }
  });

  // Appointment lookup happens before outcome validation;
  // 999999 does not exist so the handler returns 404.
  assert.equal(status, 404,
    `expected 404 for non-existent appointment_id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

// ---------------------------------------------------------------------------
// files.js edge cases
// ---------------------------------------------------------------------------

test('files: GET /api/files/download/abc (non-numeric id) returns 400 with invalid file id error', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/files/download/abc', {
    token: adminToken
  });

  // The route parses the id first; non-numeric fails parseInt -> returns 400 immediately
  // (before the Referer hotlink check)
  assert.equal(status, 400,
    `expected 400 for non-numeric file id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.match(data.error, /invalid/i, 'error message must mention invalid id');
});

// ---------------------------------------------------------------------------
// dashboard.js edge cases
// ---------------------------------------------------------------------------

test('dashboard: GET /api/dashboard/summary with valid admin token returns 200 with numeric metrics', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/dashboard/summary', {
    token: adminToken
  });

  assert.equal(status, 200,
    `expected 200 for admin dashboard summary, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.metrics, `response must include a metrics object: ${JSON.stringify(data)}`);

  const m = data.metrics;
  assert.ok(
    typeof m.todays_appointments === 'number' || typeof m.todays_appointments === 'string',
    `todays_appointments must be numeric: ${JSON.stringify(m)}`
  );
  assert.ok(
    Number.isFinite(Number(m.todays_appointments)),
    `todays_appointments must be a finite number, got: ${m.todays_appointments}`
  );
  assert.ok(
    Number.isFinite(Number(m.upcoming_appointments)),
    `upcoming_appointments must be a finite number, got: ${m.upcoming_appointments}`
  );
  assert.ok(
    Number.isFinite(Number(m.total_inspections)),
    `total_inspections must be a finite number, got: ${m.total_inspections}`
  );
  assert.ok(
    Number.isFinite(Number(m.active_resources)),
    `active_resources must be a finite number, got: ${m.active_resources}`
  );
});
