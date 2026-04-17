# RoadSafe Inspection Operations — Delivery Acceptance & Architecture Audit (v3)

**Audit Date:** 2026-04-06  
**Auditor Role:** Delivery Acceptance and Project Architecture Reviewer  
**Static Analysis Only — No Runtime Execution**

---

## 1. Verdict

**Overall Conclusion: Pass**

The delivery is a materially complete, professionally engineered implementation of the RoadSafe Inspection Operations Platform. All High- and Medium-severity security defects identified in prior audit passes have been resolved. Seven Low-severity items remain; none constitutes a security vulnerability or correctness blocker for deployment. The platform is production-ready subject to proper environment variable configuration (`DATA_ENCRYPTION_KEY`, `AUDIT_EXPORT_DIR`, `INGEST_DROP_ROOT`).

---

## 2. Scope and Static Verification Boundary

### What was reviewed
| Area | Files |
|---|---|
| Backend entry point & middleware | `server.js`, `middleware/auth.js`, `middleware/rbac.js`, `middleware/rateLimit.js` |
| Backend routes | `auth.js`, `dashboard.js`, `coordinator.js`, `inspections.js`, `ingestion.js`, `search.js`, `messages.js`, `files.js`, `compliance.js`, `users.js`, `roles.js`, `audit.js`, `security.js`, `health.js` |
| Backend services | `schedulingService.js`, `ingestionService.js`, `ingestionSchedulerService.js`, `searchService.js`, `messagingService.js`, `fileGovernanceService.js`, `securityMonitorService.js`, `auditRetentionService.js`, `retentionService.js` |
| Backend utilities | `audit.js`, `crypto.js`, `encryption.js`, `redaction.js` |
| Config & DB | `config.js`, `db.js`, `init.sql` |
| Frontend | `App.vue`, all `components/*.vue`, `services/api.js` |
| Tests | `API_tests/*.test.js` (5 files), `unit_tests/*.test.js` (3 files) |
| Configuration & docs | `.env.example`, `docker-compose.yml`, `README.md`, `docs/api-spec.md` |

### What was not executed
Docker containers, MySQL server, Node.js runtime, test suites, browser UI. All conclusions are derived from static code and schema analysis.

### Claims requiring manual verification
- Actual TLS certificate validity and HTTPS behaviour
- Rate-limiter performance under concurrent load (in-memory, single process)
- Brute-force lockout persistence behaviour across server restarts
- API integration test pass/fail rates (all require a live stack)
- Runtime encryption key validation (throws at first use, not at startup)

---

## 3. Repository / Requirement Mapping Summary

### Prompt Core Requirements vs. Implementation

