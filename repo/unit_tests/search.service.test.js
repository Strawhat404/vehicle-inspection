import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables } from '../backend/src/services/searchService.js';

const { buildWhere, sortClause, PAGE_SIZE } = _testables;

// ─── PAGE_SIZE ────────────────────────────────────────────────────────────────

test('PAGE_SIZE is 25', () => {
  assert.equal(PAGE_SIZE, 25);
});

// ─── buildWhere: baseline ────────────────────────────────────────────────────

test('buildWhere with no filters returns "1=1"', () => {
  const params = [];
  const result = buildWhere({}, params);
  assert.equal(result, '1=1');
  assert.deepEqual(params, []);
});

test('buildWhere with null filters returns "1=1"', () => {
  const params = [];
  const result = buildWhere(null, params);
  assert.equal(result, '1=1');
  assert.deepEqual(params, []);
});

// ─── buildWhere: brand filter ─────────────────────────────────────────────────

test('buildWhere with brand filter adds brand = ? clause', () => {
  const params = [];
  const result = buildWhere({ brand: 'Toyota' }, params);
  assert.ok(result.includes('brand = ?'), `Expected "brand = ?" in: ${result}`);
  assert.ok(params.includes('Toyota'));
});

// ─── buildWhere: actor scope isolation ───────────────────────────────────────

test('buildWhere with Customer actor adds customer_id scope', () => {
  const params = [];
  const actor = { role: 'Customer', id: 42, locationCode: 'LOC1', departmentCode: 'DEP1' };
  const result = buildWhere({}, params, actor);
  assert.ok(result.includes('a.customer_id = ?'), `Expected customer_id scope in: ${result}`);
  assert.ok(params.includes(42));
});

test('buildWhere with Customer actor also adds location_code and department_code scope', () => {
  const params = [];
  const actor = { role: 'Customer', id: 7, locationCode: 'LOC2', departmentCode: 'DEP2' };
  const result = buildWhere({}, params, actor);
  assert.ok(result.includes('a.location_code = ?'), `Expected location_code scope in: ${result}`);
  assert.ok(result.includes('a.department_code = ?'), `Expected department_code scope in: ${result}`);
});

test('buildWhere with non-admin actor adds location_code and department_code scope', () => {
  const params = [];
  const actor = { role: 'Inspector', id: 10, locationCode: 'LOC3', departmentCode: 'DEP3' };
  const result = buildWhere({}, params, actor);
  assert.ok(result.includes('a.location_code = ?'), `Expected location_code scope in: ${result}`);
  assert.ok(result.includes('a.department_code = ?'), `Expected department_code scope in: ${result}`);
  assert.ok(params.includes('LOC3'));
  assert.ok(params.includes('DEP3'));
});

test('buildWhere with Administrator actor does NOT add scope filters', () => {
  const params = [];
  const actor = { role: 'Administrator', id: 1, locationCode: 'LOC4', departmentCode: 'DEP4' };
  const result = buildWhere({}, params, actor);
  assert.ok(!result.includes('a.customer_id'), `Did not expect customer_id scope in: ${result}`);
  assert.ok(!result.includes('a.location_code'), `Did not expect location_code scope in: ${result}`);
  assert.ok(!result.includes('a.department_code'), `Did not expect department_code scope in: ${result}`);
  assert.deepEqual(params, []);
});

// ─── buildWhere: query text (LIKE) ────────────────────────────────────────────

test('buildWhere with query text adds LIKE conditions', () => {
  const params = [];
  const result = buildWhere({ query: 'civic' }, params);
  assert.ok(result.includes('LIKE ?'), `Expected LIKE clause in: ${result}`);
  assert.ok(params.some((p) => p === '%civic%'), 'Expected %civic% in params');
});

// ─── buildWhere: price range ──────────────────────────────────────────────────

