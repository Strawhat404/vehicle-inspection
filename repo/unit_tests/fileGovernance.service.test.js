import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables } from '../backend/src/services/fileGovernanceService.js';

const { hashContent, scanSensitive, MAX_FILE_BYTES, ALLOWED_MIME, ALLOWED_EXT } = _testables;

// ─── MAX_FILE_BYTES ───────────────────────────────────────────────────────────

test('MAX_FILE_BYTES is 50MB (52428800 bytes)', () => {
  assert.equal(MAX_FILE_BYTES, 50 * 1024 * 1024);
});

// ─── ALLOWED_MIME ─────────────────────────────────────────────────────────────

test('ALLOWED_MIME is a Set', () => {
  assert.ok(ALLOWED_MIME instanceof Set);
});

test('ALLOWED_MIME contains application/pdf', () => {
  assert.ok(ALLOWED_MIME.has('application/pdf'));
});

test('ALLOWED_MIME contains text/plain', () => {
  assert.ok(ALLOWED_MIME.has('text/plain'));
});

test('ALLOWED_MIME contains text/csv', () => {
  assert.ok(ALLOWED_MIME.has('text/csv'));
});

test('ALLOWED_MIME contains image/png', () => {
  assert.ok(ALLOWED_MIME.has('image/png'));
});

test('ALLOWED_MIME contains image/jpeg', () => {
  assert.ok(ALLOWED_MIME.has('image/jpeg'));
});

// ─── ALLOWED_EXT ──────────────────────────────────────────────────────────────

test('ALLOWED_EXT is a Set', () => {
  assert.ok(ALLOWED_EXT instanceof Set);
});

test('ALLOWED_EXT contains .pdf', () => {
  assert.ok(ALLOWED_EXT.has('.pdf'));
});

test('ALLOWED_EXT contains .txt', () => {
  assert.ok(ALLOWED_EXT.has('.txt'));
});

test('ALLOWED_EXT contains .csv', () => {
  assert.ok(ALLOWED_EXT.has('.csv'));
});

test('ALLOWED_EXT contains .png', () => {
  assert.ok(ALLOWED_EXT.has('.png'));
});

test('ALLOWED_EXT contains .jpg', () => {
  assert.ok(ALLOWED_EXT.has('.jpg'));
});

test('ALLOWED_EXT contains .jpeg', () => {
  assert.ok(ALLOWED_EXT.has('.jpeg'));
});

// ─── hashContent ──────────────────────────────────────────────────────────────

test('hashContent returns a 64-char hex string', () => {
  const result = hashContent(Buffer.from('hello'));
  assert.equal(typeof result, 'string');
  assert.equal(result.length, 64);
  assert.match(result, /^[0-9a-f]+$/);
});

test('hashContent returns consistent SHA-256 hex for the same input', () => {
  const buf = Buffer.from('consistent content');
  assert.equal(hashContent(buf), hashContent(buf));
});

test('hashContent returns the same hash on repeated calls with identical content', () => {
  const h1 = hashContent(Buffer.from('vehicle inspection'));
  const h2 = hashContent(Buffer.from('vehicle inspection'));
  assert.equal(h1, h2);
});

test('hashContent returns different hashes for different inputs', () => {
  const h1 = hashContent(Buffer.from('input-one'));
  const h2 = hashContent(Buffer.from('input-two'));
  assert.notEqual(h1, h2);
});

test('hashContent returns the known SHA-256 of "hello"', () => {
  // sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
  const expected = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
  assert.equal(hashContent(Buffer.from('hello')), expected);
});

// ─── scanSensitive ────────────────────────────────────────────────────────────
//
// The default config (no .env present) sets:
//   regexRules: [ {name:'ssn', pattern:'\\b\\d{3}-\\d{2}-\\d{4}\\b'},
//                 {name:'ssn_compact', pattern:'\\b\\d{9}\\b'} ]
//   dictionaryTerms: ['social security number', 'ssn']

test('scanSensitive returns null for clean content', () => {
  const buf = Buffer.from('This report contains no sensitive information.');
  assert.equal(scanSensitive(buf), null);
});

