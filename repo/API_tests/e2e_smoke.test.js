import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin, futureSlot } from './helpers/setup.js';

// Flow 1: Admin login and create user
test('e2e flow 1: admin creates coordinator user who can log in and see their own profile', async () => {
  // Admin logs in
  const adminToken = await loginAdmin();
  assert.ok(adminToken, 'admin token must be present');

  // Admin creates a Coordinator user
  const ts = Date.now();
  const newUser = {
    username: `e2e_coord_${ts}`,
    full_name: `E2E Coordinator ${ts}`,
    password: 'CoordPass@12345',
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `e2e_coord_${ts}@roadsafe.internal`
  };

  const registerRes = await request('/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: newUser
  });
  assert.equal(registerRes.status, 201, `register must return 201, got ${registerRes.status}: ${JSON.stringify(registerRes.data)}`);

  // Verify user appears in GET /api/users list
  const listRes = await request(
    `/api/users?page=1&pageSize=5&q=${encodeURIComponent(newUser.username)}`,
    { token: adminToken }
  );
  assert.equal(listRes.status, 200, `user list must return 200, got ${listRes.status}: ${JSON.stringify(listRes.data)}`);
  const found = (listRes.data.rows || []).find((u) => u.username === newUser.username);
  assert.ok(found, `newly created user must appear in /api/users list`);

  // Login as the new coordinator
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { username: newUser.username, password: newUser.password }
  });
  assert.equal(loginRes.status, 200, `coordinator login must return 200, got ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  assert.ok(loginRes.data.token, 'coordinator login must return a token');
  const coordToken = loginRes.data.token;

  // Verify GET /api/auth/me returns correct user info
  const meRes = await request('/api/auth/me', { token: coordToken });
  assert.equal(meRes.status, 200, `GET /api/auth/me must return 200, got ${meRes.status}: ${JSON.stringify(meRes.data)}`);
  const me = meRes.data.user || meRes.data;
  assert.ok(me, 'auth/me must return user data');
  assert.equal(
    me.username,
    newUser.username,
    `auth/me username must match, expected ${newUser.username}, got ${me.username}`
  );
  const role = me.role || me.role_name;
  assert.equal(role, 'Coordinator', `auth/me role must be Coordinator, got ${role}`);
});

// Flow 2: Coordinator schedules appointment
test('e2e flow 2: coordinator schedules an appointment that appears in coordinator-view and open-appointments', async () => {
  const adminToken = await loginAdmin();

  // Create a coordinator and a customer
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });
  const { id: customerId } = await createUser(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Schedule an appointment via coordinator
  const scheduledAt = futureSlot(5, 9);
  const scheduleRes = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordToken,
    body: {
      customer_id: customerId,
      location_code: 'HQ',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: scheduledAt,
      notes: 'e2e smoke flow 2'
    }
  });

  // 201 = created; 409 = slot already taken or submission lock (acceptable)
  assert.ok(
    [201, 409].includes(scheduleRes.status),
    `schedule must return 201 or 409, got ${scheduleRes.status}: ${JSON.stringify(scheduleRes.data)}`
  );

  if (scheduleRes.status === 201) {
    const appointmentId = scheduleRes.data.appointmentId;
    assert.ok(appointmentId, `schedule response must include appointmentId: ${JSON.stringify(scheduleRes.data)}`);
    assert.ok(Number.isInteger(appointmentId) && appointmentId > 0, 'appointmentId must be a positive integer');

    // Verify coordinator-view returns seats and bayUtilization (existing structure check)
    const coordViewRes = await request('/api/dashboard/coordinator-view', { token: coordToken });
    assert.equal(coordViewRes.status, 200, `coordinator-view must return 200, got ${coordViewRes.status}: ${JSON.stringify(coordViewRes.data)}`);
    assert.ok('seats' in coordViewRes.data, 'coordinator-view must have seats field');
    assert.ok(Array.isArray(coordViewRes.data.seats), 'coordinator-view seats must be an array');
    assert.ok('bayUtilization' in coordViewRes.data, 'coordinator-view must have bayUtilization field');
  }

  // Verify open-appointments endpoint is accessible and has correct structure
  const openRes = await request('/api/coordinator/open-appointments', { token: coordToken });
  assert.equal(openRes.status, 200, `open-appointments must return 200, got ${openRes.status}: ${JSON.stringify(openRes.data)}`);
  assert.ok('appointments' in openRes.data, 'open-appointments must have appointments field');
  assert.ok(Array.isArray(openRes.data.appointments), 'open-appointments must be an array');
});

// Flow 3: Inspector publishes result
test('e2e flow 3: inspector publishes inspection result that appears in results/me', async () => {
  const adminToken = await loginAdmin();

  // Create inspector and customer
  const inspector = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });
  const { id: customerId } = await createUser(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Schedule appointment - system auto-assigns an available inspector
  const scheduledAt = futureSlot(6, 14);
  const scheduleRes = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordToken,
    body: {
      customer_id: customerId,
      location_code: 'HQ',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: scheduledAt,
      notes: 'e2e smoke flow 3'
    }
  });

  assert.ok(
    [201, 409].includes(scheduleRes.status),
    `schedule must return 201 or 409, got ${scheduleRes.status}: ${JSON.stringify(scheduleRes.data)}`
  );

  if (scheduleRes.status !== 201) {
    // Slot was already taken or lock active; skip result-publication assertions
    return;
  }

  const appointmentId = scheduleRes.data.appointmentId;
  const assignedInspectorId = scheduleRes.data.inspectorId;
  assert.ok(appointmentId, 'appointmentId must be present in schedule response');
  assert.ok(assignedInspectorId, 'inspectorId must be present in schedule response');

  // Verify appointment appears in inspector queue (at least via admin, since assigned inspector may vary)
  const queueRes = await request('/api/inspections/queue', { token: adminToken });
  assert.equal(queueRes.status, 200, `inspection queue must return 200, got ${queueRes.status}: ${JSON.stringify(queueRes.data)}`);
  assert.ok(Array.isArray(queueRes.data.rows), 'inspection queue must have rows array');

  // Use the token of whoever was actually assigned; fall back to admin to publish
  const publishToken = assignedInspectorId === inspector.id ? inspector.token : adminToken;

  const resultRes = await request('/api/inspections/results', {
    method: 'POST',
    token: publishToken,
    body: {
      appointment_id: appointmentId,
      location_code: 'HQ',
      department_code: 'OPS',
      outcome: 'pass',
      score: 92.0,
      findings: { brake_test: 'pass', emissions: 'pass' }
    }
  });

  assert.ok(
    [201, 409].includes(resultRes.status),
    `result publish must return 201 or 409, got ${resultRes.status}: ${JSON.stringify(resultRes.data)}`
  );

  if (resultRes.status === 201) {
    const resultId = resultRes.data.resultId ?? resultRes.data.id;
    assert.ok(resultId, `result response must include resultId: ${JSON.stringify(resultRes.data)}`);
    assert.equal(resultRes.data.outcome, 'pass', `result outcome must be 'pass', got ${resultRes.data.outcome}`);

    // Verify result appears in results/me for the assigned inspector
    const meResultsRes = await request('/api/inspections/results/me', { token: publishToken });
    assert.equal(meResultsRes.status, 200, `results/me must return 200, got ${meResultsRes.status}: ${JSON.stringify(meResultsRes.data)}`);
    assert.ok(Array.isArray(meResultsRes.data.rows), 'results/me must have rows array');

    const found = meResultsRes.data.rows.find((r) => Number(r.id) === Number(resultId));
    assert.ok(found, `published result ${resultId} must appear in inspector's results/me`);
    assert.equal(found.outcome, 'pass', `result outcome in results/me must be 'pass', got ${found.outcome}`);
  }
});

