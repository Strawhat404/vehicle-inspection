import fs from 'fs';
import http from 'http';
import https from 'https';
import { config } from './config.js';
import { query } from './db.js';
import { safeLog } from './utils/redaction.js';
import { startIngestionScheduler } from './services/ingestionSchedulerService.js';
import { createApp } from './app.js';

const app = createApp();

function createServer() {
  if (config.nodeEnv === 'production' && !config.tls.enabled) {
    throw new Error('TLS must remain enabled in production');
  }

  if (!config.tls.enabled) {
    return http.createServer(app.callback());
  }

  if (!fs.existsSync(config.tls.certPath) || !fs.existsSync(config.tls.keyPath)) {
    throw new Error(`TLS enabled but cert files not found at ${config.tls.certPath} and ${config.tls.keyPath}`);
  }

  return https.createServer(
    {
      cert: fs.readFileSync(config.tls.certPath),
      key: fs.readFileSync(config.tls.keyPath)
    },
    app.callback()
  );
}

async function ensureSchemaCompatibility() {
  const logsTableRows = await query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'audit_logs'`
  );
  const eventsTableRows = await query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'audit_events'`
  );

  const hasAuditLogs = Number(logsTableRows[0]?.total || 0) > 0;
  const hasAuditEvents = Number(eventsTableRows[0]?.total || 0) > 0;
  if (hasAuditLogs && !hasAuditEvents) {
    await query('RENAME TABLE audit_logs TO audit_events');
  }

  await query(
    `CREATE TABLE IF NOT EXISTS audit_events (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_user_id BIGINT UNSIGNED NULL,
      actor_role VARCHAR(64) NULL,
      action VARCHAR(120) NOT NULL,
      target_table VARCHAR(120) NOT NULL,
      target_record_id VARCHAR(120) NULL,
      location_code VARCHAR(32) NULL,
      department_code VARCHAR(32) NULL,
      event_hash CHAR(64) NULL,
      details JSON NULL,
      INDEX idx_audit_event_time (event_time),
      INDEX idx_audit_scope (location_code, department_code)
    ) ENGINE=InnoDB`
  );

  const userColumns = [
    { name: 'location_code', ddl: "ADD COLUMN location_code VARCHAR(32) NOT NULL DEFAULT 'HQ'" },
    { name: 'department_code', ddl: "ADD COLUMN department_code VARCHAR(32) NOT NULL DEFAULT 'OPS'" },
    { name: 'team_id', ddl: 'ADD COLUMN team_id VARCHAR(32) NULL' }
  ];

  for (const column of userColumns) {
    const columnRows = await query(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND column_name = ?`,
      [column.name]
    );

    const hasColumn = Number(columnRows[0]?.total || 0) > 0;
    if (!hasColumn) {
      await query(`ALTER TABLE users ${column.ddl}`);
    }
  }
}

async function bootstrap() {
  // Runtime schema guard: keep compatibility with DBs initialized from repo/backend/db/init.sql
  await ensureSchemaCompatibility();
  await startIngestionScheduler();
  const server = createServer();
  server.listen(config.port, () => {
    safeLog('backend_started', { port: config.port, tlsEnabled: config.tls.enabled });
  });
}

bootstrap().catch((error) => {
  safeLog('backend_startup_failed', { error: error.message, stack: error.stack });
  process.exit(1);
});
