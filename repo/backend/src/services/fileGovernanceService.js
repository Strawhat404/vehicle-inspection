import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';
import { config } from '../config.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'text/plain', 'text/csv', 'image/png', 'image/jpeg']);
const ALLOWED_EXT = new Set(['.pdf', '.txt', '.csv', '.png', '.jpg', '.jpeg']);

function hashContent(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function scanSensitive(buffer) {
  const text = buffer.toString('utf8');
  for (const rule of config.sensitiveContent.regexRules) {
    try {
      const regex = new RegExp(rule.pattern, 'gi');
      if (regex.test(text)) return rule.name;
    } catch {
      // Skip invalid runtime-configured expressions instead of crashing file governance.
    }
  }

  const lowered = text.toLowerCase();
  for (const term of config.sensitiveContent.dictionaryTerms) {
    if (lowered.includes(String(term).toLowerCase())) {
      return `dictionary:${term}`;
    }
  }
  return null;
}

export async function findAuthorizedFileDownload({ fileId, actor }) {
  const rows = await query(
    `SELECT id, uploaded_by, storage_path, file_name, mime_type, location_code, department_code
     FROM files
     WHERE id = ?`,
    [fileId]
  );

  if (!rows.length) return null;
  const file = rows[0];
  if (actor.role !== 'Administrator') {
    if (
      file.location_code !== actor.locationCode ||
      file.department_code !== actor.departmentCode
    ) {
      return null;
    }
  }

  if (!fs.existsSync(file.storage_path)) {
    throw new Error('Stored file missing on disk');
  }

  return file;
}

export async function validateAndIngestFile({
  uploaderId,
  locationCode,
  departmentCode,
  sourcePath,
  mimeType,
  linkedTable,
  linkedRecordId
}) {
  const resolved = path.resolve(sourcePath);
  const allowedRoot = path.resolve(config.ingestion.dropRoot);
  if (resolved !== allowedRoot && !resolved.startsWith(allowedRoot + path.sep)) {
    throw new Error('Source path is outside allowed drop root');
  }
  if (!fs.existsSync(resolved)) throw new Error('File not found');

  const stat = fs.statSync(resolved);
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error('File exceeds 50MB limit');
  }

  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error('Blocked file extension');
  }

  if (mimeType && !ALLOWED_MIME.has(mimeType)) {
    throw new Error('Blocked MIME type');
  }

  const buffer = fs.readFileSync(resolved);
  const checksum = hashContent(buffer);

  const blocked = await query('SELECT id FROM blocked_file_hashes WHERE checksum_sha256 = ?', [checksum]);
  if (blocked.length) {
    throw new Error('File hash is blocked by governance policy');
  }

  await query(
    `INSERT INTO files
      (uploaded_by, storage_path, file_name, mime_type, file_size_bytes, checksum_sha256, linked_table, linked_record_id, location_code, department_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uploaderId,
      resolved,
      path.basename(resolved),
      mimeType || null,
      stat.size,
      checksum,
      linkedTable || null,
      linkedRecordId || null,
      locationCode,
      departmentCode
    ]
  );

  const rows = await query('SELECT LAST_INSERT_ID() AS id');
  const fileId = rows[0].id;

  const sensitiveMatch = scanSensitive(buffer);
  if (sensitiveMatch) {
    await query(
      'INSERT INTO file_quarantine (file_id, reason, matched_pattern) VALUES (?, ?, ?)',
      [fileId, 'Sensitive content detected', sensitiveMatch]
    );
  }

  return {
    fileId,
    checksum,
    quarantined: Boolean(sensitiveMatch),
    sensitivePattern: sensitiveMatch
  };
}
