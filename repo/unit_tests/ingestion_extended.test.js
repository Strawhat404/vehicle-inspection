import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as ingest } from '../backend/src/services/ingestionService.js';

const { dedupeRows, deviationPercent, buildCheckpointSnapshot, computeRetryState, pickJobByPriority, deterministicKey, MAX_RETRIES } = ingest;

// ─── dedupeRows ──────────────────────────────────────────────────────────────

test('dedupeRows: returns all rows when no duplicates exist', () => {
  const rows = [
    { vehicle_plate: 'KAA100A', customer_id: '1', appointment_ts: '2026-01-01T08:00:00Z', location_code: 'HQ', department_code: 'OPS' },
    { vehicle_plate: 'KAA101B', customer_id: '2', appointment_ts: '2026-01-01T09:00:00Z', location_code: 'HQ', department_code: 'OPS' },
    { vehicle_plate: 'KAA102C', customer_id: '3', appointment_ts: '2026-01-01T10:00:00Z', location_code: 'HQ', department_code: 'OPS' }
  ];

  const { rows: kept, duplicateCount } = dedupeRows(rows);

  assert.equal(kept.length, 3);
  assert.equal(duplicateCount, 0);
});

test('dedupeRows: removes exact duplicate rows and counts them', () => {
  const baseRow = {
    vehicle_plate: 'KAA123A', customer_id: '42', appointment_ts: '2026-03-26T10:00:00Z',
    location_code: 'HQ', department_code: 'OPS'
  };
  const rows = [baseRow, { ...baseRow }, { ...baseRow }];

  const { rows: kept, duplicateCount } = dedupeRows(rows);

  assert.equal(kept.length, 1);
  assert.equal(duplicateCount, 2);
});

test('dedupeRows: keeps first occurrence and dedupes subsequent identical rows', () => {
  const first = { vehicle_plate: 'KAA123A', customer_id: '42', appointment_ts: '2026-03-26T10:00:00Z', location_code: 'HQ', department_code: 'OPS' };
  const second = { ...first };

  const { rows: kept } = dedupeRows([first, second]);

  assert.equal(kept.length, 1);
  assert.strictEqual(kept[0], first);
});

test('dedupeRows: returns empty array and zero duplicates for empty input', () => {
  const { rows: kept, duplicateCount } = dedupeRows([]);

  assert.equal(kept.length, 0);
  assert.equal(duplicateCount, 0);
});

test('dedupeRows: rows with different plates but same other fields are NOT duplicates', () => {
  const row1 = { vehicle_plate: 'KAA111A', customer_id: '10', appointment_ts: '2026-01-01T08:00:00Z', location_code: 'HQ', department_code: 'OPS' };
  const row2 = { vehicle_plate: 'KAA222B', customer_id: '10', appointment_ts: '2026-01-01T08:00:00Z', location_code: 'HQ', department_code: 'OPS' };

  const { rows: kept, duplicateCount } = dedupeRows([row1, row2]);

  assert.equal(kept.length, 2);
  assert.equal(duplicateCount, 0);
});

// ─── deviationPercent ─────────────────────────────────────────────────────────

test('deviationPercent: returns 0 when both current and baseline are 0', () => {
  assert.equal(deviationPercent(0, 0), 0);
});

test('deviationPercent: returns 100 when baseline is 0 and current is non-zero', () => {
  assert.equal(deviationPercent(5, 0), 100);
  assert.equal(deviationPercent(0.01, 0), 100);
});

test('deviationPercent: returns 0 when current equals baseline', () => {
  assert.equal(deviationPercent(10, 10), 0);
  assert.equal(deviationPercent(0.5, 0.5), 0);
});

test('deviationPercent: computes correct percent for values above baseline', () => {
  // current=15, baseline=10 → |15-10|/10 * 100 = 50.00000
  assert.equal(deviationPercent(15, 10), 50);
});

test('deviationPercent: computes correct percent for values below baseline', () => {
  // current=5, baseline=10 → |5-10|/10 * 100 = 50.00000
  assert.equal(deviationPercent(5, 10), 50);
});

test('deviationPercent: result is rounded to 5 decimal places', () => {
  // current=1, baseline=3 → 66.66666... → 66.66667
  const result = deviationPercent(1, 3);
  assert.equal(result, 66.66667);
});

