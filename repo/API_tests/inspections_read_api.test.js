import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUserAndLogin } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// 401 unauthenticated on all three endpoints
// ---------------------------------------------------------------------------

test('inspections: unauthenticated GET /api/inspections/queue returns 401', async () => {
  const { status, data } = await request('/api/inspections/queue');
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('inspections: unauthenticated GET /api/inspections/results/me returns 401', async () => {
  const { status, data } = await request('/api/inspections/results/me');
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('inspections: unauthenticated GET /api/inspections/customer/reports returns 401', async () => {
  const { status, data } = await request('/api/inspections/customer/reports');
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

// ---------------------------------------------------------------------------
// GET /api/inspections/queue — Inspector
// ---------------------------------------------------------------------------

test('inspections: Inspector GET /api/inspections/queue returns 200 with rows array', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/queue', { token: inspectorToken });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Object.prototype.hasOwnProperty.call(data, 'rows'), `response must have rows property, got: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `rows must be an array, got: ${JSON.stringify(data.rows)}`);
});

test('inspections: Inspector queue row schema when rows exist', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/queue', { token: inspectorToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'rows must be an array');

  if (data.rows.length > 0) {
    const row = data.rows[0];
    const requiredFields = [
      'id', 'customer_id', 'scheduled_at', 'status', 'notes',
      'location_code', 'department_code', 'plate_number', 'brand', 'model_name', 'model_year'
    ];
    for (const field of requiredFields) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(row, field),
        `queue row must have field '${field}', got: ${JSON.stringify(row)}`
      );
    }
    assert.equal(typeof row.id, 'number', `row.id must be a number, got ${typeof row.id}`);
    assert.equal(typeof row.scheduled_at, 'string', `row.scheduled_at must be a string, got ${typeof row.scheduled_at}`);
    assert.equal(typeof row.status, 'string', `row.status must be a string, got ${typeof row.status}`);
  }
});

// ---------------------------------------------------------------------------
// GET /api/inspections/queue — Admin with inspector_id query param
// ---------------------------------------------------------------------------

test('inspections: Admin GET /api/inspections/queue returns 200 with rows array', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/inspections/queue', { token: adminToken });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Object.prototype.hasOwnProperty.call(data, 'rows'), `response must have rows property, got: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `rows must be an array, got: ${JSON.stringify(data.rows)}`);
});

test('inspections: Admin GET /api/inspections/queue with inspector_id query param returns 200', async () => {
  const adminToken = await loginAdmin();
  const inspector = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(
    `/api/inspections/queue?inspector_id=${inspector.id}`,
    { token: adminToken }
  );

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `rows must be an array, got: ${JSON.stringify(data)}`);
});

// ---------------------------------------------------------------------------
// GET /api/inspections/results/me — Inspector
// ---------------------------------------------------------------------------

test('inspections: Inspector GET /api/inspections/results/me returns 200 with rows array', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/results/me', { token: inspectorToken });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Object.prototype.hasOwnProperty.call(data, 'rows'), `response must have rows property, got: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `rows must be an array, got: ${JSON.stringify(data.rows)}`);
});

test('inspections: Inspector results/me row schema when rows exist', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/results/me', { token: inspectorToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'rows must be an array');

  if (data.rows.length > 0) {
    const row = data.rows[0];
    const requiredFields = ['id', 'appointment_id', 'outcome', 'score', 'findings', 'completed_at'];
    for (const field of requiredFields) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(row, field),
        `results row must have field '${field}', got: ${JSON.stringify(row)}`
      );
    }
    assert.equal(typeof row.id, 'number', `row.id must be a number, got ${typeof row.id}`);
    assert.equal(typeof row.appointment_id, 'number', `row.appointment_id must be a number, got ${typeof row.appointment_id}`);
    assert.equal(typeof row.outcome, 'string', `row.outcome must be a string, got ${typeof row.outcome}`);
  }
});

// ---------------------------------------------------------------------------
// GET /api/inspections/results/me — Admin with inspector_id query param
// ---------------------------------------------------------------------------

test('inspections: Admin GET /api/inspections/results/me with inspector_id param returns 200', async () => {
  const adminToken = await loginAdmin();
  const inspector = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(
    `/api/inspections/results/me?inspector_id=${inspector.id}`,
    { token: adminToken }
  );

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `rows must be an array, got: ${JSON.stringify(data)}`);
});

// ---------------------------------------------------------------------------
// GET /api/inspections/customer/reports — Customer
// ---------------------------------------------------------------------------

test('inspections: Customer GET /api/inspections/customer/reports returns 200 with rows array', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/customer/reports', { token: customerToken });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Object.prototype.hasOwnProperty.call(data, 'rows'), `response must have rows property, got: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `rows must be an array, got: ${JSON.stringify(data.rows)}`);
});

test('inspections: customer/reports row schema when rows exist', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/customer/reports', { token: customerToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'rows must be an array');

  if (data.rows.length > 0) {
    const row = data.rows[0];
    const requiredFields = [
      'report_id', 'appointment_id', 'outcome', 'score', 'findings',
      'completed_at', 'plate_number', 'brand', 'model_name', 'model_year'
    ];
    for (const field of requiredFields) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(row, field),
        `customer report row must have field '${field}', got: ${JSON.stringify(row)}`
      );
    }
    assert.equal(typeof row.report_id, 'number', `row.report_id must be a number, got ${typeof row.report_id}`);
    assert.equal(typeof row.appointment_id, 'number', `row.appointment_id must be a number, got ${typeof row.appointment_id}`);
    assert.equal(typeof row.outcome, 'string', `row.outcome must be a string, got ${typeof row.outcome}`);
  }
});

// ---------------------------------------------------------------------------
// GET /api/inspections/customer/reports — Admin with customer_id
// ---------------------------------------------------------------------------

test('inspections: Admin GET /api/inspections/customer/reports with customer_id param returns 200', async () => {
  const adminToken = await loginAdmin();
  const customer = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request(
    `/api/inspections/customer/reports?customer_id=${customer.id}`,
    { token: adminToken }
  );

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `rows must be an array, got: ${JSON.stringify(data)}`);
});

// ---------------------------------------------------------------------------
// GET /api/inspections/customer/reports — Admin WITHOUT customer_id returns 400
// ---------------------------------------------------------------------------

test('inspections: Admin GET /api/inspections/customer/reports without customer_id returns exactly 400', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/inspections/customer/reports', { token: adminToken });

  assert.equal(status, 400, `expected exactly 400, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.equal(data.error, 'customer_id is required', `expected error 'customer_id is required', got: '${data.error}'`);
});

// ---------------------------------------------------------------------------
// Role 403 checks
// ---------------------------------------------------------------------------

test('inspections: Coordinator gets 403 on GET /api/inspections/queue', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/queue', { token: coordToken });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('inspections: Inspector gets 403 on GET /api/inspections/customer/reports', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/inspections/customer/reports', { token: inspectorToken });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});
