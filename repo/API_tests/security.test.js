import test from 'node:test';
import assert from 'node:assert/strict';
import { request, loginAdmin, createUserAndLogin } from './helpers/setup.js';

test('security: IDOR seat assignment blocked and sensitive fields masked for non-admin', async () => {
  const adminToken = await loginAdmin();
  const { token: coordinatorToken } = await createUserAndLogin(adminToken, {
    role_name: 'Coordinator',
    location_code: 'HQ',
    department_code: 'OPS'
  });

  // IDOR: coordinator must not assign a seat for an appointment they do not own
  const { status: idorStatus, data: idorData } = await request('/api/coordinator/waiting-room/assign-seat', {
    method: 'POST',
    token: coordinatorToken,
    body: {
      seat_id: 1,
      appointment_id: 999999,
      location_code: 'HQ',
      department_code: 'OPS'
    }
  });
  assert.equal(idorStatus, 403,
    `expected 403 for out-of-scope seat assignment, got ${idorStatus}: ${JSON.stringify(idorData)}`);

  // Sensitive field masking: plate_number and VIN must be redacted for non-admin roles
  const { status: searchStatus, data: searchData } = await request('/api/search/vehicles?page=1', {
    token: coordinatorToken
  });
  assert.equal(searchStatus, 200,
    `search should return 200, got ${searchStatus}: ${JSON.stringify(searchData)}`);
  assert.ok(Array.isArray(searchData.rows), 'search response must include a rows array');

  if (searchData.rows.length > 0) {
    const first = searchData.rows[0];

    // Verify basic vehicle record structure is present
    assert.ok('brand' in first || 'model_name' in first,
      `search result must include vehicle fields: ${JSON.stringify(first)}`);

    // Sensitive fields must be redacted for coordinators
    assert.equal(first.plate_number, '***REDACTED***',
      `plate_number must be redacted for coordinator, got: ${first.plate_number}`);
    assert.equal(first.vin, '***REDACTED***',
      `vin must be redacted for coordinator, got: ${first.vin}`);

    // Ensure no raw PII leaks under alternate field names
    assert.ok(!first.license_plate || first.license_plate === '***REDACTED***',
      `license_plate must be absent or redacted, got: ${first.license_plate}`);
  }
});
