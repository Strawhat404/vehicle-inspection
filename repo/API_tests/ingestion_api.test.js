import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUserAndLogin } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// 401 unauthenticated on all endpoints
// ---------------------------------------------------------------------------

test('ingestion: unauthenticated POST /api/ingestion/jobs returns 401', async () => {
  const { status, data } = await request('/api/ingestion/jobs', {
    method: 'POST',
    body: { source_system: 'csv', job_type: 'csv_import', payload: { priority: 10 } }
  });
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('ingestion: unauthenticated POST /api/ingestion/run-once returns 401', async () => {
  const { status, data } = await request('/api/ingestion/run-once', { method: 'POST' });
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('ingestion: unauthenticated GET /api/ingestion/jobs/:id returns 401', async () => {
  const { status, data } = await request('/api/ingestion/jobs/1');
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('ingestion: unauthenticated POST /api/ingestion/drop-scan returns 401', async () => {
  const { status, data } = await request('/api/ingestion/drop-scan', { method: 'POST' });
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

// ---------------------------------------------------------------------------
// POST /api/ingestion/jobs — returns 201 { jobId: number }
// ---------------------------------------------------------------------------

test('ingestion: Admin POST /api/ingestion/jobs with valid payload returns 201 with numeric jobId', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/ingestion/jobs', {
    method: 'POST',
    token: adminToken,
    body: { source_system: 'csv', job_type: 'csv_import', payload: { priority: 10 } }
  });

  assert.equal(status, 201, `expected 201, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'jobId'),
    `response must have jobId field, got: ${JSON.stringify(data)}`
  );
  assert.equal(typeof data.jobId, 'number', `jobId must be a number, got ${typeof data.jobId}: ${JSON.stringify(data)}`);
  assert.ok(data.jobId > 0, `jobId must be a positive number, got ${data.jobId}`);
});

test('ingestion: Data Engineer POST /api/ingestion/jobs returns 201 with numeric jobId', async () => {
  const adminToken = await loginAdmin();
  const { token: deToken } = await createUserAndLogin(adminToken, {
    role_name: 'Data Engineer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/ingestion/jobs', {
    method: 'POST',
    token: deToken,
    body: { source_system: 'csv', job_type: 'csv_import', payload: { priority: 10 } }
  });

  assert.equal(status, 201, `expected 201, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'jobId'),
    `response must have jobId field, got: ${JSON.stringify(data)}`
  );
  assert.equal(typeof data.jobId, 'number', `jobId must be a number, got ${typeof data.jobId}`);
  assert.ok(data.jobId > 0, `jobId must be a positive number, got ${data.jobId}`);
});

// ---------------------------------------------------------------------------
// POST /api/ingestion/run-once — returns 200 { processed: boolean, ... }
// ---------------------------------------------------------------------------

test('ingestion: Admin POST /api/ingestion/run-once returns 200 with processed field', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/ingestion/run-once', {
    method: 'POST',
    token: adminToken
  });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'processed'),
    `response must have processed field, got: ${JSON.stringify(data)}`
  );
});

// ---------------------------------------------------------------------------
// GET /api/ingestion/jobs/:id — returns 200 { job: {...}, checkpoints: [...] }
// ---------------------------------------------------------------------------

test('ingestion: Data Engineer GET /api/ingestion/jobs/:id returns 200 with job.status and checkpoints array', async () => {
  const adminToken = await loginAdmin();
  const { token: deToken } = await createUserAndLogin(adminToken, {
    role_name: 'Data Engineer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Create a job first to get a real id
  const createRes = await request('/api/ingestion/jobs', {
    method: 'POST',
    token: adminToken,
    body: { source_system: 'csv', job_type: 'csv_import', payload: { priority: 5 } }
  });
  assert.equal(createRes.status, 201, `setup: could not create job, got ${createRes.status}: ${JSON.stringify(createRes.data)}`);
  const jobId = createRes.data.jobId;
  assert.ok(jobId, `setup: jobId missing from create response: ${JSON.stringify(createRes.data)}`);

  const { status, data } = await request(`/api/ingestion/jobs/${jobId}`, { token: deToken });

  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'job'),
    `response must have job field, got: ${JSON.stringify(data)}`
  );
  assert.ok(data.job && typeof data.job === 'object', `job must be an object, got: ${JSON.stringify(data.job)}`);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data.job, 'status'),
    `job object must have status field, got: ${JSON.stringify(data.job)}`
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'checkpoints'),
    `response must have checkpoints field, got: ${JSON.stringify(data)}`
  );
  assert.ok(Array.isArray(data.checkpoints), `checkpoints must be an array, got: ${JSON.stringify(data.checkpoints)}`);
});

// ---------------------------------------------------------------------------
// GET /api/ingestion/jobs/999999 — returns 404
// ---------------------------------------------------------------------------

test('ingestion: GET /api/ingestion/jobs/999999 returns 404', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/ingestion/jobs/999999', { token: adminToken });

  assert.equal(status, 404, `expected 404 for non-existent job, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

// ---------------------------------------------------------------------------
// POST /api/ingestion/drop-scan — 500 when drop root directory is missing
// The config default is /var/roadsafe/dropzone which does not exist on disk
// outside Docker, so fs.readdirSync throws ENOENT → global error handler → 500
// ---------------------------------------------------------------------------

test('ingestion: Admin POST /api/ingestion/drop-scan without real directory returns exactly 500', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/ingestion/drop-scan', {
    method: 'POST',
    token: adminToken
  });

  assert.equal(status, 500, `expected exactly 500 (ENOENT for missing drop root), got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

// ---------------------------------------------------------------------------
// Role 403 checks — Coordinator blocked from all endpoints
// ---------------------------------------------------------------------------

test('ingestion: Coordinator gets 403 on POST /api/ingestion/jobs', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/ingestion/jobs', {
    method: 'POST',
    token: coordToken,
    body: { source_system: 'csv', job_type: 'csv_import', payload: { priority: 10 } }
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('ingestion: Coordinator gets 403 on POST /api/ingestion/run-once', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/ingestion/run-once', {
    method: 'POST',
    token: coordToken
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('ingestion: Coordinator gets 403 on GET /api/ingestion/jobs/:id', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/ingestion/jobs/1', { token: coordToken });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('ingestion: Coordinator gets 403 on POST /api/ingestion/drop-scan', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/ingestion/drop-scan', {
    method: 'POST',
    token: coordToken
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

// ---------------------------------------------------------------------------
// Role 403 check — Customer blocked from POST /api/ingestion/jobs
// ---------------------------------------------------------------------------

test('ingestion: Customer gets 403 on POST /api/ingestion/jobs', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/ingestion/jobs', {
    method: 'POST',
    token: customerToken,
    body: { source_system: 'csv', job_type: 'csv_import', payload: { priority: 10 } }
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});
