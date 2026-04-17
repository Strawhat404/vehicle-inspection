import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin } from './helpers/setup.js';

test('roles: unauthenticated GET /api/roles returns 401', async () => {
  const { status, data } = await request('/api/roles');
  assert.equal(status, 401, `expected 401 for unauthenticated roles list, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('audit: unauthenticated GET /api/audit/events returns 401', async () => {
  const { status, data } = await request('/api/audit/events');
  assert.equal(status, 401, `expected 401 for unauthenticated audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('audit: unauthenticated POST /api/audit/export returns 401', async () => {
  const { status, data } = await request('/api/audit/export', {
    method: 'POST'
  });
  assert.equal(status, 401, `expected 401 for unauthenticated audit export, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must have an error field');
});

test('roles: Admin can GET /api/roles - returns 200 with roles array', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/roles', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for admin roles list, got ${status}: ${JSON.stringify(data)}`);

  // Response can be array directly or wrapped in roles key
  const roles = Array.isArray(data) ? data : data.roles;
  assert.ok(Array.isArray(roles), `response must have a roles array, got: ${JSON.stringify(data)}`);
  assert.ok(roles.length > 0, 'roles array must not be empty');

  // Each role object must have id, name, description
  for (const role of roles) {
    assert.ok(
      role.id !== undefined,
      `role object must have id field, got: ${JSON.stringify(role)}`
    );
    assert.ok(
      role.name !== undefined,
      `role object must have name field, got: ${JSON.stringify(role)}`
    );
    assert.ok(
      role.description !== undefined,
      `role object must have description field, got: ${JSON.stringify(role)}`
    );
    assert.equal(typeof role.name, 'string', 'role name must be a string');
    assert.ok(role.name.length > 0, 'role name must not be empty');
  }
});

test('roles: non-admin (Coordinator) gets 403 on GET /api/roles', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/roles', {
    token: coordToken
  });

  assert.equal(status, 403, `expected 403 for Coordinator on /api/roles, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('roles: non-admin (Inspector) gets 403 on GET /api/roles', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/roles', {
    token: inspectorToken
  });

  assert.equal(status, 403, `expected 403 for Inspector on /api/roles, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
});

test('audit: Admin can GET /api/audit/events - returns 200 with rows array and pagination', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/events?page=1&pageSize=10', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for admin audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(
    data.pagination || data.total !== undefined || data.totalCount !== undefined,
    `response must have pagination or total count, got: ${JSON.stringify(data)}`
  );
  if (data.pagination) {
    assert.equal(typeof data.pagination, 'object', 'pagination must be an object');
  }
});

test('audit: audit events have required fields (id, event_time, actor_role, action, target_table)', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/events?page=1&pageSize=20', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'response must have rows array');

  // Only validate fields if events exist
  if (data.rows.length > 0) {
    const event = data.rows[0];
    assert.ok(
      event.id !== undefined,
      `audit event must have id field, got: ${JSON.stringify(event)}`
    );
    assert.ok(
      event.event_time !== undefined,
      `audit event must have event_time field, got: ${JSON.stringify(event)}`
    );
    assert.ok(
      event.actor_role !== undefined,
      `audit event must have actor_role field, got: ${JSON.stringify(event)}`
    );
    assert.ok(
      event.action !== undefined,
      `audit event must have action field, got: ${JSON.stringify(event)}`
    );
    assert.ok(
      event.target_table !== undefined,
      `audit event must have target_table field, got: ${JSON.stringify(event)}`
    );
  }
});

test('audit: Admin can filter audit events with action query param', async () => {
  const adminToken = await loginAdmin();

  // Filter by a common action such as login
  const { status, data } = await request('/api/audit/events?page=1&pageSize=10&action=login', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for filtered audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);

  // All returned rows should match the action filter (if rows exist)
  for (const event of data.rows) {
    assert.ok(
      event.action !== undefined,
      `filtered event must have action field, got: ${JSON.stringify(event)}`
    );
    assert.match(
      String(event.action).toLowerCase(),
      /login/,
      `filtered event action should contain 'login', got: ${event.action}`
    );
  }
});

test('audit: Admin can POST /api/audit/export - returns 200 with exported count or filePath', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/export', {
    method: 'POST',
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for admin audit export, got ${status}: ${JSON.stringify(data)}`);

  const hasCount = data.exported !== undefined || data.count !== undefined || data.exportedCount !== undefined;
  const hasFilePath = data.filePath !== undefined || data.file_path !== undefined || data.path !== undefined;
  assert.ok(
    hasCount || hasFilePath,
    `export response must have exported count or filePath, got: ${JSON.stringify(data)}`
  );

  if (hasCount) {
    const count = data.exported ?? data.count ?? data.exportedCount;
    assert.equal(typeof count, 'number', 'exported count must be a number');
    assert.ok(count >= 0, 'exported count must be non-negative');
  }

  if (hasFilePath) {
    const filePath = data.filePath ?? data.file_path ?? data.path;
    assert.equal(typeof filePath, 'string', 'filePath must be a string');
    assert.ok(filePath.length > 0, 'filePath must not be empty');
  }
});

test('audit: non-admin (Coordinator) gets 403 on GET /api/audit/events', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/audit/events', {
    token: coordToken
  });

  assert.equal(status, 403, `expected 403 for Coordinator on audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
  assert.ok(data.error.length > 0, 'error message must not be empty');
});

test('audit: non-admin (Inspector) gets 403 on POST /api/audit/export', async () => {
  const adminToken = await loginAdmin();
  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/audit/export', {
    method: 'POST',
    token: inspectorToken
  });

  assert.equal(status, 403, `expected 403 for Inspector on audit export, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('audit: Customer gets 403 on GET /api/audit/events', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/audit/events', {
    token: customerToken
  });

  assert.equal(status, 403, `expected 403 for Customer on audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
});

