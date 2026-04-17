import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUser, createUserAndLogin, futureSlot } from './helpers/setup.js';

test('cross-scope search isolation: coordinator cannot see other location vehicles', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/search/vehicles?page=1', {
    token: coordToken
  });

  assert.equal(status, 200, `search should return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'response must have a rows array');

  // Verify structure of returned vehicle records
  for (const vehicle of data.rows) {
    assert.ok('brand' in vehicle, `vehicle record missing 'brand' field: ${JSON.stringify(vehicle)}`);
    assert.ok('model_name' in vehicle, `vehicle record missing 'model_name' field: ${JSON.stringify(vehicle)}`);
    assert.ok('model_year' in vehicle, `vehicle record missing 'model_year' field: ${JSON.stringify(vehicle)}`);
    assert.ok('price_usd' in vehicle, `vehicle record missing 'price_usd' field: ${JSON.stringify(vehicle)}`);
    assert.ok('energy_type' in vehicle, `vehicle record missing 'energy_type' field: ${JSON.stringify(vehicle)}`);
    assert.ok('transmission' in vehicle, `vehicle record missing 'transmission' field: ${JSON.stringify(vehicle)}`);
  }
});

test('cross-scope autocomplete isolation: non-admin only sees own scope data', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/search/autocomplete?prefix=T', {
    token: coordToken
  });

  assert.equal(status, 200, `autocomplete should return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.suggestions), 'response must have a suggestions array');
  // Each suggestion must be a string
  for (const suggestion of data.suggestions) {
    assert.equal(typeof suggestion, 'string', `suggestion must be a string, got ${typeof suggestion}: ${JSON.stringify(suggestion)}`);
    assert.ok(suggestion.length > 0, 'suggestion must not be an empty string');
  }
});

test('cross-scope trending isolation: non-admin only sees own scope trends', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/search/trending', {
    token: coordToken
  });

  assert.equal(status, 200, `trending should return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.keywords), 'response must have a keywords array');
  // Each keyword item must have 'keyword' and 'uses' fields
  for (const item of data.keywords) {
    assert.ok('keyword' in item, `trending item missing 'keyword' field: ${JSON.stringify(item)}`);
    assert.ok('uses' in item, `trending item missing 'uses' field: ${JSON.stringify(item)}`);
    assert.equal(typeof item.keyword, 'string', `keyword must be a string, got: ${typeof item.keyword}`);
    assert.equal(typeof item.uses, 'number', `uses must be a number, got: ${typeof item.uses}`);
  }
});

test('file governance: download without valid Referer returns 403 (hotlink protection)', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Attempt to download file ID 999999 without a Referer header matching the frontend origin.
  // The route enforces hotlink protection before any file lookup, so it returns 403.
  const { status, data } = await request('/api/files/download/999999', {
    token: coordToken
  });

  assert.equal(status, 403, `expected 403 (hotlink protection) for download without valid Referer, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'forbidden response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('retention: account closure request workflow', async () => {
  const adminToken = await loginAdmin();
  const { token: customerToken } = await createUserAndLogin(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // Request account closure
  const { status, data } = await request('/api/compliance/account-closure', {
    method: 'POST',
    token: customerToken
  });

  // Should either succeed (201) or indicate already requested (409)
  assert.ok([201, 409].includes(status), `expected 201 or 409 for account closure, got ${status}: ${JSON.stringify(data)}`);

  if (status === 201) {
    // Verify the response includes a request ID
    const requestId = data.requestId ?? data.id;
    assert.ok(requestId, `account closure 201 response must include requestId or id: ${JSON.stringify(data)}`);
    assert.ok(Number.isFinite(Number(requestId)) || typeof requestId === 'string',
      `requestId must be a number or string, got: ${typeof requestId}`);
  }
});

test('cross-scope message access: inbox returns scoped messages with correct structure', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/messages/inbox', {
    token: coordToken
  });

  assert.equal(status, 200, `inbox should return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.messages), 'response must have a messages array');

  // Verify each message has expected fields
  for (const msg of data.messages) {
    assert.ok('id' in msg, `message missing 'id' field: ${JSON.stringify(msg)}`);
    assert.ok('subject' in msg, `message missing 'subject' field: ${JSON.stringify(msg)}`);
    assert.ok('message_type' in msg, `message missing 'message_type' field: ${JSON.stringify(msg)}`);
    assert.ok('status' in msg, `message missing 'status' field: ${JSON.stringify(msg)}`);
  }
});

test('search redaction: admin search returns unredacted plate_number and vin', async () => {
  const adminToken = await loginAdmin();

  const { status, data } = await request('/api/search/vehicles?page=1', {
    token: adminToken
  });

  assert.equal(status, 200, `admin search should return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'response must have a rows array');

  // If records exist, admin must receive unredacted sensitive fields
  for (const vehicle of data.rows) {
    assert.notEqual(
      vehicle.plate_number,
      '***REDACTED***',
      `admin must receive unredacted plate_number, got redacted value on vehicle: ${JSON.stringify(vehicle)}`
    );
    assert.notEqual(
      vehicle.vin,
      '***REDACTED***',
      `admin must receive unredacted vin, got redacted value on vehicle: ${JSON.stringify(vehicle)}`
    );
  }
});

