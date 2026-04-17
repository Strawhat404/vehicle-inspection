import test from 'node:test';
import assert from 'node:assert/strict';
import { redactObject } from '../backend/src/utils/redaction.js';

const REDACTED = '***REDACTED***';

// ─── Sensitive key redaction ──────────────────────────────────────────────────

test('redactObject redacts "token" field to ***REDACTED***', () => {
  const result = redactObject({ token: 'abc123' });
  assert.equal(result.token, REDACTED);
});

test('redactObject redacts "password" field', () => {
  const result = redactObject({ password: 'secret' });
  assert.equal(result.password, REDACTED);
});

test('redactObject redacts "password_hash" field', () => {
  const result = redactObject({ password_hash: 'abc' });
  assert.equal(result.password_hash, REDACTED);
});

test('redactObject redacts "password_salt" field', () => {
  const result = redactObject({ password_salt: 'xyz' });
  assert.equal(result.password_salt, REDACTED);
});

test('redactObject redacts "email" field', () => {
  const result = redactObject({ email: 'user@example.com' });
  assert.equal(result.email, REDACTED);
});

test('redactObject redacts "vin" field', () => {
  const result = redactObject({ vin: '1HGBH41JXMN109186' });
  assert.equal(result.vin, REDACTED);
});

test('redactObject redacts "plate_number" field', () => {
  const result = redactObject({ plate_number: 'KAA123A' });
  assert.equal(result.plate_number, REDACTED);
});

test('redactObject redacts "ssn" field', () => {
  const result = redactObject({ ssn: '123-45-6789' });
  assert.equal(result.ssn, REDACTED);
});

// ─── Non-sensitive fields left untouched ──────────────────────────────────────

test('redactObject leaves non-sensitive fields untouched', () => {
  const result = redactObject({ brand: 'Toyota', model_year: 2022, price_usd: 15000 });
  assert.equal(result.brand, 'Toyota');
  assert.equal(result.model_year, 2022);
  assert.equal(result.price_usd, 15000);
});

test('redactObject returns the same non-sensitive string values', () => {
  const result = redactObject({ status: 'active', location_code: 'HQ' });
  assert.equal(result.status, 'active');
  assert.equal(result.location_code, 'HQ');
});

// ─── Nested objects ───────────────────────────────────────────────────────────

test('redactObject handles nested objects', () => {
  const input = {
    user: {
      id: 1,
      email: 'nested@example.com',
      profile: {
        token: 'tok_xyz',
        name: 'Alice'
      }
    }
  };
  const result = redactObject(input);
  assert.equal(result.user.email, REDACTED);
  assert.equal(result.user.profile.token, REDACTED);
  assert.equal(result.user.id, 1);
  assert.equal(result.user.profile.name, 'Alice');
});

// ─── Arrays of objects ────────────────────────────────────────────────────────

test('redactObject handles arrays of objects', () => {
  const input = [
    { id: 1, password: 'pass1', brand: 'Honda' },
    { id: 2, password: 'pass2', brand: 'Ford' }
  ];
  const result = redactObject(input);
  assert.equal(result[0].password, REDACTED);
  assert.equal(result[0].brand, 'Honda');
  assert.equal(result[1].password, REDACTED);
  assert.equal(result[1].brand, 'Ford');
});

test('redactObject handles arrays nested inside objects', () => {
  const input = {
    items: [
      { vin: 'VIN001', status: 'ok' },
      { vin: 'VIN002', status: 'flagged' }
    ]
  };
  const result = redactObject(input);
  assert.equal(result.items[0].vin, REDACTED);
  assert.equal(result.items[0].status, 'ok');
  assert.equal(result.items[1].vin, REDACTED);
});

// ─── Null / undefined / primitives ────────────────────────────────────────────

test('redactObject returns null unchanged', () => {
  assert.equal(redactObject(null), null);
});

test('redactObject returns undefined unchanged', () => {
  assert.equal(redactObject(undefined), undefined);
});

test('redactObject returns a number unchanged', () => {
  assert.equal(redactObject(42), 42);
});

test('redactObject returns a string unchanged', () => {
  assert.equal(redactObject('hello'), 'hello');
});
