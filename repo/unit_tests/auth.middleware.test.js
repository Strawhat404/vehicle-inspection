import test from 'node:test';
import assert from 'node:assert/strict';
import { authRequired, authOptional } from '../backend/src/middleware/auth.js';

/**
 * Auth middleware unit tests.
 *
 * loadSessionUser queries the database, so we can only test the paths that
 * short-circuit before any DB call is made (missing / malformed tokens) and
 * the authOptional paths that silently absorb errors and always call next().
 *
 * DB-dependent paths (valid token → user lookup) are covered by integration
 * tests that run against a live DB.
 */

function mockCtx(authHeader = '') {
  return {
    headers: { authorization: authHeader },
    state: {},
    status: 200,
    body: {}
  };
}

// ─── authRequired ─────────────────────────────────────────────────────────────

test('authRequired: returns 401 with missing bearer token error when no Authorization header', async () => {
  const ctx = mockCtx('');
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await authRequired(ctx, next);

  assert.equal(ctx.status, 401);
  assert.deepEqual(ctx.body, { error: 'Missing bearer token' });
  assert.equal(nextCalled, false);
});

test('authRequired: returns 401 when Authorization header does not start with Bearer ', async () => {
  const ctx = mockCtx('Token abc123');
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await authRequired(ctx, next);

  assert.equal(ctx.status, 401);
  assert.deepEqual(ctx.body, { error: 'Missing bearer token' });
  assert.equal(nextCalled, false);
});

test('authRequired: returns 401 when Authorization is "Bearer " with empty token after prefix', async () => {
  // "Bearer " with nothing after the space produces an empty string token
  const ctx = mockCtx('Bearer ');
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await authRequired(ctx, next);

  assert.equal(ctx.status, 401);
  assert.deepEqual(ctx.body, { error: 'Missing bearer token' });
  assert.equal(nextCalled, false);
});

test('authRequired: sets ctx.status to 401 and does NOT call next() for missing token', async () => {
  const ctx = mockCtx();
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await authRequired(ctx, next);

  assert.equal(ctx.status, 401);
  assert.equal(nextCalled, false);
});

// ─── authOptional ─────────────────────────────────────────────────────────────

test('authOptional: calls next() when no Authorization header is present', async () => {
  const ctx = mockCtx('');
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await authOptional(ctx, next);

  assert.equal(nextCalled, true);
});

test('authOptional: ctx.state.user remains undefined when no token is provided', async () => {
  const ctx = mockCtx('');
  const next = async () => {};

  await authOptional(ctx, next);

  assert.equal(ctx.state.user, undefined);
});

test('authOptional: calls next() even when token is present but DB is unavailable (error caught silently)', async () => {
  // Provide a syntactically valid Bearer token. The DB query will fail because
  // there is no running MySQL instance in the unit-test environment.
  // authOptional silently catches that error and still calls next().
  const ctx = mockCtx('Bearer some-token-that-will-cause-db-error');
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await authOptional(ctx, next);

  assert.equal(nextCalled, true, 'authOptional must always call next() regardless of DB errors');
});
