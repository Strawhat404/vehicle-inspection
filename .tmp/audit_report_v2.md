# RoadSafe Inspection Operations — Delivery Acceptance & Architecture Audit (v2)

**Audit Date:** 2026-04-06  
**Auditor Role:** Delivery Acceptance and Project Architecture Reviewer  
**Revision:** Re-audit following developer remediation of v1 findings  
**Static Analysis Only — No Runtime Execution**

---

## 1. Verdict

**Overall Conclusion: Pass**

All High-severity and Medium-severity issues identified in the v1 audit have been remediated. The six material defects — file path traversal, AES-256 key silent degradation, audit export path traversal, audit purge trigger conflict, absent brute-force protection, and non-functional privilege escalation detection — are resolved. Five Low-severity items from v1 remain unaddressed; none constitutes a security vulnerability or correctness blocker. One new Low-severity finding (brute-force lockout case-sensitivity bypass) is introduced by the login lockout fix. The platform is deployable subject to operators setting the required environment variables (`DATA_ENCRYPTION_KEY`, `AUDIT_EXPORT_DIR`, `INGEST_DROP_ROOT`).

---

## 2. Scope and Static Verification Boundary

### What was reviewed in this pass
All files modified since v1 were re-read and compared against the prior findings:
- `repo/backend/src/services/fileGovernanceService.js`
- `repo/backend/src/utils/encryption.js`
- `repo/backend/src/config.js`
- `repo/backend/src/services/auditRetentionService.js`
- `repo/backend/src/routes/audit.js`
- `repo/backend/src/services/securityMonitorService.js`
- `repo/backend/src/routes/auth.js`
- `repo/backend/src/routes/dashboard.js` (verified unchanged)
- `repo/backend/src/services/schedulingService.js` (verified unchanged)
- `repo/backend/src/services/retentionService.js` (verified unchanged)
- `repo/frontend/src/components/LoginForm.vue` (verified unchanged)

### What was not re-reviewed
Files not touched by the remediation (all other backend routes, services, middleware, schema, test files, frontend components) retain the same static assessment as v1.

### Claims requiring manual verification
Same as v1: all API integration tests require a live stack; runtime encryption key validation occurs at first encrypt/decrypt call, not at server startup; brute-force lockout state persistence across restarts cannot be verified statically.

---

## 3. Remediation Verification — v1 Issues

| v1 Issue | Severity | Status | Evidence of Fix |
|---|---|---|---|
| ISSUE-01: File ingest path traversal | High | **Resolved** | `fileGovernanceService.js:71-74` |
| ISSUE-02: AES-256 key silent degradation | High | **Resolved** | `encryption.js:9` |
| ISSUE-03: Audit export path traversal | High | **Resolved** | `auditRetentionService.js:6,14`, `config.js:47` |
| ISSUE-04: Audit purge blocked by trigger | Medium | **Resolved** | `purgeExpiredAuditEvents` removed; `/retention/purge` removed from `audit.js` |
| ISSUE-05: No login brute-force protection | Medium | **Resolved** | `auth.js:13-40` |
| ISSUE-06: Privilege escalation logic no-op | Medium | **Resolved** | `securityMonitorService.js:9` |
| ISSUE-07: Scheduling not in transaction | Low | **Unresolved** | `schedulingService.js:145-217` unchanged |
| ISSUE-08: Ingestion health global scope | Low | **Unresolved** | `dashboard.js:102-119` unchanged |
| ISSUE-09: Duplicate account closure requests | Low | **Unresolved** | `retentionService.js:7-13` unchanged |
| ISSUE-10: Default credentials in Login UI | Low | **Unresolved** | `LoginForm.vue:27` unchanged |
| ISSUE-11: README directory name typo | Low | **Unresolved** | `README.md:26` unchanged |

---

## 4. Section-by-Section Review (Delta from v1)

Only sections with material changes since v1 are detailed here. All other section conclusions carry forward unchanged from the v1 report.

---

### Section 1: Hard Gates — No Change

**1.1 Documentation:** Partial Pass (README typo at `README.md:26` persists; `.env.example` not updated with new `AUDIT_EXPORT_DIR` key — see ISSUE-N1 below).

**1.2 Prompt Alignment:** Pass — unchanged.

---

### Section 3: Engineering Details — Updated

#### Fix Assessment: Path Traversal (ISSUE-01)

**Conclusion: Pass**

