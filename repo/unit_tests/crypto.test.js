import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordComplexity, hashPassword, verifyPassword, generateToken } from '../backend/src/utils/crypto.js';

// ─── validatePasswordComplexity ───────────────────────────────────────────────

test('validatePasswordComplexity: true for valid password with 12+ chars, upper, lower, digit, special', () => {
  assert.equal(validatePasswordComplexity('Abcdefgh1234!'), true);
});

test('validatePasswordComplexity: false for password that is too short (< 12 chars)', () => {
  assert.equal(validatePasswordComplexity('short1A!'), false);
});

test('validatePasswordComplexity: false for password with no uppercase', () => {
  assert.equal(validatePasswordComplexity('abcdefgh1234!'), false);
});

test('validatePasswordComplexity: false for password with no lowercase', () => {
  assert.equal(validatePasswordComplexity('ABCDEFGH1234!'), false);
});

test('validatePasswordComplexity: false for password with no digit', () => {
  assert.equal(validatePasswordComplexity('Abcdefghijkl!'), false);
});

test('validatePasswordComplexity: false for password with no special character', () => {
  assert.equal(validatePasswordComplexity('Abcdefgh12345'), false);
});

test('validatePasswordComplexity: false for null', () => {
  assert.equal(validatePasswordComplexity(null), false);
});

test('validatePasswordComplexity: false for undefined', () => {
  assert.equal(validatePasswordComplexity(undefined), false);
});

test('validatePasswordComplexity: false for empty string', () => {
  assert.equal(validatePasswordComplexity(''), false);
});

test('validatePasswordComplexity: false for a number', () => {
  assert.equal(validatePasswordComplexity(12345678901234), false);
});

// ─── hashPassword (bcrypt path — no salt) ────────────────────────────────────

test('hashPassword without salt uses bcrypt: hash starts with $2b$12$', () => {
  const { hash } = hashPassword('Abcdefgh1234!');
  assert.ok(hash.startsWith('$2b$12$'), `Expected bcrypt hash prefix, got: ${hash}`);
});

test('hashPassword without salt uses bcrypt: salt field is null', () => {
  const { salt } = hashPassword('Abcdefgh1234!');
  assert.equal(salt, null);
});

// ─── hashPassword (pbkdf2 path — with salt) ───────────────────────────────────

test('hashPassword with salt uses pbkdf2: hash is a hex string', () => {
  const saltValue = 'testsalt';
  const { hash } = hashPassword('Abcdefgh1234!', saltValue);
  assert.match(hash, /^[0-9a-f]+$/, 'Expected hex string hash from pbkdf2');
});

test('hashPassword with salt uses pbkdf2: returns the same salt back', () => {
  const saltValue = 'testsalt';
  const { salt } = hashPassword('Abcdefgh1234!', saltValue);
  assert.equal(salt, saltValue);
});

// ─── verifyPassword (bcrypt path) ────────────────────────────────────────────

test('verifyPassword with bcrypt hash returns true for correct password', () => {
  const password = 'Abcdefgh1234!';
  const { hash } = hashPassword(password);
  assert.equal(verifyPassword(password, null, hash), true);
});

test('verifyPassword with bcrypt hash returns false for wrong password', () => {
  const { hash } = hashPassword('Abcdefgh1234!');
  assert.equal(verifyPassword('WrongPassword1!', null, hash), false);
});

// ─── verifyPassword (pbkdf2 path) ────────────────────────────────────────────

test('verifyPassword with pbkdf2 hash returns true for correct password', () => {
  const password = 'Abcdefgh1234!';
  const saltValue = 'a-unique-salt-value';
  const { hash } = hashPassword(password, saltValue);
  assert.equal(verifyPassword(password, saltValue, hash), true);
});

test('verifyPassword with pbkdf2 hash returns false for wrong password', () => {
  const saltValue = 'a-unique-salt-value';
  const { hash } = hashPassword('Abcdefgh1234!', saltValue);
  assert.equal(verifyPassword('WrongPassword1!', saltValue, hash), false);
});

test('verifyPassword with null salt and non-bcrypt hash returns false', () => {
  // A hex string that looks like a pbkdf2 hash but has no bcrypt prefix; without a salt the
  // code must return false rather than throwing.
  const fakeHexHash = 'a'.repeat(128);
  assert.equal(verifyPassword('Abcdefgh1234!', null, fakeHexHash), false);
});

// ─── generateToken ────────────────────────────────────────────────────────────

test('generateToken returns a 96-character string', () => {
  const token = generateToken();
  assert.equal(token.length, 96);
});

test('generateToken returns a lowercase hex string matching /^[0-9a-f]{96}$/', () => {
  const token = generateToken();
  assert.match(token, /^[0-9a-f]{96}$/);
});

test('generateToken returns different values on successive calls', () => {
  const t1 = generateToken();
  const t2 = generateToken();
  assert.notEqual(t1, t2);
});
