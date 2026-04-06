import { query, getConnection } from '../db.js';

const SLOT_MINUTES = 30;
const RECALIBRATION_AFTER_TESTS = 8;
const RECALIBRATION_MINUTES = 15;

function normalizeSlotStart(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid scheduled_at');
  const mins = d.getUTCMinutes();
  if (mins !== 0 && mins !== 30) {
    throw new Error('Appointments must start at 30-minute boundaries');
  }
  d.setUTCSeconds(0, 0);
  return d;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function isHeavyVehicle(vehicleType) {
  return String(vehicleType || '').toLowerCase() === 'heavy_duty';
}

function getBayNumber(metadata) {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return Number(parsed?.bayNumber || 0);
  } catch {
    return 0;
  }
}

function filterBayCandidates(rows, heavyDuty) {
  return rows.filter((r) => {
    const bayNo = getBayNumber(r.metadata);
    if (!heavyDuty) return true;
    return bayNo >= 3 && bayNo <= 6;
  });
}

function shouldScheduleRecalibration(nextTestCount) {
  return Number(nextTestCount) % RECALIBRATION_AFTER_TESTS === 0;
}

function getRecalibrationWindow(baseSlotStart) {
  const start = addMinutes(new Date(baseSlotStart), SLOT_MINUTES);
  const end = addMinutes(start, RECALIBRATION_MINUTES);
  return { start, end };
}

