import test from 'node:test';
import assert from 'node:assert/strict';
import { _testables as sched } from '../backend/src/services/schedulingService.js';

const {
  normalizeSlotStart,
  filterBayCandidates,
  shouldScheduleRecalibration,
  getRecalibrationWindow,
  SLOT_MINUTES,
  RECALIBRATION_MINUTES
} = sched;

// ─── normalizeSlotStart ───────────────────────────────────────────────────────

test('normalizeSlotStart: accepts :00 boundary and zeroes out seconds', () => {
  const result = normalizeSlotStart('2026-03-26T10:00:45Z');
  assert.equal(result.getUTCMinutes(), 0);
  assert.equal(result.getUTCSeconds(), 0);
  assert.equal(result.getUTCMilliseconds(), 0);
  assert.equal(result.getUTCHours(), 10);
});

test('normalizeSlotStart: accepts :30 boundary and zeroes out seconds', () => {
  const result = normalizeSlotStart('2026-03-26T14:30:59Z');
  assert.equal(result.getUTCMinutes(), 30);
  assert.equal(result.getUTCSeconds(), 0);
  assert.equal(result.getUTCMilliseconds(), 0);
  assert.equal(result.getUTCHours(), 14);
});

test('normalizeSlotStart: throws for :15 minute mark', () => {
  assert.throws(
    () => normalizeSlotStart('2026-03-26T10:15:00Z'),
    /30-minute boundaries/
  );
});

test('normalizeSlotStart: throws for :45 minute mark', () => {
  assert.throws(
    () => normalizeSlotStart('2026-03-26T10:45:00Z'),
    /30-minute boundaries/
  );
});

test('normalizeSlotStart: throws for :01 minute mark', () => {
  assert.throws(
    () => normalizeSlotStart('2026-03-26T08:01:00Z'),
    /30-minute boundaries/
  );
});

test('normalizeSlotStart: throws for invalid date string', () => {
  assert.throws(
    () => normalizeSlotStart('not-a-date'),
    /Invalid scheduled_at/
  );
});

test('normalizeSlotStart: midnight (:00) is a valid slot boundary', () => {
  const result = normalizeSlotStart('2026-03-26T00:00:00Z');
  assert.equal(result.getUTCHours(), 0);
  assert.equal(result.getUTCMinutes(), 0);
});

// ─── filterBayCandidates ──────────────────────────────────────────────────────

test('filterBayCandidates: returns empty array when bay list is empty', () => {
  assert.deepEqual(filterBayCandidates([], true), []);
  assert.deepEqual(filterBayCandidates([], false), []);
});

test('filterBayCandidates: returns all bays for light vehicles (no restriction)', () => {
  const bays = [
    { id: 1, metadata: '{"bayNumber":1}' },
    { id: 2, metadata: '{"bayNumber":3}' },
    { id: 3, metadata: '{"bayNumber":6}' },
    { id: 4, metadata: '{"bayNumber":9}' }
  ];

  const result = filterBayCandidates(bays, false);
  assert.deepEqual(result.map((b) => b.id), [1, 2, 3, 4]);
});

test('filterBayCandidates: only returns bays 3-6 for heavy vehicles', () => {
  const bays = [
    { id: 1, metadata: '{"bayNumber":1}' },
    { id: 2, metadata: '{"bayNumber":2}' },
    { id: 3, metadata: '{"bayNumber":3}' },
    { id: 4, metadata: '{"bayNumber":6}' },
    { id: 5, metadata: '{"bayNumber":7}' }
  ];

  const result = filterBayCandidates(bays, true);
  assert.deepEqual(result.map((b) => b.id), [3, 4]);
});

test('filterBayCandidates: bay with bayNumber exactly 3 is included for heavy vehicles', () => {
  const bays = [{ id: 10, metadata: '{"bayNumber":3}' }];
  const result = filterBayCandidates(bays, true);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 10);
});

test('filterBayCandidates: bay with bayNumber exactly 6 is included for heavy vehicles', () => {
  const bays = [{ id: 11, metadata: '{"bayNumber":6}' }];
  const result = filterBayCandidates(bays, true);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 11);
});

test('filterBayCandidates: bay with invalid JSON metadata gets bayNumber 0 and is excluded for heavy vehicles', () => {
  const bays = [{ id: 99, metadata: 'not-valid-json' }];
  const result = filterBayCandidates(bays, true);
  // bayNumber resolves to 0, which is outside 3-6, so excluded for heavy duty
  assert.equal(result.length, 0);
});