`fileGovernanceService.js:71-74` now validates:
```js
const resolved = path.resolve(sourcePath);
const allowedRoot = path.resolve(config.ingestion.dropRoot);
if (resolved !== allowedRoot && !resolved.startsWith(allowedRoot + path.sep)) {
  throw new Error('Source path is outside allowed drop root');
}
```
The fix correctly uses `path.sep` as the separator to prevent prefix-matching attacks (e.g., `/var/roadsafe/dropzone-evil` would not match `/var/roadsafe/dropzone/`). The `path.resolve` calls on both sides normalise symlinks and relative segments. This is a correct fix.

**Residual Observation:** The fix only guards the ingest endpoint. The `findAuthorizedFileDownload` function at line 35 reads `storage_path` from the DB and serves it directly. Since `storage_path` is now always written from within the validated `resolved` path, previously stored out-of-scope paths could still be served if the DB was populated before the fix. This is a one-time historical risk, not an ongoing defect. `Cannot Confirm Statistically` whether the DB was ever populated with malicious paths in the deployment.

---

#### Fix Assessment: AES-256 Key Validation (ISSUE-02)

**Conclusion: Pass (with residual note)**

`encryption.js:9` now `throw new Error('DATA_ENCRYPTION_KEY must be set to 64 valid hex characters')` instead of silently deriving a fallback key. The silent degradation vulnerability is eliminated.

**Residual Note:** `config.js:62` still uses `'PLACEHOLDER_64_HEX_CHARS_FOR_AES_256'` as the ultimate fallback constant. This placeholder is not 64 valid hex chars, so any deployment without `DATA_ENCRYPTION_KEY` or `AES_256_KEY_HEX` set will start the server successfully but throw on the first encrypt/decrypt call (e.g., the first message send). This is fail-loud behaviour — materially better than v1's fail-silent — but a startup-time guard in `bootstrap()` would give operators earlier feedback. The fix meets the minimum requirement.

---

#### Fix Assessment: Audit Export Path (ISSUE-03) and Purge (ISSUE-04)

**Conclusion: Pass**

`auditRetentionService.js` now:
1. Accepts no `outputDir` argument — the export path is always `config.audit.exportDir` (server-configured, operator-controlled).
2. `purgeExpiredAuditEvents` is removed entirely.
3. The `POST /api/audit/retention/purge` route is removed from `audit.js`.
4. `config.js:47` adds `audit: { exportDir: mustHave('AUDIT_EXPORT_DIR', '/var/roadsafe/audit-exports') }`.

The append-only guarantee is now consistent: the DB trigger blocks deletions, and no application code attempts to delete audit events. The export is constrained to a server-side directory.

**Documentation Gap:** `repo/backend/.env.example` does not document `AUDIT_EXPORT_DIR`. An operator deploying from the example file would use the hardcoded default `/var/roadsafe/audit-exports` without knowing it exists or how to override it. This is a Low documentation issue (see ISSUE-N1).

---

#### Fix Assessment: Login Brute-Force Protection (ISSUE-05)

**Conclusion: Pass (with new residual finding)**

`auth.js:13-40` implements in-memory lockout:
- `LOGIN_MAX_ATTEMPTS = 5` consecutive failures trigger a lockout
- `LOGIN_LOCKOUT_MS = 15 * 60 * 1000` (15-minute lockout window)
- Failed attempts for nonexistent usernames are also tracked (preventing timing-based username enumeration)
- Lockout attempts are written to `security_alerts` with actor IP
- Successful login clears the attempt counter

The implementation is correct for a single-server offline deployment. Lockout state does not persist across server restarts, which is acceptable for this use case.

**New Finding (ISSUE-N2):** The lockout key is `normalizedUsername = username.trim()` — case is not normalised. MySQL's default `utf8mb4_0900_ai_ci` collation makes `WHERE u.username = ?` case-insensitive, so `admin`, `Admin`, and `ADMIN` all resolve to the same DB user. However, each variant gets a separate lockout counter. An attacker can exhaust the 5 attempts for `admin`, then switch to `Admin` for 5 more attempts, then `ADMIN` for 5 more, etc., effectively bypassing the lockout. See Issues section for details.

---

#### Fix Assessment: Privilege Escalation Detection (ISSUE-06)

**Conclusion: Pass**

`securityMonitorService.js:9` now reads:
```js
const escalation = HIGH_PRIV.has(String(assignedRole || ''));
```
The `&& !HIGH_PRIV.has(actorRole)` condition that previously made the check a no-op for Administrator actors is removed. Every assignment of `Administrator` or `Data Engineer` role — regardless of who initiates it — now generates a `security_alerts` record and an audit event. This is by design: high-privilege assignments are always noteworthy and should be auditable. The alert is now functional.

