import test from 'node:test';
import assert from 'node:assert/strict';

// auditRetentionService imports db.js (mysql2 pool) and uses fs.
// Pool creation does not open a connection, so the import succeeds without a
// running database. The actual ledger export requires a live DB and is covered
// by integration tests.

test('auditRetentionService exports exportAuditLedger function', async () => {
  const mod = await import('../backend/src/services/auditRetentionService.js');
  assert.equal(typeof mod.exportAuditLedger, 'function');
});
