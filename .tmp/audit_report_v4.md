# RoadSafe Inspection Operations — Delivery Acceptance & Architecture Audit (v5)

**Audit Date:** 2026-04-06  
**Auditor Role:** Delivery Acceptance and Project Architecture Reviewer  
**Static Analysis Only — No Runtime Execution**

---

## 1. Verdict

**Overall Conclusion: Pass**

The High regression introduced in v4 (invalid column references in `ingestion_jobs` queries) is correctly resolved. The `/summary` endpoint now scopes ingestion health data via a `JOIN users ON submitted_by` pattern, which is schema-valid and produces no runtime errors. All seven previously-Low items from v3/v4 remain resolved.

Two Low-severity gaps remain open. Neither is a runtime error or a security vulnerability; both are functional data-scoping inconsistencies. The delivery is accepted at Pass with these Low items noted for follow-up.

---

## 2. Scope and Static Verification Boundary

### What was reviewed in this pass

Files changed since v4:
- `repo/backend/src/routes/dashboard.js` — ingestion health regression fix

All other files carry forward from v4 unchanged.

### What was not executed

No runtime, containers, or tests were executed. All findings are based on static schema-to-query alignment.

---

## 3. Remediation Verification — v4 Issues

| v4 Issue | Severity | Status | Evidence |
|---|---|---|---|
| ISSUE-01: Dashboard broken by invalid column reference | High | **Resolved** | `dashboard.js:104-107, 113-122` — JOIN pattern applied |

---

## 4. Detailed Fix Assessment

---

### v4 ISSUE-01 — Invalid Column Reference in Ingestion Health — Resolved

**Evidence of fix:** `dashboard.js:104-107`:

```sql
(SELECT COUNT(*) FROM ingestion_jobs ij
 JOIN users u ON u.id = ij.submitted_by
 WHERE ij.status = 'queued'
   AND u.location_code = ? AND u.department_code = ?) AS queued,
(SELECT COUNT(*) FROM ingestion_jobs ij
 JOIN users u ON u.id = ij.submitted_by
 WHERE ij.status = 'running'
   AND u.location_code = ? AND u.department_code = ?) AS running,
(SELECT COUNT(*) FROM ingestion_jobs ij
 JOIN users u ON u.id = ij.submitted_by
 WHERE ij.status = 'failed'
   AND ij.updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
   AND u.location_code = ? AND u.department_code = ?) AS failed_24h
```

`dashboard.js:113-122` — `recentJobs` query applies the same JOIN:

```sql
SELECT ij.id, ij.job_type, ij.status, ij.started_at
FROM ingestion_jobs ij
JOIN users u ON u.id = ij.submitted_by
WHERE ij.started_at IS NOT NULL
  AND u.location_code = ? AND u.department_code = ?
ORDER BY ij.started_at DESC
LIMIT 5
```

**Schema validation:** `init.sql:243-256` confirms `ingestion_jobs` has no `location_code`/`department_code` columns, but does have `submitted_by BIGINT UNSIGNED NOT NULL` with `CONSTRAINT fk_ingestion_submitter FOREIGN KEY (submitted_by) REFERENCES users(id)`. The JOIN is schema-valid, referentially enforced, and requires no migration.

**Assessment:** Fix is correct and complete for all four subqueries in the `/summary` ingestion health block. Runtime error is eliminated.

---

## 5. Issues / Suggestions (Severity-Rated)

---

### ISSUE-01 — LOW: `/ingestion-health` Endpoint Remains Globally Unscoped

- **Severity:** Low
- **Title:** `GET /api/dashboard/ingestion-health` returns all jobs system-wide for all roles
- **Conclusion:** Open — data over-exposure, no runtime error
- **Evidence:** `dashboard.js:183-195`:

```js
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
```

No `JOIN users` or `location_code`/`department_code` filter is applied. A Data Engineer or Coordinator with role access to this endpoint sees ingestion jobs from all locations and departments system-wide, not just their own scope.

- **Impact:** Low — data over-exposure, not a crash. Coordinators and Data Engineers can observe job activity from other departments. No write capability exposed.
- **Minimum Actionable Fix:** Apply the same JOIN pattern used in the `/summary` fix, with an admin bypass:

```js
let statusRows, retryRows;
if (user.role === 'Administrator') {
  statusRows = await query(`SELECT status, COUNT(*) AS count FROM ingestion_jobs GROUP BY status`);
  retryRows = await query(`SELECT id, source_system, job_type, status,
    JSON_EXTRACT(payload, '$.retries') AS retries, updated_at
    FROM ingestion_jobs ORDER BY updated_at DESC LIMIT 50`);
} else {
  statusRows = await query(
    `SELECT ij.status, COUNT(*) AS count
     FROM ingestion_jobs ij
     JOIN users u ON u.id = ij.submitted_by
     WHERE u.location_code = ? AND u.department_code = ?
     GROUP BY ij.status`,
    [user.locationCode, user.departmentCode]
  );
  retryRows = await query(
    `SELECT ij.id, ij.source_system, ij.job_type, ij.status,
            JSON_EXTRACT(ij.payload, '$.retries') AS retries, ij.updated_at
     FROM ingestion_jobs ij
     JOIN users u ON u.id = ij.submitted_by
     WHERE u.location_code = ? AND u.department_code = ?
     ORDER BY ij.updated_at DESC LIMIT 50`,
    [user.locationCode, user.departmentCode]
  );
}
```