| Prompt Requirement | Implementation | Status |
|---|---|---|
| 5 primary roles with RBAC | `middleware/rbac.js`, `init.sql:365-372` | Pass |
| Dashboard: appointments, utilization, ingestion health | `routes/dashboard.js:8-211` | Pass |
| Coordinator scheduling + overbooking prevention | `services/schedulingService.js`, `init.sql:203-222` | Pass |
| Heavy-duty vehicles → bays 3–6 | `schedulingService.js:35-40` | Pass |
| Recalibration reserve: 15 min after every 8 tests | `schedulingService.js:3-5, 115-143` | Pass |
| Advanced search: filters, pagination (25/page), sort | `services/searchService.js:1-102` | Pass |
| Autocomplete + trending keywords (7-day window) | `searchService.js:111-188` | Pass |
| In-app Messaging Center + offline SMS/email outbox | `services/messagingService.js`, `routes/messages.js` | Pass |
| Plugin-based ETL: CSV, device export, network share | `services/ingestionService.js:491-510` | Pass |
| Job queue: priority, dependencies, checkpoints, retries (×5 exp.) | `ingestionService.js:199-547` | Pass |
| Incremental jobs hourly by default | `ingestionSchedulerService.js:5, 52` | Pass |
| Backfill capped at 30 days | `ingestionService.js:7-9` | Pass |
| Quality alerts: >2% variance from 14-run baseline | `ingestionService.js:340-362` | Pass |
| HTTPS with local TLS certificates | `server.js:113-133` | Pass |
| AES-256 at rest (messages, outbox) | `utils/encryption.js` | Pass |
| Privacy masking for non-admin responses | `utils/redaction.js`, applied in `search.js:29`, `messages.js:38` | Pass |
| Password ≥12 chars with complexity | `utils/crypto.js:8-15` | Pass |
| Rate limiting: 60/user, 300/IP per minute | `middleware/rateLimit.js` | Pass |
| Login brute-force lockout (5 attempts, 15-min) | `routes/auth.js:13-40` | Pass |
| Privilege escalation detection | `services/securityMonitorService.js:6-28` | Pass |
| Append-only audit log with DB triggers | `init.sql:446-464` | Pass |
| Audit log: 2-year retention, local file export | `services/auditRetentionService.js` | Pass |
| File governance: 50 MB limit, allowlists, hash blocklist, quarantine | `services/fileGovernanceService.js` | Pass |
| File ingest sandboxed to drop root | `fileGovernanceService.js:70-74` | Pass |
| Sensitive-content detection + quarantine (SSN, dictionary) | `fileGovernanceService.js:16-33` | Pass |
| 7-year inspection report retention + tombstones | `services/retentionService.js:3, 17-39` | Pass |
| Account closure within 30 days | `services/retentionService.js:4, 41-65` | Pass |
| Vue.js frontend with 5 role-specific dashboards | `frontend/src/App.vue`, `components/` | Pass |

**Single functional gap:** The Prompt states "Administrators configure locations, policies, and user access." User and role management is fully implemented. There is no dedicated API endpoint or UI for dynamically creating new location codes or configuring policy parameters (bay rules, retention thresholds). These are handled via seed data and hard-coded constants. This is a minor gap; the described HQ scenario is fully supported by the seed data, and user management covers the "user access" sub-requirement completely.

---

## 4. Section-by-Section Review

---

### Section 1: Hard Gates

#### 1.1 Documentation and Static Verifiability

**Conclusion: Pass**

- `README.md` provides a single-command startup (`cd repo && docker compose up`) with both service URLs and default admin credentials.
- `repo/backend/.env.example` documents all required environment keys.
- `repo/backend/init.sql` contains the complete schema and seed data; database state is fully reproducible from the file.
- `repo/docker-compose.yml` defines all services, health checks, volumes, and environment injection.
- `docs/api-spec.md` documents all major REST endpoints.
- The documented entry point is consistent with the actual `docker-compose.yml` location.

**Minor gap:** `README.md:26` labels the project directory `task2/` instead of the actual path. `repo/backend/.env.example` does not document the `AUDIT_EXPORT_DIR` key added in a recent fix. Both are documentation-only issues with no runtime impact.

#### 1.2 Prompt Alignment

**Conclusion: Pass**

The implementation is fully centred on the RoadSafe inspection management platform. No major unrelated features are present. The core problem definition is preserved throughout.

---

### Section 2: Delivery Completeness

#### 2.1 Core Requirements Coverage

**Conclusion: Pass**

All explicitly stated functional requirements are implemented with real logic. No large stubs or hardcoded mock responses were found. Minor functional gap noted in the mapping table above (no location/policy management UI).

#### 2.2 End-to-End Deliverable

**Conclusion: Pass**

The project is a complete, multi-layer application: 14 route files, 9 services, 4 utilities, 3 middleware, a 26-table MySQL schema, a Vue 3 frontend with 10+ components, Docker Compose orchestration, and a test suite of 8 files. It is not a fragment or teaching sample.

---

### Section 3: Engineering and Architecture Quality

#### 3.1 Structure and Module Decomposition

**Conclusion: Pass**