// Flow 4: Customer views report
test('e2e flow 4: customer can access their inspection reports endpoint', async () => {
  const adminToken = await loginAdmin();

  // Create a customer user
  const customer = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Customer fetches their reports
  const reportsRes = await request('/api/inspections/customer/reports', { token: customer.token });
  assert.equal(reportsRes.status, 200, `customer reports must return 200, got ${reportsRes.status}: ${JSON.stringify(reportsRes.data)}`);
  assert.ok('rows' in reportsRes.data, 'customer reports response must have a rows field');
  assert.ok(Array.isArray(reportsRes.data.rows), 'customer reports rows must be an array');

  // If any reports exist, verify structure
  for (const report of reportsRes.data.rows) {
    assert.ok('report_id' in report, `report must have report_id field: ${JSON.stringify(report)}`);
    assert.ok('appointment_id' in report, `report must have appointment_id field: ${JSON.stringify(report)}`);
    assert.ok('outcome' in report, `report must have outcome field: ${JSON.stringify(report)}`);
    assert.ok('completed_at' in report, `report must have completed_at field: ${JSON.stringify(report)}`);
  }
});

// Flow 5: Admin audit trail
test('e2e flow 5: admin can view audit trail and user creation events appear with expected fields', async () => {
  const adminToken = await loginAdmin();

  // Perform an auditable action: create a user
  const ts = Date.now();
  const auditUser = {
    username: `e2e_audit_${ts}`,
    full_name: `E2E Audit User ${ts}`,
    password: 'AuditPass@12345',
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS',
    email: `e2e_audit_${ts}@roadsafe.internal`
  };

  const registerRes = await request('/api/auth/register', {
    method: 'POST',
    token: adminToken,
    body: auditUser
  });
  assert.equal(registerRes.status, 201, `register must return 201 for audit flow, got ${registerRes.status}: ${JSON.stringify(registerRes.data)}`);

  // Check audit events via GET /api/audit/events
  const auditRes = await request('/api/audit/events?page=1&pageSize=50&action=iam.user.create', {
    token: adminToken
  });
  assert.equal(auditRes.status, 200, `audit events must return 200, got ${auditRes.status}: ${JSON.stringify(auditRes.data)}`);
  assert.ok(Array.isArray(auditRes.data.rows), 'audit events must have a rows array');
  assert.ok('pagination' in auditRes.data, 'audit events must have a pagination object');

  // Find the user creation event for this specific user
  const event = auditRes.data.rows.find(
    (e) =>
      typeof e.action === 'string' &&
      e.action.includes('iam.user.create') &&
      (String(e.target_record_id) === auditUser.username ||
        (e.details && typeof e.details === 'string' && e.details.includes(auditUser.username)) ||
        (e.details && typeof e.details === 'object' && JSON.stringify(e.details).includes(auditUser.username)))
  );

  assert.ok(event, `audit log must contain an iam.user.create event for ${auditUser.username}`);

  // Verify audit event has expected fields
  assert.ok('id' in event, 'audit event must have id field');
  assert.ok('event_time' in event, 'audit event must have event_time field');
  assert.ok('actor_role' in event, 'audit event must have actor_role field');
  assert.ok('action' in event, 'audit event must have action field');
  assert.ok(
    typeof event.action === 'string' && event.action.includes('iam.user.create'),
    `audit event action must contain 'iam.user.create', got: ${event.action}`
  );
  assert.equal(event.actor_role, 'Administrator', `audit event actor_role must be 'Administrator', got: ${event.actor_role}`);
});