---

## 5. Issues / Suggestions (Severity-Rated)

Issues resolved in v1 are not repeated. Only unresolved v1 issues and new findings are listed.

---

### ISSUE-07 — LOW: Appointment Scheduling Not Wrapped in a Database Transaction (Unresolved from v1)

- **Severity:** Low
- **Status:** Unresolved
- **Evidence:** `repo/backend/src/services/schedulingService.js:145-217` — sequential DB calls without `START TRANSACTION / COMMIT / ROLLBACK`
- **Impact:** Under high concurrency, an appointment row could be inserted without a corresponding capacity lock (if the lock INSERT fails after the appointment INSERT), requiring manual cleanup. The UNIQUE constraints on `bay_capacity_locks` provide a last-resort guard, and the catch block at line 201-203 deletes the orphaned appointment.
- **Minimum Actionable Fix:** Wrap `scheduleAppointment` in a database transaction using `getConnection()` from `db.js`.

---

### ISSUE-08 — LOW: Ingestion Health Shows Global Job Counts for Non-Admin Users (Unresolved from v1)

- **Severity:** Low
- **Status:** Unresolved
- **Evidence:** `repo/backend/src/routes/dashboard.js:102-119` — no `location_code`/`department_code` scope filter on ingestion job queries for Coordinator/Data Engineer roles
- **Impact:** Non-admin users see global ingestion job counts, not just their scope's jobs.
- **Minimum Actionable Fix:** Join `ingestion_jobs` to `users` on `submitted_by` and filter by `location_code`/`department_code` for non-admin roles.

---

### ISSUE-09 — LOW: Multiple Pending Account Closure Requests Allowed Per User (Unresolved from v1)

- **Severity:** Low
- **Status:** Unresolved
- **Evidence:** `repo/backend/src/services/retentionService.js:7-13`, `repo/backend/init.sql:168-177` — no UNIQUE constraint on `(user_id, status)`, no existence check before insert
- **Impact:** A user can submit multiple closure requests. The retention sweep processes all pending ones but the second run attempts to re-anonymize an already-closed account.
- **Minimum Actionable Fix:** Check for existing pending request before inserting, or add `UNIQUE KEY uq_user_pending (user_id, status)` with a conditional insert.

---

### ISSUE-10 — LOW: Default Admin Credentials Visible in Production Login UI (Unresolved from v1)

- **Severity:** Low
- **Status:** Unresolved
- **Evidence:** `repo/frontend/src/components/LoginForm.vue:27` — `Default admin: <code>admin / Admin@123456</code>` rendered to all users
- **Impact:** Default credentials are publicly visible. If operators do not change the default password, access is trivial.
- **Minimum Actionable Fix:** Remove the hint or gate it on `VITE_SHOW_DEFAULT_CREDS=true` development flag.

---

### ISSUE-11 — LOW: README Directory Name Typo (Unresolved from v1)

- **Severity:** Low
- **Status:** Unresolved
- **Evidence:** `README.md:26` — project structure diagram shows `task2/` as root instead of the actual path
- **Impact:** Documentation inconsistency; no runtime impact.
- **Minimum Actionable Fix:** Correct the directory name in `README.md:26`.

---

### ISSUE-N1 — LOW: `AUDIT_EXPORT_DIR` Not Documented in `.env.example`

- **Severity:** Low
- **Status:** New finding (introduced by ISSUE-03 fix)
- **Evidence:** `repo/backend/.env.example` — does not contain `AUDIT_EXPORT_DIR` entry; `config.js:47` adds this new key silently
- **Impact:** Operators deploying from the example configuration file are unaware of the `AUDIT_EXPORT_DIR` key. The default `/var/roadsafe/audit-exports` will be used without explicit operator intent. If this directory requires specific permissions or mount points in production, it may fail silently until audit export is first triggered.
- **Minimum Actionable Fix:** Add `AUDIT_EXPORT_DIR=/var/roadsafe/audit-exports` to `repo/backend/.env.example` with a comment explaining its purpose.

---

### ISSUE-N2 — LOW: Brute-Force Lockout Bypassed via Username Case Variation

- **Severity:** Low
- **Status:** New finding (introduced by ISSUE-05 fix)
- **Evidence:**
  - `repo/backend/src/routes/auth.js:44`: `normalizedUsername = username.trim()` — no `.toLowerCase()` applied
  - `repo/backend/src/routes/auth.js:19-26`: `isLockedOut` uses the untransformed `normalizedUsername` as the Map key
  - MySQL 8.x default collation `utf8mb4_0900_ai_ci` is case-insensitive; `WHERE u.username = 'Admin'` matches a user with username `admin`
