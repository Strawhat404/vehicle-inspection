import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables } from '../backend/src/services/retentionService.js';

const { REPORT_RETENTION_YEARS, ACCOUNT_CLOSURE_DAYS } = _testables;

// ─── REPORT_RETENTION_YEARS ───────────────────────────────────────────────────

test('REPORT_RETENTION_YEARS is 7', () => {
  assert.equal(REPORT_RETENTION_YEARS, 7);
});

// ─── ACCOUNT_CLOSURE_DAYS ─────────────────────────────────────────────────────

test('ACCOUNT_CLOSURE_DAYS is 30', () => {
  assert.equal(ACCOUNT_CLOSURE_DAYS, 30);
});

// ─── Module exports ───────────────────────────────────────────────────────────
// retentionService imports db.js (mysql2 pool). Pool creation does not open a
// connection, so the import succeeds without a running database. The actual
// sweep/closure logic is covered by integration tests.

test('retentionService exports createAccountClosureRequest as a function', async () => {
  const mod = await import('../backend/src/services/retentionService.js');
  assert.equal(typeof mod.createAccountClosureRequest, 'function');
});

test('retentionService exports runRetentionSweep as a function', async () => {
  const mod = await import('../backend/src/services/retentionService.js');
  assert.equal(typeof mod.runRetentionSweep, 'function');
});