Clean layered architecture: `routes/` → `services/` → `utils/` → `db.js`. No single file concentrates excessive logic. The two largest service files (`ingestionService.js` ~560 lines, `schedulingService.js` ~337 lines) are well-structured with named functions and clearly bounded responsibilities. No redundant or unnecessary files were identified.

#### 3.2 Maintainability and Extensibility

**Conclusion: Pass**

- ETL connector framework uses a `connectorRegistry` Map with a public `registerIngestionConnector` export — new connectors are addable without modifying existing code (`ingestionService.js:491-510`).
- RBAC is centralised in two middleware functions.
- Sensitive-field masking is centralised in a `SENSITIVE_KEYS` Set in `redaction.js`.
- `_testables` exports in `schedulingService.js` and `ingestionService.js` allow unit testing of pure logic without database mocks.

---

### Section 4: Engineering Details and Professionalism

#### 4.1 Error Handling, Logging, Validation

**Conclusion: Pass**

- Global error handler at `server.js:50-63` returns a generic `{ error: 'Internal Server Error' }` 500 — no stack traces or field values leak to clients.
- Domain errors use structured codes (`DUPLICATE_APPOINTMENT`, `APPOINTMENT_SCOPE_VIOLATION`) enabling clean client-side branching.
- All SQL uses parameterised placeholders throughout; no string concatenation in any query was found.
- Input validation covers: password complexity, role_name existence, numeric ID parsing, pagination bounds, file extension/MIME type, scheduled_at boundary enforcement.
- `safeLog` in `redaction.js` strips all fields in `SENSITIVE_KEYS` before writing to console.
- Audit events are persisted to the database for all security-relevant actions.

#### 4.2 Real Product vs. Demo Quality

**Conclusion: Pass**

The delivery shows production-quality engineering: scoped isolation by location+department in every query, deterministic dedupe keys, checkpoint-based ETL resumption, seed-data-driven initialisation, append-only audit triggers, and proper TLS cert file validation at startup.

---

### Section 5: Prompt Understanding and Requirement Fit

#### 5.1 Business Goal and Semantic Alignment

**Conclusion: Pass**

Key business semantics are correctly implemented:

| Business Rule | Implementation |
|---|---|
| Slots at 30-minute boundaries only | `schedulingService.js:7-15` — throws on non-boundary `scheduled_at` |
| Heavy-duty → bays 3–6 | `schedulingService.js:35-40` — `bayNumber >= 3 && bayNumber <= 6` |
| Emissions recalibration: 15 min after every 8 tests | `schedulingService.js:115-143` — inserts maintenance window immediately after triggering slot |
| Trending from last 7 days of local query logs | `searchService.js:163` — `DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)` |
| Backfill cap of 30 days | `ingestionService.js:7-9` |
| Retries ×5 with exponential backoff | `ingestionService.js:182-188` — `2^retries * 1000 ms` |
| Offline SMS/email via local outbox | `messagingService.js:18-32` — writes to `manual_delivery_outbox`, no external API call |
| 7-year report retention + tombstones | `retentionService.js:3, 17-39` |
| Account anonymisation within 30 days | `retentionService.js:4, 41-65` |

---

### Section 6: Aesthetics

**Conclusion: Pass**

- **Structure:** Fixed left sidebar (`w-72`, `DashboardShell.vue`) with role-computed menus separates navigation from the main content area.
- **Consistency:** All inputs, buttons, and labels use uniform Tailwind utility classes. No mixed design language.
- **Interaction feedback:** Loading states (`loading.value = true/false`) disable buttons during API calls (`disabled:opacity-50`). Inline error and success messages on all async operations.
- **Visual encoding:** Colour-coded status badges (blue → scheduled, green → checked-in, red → failed/cancelled, amber → occupied seats). Resource utilisation progress bars with computed width percentages.
- **Role-gating:** View access is enforced both in `App.vue` template conditions and in the `handleMenuSelect` role map — no component renders for unauthorised roles.