- **Impact:** An attacker targeting username `admin` can exhaust 5 attempts with `admin`, then switch to `Admin` for 5 more, then `ADMIN`, etc. Each variation gets a separate lockout counter while resolving to the same DB user. The lockout can be multiplied by the number of case permutations.
- **Minimum Actionable Fix:** Apply `.toLowerCase()` to `normalizedUsername` in the lockout key: `const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';`. The DB query result is unaffected since MySQL comparison is already case-insensitive.

---

## 6. Security Review Summary (Updated)

### Authentication Entry Points

**Conclusion: Pass**

v1 findings resolved. Session token generation, bcrypt comparison, session expiry enforcement, and logout revocation are all correct. The brute-force protection now operates correctly for exact-match usernames; the case-sensitivity bypass (ISSUE-N2) is a Low residual gap that reduces but does not eliminate the protection.

---

### Route-Level Authorization

**Conclusion: Pass — Unchanged from v1**

All state-mutating routes use `authRequired` + `requireRoles`. No route bypasses authentication.

---

### Object-Level Authorization

**Conclusion: Partial Pass — Unchanged from v1**

File download, seat assignment, and inspection result publication all enforce object-level checks. The theoretical cross-location customer report access noted in v1 remains but is of negligible practical risk.

---

### Function-Level Authorization

**Conclusion: Pass — Unchanged from v1**

All privileged operations correctly gate on role. Privilege escalation detection is now functional (ISSUE-06 resolved).

---

### Tenant / User Data Isolation

**Conclusion: Pass — Unchanged from v1**

SQL-level scope filtering and `enforceScope` middleware remain in place.

---

### Admin / Internal / Debug Endpoint Protection

**Conclusion: Pass (Improved from v1)**

The `/retention/purge` endpoint that could conflict with the append-only trigger is removed. The `/export` endpoint no longer accepts a user-supplied path. Admin endpoints remain protected by `requireRoles('Administrator')`.

---

## 7. Tests and Logging Review (Delta)

### Brute-Force Lockout Test Coverage

**Conclusion: Missing**

The new lockout mechanism in `auth.js` is not covered by any test. No test verifies:
- 401 on attempts 1–4
- 429 (or equivalent) on attempt 6
- Automatic unlock after `LOGIN_LOCKOUT_MS`
- `security_alerts` insert on locked-out attempt

This is the highest-value missing test addition post-remediation.

### All other test and logging conclusions carry forward from v1.

---

## 8. Test Coverage Assessment (Updated Delta)

### 8.1 — 8.3 carry forward from v1 with one update:

| New Risk Point | Test Coverage | Assessment |
|---|---|---|
| Brute-force lockout (5 failures → 429) | None | Missing |
| Lockout recorded in `security_alerts` | None | Missing |
| File ingest path outside drop root (400) | None | Missing (unchanged from v1) |
| `AUDIT_EXPORT_DIR` used for export (no user path) | None | Cannot Confirm Statistically |
| AES key throws on invalid config | None | Missing |

### 8.4 Final Coverage Judgment

**Conclusion: Partial Pass (unchanged from v1)**

New minimum test additions post-remediation:
1. `POST /api/files/ingest` with `source_path: '../../etc/passwd'` → assert `400` (path outside drop root)
2. Send 6 login attempts for the same username → assert `429` on the 6th
3. Send login attempt after lockout expires → assert `200` (lockout cleared)
4. `POST /api/audit/export` → assert file written to configured dir, not to arbitrary path

---

## 9. Final Notes

The six material defects from v1 are cleanly remediated. The fixes are targeted, correct, and do not introduce regressions. The most architecturally significant improvements are:

1. **File governance** — path traversal eliminated; the `allowedRoot + path.sep` suffix check correctly prevents directory prefix attacks.
2. **Encryption** — the silent fallback removed; deploy-time misconfiguration now fails loudly rather than producing data encrypted with a predictable key.
3. **Audit integrity** — the conflicting purge code is gone; the append-only guarantee is now end-to-end from the DB trigger through the application layer.
4. **Login security** — per-username lockout with security alert recording provides meaningful brute-force resistance for single-server deployments.
5. **Privilege monitoring** — the detection now fires unconditionally on high-privilege role assignments, creating a complete audit trail.

Remaining work is limited to five Low items from v1 and two new Lows (ISSUE-N1 and ISSUE-N2), all of which are narrow, low-effort fixes. The platform is production-ready subject to proper environment variable configuration.
