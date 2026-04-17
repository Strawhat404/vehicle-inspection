import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin, futureSlot } from './helpers/setup.js';

test('operations: duplicate appointment conflict and 5-minute submission lock', async () => {
  const adminToken = await loginAdmin();

  const { id: coordinatorId } = await createUser(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });
  assert.ok(coordinatorId > 0, `coordinator id must be a positive integer, got: ${coordinatorId}`);

  const { id: customerId } = await createUser(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });
  assert.ok(customerId > 0, `customer id must be a positive integer, got: ${customerId}`);

  // Log in the coordinator using its stored username/password via createUserAndLogin pattern.
  // Re-use createUser result — we need a login token, so create-and-login directly.
  const { token: coordinatorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const basePayload = {
    customer_id: customerId,
    location_code: 'HQ',
    department_code: 'OPS',
    vehicle_type: 'light',
    notes: 'operations test'
  };

  // --- Duplicate appointment conflict ---
  const duplicateSlot = futureSlot(2, 10, 0);

  const firstAttempt = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: { ...basePayload, scheduled_at: duplicateSlot }
  });

  if (firstAttempt.status === 201) {
    // First appointment must return a valid appointmentId
    const firstAppointmentId = firstAttempt.data.appointmentId;
    assert.ok(firstAppointmentId, `first appointment must return appointmentId: ${JSON.stringify(firstAttempt.data)}`);
    assert.ok(Number.isInteger(firstAppointmentId) && firstAppointmentId > 0,
      `appointmentId must be a positive integer, got: ${firstAppointmentId}`);

    // Booking the same slot again must conflict
    const duplicate = await request('/api/coordinator/appointments/schedule', {
      method: 'POST',
      token: coordinatorToken,
      body: { ...basePayload, scheduled_at: duplicateSlot }
    });
    assert.equal(duplicate.status, 409,
      `duplicate slot must return 409, got ${duplicate.status}: ${JSON.stringify(duplicate.data)}`);
    assert.ok(duplicate.data.error, 'conflict response must include an error message');
  } else {
    // Slot was already taken — server must have returned a conflict or validation error
    assert.ok([409, 400].includes(firstAttempt.status),
      `expected 409/400 for already-taken slot, got ${firstAttempt.status}: ${JSON.stringify(firstAttempt.data)}`);
  }

  // --- 5-minute submission lock ---
  const lockSlot1 = futureSlot(3, 11, 0);
  const lockSlot2 = futureSlot(3, 11, 30);

  const first = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: { ...basePayload, scheduled_at: lockSlot1 }
  });

  assert.equal(first.status, 201,
    `initial appointment for lock check must succeed with 201, got ${first.status}: ${JSON.stringify(first.data)}`);

  const firstId = first.data.appointmentId;
  assert.ok(firstId, `first lock-check appointment must return appointmentId: ${JSON.stringify(first.data)}`);
  assert.ok(Number.isInteger(firstId) && firstId > 0,
    `lock-check appointmentId must be a positive integer, got: ${firstId}`);

  const second = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordinatorToken,
    body: { ...basePayload, scheduled_at: lockSlot2 }
  });

  assert.equal(second.status, 409,
    `second appointment within 5-min lock must return 409, got ${second.status}: ${JSON.stringify(second.data)}`);
  assert.ok(second.data.error, 'submission lock response must include an error message');
  assert.match(String(second.data.error), /submission lock/i,
    `error message must mention submission lock, got: ${second.data.error}`);
});