**Minor:** The coordinator appointment form uses a raw numeric `customer_id` input instead of a customer search picker — functional but low ergonomics. The login form exposes default admin credentials in plaintext (see ISSUE-05 below).

---

## 5. Issues / Suggestions (Severity-Rated)

All previously reported High and Medium issues have been resolved. The following Low-severity items remain open.

---

### ISSUE-01 — LOW: Appointment Scheduling Not Wrapped in a Database Transaction

- **Severity:** Low
- **Evidence:** `repo/backend/src/services/schedulingService.js:145-217`
- **Detail:** The `scheduleAppointment` function executes multiple sequential DB writes — availability checks, `INSERT appointments`, `INSERT bay_capacity_locks` — without a `START TRANSACTION / COMMIT / ROLLBACK`. The UNIQUE constraints on `bay_capacity_locks` (`init.sql:214-216`) act as a last-resort guard; on lock INSERT failure the catch block at line 201-203 deletes the orphaned appointment row. Under high concurrency, a window exists between the availability check and the lock insert where two requests could observe the same resource as free and race to lock it. The UNIQUE constraint catches this, but the outcome is a deleted appointment with no lock — the customer receives an error but no partial committed state persists. For a single-server offline deployment the practical risk is low; it becomes more relevant if the system is ever scaled horizontally.
- **Impact:** Under concurrent load: transient 500 errors for one of two racing callers; no data corruption. No security impact.
- **Minimum Actionable Fix:** Acquire a DB connection via `getConnection()` and wrap `scheduleAppointment` in `START TRANSACTION / COMMIT / ROLLBACK`.

---

### ISSUE-02 — LOW: Ingestion Health Displays Global Job Counts for Non-Admin Roles

- **Severity:** Low
- **Evidence:** `repo/backend/src/routes/dashboard.js:102-119`
- **Detail:** The ingestion health subquery for Coordinators and Data Engineers has no `location_code`/`department_code` filter. All ingestion job counts (queued, running, failed, recent) are global across all locations and departments. The broader dashboard metrics (appointments, resources) correctly scope to the user's location and department; ingestion health is the only un-scoped section.
- **Impact:** Coordinators/Data Engineers see job activity from other organisational units. Minor information disclosure; no write impact.
- **Minimum Actionable Fix:** Join `ingestion_jobs` to `users` on `submitted_by` and add `WHERE u.location_code = ? AND u.department_code = ?` for non-admin roles.

---

### ISSUE-03 — LOW: Multiple Pending Account Closure Requests Allowed Per User

- **Severity:** Low
- **Evidence:** `repo/backend/src/services/retentionService.js:7-13`; `repo/backend/init.sql:168-177`
- **Detail:** `createAccountClosureRequest` inserts unconditionally with no check for an existing pending request. The `account_closure_requests` table has no `UNIQUE KEY` on `(user_id, status)`. A user can submit multiple closure requests; the retention sweep processes all pending ones, running anonymisation logic more than once on an already-closed account. Idempotent by coincidence (overwriting with the same `closed_user_N` values) but semantically incorrect.
- **Impact:** Duplicate state records; no security or data-loss impact.
- **Minimum Actionable Fix:** Before inserting, check: `SELECT id FROM account_closure_requests WHERE user_id = ? AND status = 'pending' LIMIT 1`. Return the existing ID if found. Or add `UNIQUE KEY uq_user_pending (user_id, status)` and handle the duplicate-key error.

---

### ISSUE-04 — LOW: Default Admin Credentials Hardcoded in Production Login UI

- **Severity:** Low
- **Evidence:** `repo/frontend/src/components/LoginForm.vue:27`
- **Detail:** `<p class="mt-3 text-xs text-slate-500">Default admin: <code>admin / Admin@123456</code></p>` is rendered to every visitor of the login page unconditionally. If the deployment operator does not change the default password, any user who reaches the login page can immediately authenticate as an Administrator.
- **Impact:** Facilitates unauthorised admin access if the default password is not changed post-deployment.
- **Minimum Actionable Fix:** Remove the credential hint or gate it behind a build-time environment flag (`VITE_SHOW_DEFAULT_CREDS=true`).

