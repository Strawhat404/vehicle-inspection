import { query } from '../db.js';

const PAGE_SIZE = 25;

function buildWhere(filters, params, actor = null) {
  const safeFilters = filters && typeof filters === 'object' ? filters : {};
  const where = ['1=1'];

  if (actor?.role === 'Customer') {
    where.push('a.customer_id = ?');
    params.push(actor.id);
  }

  // Enforce scope isolation for non-admin users at SQL level
  if (actor && actor.role !== 'Administrator') {
    where.push('a.location_code = ?');
    params.push(actor.locationCode);
    where.push('a.department_code = ?');
    params.push(actor.departmentCode);
  }

  if (safeFilters.brand) {
    where.push('brand = ?');
    params.push(safeFilters.brand);
  }
  if (safeFilters.model_year) {
    where.push('model_year = ?');
    params.push(Number(safeFilters.model_year));
  }
  if (safeFilters.price_min) {
    where.push('price_usd >= ?');
    params.push(Number(safeFilters.price_min));
  }
  if (safeFilters.price_max) {
    where.push('price_usd <= ?');
    params.push(Number(safeFilters.price_max));
  }
  if (safeFilters.energy_type) {
    where.push('energy_type = ?');
    params.push(safeFilters.energy_type);
  }
  if (safeFilters.transmission) {
    where.push('transmission = ?');
    params.push(safeFilters.transmission);
  }
  const queryText = typeof safeFilters.query === 'string' ? safeFilters.query.trim() : '';
  if (queryText) {
    where.push('(brand LIKE ? OR model_name LIKE ? OR plate_number LIKE ?)');
    const q = `%${queryText}%`;
    params.push(q, q, q);
  }

  if (safeFilters.date_from) {
    where.push('COALESCE(a.scheduled_at, vr.created_at) >= ?');
    params.push(safeFilters.date_from);
  }
  if (safeFilters.date_to) {
    where.push('COALESCE(a.scheduled_at, vr.created_at) <= ?');
    params.push(safeFilters.date_to);
  }

  return where.join(' AND ');
}

function sortClause(sortBy, sortOrder) {
  const order = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  if (sortBy === 'status') return `a.status ${order}, vr.created_at DESC`;
  return `vr.created_at ${order}`;
}

export async function searchVehicleRecords(filters, actor = null) {
  const safeFilters = filters && typeof filters === 'object' ? filters : {};
  const params = [];
  const where = buildWhere(safeFilters, params, actor);
  const page = Math.max(1, Number(safeFilters.page || 1));
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await query(
    `SELECT vr.*, a.status AS appointment_status, a.scheduled_at
     FROM vehicle_records vr
     LEFT JOIN appointments a ON a.id = vr.appointment_id
     WHERE ${where}
     ORDER BY ${sortClause(safeFilters.sort_by, safeFilters.sort_order)}
     LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  );

  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM vehicle_records vr
     LEFT JOIN appointments a ON a.id = vr.appointment_id
     WHERE ${where}`,
    [...params]
  );

  return {
    page,
    pageSize: PAGE_SIZE,
    total: Number(countRows[0]?.total || 0),
    rows
  };
}

export async function logSearch(userId, rawQuery, filters) {
  await query(
    'INSERT INTO search_query_logs (user_id, raw_query, filters) VALUES (?, ?, ?)',
    [userId, rawQuery || '', JSON.stringify(filters || {})]
  );
}

export async function autocomplete(prefix, actor = null) {
  const p = `${String(prefix || '').trim()}%`;
  
  // Scope-isolated autocomplete for non-admin users
  if (actor && actor.role !== 'Administrator') {
    const rows = await query(
      `SELECT DISTINCT term FROM (
        SELECT vr.brand AS term 
        FROM vehicle_records vr
        LEFT JOIN appointments a ON a.id = vr.appointment_id
        WHERE a.location_code = ? AND a.department_code = ?
        UNION ALL
        SELECT vr.model_name AS term 
        FROM vehicle_records vr
        LEFT JOIN appointments a ON a.id = vr.appointment_id
        WHERE a.location_code = ? AND a.department_code = ?
        UNION ALL
        SELECT sql_log.raw_query AS term 
        FROM search_query_logs sql_log
        JOIN users u ON u.id = sql_log.user_id
        WHERE u.location_code = ? AND u.department_code = ?
      ) x
      WHERE term LIKE ?
      ORDER BY term ASC
      LIMIT 10`,
      [actor.locationCode, actor.departmentCode, actor.locationCode, actor.departmentCode, actor.locationCode, actor.departmentCode, p]
    );
    return rows.map((r) => r.term);
  }
  
  // Admin gets global autocomplete
  const rows = await query(
    `SELECT DISTINCT term FROM (
      SELECT brand AS term FROM vehicle_records
      UNION ALL
      SELECT model_name AS term FROM vehicle_records
      UNION ALL
      SELECT raw_query AS term FROM search_query_logs
    ) x
    WHERE term LIKE ?
    ORDER BY term ASC
    LIMIT 10`,
    [p]
  );
  return rows.map((r) => r.term);
}

export async function trendingKeywords(actor = null) {
  // Scope-isolated trending for non-admin users
  if (actor && actor.role !== 'Administrator') {
    const rows = await query(
      `SELECT sql_log.raw_query AS keyword, COUNT(*) AS uses
       FROM search_query_logs sql_log
       JOIN users u ON u.id = sql_log.user_id
       WHERE sql_log.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
         AND sql_log.raw_query <> ''
         AND u.location_code = ?
         AND u.department_code = ?
       GROUP BY sql_log.raw_query
       ORDER BY uses DESC, keyword ASC
       LIMIT 10`,
      [actor.locationCode, actor.departmentCode]
    );
    return rows;
  }
  
  // Admin gets global trending
  const rows = await query(
    `SELECT raw_query AS keyword, COUNT(*) AS uses
     FROM search_query_logs
     WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
       AND raw_query <> ''
     GROUP BY raw_query
     ORDER BY uses DESC, keyword ASC
     LIMIT 10`
  );
  return rows;
}

export const _testables = { buildWhere, sortClause, PAGE_SIZE };
