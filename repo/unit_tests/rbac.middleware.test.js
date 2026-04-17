import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRoles, enforceScope } from '../backend/src/middleware/rbac.js';

function mockCtx(user = null, query = {}, body = {}) {
  return {
    state: { user },
    query,
    request: { body },
    status: 200,
    body: {}
  };
}

// ─── requireRoles ────────────────────────────────────────────────────────────

test('requireRoles: returns 401 when ctx.state.user is null', async () => {
  const mw = requireRoles('Inspector');
  const ctx = mockCtx(null);
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 401);
  assert.equal(nextCalled, false);
});

test('requireRoles: returns 403 when user role is not in allowed list', async () => {
  const mw = requireRoles('Inspector');
  const user = { id: 1, username: 'test', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user);
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 403);
  assert.equal(nextCalled, false);
});

test('requireRoles: calls next() when user role is in allowed list', async () => {
  const mw = requireRoles('Coordinator');
  const user = { id: 1, username: 'test', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user);
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 200);
  assert.equal(nextCalled, true);
});

test('requireRoles: works with multiple allowed roles', async () => {
  const mw = requireRoles('Inspector', 'Coordinator', 'Manager');
  const user = { id: 2, username: 'mgr', role: 'Manager', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user);
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(nextCalled, true);

  // Also verify a role NOT in the list is rejected
  const user2 = { ...user, role: 'Driver' };
  const ctx2 = mockCtx(user2);
  let next2Called = false;
  await mw(ctx2, async () => { next2Called = true; });
  assert.equal(ctx2.status, 403);
  assert.equal(next2Called, false);
});

test('requireRoles: works with Administrator role', async () => {
  const mw = requireRoles('Administrator');
  const user = { id: 3, username: 'admin', role: 'Administrator', locationCode: null, departmentCode: null, teamId: null };
  const ctx = mockCtx(user);
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(nextCalled, true);
});

// ─── enforceScope ────────────────────────────────────────────────────────────

test('enforceScope: returns 401 when ctx.state.user is null', async () => {
  const mw = enforceScope();
  const ctx = mockCtx(null);
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 401);
  assert.equal(nextCalled, false);
});

test('enforceScope: Administrator bypasses all scope checks and calls next', async () => {
  const mw = enforceScope();
  const admin = { id: 1, username: 'admin', role: 'Administrator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  // Provide mismatched query params - admin should still pass through
  const ctx = mockCtx(admin, { location: 'BRANCH', department: 'FINANCE', team: 'T99' }, {});
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(nextCalled, true);
  assert.equal(ctx.status, 200);
});

test('enforceScope: non-admin passes when no scope params in request', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user, {}, {});
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(nextCalled, true);
  assert.equal(ctx.status, 200);
});

test('enforceScope: non-admin passes when scope params match user scope', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user, { location: 'HQ', department: 'OPS', team: 'T1' }, {});
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(nextCalled, true);
  assert.equal(ctx.status, 200);
});

test('enforceScope: returns 403 when query location does not match user locationCode', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user, { location: 'BRANCH' }, {});
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 403);
  assert.equal(nextCalled, false);
});

test('enforceScope: returns 403 when query department does not match user departmentCode', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user, { department: 'FINANCE' }, {});
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 403);
  assert.equal(nextCalled, false);
});

test('enforceScope: returns 403 when query team does not match user teamId', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user, { team: 'T99' }, {});
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 403);
  assert.equal(nextCalled, false);
});

test('enforceScope: reads scope from body.location_code and body.department_code', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };

  // Matching body fields should pass
  const ctx1 = mockCtx(user, {}, { location_code: 'HQ', department_code: 'OPS' });
  let next1Called = false;
  await mw(ctx1, async () => { next1Called = true; });
  assert.equal(next1Called, true, 'should call next when body scope matches');

  // Mismatched body location_code should fail
  const ctx2 = mockCtx(user, {}, { location_code: 'BRANCH' });
  let next2Called = false;
  await mw(ctx2, async () => { next2Called = true; });
  assert.equal(ctx2.status, 403, 'should 403 when body location_code mismatches');
  assert.equal(next2Called, false);
});

test('enforceScope: reads scope from body.team_id', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };

  const ctxPass = mockCtx(user, {}, { team_id: 'T1' });
  let passNext = false;
  await mw(ctxPass, async () => { passNext = true; });
  assert.equal(passNext, true);

  const ctxFail = mockCtx(user, {}, { team_id: 'T99' });
  let failNext = false;
  await mw(ctxFail, async () => { failNext = true; });
  assert.equal(ctxFail.status, 403);
  assert.equal(failNext, false);
});

test('enforceScope: reads scope from body.filters.location_code and body.filters.department_code', async () => {
  const mw = enforceScope();
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };

  // Matching nested filter should pass
  const ctx1 = mockCtx(user, {}, { filters: { location_code: 'HQ', department_code: 'OPS' } });
  let next1Called = false;
  await mw(ctx1, async () => { next1Called = true; });
  assert.equal(next1Called, true, 'should pass when nested filters match');

  // Mismatched nested filter.department_code should fail
  const ctx2 = mockCtx(user, {}, { filters: { location_code: 'HQ', department_code: 'HR' } });
  let next2Called = false;
  await mw(ctx2, async () => { next2Called = true; });
  assert.equal(ctx2.status, 403, 'should 403 when filters.department_code mismatches');
  assert.equal(next2Called, false);
});

test('enforceScope: custom field name options are reflected in 403 error message', async () => {
  const mw = enforceScope({ locationField: 'site_code', departmentField: 'division_code', teamField: 'group_id' });
  const user = { id: 2, username: 'coord', role: 'Coordinator', locationCode: 'HQ', departmentCode: 'OPS', teamId: 'T1' };
  const ctx = mockCtx(user, { location: 'WRONG' }, {});
  let nextCalled = false;
  const next = async () => { nextCalled = true; };

  await mw(ctx, next);

  assert.equal(ctx.status, 403);
  assert.equal(nextCalled, false);
  // The custom field name appears in the error message
  assert.ok(
    typeof ctx.body.error === 'string' && ctx.body.error.includes('site_code'),
    `Expected error to mention 'site_code', got: ${ctx.body.error}`
  );
});