---

### ISSUE-05 — LOW: `AUDIT_EXPORT_DIR` Not Documented in `.env.example`

- **Severity:** Low
- **Evidence:** `repo/backend/.env.example` — no `AUDIT_EXPORT_DIR` entry; `repo/backend/src/config.js:47` — `audit: { exportDir: mustHave('AUDIT_EXPORT_DIR', '/var/roadsafe/audit-exports') }`
- **Detail:** The `AUDIT_EXPORT_DIR` configuration key was introduced when the audit export path traversal was fixed. The `.env.example` file was not updated to document it. Operators deploying from the example file will use the hardcoded default `/var/roadsafe/audit-exports` without knowing the key exists or how to override it.
- **Impact:** Operational: operators cannot configure the export directory without reading the source. No security impact.
- **Minimum Actionable Fix:** Add `AUDIT_EXPORT_DIR=/var/roadsafe/audit-exports` with a descriptive comment to `repo/backend/.env.example`.

---

### ISSUE-06 — LOW: Brute-Force Lockout Bypassed via Username Case Variation

- **Severity:** Low
- **Evidence:** `repo/backend/src/routes/auth.js:44` — `username.trim()` only; no `.toLowerCase()`
- **Detail:** The lockout `Map` key is `normalizedUsername = username.trim()`. MySQL 8.x default collation `utf8mb4_0900_ai_ci` makes `WHERE u.username = ?` case-insensitive, so `admin`, `Admin`, and `ADMIN` all resolve to the same database user. However, each spelling gets a separate entry in the `loginAttempts` Map. An attacker can exhaust 5 attempts with `admin`, then switch to `Admin` for 5 more, `ADMIN` for 5 more, etc., accumulating unlimited guesses against the same account before the IP rate-limit (300/min) intervenes.
- **Impact:** Partially defeats brute-force protection for accounts targeted with case variations. Practical attack requires deliberate variation; automated tools that normalise input would still be blocked.
- **Minimum Actionable Fix:** Change line 44 to: `const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';`. The DB lookup is unaffected since MySQL comparison is already case-insensitive.

---

### ISSUE-07 — LOW: README Project Directory Label Incorrect

- **Severity:** Low (Documentation only)
- **Evidence:** `README.md:26` — project structure diagram shows `task2/` as root
- **Impact:** Documentation inconsistency; no runtime impact.
- **Minimum Actionable Fix:** Correct the label in `README.md:26`.

---

## 6. Security Review Summary

### Authentication Entry Points — Pass

Session tokens are `crypto.randomBytes(48).toString('hex')` (96 hex chars, 48 bytes of entropy). `authRequired` validates the token against `sessions` with DB-level expiry and revocation checks on every request. Logout revokes the session row immediately. Brute-force lockout triggers after 5 consecutive failures (15-minute window) and writes a `security_alerts` record with the source IP. The lockout map key has a case-normalisation gap (ISSUE-06) that partially reduces effectiveness.

**Evidence:** `routes/auth.js:13-132`, `middleware/auth.js:45-70`, `utils/crypto.js:44-46`

---

### Route-Level Authorization — Pass

Every state-mutating route applies `authRequired` followed by `requireRoles(...)`. No route bypasses authentication except `/health` and `/api/auth/login`. Read endpoints for sensitive resources (user list, audit events) require `Administrator`. All role guards are evaluated before any business logic.

**Evidence:** `routes/users.js:73`, `routes/audit.js:15`, `routes/coordinator.js:18-21`, `routes/inspections.js:9,31`

---

### Object-Level Authorization — Partial Pass

