import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUserAndLogin } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// 401 unauthenticated
// ---------------------------------------------------------------------------

test('compliance: unauthenticated POST /api/compliance/account-closure returns 401', async () => {
  const { status, data } = await request('/api/compliance/account-closure', { method: 'POST' });
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('compliance: unauthenticated POST /api/compliance/retention/run returns 401', async () => {
  const { status, data } = await request('/api/compliance/retention/run', { method: 'POST' });
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

// ---------------------------------------------------------------------------
// POST /api/compliance/account-closure
// The route always responds 201 { requestId }. If a pending request already
// exists for the user, the service returns the existing row's id — so a
// duplicate call is idempotent at 201 (no 409 is produced).
// ---------------------------------------------------------------------------

test('compliance: fresh Customer POST /api/compliance/account-closure returns exactly 201 with numeric requestId', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/compliance/account-closure', {
    method: 'POST',
    token: customerToken
  });

  assert.equal(status, 201, `expected 201, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'requestId'),
    `response must have requestId field, got: ${JSON.stringify(data)}`
  );
  assert.equal(typeof data.requestId, 'number', `requestId must be a number, got ${typeof data.requestId}: ${JSON.stringify(data)}`);
  assert.ok(data.requestId > 0, `requestId must be a positive number, got ${data.requestId}`);
});

test('compliance: duplicate account-closure for same customer returns 201 with same requestId (idempotent)', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // First request — creates the pending closure
  const first = await request('/api/compliance/account-closure', {
    method: 'POST',
    token: customerToken
  });
  assert.equal(first.status, 201, `first request expected 201, got ${first.status}: ${JSON.stringify(first.data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(first.data, 'requestId'),
    `first response must have requestId, got: ${JSON.stringify(first.data)}`
  );
  assert.equal(typeof first.data.requestId, 'number', `first requestId must be a number`);
  const firstId = first.data.requestId;

  // Second request — pending already exists, service returns existing id
  const second = await request('/api/compliance/account-closure', {
    method: 'POST',
    token: customerToken
  });
  assert.equal(second.status, 201, `duplicate request expected 201 (idempotent), got ${second.status}: ${JSON.stringify(second.data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(second.data, 'requestId'),
    `duplicate response must have requestId, got: ${JSON.stringify(second.data)}`
  );
  assert.equal(typeof second.data.requestId, 'number', `duplicate requestId must be a number`);
  assert.equal(
    second.data.requestId,
    firstId,
    `duplicate closure must return the same requestId (${firstId}), got ${second.data.requestId}`
  );
});

// ---------------------------------------------------------------------------
// POST /api/compliance/retention/run — Admin
// Returns 200 { tombstonedReports: number, completedClosures: number }
// ---------------------------------------------------------------------------

test('compliance: Admin POST /api/compliance/retention/run returns exactly 200 with tombstonedReports and completedClosures', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/compliance/retention/run', {
    method: 'POST',
    token: adminToken
  });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'tombstonedReports'),
    `response must have tombstonedReports field, got: ${JSON.stringify(data)}`
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'completedClosures'),
    `response must have completedClosures field, got: ${JSON.stringify(data)}`
  );
  assert.equal(typeof data.tombstonedReports, 'number', `tombstonedReports must be a number, got ${typeof data.tombstonedReports}`);
  assert.equal(typeof data.completedClosures, 'number', `completedClosures must be a number, got ${typeof data.completedClosures}`);
  assert.ok(data.tombstonedReports >= 0, `tombstonedReports must be >= 0, got ${data.tombstonedReports}`);
  assert.ok(data.completedClosures >= 0, `completedClosures must be >= 0, got ${data.completedClosures}`);
});

// ---------------------------------------------------------------------------
// POST /api/compliance/retention/run — Data Engineer
// ---------------------------------------------------------------------------

test('compliance: Data Engineer POST /api/compliance/retention/run returns 200', async () => {
  const adminToken = await loginAdmin();
  const { token: engineerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Data Engineer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/compliance/retention/run', {
    method: 'POST',
    token: engineerToken
  });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'tombstonedReports'),
    `response must have tombstonedReports field, got: ${JSON.stringify(data)}`
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'completedClosures'),
    `response must have completedClosures field, got: ${JSON.stringify(data)}`
  );
  assert.equal(typeof data.tombstonedReports, 'number', `tombstonedReports must be a number`);
  assert.equal(typeof data.completedClosures, 'number', `completedClosures must be a number`);
  assert.ok(data.tombstonedReports >= 0, `tombstonedReports must be >= 0`);
  assert.ok(data.completedClosures >= 0, `completedClosures must be >= 0`);
});

// ---------------------------------------------------------------------------
// Role 403 checks on retention/run
// ---------------------------------------------------------------------------

test('compliance: Customer gets 403 on POST /api/compliance/retention/run', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/compliance/retention/run', {
    method: 'POST',
    token: customerToken
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('compliance: Coordinator gets 403 on POST /api/compliance/retention/run', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/compliance/retention/run', {
    method: 'POST',
    token: coordToken
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('compliance: Inspector gets 403 on POST /api/compliance/retention/run', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/compliance/retention/run', {
    method: 'POST',
    token: inspectorToken
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});