async function selectAvailableInspector({ locationCode, departmentCode, slotStart }) {
  const rows = await query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN bay_capacity_locks bcl ON bcl.inspector_id = u.id AND bcl.slot_start = ?
     WHERE r.name = 'Inspector'
       AND u.is_active = 1
       AND u.location_code = ?
       AND u.department_code = ?
       AND bcl.id IS NULL
     ORDER BY u.id ASC
     LIMIT 1`,
    [slotStart, locationCode, departmentCode]
  );
  return rows[0]?.id || null;
}

async function selectAvailableBay({ locationCode, departmentCode, slotStart, heavyDuty }) {
  const rows = await query(
    `SELECT fr.id, fr.metadata
     FROM facilities_resources fr
     LEFT JOIN bay_capacity_locks bcl ON bcl.bay_resource_id = fr.id AND bcl.slot_start = ?
     WHERE fr.resource_type = 'inspection_bay'
       AND fr.is_active = 1
       AND fr.status = 'available'
       AND fr.location_code = ?
       AND fr.department_code = ?
       AND bcl.id IS NULL
     ORDER BY fr.id ASC`,
    [slotStart, locationCode, departmentCode]
  );

  const filtered = filterBayCandidates(rows, heavyDuty);

  return filtered[0]?.id || null;
}

async function selectAvailableEquipment({ locationCode, departmentCode, slotStart }) {
  const rows = await query(
    `SELECT fr.id
     FROM facilities_resources fr
     LEFT JOIN bay_capacity_locks bcl ON bcl.equipment_resource_id = fr.id AND bcl.slot_start = ?
     LEFT JOIN maintenance_windows mw
       ON mw.equipment_resource_id = fr.id
      AND ? < mw.ends_at
      AND DATE_ADD(?, INTERVAL ${SLOT_MINUTES} MINUTE) > mw.starts_at
     WHERE fr.resource_type = 'equipment'
       AND fr.is_active = 1
       AND fr.status = 'available'
       AND fr.location_code = ?
       AND fr.department_code = ?
       AND JSON_UNQUOTE(JSON_EXTRACT(fr.metadata, '$.equipmentType')) = 'emissions_analyzer'
       AND bcl.id IS NULL
       AND mw.id IS NULL
     ORDER BY fr.id ASC
     LIMIT 1`,
    [slotStart, slotStart, slotStart, locationCode, departmentCode]
  );
  return rows[0]?.id || null;
}

async function maybeReserveRecalibration(equipmentResourceId, baseSlotStart) {
  const counters = await query(
    'SELECT tests_since_recalibration FROM equipment_usage_counters WHERE equipment_resource_id = ?',
    [equipmentResourceId]
  );
  const current = counters[0]?.tests_since_recalibration ?? 0;
  const next = current + 1;

  if (!counters.length) {
    await query(
      'INSERT INTO equipment_usage_counters (equipment_resource_id, tests_since_recalibration) VALUES (?, ?)',
      [equipmentResourceId, next % RECALIBRATION_AFTER_TESTS]
    );
  } else {
    await query(
      'UPDATE equipment_usage_counters SET tests_since_recalibration = ? WHERE equipment_resource_id = ?',
      [next % RECALIBRATION_AFTER_TESTS, equipmentResourceId]
    );
  }

  if (shouldScheduleRecalibration(next)) {
    const { start, end } = getRecalibrationWindow(baseSlotStart);
    await query(
      `INSERT INTO maintenance_windows (equipment_resource_id, reason, starts_at, ends_at)
       VALUES (?, 'automatic_recalibration', ?, ?)`,
      [equipmentResourceId, start, end]
    );
  }
}

export async function scheduleAppointment({
  customerId,
  coordinatorId,
  locationCode,
  departmentCode,
  scheduledAt,
  notes,
  vehicleType
}) {
  const slotStart = normalizeSlotStart(scheduledAt);
  const slotEnd = addMinutes(slotStart, SLOT_MINUTES);

  const duplicateRows = await query(
    `SELECT id
     FROM appointments
     WHERE customer_id = ?
       AND location_code = ?
       AND department_code = ?
       AND scheduled_at = ?
       AND status IN ('scheduled', 'checked_in')
     LIMIT 1`,
    [customerId, locationCode, departmentCode, slotStart]
  );
  if (duplicateRows.length) {
    const err = new Error('Duplicate appointment for customer and slot');
    err.code = 'DUPLICATE_APPOINTMENT';
    throw err;
  }

  const heavyDuty = isHeavyVehicle(vehicleType);
  const inspectorId = await selectAvailableInspector({ locationCode, departmentCode, slotStart });
  if (!inspectorId) throw new Error('No available inspector for selected slot');

  const bayResourceId = await selectAvailableBay({ locationCode, departmentCode, slotStart, heavyDuty });
  if (!bayResourceId) throw new Error('No available inspection bay for selected slot');

  const equipmentResourceId = await selectAvailableEquipment({ locationCode, departmentCode, slotStart });
  if (!equipmentResourceId) throw new Error('No available required equipment set for selected slot');

  const conn = await getConnection();
  let appointmentId;
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO appointments
        (customer_id, coordinator_id, inspector_id, location_code, department_code, scheduled_at, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [customerId, coordinatorId, inspectorId, locationCode, departmentCode, slotStart, notes || null]
    );

    const [createdRows] = await conn.query('SELECT LAST_INSERT_ID() AS id');
    appointmentId = createdRows[0].id;

    await conn.query(
      `INSERT INTO bay_capacity_locks
        (appointment_id, bay_resource_id, inspector_id, equipment_resource_id, slot_start, slot_end, location_code, department_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [appointmentId, bayResourceId, inspectorId, equipmentResourceId, slotStart, slotEnd, locationCode, departmentCode]
    );

    await conn.commit();
  } catch (_err) {
    await conn.rollback();
    throw new Error('Overbooking prevented by resource lock constraints');
  } finally {
    conn.release();
  }

  await maybeReserveRecalibration(equipmentResourceId, slotStart);

  return {
    appointmentId,
    inspectorId,
    bayResourceId,
    equipmentResourceId,
    slotStart,
    slotEnd,
    heavyDutyRouted: heavyDuty
  };
}