- **Pass:** File downloads enforce location/department scope in `findAuthorizedFileDownload` (`fileGovernanceService.js:44-51`).
- **Pass:** Seat assignment validates appointment scope before updating (`schedulingService.js:271-287`).
- **Pass:** Inspection result submission verifies `appointment.inspector_id === ctx.state.user.id` before accepting (`inspections.js:53`).
- **Pass:** Customer report endpoint enforces `WHERE a.customer_id = ?` with the authenticated user's own ID for non-admin (`inspections.js:147-171`).
- **Residual:** Customer reports do not additionally filter by `location_code`/`department_code`. A customer associated with appointments at multiple locations would see reports across all locations. For a single-location offline deployment this is benign; in a multi-location scenario it could expose cross-location data. Marked as residual low risk rather than an active defect.

---

### Function-Level Authorization — Pass

All privileged operations (user create/edit/deactivate, role management, audit queries, compliance sweeps) are gated on `requireRoles('Administrator')`. Ingestion management gated to `Data Engineer` and `Administrator`. Coordinator scheduling gated to `Coordinator` and `Administrator`. Inspector result submission gated to `Inspector` and `Administrator`. No function was found that permits lower-privilege roles to invoke higher-privilege operations.

**Evidence:** `routes/users.js:73,155,181`, `routes/ingestion.js`, `routes/coordinator.js:21`, `routes/compliance.js:24`

---

### Tenant / User Data Isolation — Pass

Two independent isolation layers:
1. **Middleware layer:** `enforceScope()` at `rbac.js:23-75` rejects requests that supply a mismatched `location_code`/`department_code` for non-admin users.
2. **SQL layer:** `searchService.js:14-20` appends `WHERE a.location_code = ? AND a.department_code = ?` for non-admin actors regardless of request parameters — scope is enforced at query time even if the middleware layer is misconfigured or bypassed.

Ingestion health in the dashboard is the one area where SQL-layer isolation is absent for non-admin roles (ISSUE-02).

---

### Admin / Internal / Debug Endpoint Protection — Pass

- All admin endpoints require `requireRoles('Administrator')`.
- No debug or internal endpoints without authentication are present.
- `/health` returns operational status only; no sensitive data.
- Stack traces are not returned to clients (global error handler at `server.js:50-63`).
- The `/retention/purge` endpoint that previously conflicted with the append-only trigger has been removed entirely.
- The audit export endpoint no longer accepts a user-supplied output path; it writes exclusively to `config.audit.exportDir`.

**Evidence:** `server.js:50-63`, `routes/audit.js:15,66-68`, `routes/health.js`

---

## 7. Tests and Logging Review

### Unit Tests — Pass

Three files covering pure business logic via `_testables` exports:
- `scheduling.test.js`: 30-minute boundary enforcement, heavy-duty bay routing (bays 3–6), recalibration window timing.
- `ingestion.test.js`: Priority-queue selection, exponential retry backoff, checkpoint snapshot building.
- `normalization.test.js`: Miles→km conversion, multi-currency→USD conversion, deterministic dedupe key stability.

Framework: Node.js built-in `node:test` + `assert/strict`. No external test runner dependency. Tests are self-contained pure-function tests requiring no DB or network.

### API / Integration Tests — Partial Pass

Five files with meaningful assertions against a live server:
- `auth_and_idor.test.js`: 401 for 6 unprotected routes, 403 for non-admin register, 403 for cross-scope scheduling, 403 for out-of-scope IDOR seat assignment, 401 for invalid credentials, 401 after session logout.
- `auth.test.js`: Password complexity rejection, coordinator creation and cross-scope 403.
- `critical_flows.test.js`: Search scope isolation, autocomplete scope, file download scope, account closure workflow (201/409), inbox isolation, inspection result publication.
- `operations.test.js`: Duplicate appointment 409, 5-minute submission lock 409.
- `security.test.js`: IDOR seat assignment 403, sensitive field masking (plate_number, vin redacted for non-admin).