---

### ISSUE-02 — LOW: No Admin Bypass in `/summary` Ingestion Health Block

- **Severity:** Low
- **Title:** Administrator receives location-scoped ingestion health data inconsistently with their global metrics view
- **Conclusion:** Open — functional inconsistency, no runtime error
- **Evidence:** `dashboard.js:101-124`:

```js
if (['Administrator', 'Data Engineer', 'Coordinator'].includes(user.role)) {
  const healthRows = await query(
    `SELECT ... WHERE ... AND u.location_code = ? AND u.department_code = ?`,
    [user.locationCode, user.departmentCode, ...]
  );
```

The first SQL block in the handler (lines 10-19) gives Administrator a fully global view of appointments, inspections, and resource metrics. But the ingestion health block applies the same location/department scope filter to Administrator as it does to Coordinator and Data Engineer.

If an Administrator's `locationCode`/`departmentCode` is null or not set, the ingestion health counts will be 0. If set, they see only one department's jobs while their other dashboard metrics are global — an inconsistent view.

- **Impact:** Low — no crash, no security implication. Administrator dashboard shows mixed global/scoped data.
- **Minimum Actionable Fix:** Add an admin branch mirroring the pattern already used in the same function:

```js
if (['Administrator', 'Data Engineer', 'Coordinator'].includes(user.role)) {
  if (user.role === 'Administrator') {
    const healthRows = await query(
      `SELECT
        (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'queued') AS queued,
        (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'running') AS running,
        (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'failed'
          AND updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)) AS failed_24h`
    );
    // ... similarly unscoped recentJobs
  } else {
    // existing scoped block
  }
}
```

---

## 6. Security Review Summary

No changes to any security mechanism since v4. All security conclusions carry forward:

| Area | Conclusion |
|---|---|
| Authentication entry points | Pass |
| Route-level authorization | Pass |
| Object-level authorization | Partial Pass (residual cross-location customer report gap, unchanged) |
| Function-level authorization | Pass |
| Tenant / user data isolation | Pass (with Low gap noted in ISSUE-01 above) |
| Admin / internal / debug protection | Pass |

The two open Low items (ISSUE-01, ISSUE-02) fall under tenant/user data isolation. Neither creates a write-path exposure or privilege escalation vector.

---

## 7. Tests and Logging Review

### Test gaps carried forward from v4 (unchanged)

| Risk Point | Status |
|---|---|
| Transaction rollback on overbooking race | Basically covered (operations.test.js covers 409 outcome; not the rollback path itself) |
| Lockout key case normalisation | Missing — no test verifies `Admin` and `admin` share a lockout counter |
| `GET /api/dashboard/summary` as Coordinator | Missing — absence of this test allowed the v4 regression to go undetected |
| `GET /api/dashboard/ingestion-health` as Data Engineer | Missing — would immediately expose the scope gap (ISSUE-01) |

Highest-priority new test additions:
1. `GET /api/dashboard/summary` as Coordinator — assert `status === 200` and ingestion counts are scoped to Coordinator's department.
2. `GET /api/dashboard/ingestion-health` as Data Engineer — assert returned jobs are limited to submitter's location/department.
3. POST to `/api/auth/login` with `Admin` after 5 failures as `admin` — assert 429 (lockout case normalisation).

---

## 8. Test Coverage Assessment (Static Audit)

**Conclusion: Partial Pass — unchanged from v4**

The regression test gap identified in v4 (no `GET /api/dashboard/summary` test for non-admin roles) still exists. The two remaining Low items (ISSUE-01 and ISSUE-02) would also be caught immediately by integration tests hitting those endpoints as scoped roles.

---

## 9. Final Notes

The single High issue from v4 is cleanly resolved. The `JOIN users ON submitted_by` pattern is the correct approach, it requires no schema change, and it is applied consistently across all four ingestion health subqueries in the `/summary` endpoint. The delivery is accepted at Pass.

The two remaining open items are both Low severity. ISSUE-01 (globally-scoped `/ingestion-health` endpoint) is the higher-priority of the two — it causes data over-exposure to Coordinator and Data Engineer roles and was explicitly noted as an outstanding gap in v4. ISSUE-02 (missing admin bypass in the `/summary` ingestion health block) is a functional inconsistency with no security implication.

**State summary after this pass:**

| Severity | Count | Description |
|---|---|---|
| High | 0 | All resolved |
| Medium | 0 | All resolved |
| Low | 2 | `/ingestion-health` globally scoped; admin ingestion health inconsistency in `/summary` |

No blockers remain. The delivery is clean for production acceptance, with the two Low items recommended for the next maintenance iteration.
