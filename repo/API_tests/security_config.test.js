import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin } from './helpers/setup.js';

// ---------------------------------------------------------------------------
// GET /api/security/config
// Actual response shape (top-level, no wrapping .config):
// {
//   tls:              { enabled: bool, certPath: str, keyPath: str, note: str },
//   encryptionAtRest: { algorithm: 'AES-256', placeholderConfigured: bool, note: str },
//   rateLimits:       { ipPerMinute: number, userPerMinute: number }
// }
// ---------------------------------------------------------------------------

test('security_config: admin receives 200 with top-level keys tls, encryptionAtRest, rateLimits', async () => {
  const adminToken = await loginAdmin();
  const { status, data } = await request('/api/security/config', { token: adminToken });
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);

  assert.ok('tls' in data, 'response must have a top-level tls key');
  assert.ok('encryptionAtRest' in data, 'response must have a top-level encryptionAtRest key');
  assert.ok('rateLimits' in data, 'response must have a top-level rateLimits key');

  // tls shape
  assert.equal(typeof data.tls, 'object', 'tls must be an object');
  assert.equal(typeof data.tls.enabled, 'boolean', 'tls.enabled must be a boolean');

  // encryptionAtRest shape
  assert.equal(typeof data.encryptionAtRest, 'object', 'encryptionAtRest must be an object');
  assert.equal(data.encryptionAtRest.algorithm, 'AES-256', `encryptionAtRest.algorithm must be 'AES-256', got '${data.encryptionAtRest.algorithm}'`);

  // rateLimits shape
  assert.equal(typeof data.rateLimits, 'object', 'rateLimits must be an object');
  assert.equal(typeof data.rateLimits.ipPerMinute, 'number', 'rateLimits.ipPerMinute must be a number');
  assert.equal(typeof data.rateLimits.userPerMinute, 'number', 'rateLimits.userPerMinute must be a number');
});

test('security_config: Data Engineer receives 200', async () => {
  const adminToken = await loginAdmin();
  const { token: deToken } = await createUserAndLogin(adminToken, {
    role_name: 'Data Engineer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/security/config', { token: deToken });
  assert.equal(status, 200, `expected 200 for Data Engineer, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('tls' in data, 'Data Engineer response must have a top-level tls key');
  assert.ok('encryptionAtRest' in data, 'Data Engineer response must have a top-level encryptionAtRest key');
  assert.ok('rateLimits' in data, 'Data Engineer response must have a top-level rateLimits key');
});

test('security_config: Coordinator receives 403 (not in allowed roles)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/security/config', { token: coordToken });
  assert.equal(status, 403, `expected 403 for Coordinator, got ${status}: ${JSON.stringify(data)}`);
});

test('security_config: Customer receives 403 (not in allowed roles)', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/security/config', { token: customerToken });
  assert.equal(status, 403, `expected 403 for Customer, got ${status}: ${JSON.stringify(data)}`);
});

test('security_config: unauthenticated returns 401', async () => {
  const { status } = await request('/api/security/config');
  assert.equal(status, 401, `expected 401 for unauthenticated, got ${status}`);
});