test('scanSensitive detects SSN pattern (123-45-6789)', () => {
  const buf = Buffer.from('Customer SSN: 123-45-6789');
  const result = scanSensitive(buf);
  assert.notEqual(result, null, 'Expected a match for formatted SSN');
});

test('scanSensitive returns the matched rule name for formatted SSN', () => {
  const buf = Buffer.from('SSN on file: 123-45-6789');
  const result = scanSensitive(buf);
  assert.equal(result, 'ssn');
});

test('scanSensitive detects compact SSN (123456789)', () => {
  const buf = Buffer.from('Identifier: 123456789');
  const result = scanSensitive(buf);
  assert.notEqual(result, null, 'Expected a match for compact SSN');
});

test('scanSensitive returns rule name ssn_compact for compact SSN', () => {
  const buf = Buffer.from('Record 123456789 found');
  const result = scanSensitive(buf);
  assert.equal(result, 'ssn_compact');
});

test('scanSensitive detects dictionary term "social security number" (case insensitive)', () => {
  const buf = Buffer.from('Please provide your Social Security Number for verification.');
  const result = scanSensitive(buf);
  assert.notEqual(result, null, 'Expected match for "social security number"');
  assert.ok(result.includes('social security number'), `Expected term in result, got: ${result}`);
});

test('scanSensitive returns dictionary: prefixed result for dictionary terms', () => {
  const buf = Buffer.from('SOCIAL SECURITY NUMBER required');
  const result = scanSensitive(buf);
  assert.ok(result.startsWith('dictionary:'), `Expected "dictionary:" prefix in: ${result}`);
});

test('scanSensitive detects dictionary term "ssn" case-insensitively', () => {
  const buf = Buffer.from('Please enter your SSN to proceed.');
  // Note: regex rules run first; "SSN" text alone (not digits) won't match regex,
  // but the dictionary term "ssn" will match the lowercased text.
  const result = scanSensitive(buf);
  assert.notEqual(result, null, 'Expected match for dictionary term "ssn"');
});

// ─── ALLOWED_EXT extra membership checks ─────────────────────────────────────

test('ALLOWED_EXT contains .jpeg', () => {
  assert.ok(ALLOWED_EXT.has('.jpeg'));
});

test('ALLOWED_EXT does not contain .exe', () => {
  assert.ok(!ALLOWED_EXT.has('.exe'));
});

test('ALLOWED_EXT does not contain .js', () => {
  assert.ok(!ALLOWED_EXT.has('.js'));
});

test('ALLOWED_EXT does not contain .html', () => {
  assert.ok(!ALLOWED_EXT.has('.html'));
});

// ─── ALLOWED_MIME exclusion checks ───────────────────────────────────────────

test('ALLOWED_MIME does not contain application/zip', () => {
  assert.ok(!ALLOWED_MIME.has('application/zip'));
});

test('ALLOWED_MIME does not contain application/javascript', () => {
  assert.ok(!ALLOWED_MIME.has('application/javascript'));
});

// ─── hashContent edge case: empty buffer ─────────────────────────────────────

test('hashContent of empty buffer produces consistent SHA-256 of empty string', () => {
  // sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const result = hashContent(Buffer.alloc(0));
  assert.equal(result, expected);
});

// ─── scanSensitive priority and negative cases ────────────────────────────────

test('scanSensitive with content matching both regex AND dictionary term returns regex match first', () => {
  // "social security number 123-45-6789" triggers regex rule "ssn" first (regex rules run before
  // dictionary), so the result should be the rule name rather than a dictionary: prefix.
  const buf = Buffer.from('social security number 123-45-6789');
  const result = scanSensitive(buf);
  assert.equal(result, 'ssn', `Expected regex rule name "ssn" to win, got: ${result}`);
});

test('scanSensitive returns null for short number sequence that does not match SSN pattern', () => {
  // "12345" is too short to match \\b\\d{9}\\b and does not match \\b\\d{3}-\\d{2}-\\d{4}\\b
  const buf = Buffer.from('12345');
  assert.equal(scanSensitive(buf), null);
});