// ─── buildCheckpointSnapshot edge cases ───────────────────────────────────────

test('buildCheckpointSnapshot: returns zero snapshot for all-zero inputs', () => {
  const snapshot = buildCheckpointSnapshot({ parsedRows: 0, writtenRows: 0, versionNo: 0 });

  assert.deepEqual(snapshot, {
    rows_parsed: 0,
    rows_written: 0,
    dataset_version: 0,
    last_processed_row: 0
  });
});

test('buildCheckpointSnapshot: handles very large row counts', () => {
  const snapshot = buildCheckpointSnapshot({ parsedRows: 10_000_000, writtenRows: 9_999_000, versionNo: 999 });

  assert.equal(snapshot.rows_parsed, 10_000_000);
  assert.equal(snapshot.rows_written, 9_999_000);
  assert.equal(snapshot.dataset_version, 999);
  assert.equal(snapshot.last_processed_row, 10_000_000);
});

test('buildCheckpointSnapshot: last_processed_row always equals rows_parsed', () => {
  for (const n of [1, 50, 100, 5000]) {
    const snapshot = buildCheckpointSnapshot({ parsedRows: n, writtenRows: n - 1, versionNo: 1 });
    assert.equal(snapshot.last_processed_row, snapshot.rows_parsed, `Expected last_processed_row == rows_parsed for n=${n}`);
  }
});

test('buildCheckpointSnapshot: handles missing/falsy inputs gracefully (defaults to 0)', () => {
  const snapshot = buildCheckpointSnapshot({ parsedRows: undefined, writtenRows: null, versionNo: 0 });

  assert.equal(snapshot.rows_parsed, 0);
  assert.equal(snapshot.rows_written, 0);
  assert.equal(snapshot.last_processed_row, 0);
});

// ─── computeRetryState: exhaustive retry counts ──────────────────────────────

test('computeRetryState: retries=0 yields retries=1, shouldFail=false, backoff=2s', () => {
  const result = computeRetryState({ retries: 0 });
  assert.deepEqual(result, { retries: 1, shouldFail: false, retryAfterMs: 2000 });
});

test('computeRetryState: retries=1 yields retries=2, shouldFail=false, backoff=4s', () => {
  const result = computeRetryState({ retries: 1 });
  assert.deepEqual(result, { retries: 2, shouldFail: false, retryAfterMs: 4000 });
});

test('computeRetryState: retries=2 yields retries=3, shouldFail=false, backoff=8s', () => {
  const result = computeRetryState({ retries: 2 });
  assert.deepEqual(result, { retries: 3, shouldFail: false, retryAfterMs: 8000 });
});

test('computeRetryState: retries=3 yields retries=4, shouldFail=false, backoff=16s', () => {
  const result = computeRetryState({ retries: 3 });
  assert.deepEqual(result, { retries: 4, shouldFail: false, retryAfterMs: 16000 });
});

test('computeRetryState: retries=4 yields retries=5, shouldFail=false, backoff=32s', () => {
  const result = computeRetryState({ retries: 4 });
  assert.deepEqual(result, { retries: 5, shouldFail: false, retryAfterMs: 32000 });
});

test('computeRetryState: retries=MAX_RETRIES yields shouldFail=true', () => {
  const result = computeRetryState({ retries: MAX_RETRIES });
  assert.equal(result.shouldFail, true);
  assert.equal(result.retryAfterMs, 0);
  assert.equal(result.retries, MAX_RETRIES + 1);
});

test('computeRetryState: retries well beyond MAX_RETRIES still yields shouldFail=true', () => {
  const result = computeRetryState({ retries: MAX_RETRIES + 10 });
  assert.equal(result.shouldFail, true);
  assert.equal(result.retryAfterMs, 0);
});

// ─── pickJobByPriority edge cases ─────────────────────────────────────────────

test('pickJobByPriority: returns null for empty array', () => {
  assert.equal(pickJobByPriority([]), null);
});

test('pickJobByPriority: returns null when passed non-array', () => {
  assert.equal(pickJobByPriority(null), null);
  assert.equal(pickJobByPriority(undefined), null);
});

