import Router from 'koa-router';
import { authRequired } from '../middleware/auth.js';
import { enforceScope } from '../middleware/rbac.js';
import { query } from '../db.js';

const router = new Router({ prefix: '/api/dashboard' });

router.get('/summary', authRequired, enforceScope(), async (ctx) => {
  const user = ctx.state.user;
  let sql = `
    SELECT
      (SELECT COUNT(*)
       FROM appointments
       WHERE DATE(scheduled_at) = UTC_DATE()) AS todays_appointments,
      (SELECT COUNT(*) FROM appointments WHERE scheduled_at >= UTC_TIMESTAMP()) AS upcoming_appointments,
      (SELECT COUNT(*) FROM inspection_results) AS total_inspections,
      (SELECT COUNT(*) FROM facilities_resources WHERE is_active = 1) AS active_resources,
      (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'running') AS ingestion_running,
      (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'failed') AS ingestion_failed`;
  const params = [];

  if (user.role !== 'Administrator') {
    sql = `
      SELECT
        (SELECT COUNT(*)
         FROM appointments
         WHERE DATE(scheduled_at) = UTC_DATE()
           AND location_code = ?
           AND department_code = ?) AS todays_appointments,
        (SELECT COUNT(*) FROM appointments WHERE scheduled_at >= UTC_TIMESTAMP() AND location_code = ? AND department_code = ?) AS upcoming_appointments,
        (SELECT COUNT(*) FROM inspection_results WHERE location_code = ? AND department_code = ?) AS total_inspections,
        (SELECT COUNT(*) FROM facilities_resources WHERE is_active = 1 AND location_code = ? AND department_code = ?) AS active_resources,
        (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'running') AS ingestion_running,
        (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'failed') AS ingestion_failed`;
    params.push(
      user.locationCode,
      user.departmentCode,
      user.locationCode,
      user.departmentCode,
      user.locationCode,
      user.departmentCode,
      user.locationCode,
      user.departmentCode
    );
  }

  const rows = await query(sql, params);
  
  // Fetch today's appointments
  let todaysAppointments = [];
  if (user.role === 'Administrator') {
    todaysAppointments = await query(
      `SELECT a.id, a.scheduled_at, a.status, u.full_name AS customer_name, 
              JSON_UNQUOTE(JSON_EXTRACT(a.notes, '$.vehicle_type')) AS vehicle_type
       FROM appointments a
       JOIN users u ON u.id = a.customer_id
       WHERE DATE(a.scheduled_at) = UTC_DATE()
       ORDER BY a.scheduled_at ASC
       LIMIT 20`
    );
  } else {
    todaysAppointments = await query(
      `SELECT a.id, a.scheduled_at, a.status, u.full_name AS customer_name,
              JSON_UNQUOTE(JSON_EXTRACT(a.notes, '$.vehicle_type')) AS vehicle_type
       FROM appointments a
       JOIN users u ON u.id = a.customer_id
       WHERE DATE(a.scheduled_at) = UTC_DATE()
         AND a.location_code = ?
         AND a.department_code = ?
       ORDER BY a.scheduled_at ASC
       LIMIT 20`,
      [user.locationCode, user.departmentCode]
    );
  }

  // Fetch resource utilization
  let resourceUtilization = {};
  if (user.role === 'Administrator') {
    const utilRows = await query(
      `SELECT
        (SELECT COUNT(*) FROM facilities_resources WHERE resource_type = 'inspection_bay' AND is_active = 1) AS total_bays,
        (SELECT COUNT(DISTINCT bay_resource_id) FROM bay_capacity_locks WHERE slot_start <= UTC_TIMESTAMP() AND slot_end >= UTC_TIMESTAMP()) AS bays_in_use,
        (SELECT COUNT(*) FROM facilities_resources WHERE resource_type = 'equipment' AND is_active = 1) AS total_equipment,
        (SELECT COUNT(DISTINCT equipment_resource_id) FROM bay_capacity_locks WHERE slot_start <= UTC_TIMESTAMP() AND slot_end >= UTC_TIMESTAMP()) AS equipment_in_use`
    );
    resourceUtilization = utilRows[0] || {};
  } else {
    const utilRows = await query(
      `SELECT
        (SELECT COUNT(*) FROM facilities_resources WHERE resource_type = 'inspection_bay' AND is_active = 1 AND location_code = ? AND department_code = ?) AS total_bays,
        (SELECT COUNT(DISTINCT bay_resource_id) FROM bay_capacity_locks bcl JOIN facilities_resources fr ON fr.id = bcl.bay_resource_id WHERE bcl.slot_start <= UTC_TIMESTAMP() AND bcl.slot_end >= UTC_TIMESTAMP() AND fr.location_code = ? AND fr.department_code = ?) AS bays_in_use,
        (SELECT COUNT(*) FROM facilities_resources WHERE resource_type = 'equipment' AND is_active = 1 AND location_code = ? AND department_code = ?) AS total_equipment,
        (SELECT COUNT(DISTINCT equipment_resource_id) FROM bay_capacity_locks bcl JOIN facilities_resources fr ON fr.id = bcl.equipment_resource_id WHERE bcl.slot_start <= UTC_TIMESTAMP() AND bcl.slot_end >= UTC_TIMESTAMP() AND fr.location_code = ? AND fr.department_code = ?) AS equipment_in_use`,
      [user.locationCode, user.departmentCode, user.locationCode, user.departmentCode, user.locationCode, user.departmentCode, user.locationCode, user.departmentCode]
    );
    resourceUtilization = utilRows[0] || {};
  }

  // Fetch ingestion health
  const ingestionHealth = {};
  if (['Administrator', 'Data Engineer', 'Coordinator'].includes(user.role)) {
    const healthRows = await query(
      `SELECT
        (SELECT COUNT(*) FROM ingestion_jobs ij JOIN users u ON u.id = ij.submitted_by WHERE ij.status = 'queued' AND u.location_code = ? AND u.department_code = ?) AS queued,
        (SELECT COUNT(*) FROM ingestion_jobs ij JOIN users u ON u.id = ij.submitted_by WHERE ij.status = 'running' AND u.location_code = ? AND u.department_code = ?) AS running,
        (SELECT COUNT(*) FROM ingestion_jobs ij JOIN users u ON u.id = ij.submitted_by WHERE ij.status = 'failed' AND ij.updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) AND u.location_code = ? AND u.department_code = ?) AS failed_24h`,
      [user.locationCode, user.departmentCode, user.locationCode, user.departmentCode, user.locationCode, user.departmentCode]
    );
    ingestionHealth.queued = healthRows[0]?.queued ?? 0;
    ingestionHealth.running = healthRows[0]?.running ?? 0;
    ingestionHealth.failed_24h = healthRows[0]?.failed_24h ?? 0;

    const recentJobs = await query(
      `SELECT ij.id, ij.job_type, ij.status, ij.started_at
       FROM ingestion_jobs ij
       JOIN users u ON u.id = ij.submitted_by
       WHERE ij.started_at IS NOT NULL
         AND u.location_code = ?
         AND u.department_code = ?
       ORDER BY ij.started_at DESC
       LIMIT 5`,
      [user.locationCode, user.departmentCode]
    );
    ingestionHealth.recent_jobs = recentJobs;
  }

  ctx.body = {
    user,
    metrics: rows[0] || {
      todays_appointments: 0,
      upcoming_appointments: 0,
      total_inspections: 0,
      active_resources: 0,
      ingestion_running: 0,
      ingestion_failed: 0
    },
    todaysAppointments,
    resourceUtilization,
    ingestionHealth
  };
});

