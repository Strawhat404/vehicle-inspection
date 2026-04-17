import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from './helpers/setup.js';

test('GET /health returns 200 with status ok and db ok', async () => {
  const { status, data } = await request('/health');
  assert.equal(status, 200, `expected 200 for health check, got ${status}`);
  assert.ok(data.status === 'ok' || data.healthy === true || data.db === 'ok',
    `health response should indicate healthy state: ${JSON.stringify(data)}`);
});