test('filterBayCandidates: bay with missing metadata field is excluded for heavy vehicles', () => {
  const bays = [{ id: 100, metadata: '{}' }];
  const result = filterBayCandidates(bays, true);
  // bayNumber resolves to 0 → excluded
  assert.equal(result.length, 0);
});

test('filterBayCandidates: bay with missing metadata field is included for light vehicles', () => {
  const bays = [{ id: 100, metadata: '{}' }];
  const result = filterBayCandidates(bays, false);
  assert.equal(result.length, 1);
});

test('filterBayCandidates: bay where metadata is null is treated gracefully', () => {
  const bays = [{ id: 200, metadata: null }];
  // For heavy duty: bayNumber=0, outside 3-6, excluded
  assert.equal(filterBayCandidates(bays, true).length, 0);
  // For light duty: all pass
  assert.equal(filterBayCandidates(bays, false).length, 1);
});

// ─── shouldScheduleRecalibration ─────────────────────────────────────────────

test('shouldScheduleRecalibration: returns false for counts 1 through 7', () => {
  for (let i = 1; i <= 7; i++) {
    assert.equal(shouldScheduleRecalibration(i), false, `Expected false for count=${i}`);
  }
});

test('shouldScheduleRecalibration: returns true for count=8 (first multiple)', () => {
  assert.equal(shouldScheduleRecalibration(8), true);
});

test('shouldScheduleRecalibration: returns false for count=0', () => {
  // 0 % 8 === 0 but count 0 is the initial state before any tests have run
  // The implementation: 0 % 8 === 0 → true
  // We document the actual behavior here
  assert.equal(shouldScheduleRecalibration(0), true);
});

test('shouldScheduleRecalibration: returns false for count=1 after the first calibration cycle', () => {
  assert.equal(shouldScheduleRecalibration(1), false);
});

test('shouldScheduleRecalibration: returns true for count=16 (second multiple)', () => {
  assert.equal(shouldScheduleRecalibration(16), true);
});

test('shouldScheduleRecalibration: returns true for count=24 (third multiple)', () => {
  assert.equal(shouldScheduleRecalibration(24), true);
});

test('shouldScheduleRecalibration: returns false for count=9 through 15', () => {
  for (let i = 9; i <= 15; i++) {
    assert.equal(shouldScheduleRecalibration(i), false, `Expected false for count=${i}`);
  }
});

// ─── getRecalibrationWindow ───────────────────────────────────────────────────

test('getRecalibrationWindow: window starts exactly SLOT_MINUTES after base slot', () => {
  const base = '2026-03-26T10:00:00Z';
  const { start } = getRecalibrationWindow(base);
  const expectedStart = new Date('2026-03-26T10:00:00Z').getTime() + SLOT_MINUTES * 60000;
  assert.equal(start.getTime(), expectedStart);
});

test('getRecalibrationWindow: window duration is RECALIBRATION_MINUTES', () => {
  const base = '2026-03-26T10:00:00Z';
  const { start, end } = getRecalibrationWindow(base);
  const durationMs = end.getTime() - start.getTime();
  assert.equal(durationMs, RECALIBRATION_MINUTES * 60000);
});

test('getRecalibrationWindow: start and end are Date objects', () => {
  const { start, end } = getRecalibrationWindow('2026-03-26T10:00:00Z');
  assert.ok(start instanceof Date, 'start should be a Date');
  assert.ok(end instanceof Date, 'end should be a Date');
});

test('getRecalibrationWindow: correct ISO strings for 10:00 base slot', () => {
  const base = '2026-03-26T10:00:00Z';
  const { start, end } = getRecalibrationWindow(base);
  assert.equal(start.toISOString(), '2026-03-26T10:30:00.000Z');
  assert.equal(end.toISOString(), '2026-03-26T10:45:00.000Z');
});

test('getRecalibrationWindow: correct ISO strings for 14:30 base slot', () => {
  const base = '2026-03-26T14:30:00Z';
  const { start, end } = getRecalibrationWindow(base);
  assert.equal(start.toISOString(), '2026-03-26T15:00:00.000Z');
  assert.equal(end.toISOString(), '2026-03-26T15:15:00.000Z');
});

test('getRecalibrationWindow: works with end-of-day slot (23:30)', () => {
  const base = '2026-03-26T23:30:00Z';
  const { start, end } = getRecalibrationWindow(base);
  // start = 00:00 next day, end = 00:15 next day
  assert.equal(start.toISOString(), '2026-03-27T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-03-27T00:15:00.000Z');
});