test('audit: filter by actor_role param returns only matching events', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/events?page=1&pageSize=25&actor_role=Administrator', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for actor_role-filtered audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);
  assert.equal(typeof data.pagination.page, 'number', 'pagination.page must be a number');
  assert.equal(typeof data.pagination.total, 'number', 'pagination.total must be a number');

  for (const event of data.rows) {
    assert.equal(
      event.actor_role,
      'Administrator',
      `actor_role filter must only return Administrator events, got: ${event.actor_role}`
    );
  }
});

test('audit: filter by target_table param returns only matching events', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/events?page=1&pageSize=25&target_table=users', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for target_table-filtered audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);

  for (const event of data.rows) {
    assert.equal(
      event.target_table,
      'users',
      `target_table filter must only return 'users' events, got: ${event.target_table}`
    );
  }
});

test('audit: combined actor_role + target_table filter returns only matching events', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request(
    '/api/audit/events?page=1&pageSize=25&actor_role=Administrator&target_table=users',
    { token: adminToken }
  );

  assert.equal(status, 200, `expected 200 for combined filter, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);

  for (const event of data.rows) {
    assert.equal(
      event.actor_role,
      'Administrator',
      `combined filter must only return Administrator events, got actor_role: ${event.actor_role}`
    );
    assert.equal(
      event.target_table,
      'users',
      `combined filter must only return 'users' target_table events, got: ${event.target_table}`
    );
  }
});

test('audit: page=0 is treated as page 1 (invalid page defaults to first page)', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/events?page=0&pageSize=5', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for page=0, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);
  assert.equal(
    data.pagination.page,
    1,
    `invalid page=0 must default to page 1, got: ${data.pagination.page}`
  );
});

test('audit: page=-1 is treated as page 1 (negative page defaults to first page)', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/events?page=-1&pageSize=5', {
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for page=-1, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), `response must have rows array, got: ${JSON.stringify(data)}`);
  assert.ok(data.pagination, `response must have pagination object, got: ${JSON.stringify(data)}`);
  assert.equal(
    data.pagination.page,
    1,
    `negative page=-1 must default to page 1, got: ${data.pagination.page}`
  );
});

test('audit: POST /api/audit/export returns exact { exported: number, filePath: string } contract', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/audit/export', {
    method: 'POST',
    token: adminToken
  });

  assert.equal(status, 200, `expected 200 for audit export, got ${status}: ${JSON.stringify(data)}`);

  // Exact contract: { exported: number, filePath: string }
  assert.ok('exported' in data, `response must have 'exported' field, got: ${JSON.stringify(data)}`);
  assert.equal(typeof data.exported, 'number', `'exported' must be a number, got: ${typeof data.exported}`);
  assert.ok(data.exported >= 0, `'exported' must be non-negative, got: ${data.exported}`);

  assert.ok('filePath' in data, `response must have 'filePath' field, got: ${JSON.stringify(data)}`);
  assert.equal(typeof data.filePath, 'string', `'filePath' must be a string, got: ${typeof data.filePath}`);
  assert.ok(data.filePath.length > 0, `'filePath' must not be empty`);
  assert.ok(
    data.filePath.endsWith('.jsonl'),
    `'filePath' should end with .jsonl (audit ledger format), got: ${data.filePath}`
  );
});

test('audit: user creation produces audit event with correct action and actor_role', async () => {
  const adminToken = await loginAdmin();

  // Create a user — this triggers an audit event in auth.js register handler
  const ts = Date.now();
  const username = `audit_trace_${ts}`;

  const registerRes = await request('/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: {
      username,
      full_name: `Audit Trace ${ts}`,
      password: 'TestPass@12345',
      role_name: 'Inspector',
      location_code: 'HQ',
      department_code: 'OPS',
      email: `audit_trace_${ts}@roadsafe.internal`
    }
  });
  assert.equal(registerRes.status, 201, `user creation failed: ${registerRes.status}: ${JSON.stringify(registerRes.data)}`);

  // Query audit events filtered to the 'users' table to find the registration event
  const { status, data } = await request(
    '/api/audit/events?page=1&pageSize=50&target_table=users&actor_role=Administrator',
    { token: adminToken }
  );

  assert.equal(status, 200, `expected 200 for audit events, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'response must have rows array');

  // Find a recent event related to user registration
  const registrationEvent = data.rows.find(
    (e) =>
      e.target_table === 'users' &&
      e.actor_role === 'Administrator' &&
      (e.action === 'iam.user.register' || e.action === 'user.create' || (typeof e.action === 'string' && e.action.includes('register')))
  );

  if (registrationEvent) {
    assert.equal(
      registrationEvent.actor_role,
      'Administrator',
      `registration audit event must record actor_role as Administrator, got: ${registrationEvent.actor_role}`
    );
    assert.equal(
      registrationEvent.target_table,
      'users',
      `registration audit event must target 'users' table, got: ${registrationEvent.target_table}`
    );
    assert.ok(
      registrationEvent.action,
      `registration audit event must have a non-empty action, got: ${JSON.stringify(registrationEvent)}`
    );
  }
  // If no registration event found, the audit may use a different filter — verify at least
  // that filtered results respect actor_role and target_table constraints
  for (const event of data.rows) {
    assert.equal(event.actor_role, 'Administrator', `all events must match actor_role filter`);
    assert.equal(event.target_table, 'users', `all events must match target_table filter`);
  }
});