test('pickJobByPriority: returns the single queued job', () => {
  const jobs = [{ id: 7, status: 'queued', payload: { priority: 50 }, created_at: '2026-01-01T00:00:00Z' }];
  const result = pickJobByPriority(jobs);
  assert.equal(result.id, 7);
});

test('pickJobByPriority: returns null when all jobs are running (no queued)', () => {
  const jobs = [
    { id: 1, status: 'running', payload: { priority: 1 }, created_at: '2026-01-01T00:00:00Z' },
    { id: 2, status: 'completed', payload: { priority: 2 }, created_at: '2026-01-01T01:00:00Z' }
  ];
  assert.equal(pickJobByPriority(jobs), null);
});

test('pickJobByPriority: among queued jobs picks lowest priority number first', () => {
  const jobs = [
    { id: 10, status: 'queued', payload: { priority: 100 }, created_at: '2026-01-01T00:00:00Z' },
    { id: 11, status: 'queued', payload: { priority: 5 }, created_at: '2026-01-01T00:00:00Z' },
    { id: 12, status: 'queued', payload: { priority: 50 }, created_at: '2026-01-01T00:00:00Z' }
  ];
  const result = pickJobByPriority(jobs);
  assert.equal(result.id, 11);
});

test('pickJobByPriority: among tied priorities picks earliest created_at', () => {
  const jobs = [
    { id: 20, status: 'queued', payload: { priority: 10 }, created_at: '2026-01-01T12:00:00Z' },
    { id: 21, status: 'queued', payload: { priority: 10 }, created_at: '2026-01-01T06:00:00Z' },
    { id: 22, status: 'queued', payload: { priority: 10 }, created_at: '2026-01-01T09:00:00Z' }
  ];
  const result = pickJobByPriority(jobs);
  assert.equal(result.id, 21);
});

test('pickJobByPriority: ignores running jobs and picks best queued', () => {
  const jobs = [
    { id: 30, status: 'running', payload: { priority: 1 }, created_at: '2026-01-01T00:00:00Z' },
    { id: 31, status: 'queued', payload: { priority: 99 }, created_at: '2026-01-01T00:00:00Z' },
    { id: 32, status: 'queued', payload: { priority: 50 }, created_at: '2026-01-01T00:00:00Z' }
  ];
  const result = pickJobByPriority(jobs);
  assert.equal(result.id, 32);
});

// ─── deterministicKey edge cases ──────────────────────────────────────────────

test('deterministicKey: produces stable hash for identical rows', () => {
  const row = { vehicle_plate: 'TEST001', customer_id: '99', appointment_ts: '2026-06-01T12:00:00Z', location_code: 'HQ', department_code: 'OPS' };
  assert.equal(deterministicKey(row), deterministicKey({ ...row }));
});

test('deterministicKey: different plates produce different hashes', () => {
  const base = { vehicle_plate: 'AAA001', customer_id: '1', appointment_ts: '2026-01-01T00:00:00Z', location_code: 'HQ', department_code: 'OPS' };
  const other = { ...base, vehicle_plate: 'BBB002' };
  assert.notEqual(deterministicKey(base), deterministicKey(other));
});

test('deterministicKey: special characters in plate are handled without throwing', () => {
  const row = { vehicle_plate: 'KNY-999/Ä', customer_id: '5', appointment_ts: '2026-01-01T00:00:00Z', location_code: 'HQ', department_code: 'OPS' };
  assert.doesNotThrow(() => deterministicKey(row));
  const key = deterministicKey(row);
  assert.equal(typeof key, 'string');
  assert.equal(key.length, 64); // SHA-256 hex is always 64 chars
});

test('deterministicKey: missing fields fall back to empty string (deterministic)', () => {
  const sparse = {};
  const key1 = deterministicKey(sparse);
  const key2 = deterministicKey(sparse);
  assert.equal(key1, key2);
  assert.equal(typeof key1, 'string');
  assert.equal(key1.length, 64);
});

test('deterministicKey: returns 64-character hex string for any valid row', () => {
  const row = { vehicle_plate: 'KAA123A', customer_id: '42', appointment_ts: '2026-03-26T10:00:00Z', location_code: 'HQ', department_code: 'OPS' };
  const key = deterministicKey(row);
  assert.equal(key.length, 64);
  assert.match(key, /^[0-9a-f]+$/);
});