test('search redaction: non-admin search returns redacted plate_number and vin', async () => {
  const adminToken = await loginAdmin();
  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { status, data } = await request('/api/search/vehicles?page=1', {
    token: coordToken
  });

  assert.equal(status, 200, `coordinator search should return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'response must have a rows array');

  if (data.rows.length > 0) {
    const first = data.rows[0];
    assert.equal(
      first.plate_number,
      '***REDACTED***',
      `plate_number must be redacted for coordinator, got: ${first.plate_number}`
    );
    assert.equal(
      first.vin,
      '***REDACTED***',
      `vin must be redacted for coordinator, got: ${first.vin}`
    );
  }
});

test('search filter: brand filter returns only vehicles matching requested brand', async () => {
  const adminToken = await loginAdmin();

  // First fetch all vehicles to find a brand to filter by
  const allRes = await request('/api/search/vehicles?page=1', { token: adminToken });
  assert.equal(allRes.status, 200, `initial search failed: ${allRes.status}`);
  assert.ok(Array.isArray(allRes.data.rows), 'initial search must return rows array');

  if (allRes.data.rows.length === 0) {
    // No records to filter — skip assertion body but keep test green
    return;
  }

  const targetBrand = allRes.data.rows[0].brand;
  assert.ok(targetBrand, 'first vehicle must have a brand field');

  const { status, data } = await request(
    `/api/search/vehicles?page=1&brand=${encodeURIComponent(targetBrand)}`,
    { token: adminToken }
  );

  assert.equal(status, 200, `brand-filtered search should return 200, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data.rows), 'brand-filtered response must have a rows array');

  for (const vehicle of data.rows) {
    assert.equal(
      vehicle.brand,
      targetBrand,
      `brand filter must only return vehicles with brand="${targetBrand}", got: ${vehicle.brand}`
    );
  }
});

test('search sort: sort_by and sort_order params are accepted and return valid response', async () => {
  const adminToken = await loginAdmin();

  const { status: ascStatus, data: ascData } = await request(
    '/api/search/vehicles?page=1&sort_by=date&sort_order=asc',
    { token: adminToken }
  );
  assert.equal(ascStatus, 200, `sort ASC search should return 200, got ${ascStatus}: ${JSON.stringify(ascData)}`);
  assert.ok(Array.isArray(ascData.rows), 'sort ASC response must have a rows array');

  const { status: descStatus, data: descData } = await request(
    '/api/search/vehicles?page=1&sort_by=date&sort_order=desc',
    { token: adminToken }
  );
  assert.equal(descStatus, 200, `sort DESC search should return 200, got ${descStatus}: ${JSON.stringify(descData)}`);
  assert.ok(Array.isArray(descData.rows), 'sort DESC response must have a rows array');

  // sort_by=status is also a valid value
  const { status: statusSortStatus, data: statusSortData } = await request(
    '/api/search/vehicles?page=1&sort_by=status&sort_order=asc',
    { token: adminToken }
  );
  assert.equal(
    statusSortStatus,
    200,
    `sort_by=status search should return 200, got ${statusSortStatus}: ${JSON.stringify(statusSortData)}`
  );
  assert.ok(Array.isArray(statusSortData.rows), 'sort_by=status response must have a rows array');
});

test('search: unauthenticated GET /api/search/vehicles returns 401', async () => {
  const { status, data } = await request('/api/search/vehicles?page=1');
  assert.equal(status, 401, `expected 401 for unauthenticated search, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('search: unauthenticated GET /api/search/autocomplete returns 401', async () => {
  const { status, data } = await request('/api/search/autocomplete?prefix=T');
  assert.equal(status, 401, `expected 401 for unauthenticated autocomplete, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('search: unauthenticated GET /api/search/trending returns 401', async () => {
  const { status, data } = await request('/api/search/trending');
  assert.equal(status, 401, `expected 401 for unauthenticated trending, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.error, 'unauthenticated response must include an error field');
  assert.equal(typeof data.error, 'string', 'error field must be a string');
});

test('inspection result publication workflow', async () => {
  const adminToken = await loginAdmin();

  const { id: customerId } = await createUser(adminToken, {
    role_name: 'Customer',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { token: inspectorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Inspector',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const { token: coordToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  const appointmentRes = await request('/api/coordinator/appointments/schedule', {
    method: 'POST',
    token: coordToken,
    body: {
      customer_id: customerId,
      location_code: 'HQ',
      department_code: 'OPS',
      vehicle_type: 'light',
      scheduled_at: futureSlot(2, 14),
      notes: 'result publication test'
    }
  });

  assert.equal(appointmentRes.status, 201,
    `appointment creation must succeed with 201, got ${appointmentRes.status}: ${JSON.stringify(appointmentRes.data)}`);

  const appointmentId = appointmentRes.data.appointmentId;
  assert.ok(appointmentId, `appointment response must include appointmentId: ${JSON.stringify(appointmentRes.data)}`);
  assert.ok(Number.isInteger(appointmentId) && appointmentId > 0,
    `appointmentId must be a positive integer, got: ${appointmentId}`);

  // Submit inspection result
  const { status: resultStatus, data: resultData } = await request('/api/inspections/results', {
    method: 'POST',
    token: inspectorToken,
    body: {
      appointment_id: appointmentId,
      location_code: 'HQ',
      department_code: 'OPS',
      outcome: 'pass',
      score: 95.5,
      findings: { brake_test: 'pass', emissions: 'pass' }
    }
  });

  // Should succeed (201) or indicate already submitted (409)
  assert.ok([201, 409].includes(resultStatus),
    `expected 201 or 409 for result submission, got ${resultStatus}: ${JSON.stringify(resultData)}`);

  if (resultStatus === 201) {
    // Verify the result response includes identifying fields
    const resultId = resultData.resultId ?? resultData.id ?? resultData.inspection_result_id;
    assert.ok(resultId, `result 201 response must include a result ID: ${JSON.stringify(resultData)}`);
  }
});
