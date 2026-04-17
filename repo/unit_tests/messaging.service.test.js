import test from 'node:test';
import assert from 'node:assert/strict';

// messagingService imports db.js (which creates a mysql2 pool) and encryption.js.
// Pool creation does not open a connection, so the import succeeds without a
// running database. Actual message creation/retrieval requires a live DB and is
// covered by integration tests.

test('messagingService exports expected functions', async () => {
  const mod = await import('../backend/src/services/messagingService.js');
  assert.equal(typeof mod.createMessage, 'function');
  assert.equal(typeof mod.inbox, 'function');
  assert.equal(typeof mod.exportPendingOutbox, 'function');
});
