import { query } from '../db.js';

const REPORT_RETENTION_YEARS = 7;
const ACCOUNT_CLOSURE_DAYS = 30;

export async function createAccountClosureRequest(userId) {
  const existing = await query(
    `SELECT id FROM account_closure_requests WHERE user_id = ? AND status = 'pending' LIMIT 1`,
    [userId]
  );
  if (existing.length) return existing[0].id;

  await query(
    `INSERT INTO account_closure_requests (user_id, due_by, status)
     VALUES (?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY), 'pending')`,
    [userId, ACCOUNT_CLOSURE_DAYS]
  );
  const rows = await query('SELECT LAST_INSERT_ID() AS id');
  return rows[0].id;
}

export async function runRetentionSweep() {
  const oldReports = await query(
    `SELECT id
     FROM inspection_results
     WHERE completed_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? YEAR)
       AND id NOT IN (SELECT inspection_result_id FROM report_tombstones)`,
    [REPORT_RETENTION_YEARS]
  );

  for (const r of oldReports) {
    await query(
      `INSERT INTO report_tombstones (inspection_result_id, tombstone_ref, retention_reason)
       VALUES (?, ?, '7-year-retention-expired')`,
      [r.id, `TMB-${r.id}`]
    );

    await query(
      `UPDATE inspection_results
       SET findings = JSON_OBJECT('tombstoned', TRUE, 'ref', ?),
           score = NULL
       WHERE id = ?`,
      [`TMB-${r.id}`, r.id]
    );
  }

  const pendingClosures = await query(
    `SELECT id, user_id
     FROM account_closure_requests
     WHERE status = 'pending'
       AND due_by <= UTC_TIMESTAMP()`
  );

  for (const c of pendingClosures) {
    await query(
      `UPDATE users
       SET email = CONCAT('closed+', id, '@redacted.local'),
           full_name = CONCAT('Closed User #', id),
           username = CONCAT('closed_user_', id),
           is_active = 0
       WHERE id = ?`,
      [c.user_id]
    );

    await query(
      `UPDATE account_closure_requests
       SET status = 'completed', processed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [c.id]
    );
  }

  return {
    tombstonedReports: oldReports.length,
    completedClosures: pendingClosures.length
  };
}

export const _testables = { REPORT_RETENTION_YEARS, ACCOUNT_CLOSURE_DAYS };
