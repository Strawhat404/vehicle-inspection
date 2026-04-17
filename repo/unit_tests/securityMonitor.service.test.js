import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables } from '../backend/src/services/securityMonitorService.js';

const { HIGH_PRIV } = _testables;

// ─── HIGH_PRIV type ────────────────────────────────────────────────────────────

test('HIGH_PRIV is a Set', () => {
  assert.ok(HIGH_PRIV instanceof Set);
});

// ─── HIGH_PRIV membership: privileged roles ───────────────────────────────────

test('HIGH_PRIV contains "Administrator"', () => {
  assert.ok(HIGH_PRIV.has('Administrator'), 'Expected HIGH_PRIV to include Administrator');
});

test('HIGH_PRIV contains "Data Engineer"', () => {
  assert.ok(HIGH_PRIV.has('Data Engineer'), 'Expected HIGH_PRIV to include Data Engineer');
});

// ─── HIGH_PRIV membership: non-privileged roles ───────────────────────────────

test('HIGH_PRIV does not contain "Coordinator"', () => {
  assert.ok(!HIGH_PRIV.has('Coordinator'), 'Coordinator should not be in HIGH_PRIV');
});

test('HIGH_PRIV does not contain "Inspector"', () => {
  assert.ok(!HIGH_PRIV.has('Inspector'), 'Inspector should not be in HIGH_PRIV');
});

test('HIGH_PRIV does not contain "Customer"', () => {
  assert.ok(!HIGH_PRIV.has('Customer'), 'Customer should not be in HIGH_PRIV');
});

// ─── HIGH_PRIV size ────────────────────────────────────────────────────────────

test('HIGH_PRIV has exactly 2 members', () => {
  assert.equal(HIGH_PRIV.size, 2);
});

// ─── Module export: detectPrivilegeEscalation ─────────────────────────────────
// securityMonitorService imports db.js (mysql2 pool). Pool creation does not
// open a connection, so the import succeeds without a running database.

test('securityMonitorService exports detectPrivilegeEscalation as a function', async () => {
  const mod = await import('../backend/src/services/securityMonitorService.js');
  assert.equal(typeof mod.detectPrivilegeEscalation, 'function');
});