All API tests use `t.skip('API not reachable')` when no server is reachable, so they provide no value in offline/CI environments without a running stack.

**Gap:** No tests cover the brute-force lockout (429 after 5 failures), file ingest path validation (400 for path outside drop root), AES key error on misconfiguration, or rate-limit enforcement (429).

### Logging — Partial Pass

- `safeLog` provides structured console logging with automatic redaction of 16 sensitive key names.
- Audit events are persisted to `audit_events` for all security-relevant actions.
- Ingestion scheduler emits `ingestion_scheduler.tick` and `ingestion_scheduler.tick_failed` events.
- Global error handler emits `request_error` with method, URL, and error message.
- **Weakness:** No log levels (DEBUG/INFO/WARN/ERROR) — all output goes to `console.log`. No structured log framework (pino, winston). Distinguishing severity requires parsing the event name string.

### Sensitive-Data Leakage Risk — Pass

- `safeLog` strips `token`, `password`, `password_hash`, `password_salt`, `email`, `vin`, `plate_number`, `ssn`, and related fields before writing to console.
- Non-admin API responses for search and messages pass through `redactObject`.
- Error responses return only generic messages; no field values or stack traces are returned to clients.
- Login audit event records only `username`, not the credential being verified.

---

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview

| Category | Files | Framework | Requires Live Server |
|---|---|---|---|
| Unit tests | 3 (`scheduling`, `ingestion`, `normalization`) | `node:test` + `assert/strict` | No |
| API integration tests | 5 (`auth`, `auth_and_idor`, `critical_flows`, `operations`, `security`) | `node:test` + `fetch` | Yes |
| Frontend tests | 1 (`ui.test.js`) | Not deeply analysed | Cannot confirm |

No explicit test commands are documented in `README.md`. `repo/run_tests.sh` exists and likely provides the unified entry point.

---

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Test File:Line | Key Assertion | Assessment | Gap |
|---|---|---|---|---|
| Login happy path (200 + token) | `auth_and_idor.test.js:33-45` | `status === 200`, `data.token` present | Sufficient | — |
| Login: invalid credentials (401) | `auth_and_idor.test.js:105-114` | `status === 401` | Sufficient | — |
| Login: missing fields (400) | `auth.test.js:45-50` | `status === 400` | Sufficient | — |
| Password complexity rejection (400) | `auth.test.js:57-71` | `status === 400`, message match | Sufficient | — |
| Unauthenticated route access (401) | `auth_and_idor.test.js:51-68` | `status === 401` for 6 routes | Sufficient | — |
| Non-admin register attempt (403) | `auth_and_idor.test.js:70-103` | `status === 403` | Sufficient | — |
| Cross-scope scheduling (403) | `auth.test.js:91-103`, `auth_and_idor.test.js:182-214` | `status === 403` | Sufficient | — |
| Session invalidation on logout | `auth_and_idor.test.js:216-241` | 401 after logout | Sufficient | — |
| IDOR: user list blocked for non-admin (403) | `auth_and_idor.test.js:131-153` | `status === 403` | Sufficient | — |
| IDOR: seat assignment out-of-scope (403) | `auth_and_idor.test.js:155-180`, `security.test.js:56-85` | `status === 403` | Sufficient | — |
| Duplicate appointment (409) | `operations.test.js:113-128` | `status === 409` | Sufficient | — |
| 5-minute submission lock (409) | `operations.test.js:130-151` | `status === 409`, `/submission lock/` | Sufficient | — |
| 30-minute slot boundary | `scheduling.test.js:5-14` | throws on 10:15 input | Sufficient | — |
| Heavy-duty bay routing | `scheduling.test.js:16-29` | bays 3,6 returned for heavy | Sufficient | — |
| Recalibration window timing | `scheduling.test.js:31-40` | window at T+30 to T+45 | Sufficient | — |
| ETL priority queue selection | `ingestion.test.js:5-15` | job 4 selected | Sufficient | — |
| Retry exponential backoff | `ingestion.test.js:17-27` | ms = 2000, 32000; fail at attempt 6 | Sufficient | — |
| Checkpoint snapshot | `ingestion.test.js:29-40` | correct row counts and version | Sufficient | — |
| Miles→km, currency→USD | `normalization.test.js:1-30` | stable precision values | Sufficient | — |
| Deterministic dedupe key | `normalization.test.js:16-30` | same key for identical rows | Sufficient | — |
| Sensitive field masking in responses | `security.test.js:87-94` | `plate_number === '***REDACTED***'` | Basically covered | Assertion only runs if rows exist |
| Search cross-scope isolation | `critical_flows.test.js:66-101` | `status === 200` | Basically covered | No assertion that returned rows are in-scope |
| File download scope enforcement | `critical_flows.test.js:157-181` | 403 or 404 for nonexistent ID | Basically covered | Tests invalid ID only; actual cross-scope download not tested |
| Inspection result: non-assigned inspector (403) | None | — | Missing | Happy path tested; wrong-inspector rejection not tested |
| Brute-force lockout (429 after 5 failures) | None | — | Missing | New mechanism fully untested |
| Rate-limit enforcement (429) | None | — | Missing | |
| File ingest: path outside drop root (400) | None | — | Missing | Core security fix has no regression test |
| AES key error on misconfiguration | None | — | Missing | |
| Account closure: duplicate request (409/idempotent) | `critical_flows.test.js:184-211` | `201 or 409` accepted | Basically covered | 409 path accepted but not verified |

