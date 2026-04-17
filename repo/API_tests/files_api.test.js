import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUserAndLogin, resolveBase } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// Helper: make a raw fetch request with arbitrary extra headers
// ---------------------------------------------------------------------------
async function requestWithHeaders(path, { method = 'GET', token = '', body, extraHeaders = {} } = {}) {
  const base = await resolveBase();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, 'X-CSRF-Token': token } : {}),
      ...extraHeaders
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

// The frontend origin the backend trusts for hotlink protection.
// Matches config.frontend.origin default (FRONTEND_ORIGIN env or 'http://localhost:5173').
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// ---------------------------------------------------------------------------
// 401 unauthenticated on both endpoints
// ---------------------------------------------------------------------------

test('files: unauthenticated POST /api/files/ingest returns 401', async () => {
  const { status, data } = await request('/api/files/ingest', {
    method: 'POST',
    body: {
      source_path: '/data/reports/inspection_001.pdf',
      mime_type: 'application/pdf',
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('files: unauthenticated GET /api/files/download/:id returns 401', async () => {
  const { status, data } = await request('/api/files/download/1');
  assert.equal(status, 401, `expected 401, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

// ---------------------------------------------------------------------------
// POST /api/files/ingest — Coordinator with path outside allowed root → 500
// The service throws 'Source path is outside allowed drop root' which the
// global error handler converts to 500.
// ---------------------------------------------------------------------------

test('files: Coordinator POST /api/files/ingest with path outside allowed root returns exactly 500', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/files/ingest', {
    method: 'POST',
    token: coordToken,
    body: {
      source_path: '/data/reports/inspection_001.pdf',
      mime_type: 'application/pdf',
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });

  assert.equal(status, 500, `expected 500 (path outside drop root), got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

// ---------------------------------------------------------------------------
// POST /api/files/ingest — Coordinator with a nonexistent path within the
// allowed root → service throws 'File not found' → 500
// ---------------------------------------------------------------------------

test('files: Coordinator POST /api/files/ingest with nonexistent path within drop root returns exactly 500', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Use a path that is a child of the default drop root but does not exist on disk.
  // Default dropRoot is /var/roadsafe/dropzone.
  const dropRootChild = '/var/roadsafe/dropzone/no_such_file_xzy.pdf';

  const { status, data } = await request('/api/files/ingest', {
    method: 'POST',
    token: coordToken,
    body: {
      source_path: dropRootChild,
      mime_type: 'application/pdf',
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });

  assert.equal(status, 500, `expected 500 (file not found), got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

// ---------------------------------------------------------------------------
// POST /api/files/ingest — Data Engineer is authorized (not 401/403)
// Path outside root → 500, confirming the role check passes.
// ---------------------------------------------------------------------------

test('files: Data Engineer POST /api/files/ingest is authorized — path outside root returns 500 not 401/403', async () => {
  const adminToken = await loginAdmin();
  const { token: engineerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Data Engineer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/files/ingest', {
    method: 'POST',
    token: engineerToken,
    body: {
      source_path: '/data/nonexistent/report.csv',
      mime_type: 'text/csv',
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });

  assert.ok(
    status !== 401 && status !== 403,
    `Data Engineer must be authorized on /api/files/ingest, got ${status}: ${JSON.stringify(data)}`
  );
  assert.equal(status, 500, `expected 500 (path outside drop root), got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

// ---------------------------------------------------------------------------
// POST /api/files/ingest — Customer gets 403
// ---------------------------------------------------------------------------

test('files: Customer gets 403 on POST /api/files/ingest', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/files/ingest', {
    method: 'POST',
    token: customerToken,
    body: {
      source_path: '/data/reports/inspection_001.pdf',
      mime_type: 'application/pdf',
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });

  assert.equal(status, 403, `expected 403, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

// ---------------------------------------------------------------------------
// GET /api/files/download/:id — non-numeric id returns exactly 400
// ---------------------------------------------------------------------------

test('files: GET /api/files/download/abc returns exactly 400 with Invalid file ID error', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/files/download/abc', { token: adminToken });

  assert.equal(status, 400, `expected 400 for non-numeric id, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  // Route sets: ctx.body = { error: 'Invalid file id' }
  assert.ok(
    data.error.toLowerCase().includes('invalid') && data.error.toLowerCase().includes('file'),
    `error must mention invalid file id, got: '${data.error}'`
  );
});

// ---------------------------------------------------------------------------
// GET /api/files/download/999999 — missing/wrong Referer returns exactly 403
// with hotlink protection message
// ---------------------------------------------------------------------------

test('files: GET /api/files/download/999999 without Referer returns exactly 403 with hotlink error', async () => {
  const adminToken = await loginAdmin();

  // request() helper does not set Referer, so hotlink check fires first
  const { status, data } = await request('/api/files/download/999999', { token: adminToken });

  assert.equal(status, 403, `expected 403 (hotlink protection), got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(
    data.error.toLowerCase().includes('hotlink'),
    `error must mention hotlink, got: '${data.error}'`
  );
});

// ---------------------------------------------------------------------------
// GET /api/files/download/999999 — correct Referer bypasses hotlink check,
// file does not exist → 404
// ---------------------------------------------------------------------------

test('files: GET /api/files/download/999999 with correct Referer returns exactly 404', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await requestWithHeaders('/api/files/download/999999', {
    method: 'GET',
    token: adminToken,
    extraHeaders: { Referer: `${FRONTEND_ORIGIN}/inspections` }
  });

  assert.equal(status, 404, `expected 404 for nonexistent file with valid Referer, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'error response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});