export async function listBayUtilization({ locationCode, departmentCode, from, to }) {
  const rows = await query(
    `SELECT fr.id AS bay_id, fr.resource_name,
            bcl.slot_start, bcl.slot_end, a.status, a.id AS appointment_id
     FROM facilities_resources fr
     LEFT JOIN bay_capacity_locks bcl
       ON bcl.bay_resource_id = fr.id
      AND bcl.slot_start >= ?
      AND bcl.slot_start < ?
      AND bcl.location_code = ?
      AND bcl.department_code = ?
     LEFT JOIN appointments a ON a.id = bcl.appointment_id
     WHERE fr.resource_type = 'inspection_bay'
       AND fr.location_code = ?
       AND fr.department_code = ?
       AND fr.is_active = 1
     ORDER BY fr.id, bcl.slot_start`,
    [from, to, locationCode, departmentCode, locationCode, departmentCode]
  );
  return rows;
}

export async function listSeats({ locationCode, departmentCode }) {
  return query(
    `SELECT id, seat_label, x_pos, y_pos, is_active, occupied_by_appointment_id
     FROM waiting_room_seats
     WHERE location_code = ? AND department_code = ?
     ORDER BY id`,
    [locationCode, departmentCode]
  );
}

export async function upsertSeats({ locationCode, departmentCode, seats }) {
  for (const seat of seats) {
    if (seat.id) {
      await query(
        `UPDATE waiting_room_seats
         SET seat_label = ?, x_pos = ?, y_pos = ?, is_active = ?
         WHERE id = ? AND location_code = ? AND department_code = ?`,
        [seat.seat_label, seat.x_pos, seat.y_pos, seat.is_active ? 1 : 0, seat.id, locationCode, departmentCode]
      );
    } else {
      await query(
        `INSERT INTO waiting_room_seats
          (location_code, department_code, seat_label, x_pos, y_pos, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [locationCode, departmentCode, seat.seat_label, seat.x_pos || 0, seat.y_pos || 0, seat.is_active ? 1 : 0]
      );
    }
  }
}

export async function assignSeatToAppointment({ seatId, appointmentId, locationCode, departmentCode }) {
  if (Number(appointmentId || 0) > 0) {
    const appointmentRows = await query(
      `SELECT id
       FROM appointments
       WHERE id = ?
         AND location_code = ?
         AND department_code = ?
       LIMIT 1`,
      [Number(appointmentId), locationCode, departmentCode]
    );

    if (!appointmentRows.length) {
      const err = new Error('Appointment is outside actor scope');
      err.code = 'APPOINTMENT_SCOPE_VIOLATION';
      throw err;
    }
  }

  await query(
    `UPDATE waiting_room_seats
     SET occupied_by_appointment_id = CASE WHEN ? > 0 THEN ? ELSE NULL END
     WHERE id = ? AND location_code = ? AND department_code = ?`,
    [Number(appointmentId || 0), Number(appointmentId || 0), seatId, locationCode, departmentCode]
  );
}

export async function listOpenAppointments({ locationCode, departmentCode }) {
  return query(
    `SELECT id, scheduled_at, status
     FROM appointments
     WHERE location_code = ?
       AND department_code = ?
       AND status IN ('scheduled', 'checked_in')
       AND scheduled_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 HOUR)
     ORDER BY scheduled_at ASC
     LIMIT 100`,
    [locationCode, departmentCode]
  );
}

export async function listMaintenanceWindows({ locationCode, departmentCode }) {
  return query(
    `SELECT mw.id, mw.equipment_resource_id, fr.resource_name, mw.reason, mw.starts_at, mw.ends_at
     FROM maintenance_windows mw
     JOIN facilities_resources fr ON fr.id = mw.equipment_resource_id
     WHERE fr.location_code = ?
       AND fr.department_code = ?
       AND mw.starts_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)
     ORDER BY mw.starts_at DESC
     LIMIT 50`,
    [locationCode, departmentCode]
  );
}

export const _testables = {
  normalizeSlotStart,
  isHeavyVehicle,
  getBayNumber,
  filterBayCandidates,
  shouldScheduleRecalibration,
  getRecalibrationWindow,
  SLOT_MINUTES,
  RECALIBRATION_AFTER_TESTS,
  RECALIBRATION_MINUTES
};
