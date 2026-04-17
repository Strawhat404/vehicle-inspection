import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin } from './helpers/setup.js';

test('messaging send: Coordinator can POST /api/messages/send - returns 200 or 201', async () => {
  const adminToken = await loginAdmin();

  // Create a recipient user (Customer)
  const recipient = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/messages/send', {
    method: 'POST',
    token: coordToken,
    body: {
      recipient_user_id: recipient.id,
      message_type: 'system_notice',
      subject: 'Test Subject',
      body: 'Hello',
      channels: ['sms']
    }
  });
  assert.ok(
    [200, 201].includes(status),
    `expected 200 or 201 for POST messages/send, got ${status}: ${JSON.stringify(data)}`
  );
});

test('messaging inbox: sent message appears in recipient inbox with matching subject', async () => {
  const adminToken = await loginAdmin();

  const recipient = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const uniqueSubject = `Inbox Test ${Date.now()}`;

  const sendRes = await request('/api/messages/send', {
    method: 'POST',
    token: coordToken,
    body: {
      recipient_user_id: recipient.id,
      message_type: 'system_notice',
      subject: uniqueSubject,
      body: 'Hello from coordinator',
      channels: ['sms']
    }
  });
  assert.ok(
    [200, 201].includes(sendRes.status),
    `setup: could not send message, got ${sendRes.status}: ${JSON.stringify(sendRes.data)}`
  );

  const { status, data } = await request('/api/messages/inbox', { token: recipient.token });
  assert.equal(status, 200, `expected 200 for GET inbox, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.messages), 'inbox response must have a messages array');

  const found = data.messages.find((m) => m.subject === uniqueSubject);
  assert.ok(found, `sent message with subject "${uniqueSubject}" must appear in recipient inbox`);
  assert.equal(found.subject, uniqueSubject, 'message subject in inbox must match sent subject');
});

test('messaging outbox: Admin can GET /api/messages/outbox - has entries or rows array', async () => {
  const adminToken = await loginAdmin();
  const { status, data } = await request('/api/messages/outbox', { token: adminToken });
  assert.equal(status, 200, `expected 200 for GET outbox, got ${status}: ${JSON.stringify(data)}`);
  const hasEntries = Array.isArray(data.entries);
  const hasRows = Array.isArray(data.rows);
  assert.ok(
    hasEntries || hasRows,
    `response must have an entries or rows array, got: ${JSON.stringify(data)}`
  );
});

test('messaging outbox export: Admin can POST /api/messages/outbox/export - returns 200', async () => {
  const adminToken = await loginAdmin();
  const { status, data } = await request('/api/messages/outbox/export', {
    method: 'POST',
    token: adminToken
  });
  assert.equal(status, 200, `expected 200 for POST outbox/export, got ${status}: ${JSON.stringify(data)}`);
});

test('messaging send: Customer gets 403 on POST /api/messages/send', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken, id: customerId } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/messages/send', {
    method: 'POST',
    token: customerToken,
    body: {
      recipient_user_id: customerId,
      message_type: 'system_notice',
      subject: 'Customer Attempt',
      body: 'Should be forbidden',
      channels: ['sms']
    }
  });
  assert.equal(status, 403, `expected 403 for Customer on POST messages/send, got ${status}: ${JSON.stringify(data)}`);
});

test('messaging outbox export: Customer gets 403 on POST /api/messages/outbox/export', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/messages/outbox/export', {
    method: 'POST',
    token: customerToken
  });
  assert.equal(status, 403, `expected 403 for Customer on POST outbox/export, got ${status}: ${JSON.stringify(data)}`);
});

test('messaging send: unauthenticated returns 401', async () => {
  const { status } = await request('/api/messages/send', {
    method: 'POST',
    body: {
      recipient_user_id: 1,
      message_type: 'system_notice',
      subject: 'Unauth Test',
      body: 'Hello',
      channels: ['sms']
    }
  });
  assert.equal(status, 401, `expected 401 for unauthenticated POST messages/send, got ${status}`);
});

test('messaging outbox: unauthenticated returns 401 on GET /api/messages/outbox', async () => {
  const { status } = await request('/api/messages/outbox');
  assert.equal(status, 401, `expected 401 for unauthenticated GET outbox, got ${status}`);
});

test('messaging outbox export: unauthenticated returns 401 on POST /api/messages/outbox/export', async () => {
  const { status } = await request('/api/messages/outbox/export', { method: 'POST' });
  assert.equal(status, 401, `expected 401 for unauthenticated POST outbox/export, got ${status}`);
});

test('messaging inbox: unauthenticated GET /api/messages/inbox returns 401', async () => {
  const { status, data } = await request('/api/messages/inbox');
  assert.equal(status, 401, `expected 401 for unauthenticated GET inbox, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('messaging send: Coordinator POST /api/messages/send returns 201 with numeric messageId', async () => {
  const adminToken = await loginAdmin();

  const recipient = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/messages/send', {
    method: 'POST',
    token: coordToken,
    body: {
      recipient_user_id: recipient.id,
      message_type: 'system_notice',
      subject: `Contract Test ${Date.now()}`,
      body: 'Contract assertion body',
      channels: ['sms']
    }
  });

  assert.equal(status, 201, `expected 201 for coordinator send, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('messageId' in data, `response must include messageId field, got: ${JSON.stringify(data)}`);
  assert.ok(
    Number.isInteger(data.messageId) && data.messageId > 0,
    `messageId must be a positive integer, got: ${data.messageId}`
  );
});

test('messaging inbox: sent message appears with correct subject and message_type in recipient inbox', async () => {
  const adminToken = await loginAdmin();

  const recipient = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const uniqueSubject = `Schema Test ${Date.now()}`;
  const messageType = 'system_notice';

  const sendRes = await request('/api/messages/send', {
    method: 'POST',
    token: coordToken,
    body: {
      recipient_user_id: recipient.id,
      message_type: messageType,
      subject: uniqueSubject,
      body: 'Schema verification body',
      channels: ['sms']
    }
  });
  assert.equal(sendRes.status, 201, `setup: send failed with ${sendRes.status}: ${JSON.stringify(sendRes.data)}`);

  const { status, data } = await request('/api/messages/inbox', { token: recipient.token });
  assert.equal(status, 200, `expected 200 for GET inbox, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.messages), 'inbox response must have a messages array');

  const found = data.messages.find((m) => m.subject === uniqueSubject);
  assert.ok(found, `sent message with subject "${uniqueSubject}" must appear in recipient inbox`);

  // Exact message schema assertions
  assert.ok('id' in found, `inbox message must have 'id' field: ${JSON.stringify(found)}`);
  assert.ok(
    Number.isInteger(found.id) && found.id > 0,
    `inbox message 'id' must be a positive integer, got: ${found.id}`
  );
  assert.ok('sender_user_id' in found, `inbox message must have 'sender_user_id' field: ${JSON.stringify(found)}`);
  assert.ok('recipient_user_id' in found, `inbox message must have 'recipient_user_id' field: ${JSON.stringify(found)}`);
  assert.equal(
    found.recipient_user_id,
    recipient.id,
    `recipient_user_id must match the recipient: ${found.recipient_user_id}`
  );
  assert.equal(found.message_type, messageType, `message_type must match sent value, got: ${found.message_type}`);
  assert.equal(found.subject, uniqueSubject, `subject in inbox must match sent subject`);
  assert.ok('body' in found, `inbox message must have 'body' field: ${JSON.stringify(found)}`);
  assert.ok('status' in found, `inbox message must have 'status' field: ${JSON.stringify(found)}`);
  assert.ok('created_at' in found, `inbox message must have 'created_at' field: ${JSON.stringify(found)}`);
  assert.ok('read_at' in found, `inbox message must have 'read_at' field: ${JSON.stringify(found)}`);
});