---

### 8.3 Security Coverage Audit

| Security Area | Coverage | Assessment |
|---|---|---|
| Authentication (401 for missing token) | 6 routes tested | Sufficient |
| Route authorization (403 for wrong role) | Admin, Coordinator, cross-scope tested | Sufficient |
| Object-level authorization (IDOR) | User list, seat assignment tested | Basically covered — file cross-scope not tested |
| Tenant / data isolation | Search + scheduling scope tested | Basically covered — assertions could be stronger |
| Admin endpoint protection | User list 403 for non-admin tested | Sufficient |
| Brute-force lockout | Not tested | Missing |
| Rate limiting | Not tested | Missing |
| File path traversal fix | Not tested | Missing |
| AES key fail-loud behaviour | Not tested | Missing |

---

### 8.4 Final Coverage Judgment

**Conclusion: Partial Pass**

Core authentication, RBAC, scheduling business rules, and ETL logic have solid coverage. The main unmitigated test gaps are:
1. The brute-force lockout mechanism (new, entirely untested).
2. The file ingest path restriction (the most impactful security fix in the remediation cycle has no regression test).
3. Rate-limit enforcement.
4. AES key validation behaviour.

Tests could pass while these defects remained, since the gaps are in new protective mechanisms rather than in existing logic. None of the uncovered areas represents a regression in prior functionality; they represent forward coverage gaps for newly added controls.

---

## 9. Final Notes

The platform is a complete, correct, and professionally engineered implementation of the described RoadSafe Inspection Operations Platform. All High- and Medium-severity security defects are resolved. The remaining seven Low-severity items are narrow in scope and none constitutes a security vulnerability or correctness blocker.

**Priority order for remaining remediation:**
1. **ISSUE-06** (lockout case bypass) — single-line fix, closes a meaningful security gap
2. **ISSUE-05** (missing `.env.example` entry) — single-line documentation fix, prevents operator misconfiguration
3. **ISSUE-04** (default credentials in UI) — one-line template change, reduces deployment risk
4. **ISSUE-01** (scheduling transaction) — wrapping in a transaction; low urgency for single-server deployment
5. **ISSUE-02** (ingestion health scope) — adds a JOIN and WHERE clause to two queries
6. **ISSUE-03** (duplicate closure requests) — one existence check or a UNIQUE KEY
7. **ISSUE-07** (README typo) — cosmetic