test('buildWhere with price_min adds price_usd >= ? clause', () => {
  const params = [];
  const result = buildWhere({ price_min: 5000 }, params);
  assert.ok(result.includes('price_usd >= ?'), `Expected price_usd >= ? in: ${result}`);
  assert.ok(params.includes(5000));
});

test('buildWhere with price_max adds price_usd <= ? clause', () => {
  const params = [];
  const result = buildWhere({ price_max: 20000 }, params);
  assert.ok(result.includes('price_usd <= ?'), `Expected price_usd <= ? in: ${result}`);
  assert.ok(params.includes(20000));
});

test('buildWhere with both price_min and price_max adds both range clauses', () => {
  const params = [];
  const result = buildWhere({ price_min: 1000, price_max: 9999 }, params);
  assert.ok(result.includes('price_usd >= ?'));
  assert.ok(result.includes('price_usd <= ?'));
  assert.ok(params.includes(1000));
  assert.ok(params.includes(9999));
});

// ─── buildWhere: exact match fields ──────────────────────────────────────────

test('buildWhere with energy_type adds energy_type = ? clause', () => {
  const params = [];
  const result = buildWhere({ energy_type: 'Electric' }, params);
  assert.ok(result.includes('energy_type = ?'), `Expected energy_type = ? in: ${result}`);
  assert.ok(params.includes('Electric'));
});

test('buildWhere with transmission adds transmission = ? clause', () => {
  const params = [];
  const result = buildWhere({ transmission: 'Automatic' }, params);
  assert.ok(result.includes('transmission = ?'), `Expected transmission = ? in: ${result}`);
  assert.ok(params.includes('Automatic'));
});

test('buildWhere with model_year adds model_year = ? clause', () => {
  const params = [];
  const result = buildWhere({ model_year: '2022' }, params);
  assert.ok(result.includes('model_year = ?'), `Expected model_year = ? in: ${result}`);
  assert.ok(params.includes(2022));
});

// ─── buildWhere: date range ────────────────────────────────────────────────────

test('buildWhere with date_from adds COALESCE >= ? clause', () => {
  const params = [];
  const result = buildWhere({ date_from: '2025-01-01' }, params);
  assert.ok(result.includes('COALESCE(a.scheduled_at, vr.created_at) >= ?'), `Expected date_from clause in: ${result}`);
  assert.ok(params.includes('2025-01-01'));
});

test('buildWhere with date_to adds COALESCE <= ? clause', () => {
  const params = [];
  const result = buildWhere({ date_to: '2025-12-31' }, params);
  assert.ok(result.includes('COALESCE(a.scheduled_at, vr.created_at) <= ?'), `Expected date_to clause in: ${result}`);
  assert.ok(params.includes('2025-12-31'));
});

// ─── sortClause ───────────────────────────────────────────────────────────────

test('sortClause defaults to "vr.created_at DESC"', () => {
  const result = sortClause(undefined, undefined);
  assert.equal(result, 'vr.created_at DESC');
});

test('sortClause with no arguments returns "vr.created_at DESC"', () => {
  const result = sortClause();
  assert.equal(result, 'vr.created_at DESC');
});

test('sortClause with sort_by="status" returns a.status clause', () => {
  const result = sortClause('status', 'desc');
  assert.ok(result.startsWith('a.status'), `Expected result starting with a.status, got: ${result}`);
});

test('sortClause with sort_by="status" and sort_order="desc" contains DESC', () => {
  const result = sortClause('status', 'desc');
  assert.ok(result.includes('DESC'), `Expected DESC in: ${result}`);
});

test('sortClause with sort_order="asc" returns ASC', () => {
  const result = sortClause(undefined, 'asc');
  assert.ok(result.includes('ASC'), `Expected ASC in: ${result}`);
  assert.ok(!result.includes('DESC'), `Did not expect DESC in: ${result}`);
});

test('sortClause with sort_by="status" and sort_order="asc" returns ASC', () => {
  const result = sortClause('status', 'asc');
  assert.ok(result.includes('ASC'), `Expected ASC in: ${result}`);
});