test('messaging outbox: Admin GET /api/messages/outbox returns 200 with rows array', async () => {
  const adminToken = await loginAdmin();
  const { status, data } = await request('/api/messages/outbox', { token: adminToken });
  assert.equal(status, 200, `expected 200 for Admin GET outbox, got ${status}: ${JSON.stringify(data)}`);

  // The outbox route returns { rows: [...] }
  assert.ok(
    Array.isArray(data.rows),
    `Admin outbox response must have a rows array, got: ${JSON.stringify(data)}`
  );
});

test('messaging outbox/export: Data Engineer POST /api/messages/outbox/export returns 200 with exported count and rows', async () => {
  const adminToken = await loginAdmin();
  const { token: deToken } = await createUserAndLogin(adminToken, {
    role_name: 'Data Engineer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/messages/outbox/export', {
    method: 'POST',
    token: deToken
  });

  assert.equal(status, 200, `expected 200 for Data Engineer outbox/export, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('exported' in data, `response must have 'exported' field, got: ${JSON.stringify(data)}`);
  assert.equal(typeof data.exported, 'number', `'exported' must be a number, got: ${typeof data.exported}`);
  assert.ok(data.exported >= 0, `'exported' must be non-negative, got: ${data.exported}`);
  assert.ok(Array.isArray(data.rows), `response must have 'rows' array, got: ${JSON.stringify(data)}`);
});

test('messaging outbox/export: Coordinator POST /api/messages/outbox/export returns 200 with exported count and rows', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/messages/outbox/export', {
    method: 'POST',
    token: coordToken
  });

  assert.equal(status, 200, `expected 200 for Coordinator outbox/export, got ${status}: ${JSON.stringify(data)}`);
  assert.ok('exported' in data, `response must have 'exported' field, got: ${JSON.stringify(data)}`);
  assert.equal(typeof data.exported, 'number', `'exported' must be a number, got: ${typeof data.exported}`);
  assert.ok(data.exported >= 0, `'exported' must be non-negative, got: ${data.exported}`);
  assert.ok(Array.isArray(data.rows), `response must have 'rows' array, got: ${JSON.stringify(data)}`);
});