router.get('/coordinator-view', authRequired, enforceScope(), async (ctx) => {
  const locationCode = ctx.query.location || ctx.state.user.locationCode;
  const departmentCode = ctx.query.department || ctx.state.user.departmentCode;

  const seatRows = await query(
    `SELECT id, seat_label, x_pos, y_pos, is_active, occupied_by_appointment_id
     FROM waiting_room_seats
     WHERE location_code = ? AND department_code = ?
     ORDER BY id`,
    [locationCode, departmentCode]
  );

  const bayRows = await query(
    `SELECT fr.id AS bay_id, fr.resource_name, bcl.slot_start, bcl.slot_end, bcl.appointment_id
     FROM facilities_resources fr
     LEFT JOIN bay_capacity_locks bcl
       ON bcl.bay_resource_id = fr.id
      AND bcl.slot_start >= UTC_TIMESTAMP()
      AND bcl.slot_start < DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
      AND bcl.location_code = ?
      AND bcl.department_code = ?
     WHERE fr.resource_type = 'inspection_bay'
       AND fr.location_code = ?
       AND fr.department_code = ?
       AND fr.is_active = 1
     ORDER BY fr.id, bcl.slot_start`,
    [locationCode, departmentCode, locationCode, departmentCode]
  );

  ctx.body = { seats: seatRows, bayUtilization: bayRows };
});

router.get('/ingestion-health', authRequired, enforceScope(), async (ctx) => {
  const user = ctx.state.user;
  if (!['Administrator', 'Data Engineer', 'Coordinator'].includes(user.role)) {
    ctx.status = 403;
    ctx.body = { error: 'Insufficient role permissions' };
    return;
  }

  const statusRows = await query(
    `SELECT status, COUNT(*) AS count
     FROM ingestion_jobs
     GROUP BY status`
  );

  const retryRows = await query(
    `SELECT id, source_system, job_type, status,
            JSON_EXTRACT(payload, '$.retries') AS retries,
            updated_at
     FROM ingestion_jobs
     ORDER BY updated_at DESC
     LIMIT 50`
  );

  const anomalyRows = await query(
    `SELECT qa.id, qa.metric_name, qa.baseline_value, qa.current_value, qa.deviation_percent, qa.triggered_at,
            dv.dataset_name, dv.version_no
     FROM quality_alerts qa
     JOIN dataset_versions dv ON dv.id = qa.dataset_version_id
     WHERE qa.deviation_percent > 2
     ORDER BY qa.triggered_at DESC
     LIMIT 50`
  );

  ctx.body = {
    statuses: statusRows,
    jobs: retryRows.map((row) => ({
      ...row,
      retries: Number(row.retries || 0)
    })),
    alerts: anomalyRows
  };
});

export default router;
