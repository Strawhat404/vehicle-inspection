import fs from 'fs';
import path from 'path';
import { query } from '../db.js';
import { config } from '../config.js';

export async function exportAuditLedger() {
  const rows = await query(
    `SELECT id, event_time, actor_user_id, actor_role, action, target_table, target_record_id,
            location_code, department_code, event_hash, details
     FROM audit_events
     ORDER BY id ASC`
  );

  const allowedRoot = path.resolve(config.audit.exportDir);
  fs.mkdirSync(allowedRoot, { recursive: true });

  const filePath = path.join(allowedRoot, `audit-ledger-${Date.now()}.jsonl`);
  const jsonl = rows.map((row) => JSON.stringify(row)).join('\n');
  fs.writeFileSync(filePath, jsonl ? `${jsonl}\n` : '', 'utf8');

  return {
    exported: rows.length,
    filePath
  };
}
