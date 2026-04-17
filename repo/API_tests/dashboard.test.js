import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// GET /api/dashboard/summary
// Response shape: {
//   metrics: { todays_appointments, upcoming_appointments, total_inspections,
//               active_resources, ingestion_running, ingestion_failed },
//   todaysAppointments: [...],
//   resourceUtilization: {...},
//   ingestionHealth: {...}
// }
// ---------------------------------------------------------------------------

test('dashboard summary: admin receives 200 with all metrics keys as numbers', async () => {
  const adminToken = await loginAdmin();
  const { status, data } = await request('/api/dashboard/summary', { token: adminToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);

  assert.ok(data.metrics, 'response must have a metrics object');
  assert.equal(typeof data.metrics, 'object', 'metrics must be an object');

  const requiredKeys = [
    'todays_appointments',
    'upcoming_appointments',
    'total_inspections',
    'active_resources',
    'ingestion_running',
    'ingestion_failed'
  ];
  for (const key of requiredKeys) {
    assert.ok(key in data.metrics, `metrics must include key: ${key}`);
    assert.equal(typeof data.metrics[key], 'number', `metrics.${key} must be a number, got ${typeof data.metrics[key]}`);
  }

  assert.ok('todaysAppointments' in data, 'response must include todaysAppointments');
  assert.ok(Array.isArray(data.todaysAppointments), 'todaysAppointments must be an array');
  assert.ok('resourceUtilization' in data, 'response must include resourceUtilization');
  assert.equal(typeof data.resourceUtilization, 'object', 'resourceUtilization must be an object');
  assert.ok('ingestionHealth' in data, 'response must include ingestionHealth');
  assert.equal(typeof data.ingestionHealth, 'object', 'ingestionHealth must be an object');
});

test('dashboard summary: coordinator receives 200 with metrics present and values are numbers', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/dashboard/summary', { token: coordToken });
  assert.equal(status, 200, `expected 200 for coordinator, got ${status}: ${JSON.stringify(data)}`);

  assert.ok(data.metrics, 'coordinator response must have a metrics object');
  assert.equal(typeof data.metrics, 'object', 'metrics must be an object');

  const requiredKeys = [
    'todays_appointments',
    'upcoming_appointments',
    'total_inspections',
    'active_resources',
    'ingestion_running',
    'ingestion_failed'
  ];
  for (const key of requiredKeys) {
    assert.ok(key in data.metrics, `coordinator metrics must include key: ${key}`);
    assert.equal(
      typeof data.metrics[key],
      'number',
      `coordinator metrics.${key} must be a number, got ${typeof data.metrics[key]}`
    );
  }
});

test('dashboard summary: coordinator cross-scope with ?location=BRANCH returns 403', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/dashboard/summary?location=BRANCH', {
    token: coordToken
  });
  assert.equal(status, 403, `expected 403 for cross-scope summary, got ${status}: ${JSON.stringify(data)}`);
});

test('dashboard summary: unauthenticated returns 401', async () => {
  const { status } = await request('/api/dashboard/summary');
  assert.equal(status, 401, `expected 401 for unauthenticated summary, got ${status}`);
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/coordinator-view
// Response shape: { seats: [...], bayUtilization: [...] }
// ---------------------------------------------------------------------------

test('dashboard coordinator-view: admin receives 200 with seats array and bayUtilization', async () => {
  const adminToken = await loginAdmin();
  const { status, data } = await request('/api/dashboard/coordinator-view', { token: adminToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);

  assert.ok('seats' in data, 'response must have a seats field');
  assert.ok(Array.isArray(data.seats), 'seats must be an array');

  assert.ok('bayUtilization' in data, 'response must have a bayUtilization field');
  assert.ok(Array.isArray(data.bayUtilization), 'bayUtilization must be an array');
});

test('dashboard coordinator-view: unauthenticated returns 401', async () => {
  const { status } = await request('/api/dashboard/coordinator-view');
  assert.equal(status, 401, `expected 401 for unauthenticated coordinator-view, got ${status}`);
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/ingestion-health
// Response shape: { statuses: [{ status, count }, ...], jobs: [...], alerts: [...] }
// ---------------------------------------------------------------------------

test('dashboard ingestion-health: admin receives 200 with statuses array where each item has status and count', async () => {
  const adminToken = await loginAdmin();
  const { status, data } = await request('/api/dashboard/ingestion-health', { token: adminToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);

  assert.ok('statuses' in data, 'response must have a statuses field');
  assert.ok(Array.isArray(data.statuses), 'statuses must be an array');

  for (const item of data.statuses) {
    assert.ok('status' in item, `each status entry must have a status field, got: ${JSON.stringify(item)}`);
    assert.ok('count' in item, `each status entry must have a count field, got: ${JSON.stringify(item)}`);
  }
});

test('dashboard ingestion-health: unauthenticated returns 401', async () => {
  const { status } = await request('/api/dashboard/ingestion-health');
  assert.equal(status, 401, `expected 401 for unauthenticated ingestion-health, got ${status}`);
});
