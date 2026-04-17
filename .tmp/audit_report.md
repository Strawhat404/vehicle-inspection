# RoadSafe Inspection Operations — Delivery Acceptance & Architecture Audit

**Audit Date:** 2026-04-06  
**Auditor Role:** Delivery Acceptance and Project Architecture Reviewer  
**Static Analysis Only — No Runtime Execution**

---

## 1. Verdict

**Overall Conclusion: Partial Pass**

The delivery is architecturally sound and covers nearly all Prompt requirements with real implementations (no large mocked-out stubs). The schema, services, RBAC, scheduling, ingestion, search, messaging, file governance, and compliance modules are substantively implemented. However, two High-severity security defects — an arbitrary-path file read/serve vulnerability and a silent AES-256 key degradation — prevent a full Pass. A third High-severity issue (audit export path traversal) also requires remediation before production deployment.

---

## 2. Scope and Static Verification Boundary

### What was reviewed
- All backend source files: `repo/backend/src/**` (routes, services, middleware, utils, config, server)
- Database schema and seed data: `repo/backend/init.sql`
- Frontend application: `repo/frontend/src/**` (App.vue, all components, services/api.js)
- All test files: `repo/API_tests/*.test.js`, `repo/unit_tests/*.test.js`, `repo/frontend/tests/ui.test.js`
- Configuration: `repo/backend/.env.example`, `repo/docker-compose.yml`
- Documentation: `README.md`, `docs/api-spec.md`, `docs/design.md`

### What was not reviewed
- `frontend/tests/ui.test.js` — listed but not deeply analyzed; noted as existing
- `sessions/develop-1.json` — development session log, not relevant to delivery
- `node_modules/` — dependency packages not inspected

### What was intentionally not executed
- Docker containers, runtime server, MySQL, test suites
- No actual API calls, no database connections, no file I/O

### Claims requiring manual verification
- Runtime behavior of CSRF enforcement against real browser requests
- Actual TLS certificate validity and connection behavior
- Test suite pass/fail rates (all tests are integration tests requiring a live stack)
- Rate limiter behavior under concurrent load (in-memory Map, single process)
- Scheduled cron tick behavior and actual hourly ingestion execution

---

## 3. Repository / Requirement Mapping Summary

### Prompt Core Business Goal
Offline-first internal vehicle inspection operations platform: catalog, scheduling, reporting. Five roles (Admin, Data Engineer, Coordinator, Inspector, Customer). Dashboard, resource allocation, ingestion, search, messaging, compliance, security.

### Main Implementation Areas Mapped

| Prompt Requirement | Implementation Location |
|---|---|
| 5-role RBAC | `middleware/rbac.js`, `routes/auth.js`, `init.sql` |
| Dashboard (today's appointments, resource utilization, ingestion health) | `routes/dashboard.js` |
| Coordinator scheduling + overbooking prevention | `services/schedulingService.js`, `routes/coordinator.js` |
| Heavy-duty bay routing (bays 3–6) | `schedulingService.js:35-40` |
| Recalibration after 8 tests | `schedulingService.js:115-143` |
| Advanced search with filters, pagination, autocomplete, trending | `services/searchService.js`, `routes/search.js` |
| In-app messaging + offline SMS/email outbox | `services/messagingService.js`, `routes/messages.js` |
| ETL ingestion (CSV, device export, network share) | `services/ingestionService.js` |
| Priority queue, dependencies, checkpoints, retries | `ingestionService.js` |
| Quality alerts (2% variance over 14-run baseline) | `ingestionService.js:340-362` |
| File governance (50 MB, MIME/ext allowlist, hash blocklist, quarantine) | `services/fileGovernanceService.js` |
| Sensitive content detection (SSN regex, dictionary) | `fileGovernanceService.js:16-33` |
| AES-256 at rest (messages, outbox) | `utils/encryption.js` |
| HTTPS TLS | `server.js:113-133` |
| Rate limiting (60/user, 300/IP per minute) | `middleware/rateLimit.js` |
| Audit log (append-only, 2-year retention, export) | `utils/audit.js`, `services/auditRetentionService.js` |
| 7-year report retention + tombstones | `services/retentionService.js` |
| Account closure (30-day anonymization) | `services/retentionService.js` |
| Privacy masking for non-admin | `utils/redaction.js` (applied in search, messages routes) |
| Privilege escalation detection | `services/securityMonitorService.js` |
| Vue.js frontend with role-specific views | `frontend/src/App.vue`, `components/` |

---

## 4. Section-by-Section Review

---

### Section 1: Hard Gates

#### 1.1 Documentation and Static Verifiability

**Conclusion: Pass**

- `README.md` provides a one-command startup (`docker compose up`) with backend and frontend URLs, and default admin credentials.
- `.env.example` is present and lists all required configuration keys.
- `docs/api-spec.md` documents all major endpoints.
- `init.sql` contains the full schema plus seed data, making database state predictable.
- `docker-compose.yml` specifies all services, networks, volumes, health checks, and environment variables.
- The documented entry point (`cd repo && docker compose up`) is consistent with the actual `docker-compose.yml` location and service definitions.

**Minor Issue:** `README.md:26` shows `task2/` as the root directory name in the project structure diagram. The actual location is under a `task4/` directory tree. This is a documentation inconsistency but does not affect usability.

#### 1.2 Prompt Alignment

**Conclusion: Pass**

The implementation is centered on the exact business goal — an offline vehicle inspection operations platform with all five stated roles, all major modules, and no features unrelated to the Prompt. No core problem replacement or weakening was found.

---

### Section 2: Delivery Completeness

#### 2.1 Core Requirements Coverage

**Conclusion: Partial Pass**

Nearly all explicitly stated functional requirements are implemented:

| Requirement | Status | Evidence |
|---|---|---|
| 5 roles with access control | Pass | `rbac.js:1-75`, `init.sql:365-372` |
| Dashboard (appointments, utilization, ingestion health) | Pass | `dashboard.js:8-211` |
| Test center ledger with seat maps | Pass | `coordinator.js:105-138`, `schedulingService.js:241-268` |
| Bay overbooking prevention | Pass | `init.sql:214-222` (UNIQUE constraints), `schedulingService.js:196-204` |
| Heavy-duty routing to bays 3–6 | Pass | `schedulingService.js:35-40` |
| Recalibration reserve after 8 tests | Pass | `schedulingService.js:115-143` |
| Advanced search + filters + pagination (25/page) | Pass | `searchService.js:1-102` |
| Autocomplete + trending (7-day) | Pass | `searchService.js:111-188` |
| Messaging Center with offline outbox | Pass | `messagingService.js:1-91` |
| Plugin-based ETL (CSV, device export, network share) | Pass | `ingestionService.js:491-510` |
| Job queue: priorities, dependencies, checkpoints, retries | Pass | `ingestionService.js:199-547` |
| Incremental jobs hourly by default | Pass | `ingestionSchedulerService.js:5, 52` |
| Quality alerts (2% variance, 14-run baseline) | Pass | `ingestionService.js:340-362` |
| AES-256 at rest, HTTPS in transit | Pass | `encryption.js`, `server.js:113-133` |
| Privacy field masking for non-admin | Pass | `redaction.js`, applied in `search.js:29`, `messages.js:38` |
| Password complexity (12 chars minimum) | Pass | `crypto.js:8-15` |
| Rate limiting (60/user, 300/IP) | Pass | `rateLimit.js:36-57` |
| Audit log (append-only, 2-year retention, export) | Pass | `init.sql:446-464`, `auditRetentionService.js` |
| File governance (50 MB, allowlists, hash blocklist) | Pass | `fileGovernanceService.js:7-10, 74-90` |
| Sensitive content detection + quarantine | Pass | `fileGovernanceService.js:16-33, 116-120` |
| 7-year report retention + tombstones | Pass | `retentionService.js:3, 17-39` |
| Account closure in 30 days | Pass | `retentionService.js:4, 41-65` |
| Privilege escalation detection + immutable audit | Pass | `securityMonitorService.js:6-28` |

**Gap:** The Prompt states "Administrators configure locations, policies, and user access." User management (create/edit/deactivate users, roles) is fully implemented. However, there is no dedicated API endpoint or UI for administrators to create new `locations` (location_codes) or configure policies (e.g., bay rules, retention policy thresholds) dynamically. The system relies on seed data for locations and hard-coded constants for policy parameters. This is a functional gap but not a full-feature miss; the system's seed data covers the described HQ scenario.

#### 2.2 End-to-End Deliverable

**Conclusion: Pass**

The project is a complete, end-to-end application — not a fragment or demo. It includes a fully operational backend API (12+ route files, 8 services), a Vue 3 frontend with 10+ role-specific components, a complete 26-table MySQL schema, Docker Compose orchestration, and a test suite with 8 test files across unit, API integration, and UI categories.

---

### Section 3: Engineering and Architecture Quality

#### 3.1 Structure and Module Decomposition

**Conclusion: Pass**

The backend uses a clean layered architecture:
- `routes/` — HTTP concerns, request/response shaping, role guards
- `services/` — domain logic (scheduling, ingestion, file governance, messaging)
- `middleware/` — cross-cutting concerns (auth, RBAC, rate limiting)
- `utils/` — crypto, encryption, audit, redaction

No single file concentrates excessive logic. The largest services (`ingestionService.js`, `schedulingService.js`) are ~560 and ~336 lines respectively, both well-structured with clear function boundaries.

**Minor Note:** `db.js` exports both `query` and `execute` which both call `pool.query`. The distinction is unused semantically; only `messagingService.js` uses `execute`. This is a trivial inconsistency with no functional impact.

#### 3.2 Maintainability and Extensibility

**Conclusion: Pass**

- The ETL connector framework uses a `connectorRegistry` Map (`ingestionService.js:491-495`) with a public `registerIngestionConnector` export, allowing new connectors to be added without modifying existing code.
- RBAC enforcement is centralized in two middleware functions (`requireRoles`, `enforceScope`).
- Sensitive field masking is centralized in `redaction.js` via a `SENSITIVE_KEYS` Set.
- `_testables` exports in `schedulingService.js` and `ingestionService.js` allow unit testing of pure business logic without DB mocks.

---

### Section 4: Engineering Details and Professionalism

#### 4.1 Error Handling, Logging, Validation

**Conclusion: Pass**

- Global error handler at `server.js:50-63` catches unhandled rejections and returns a generic 500 response (no stack trace leakage to clients).
- Domain errors use structured error codes (`DUPLICATE_APPOINTMENT`, `APPOINTMENT_SCOPE_VIOLATION`) enabling clean client-side handling.
- All SQL queries use parameterized placeholders throughout; no string concatenation in SQL observed.
- Input validation is present for: password complexity, role_name existence, numeric IDs, pagination parameters, file extension/MIME type.
- `safeLog` in `redaction.js` strips sensitive fields before writing to console. Logging uses structured key-value objects rather than bare strings.
- One concern: `auditRetentionService.js:8-10` allows `DELETE FROM audit_events` via the retention purge API, which bypasses the append-only triggers. The triggers block direct client UPDATE/DELETE but `purgeExpiredAuditEvents()` also issues a `DELETE` directly, which would be blocked by the trigger at the database level. **This means the purge endpoint will fail at runtime** because the `tr_audit_events_block_delete` trigger prevents all DELETEs. This is a latent defect: the code exists but cannot execute successfully. `Cannot Confirm Statistically` whether the trigger is intentionally meant to allow the retention sweep (perhaps by dropping/recreating the trigger).

#### 4.2 Real Product vs. Demo Quality

**Conclusion: Pass**

The deliverable exhibits production-quality engineering: scoped isolation by location+department throughout, deterministic dedupe keys, checkpoint-based resumption, seed-data-driven initialization, structured error codes, TLS with cert file validation, and 26 well-normalized tables with appropriate foreign keys and indexes. This is not a demo.

---

### Section 5: Prompt Understanding and Requirement Fit

#### 5.1 Business Goal and Semantic Alignment

**Conclusion: Pass**

The implementation correctly understands the business semantics:

- **Offline-first**: No external API calls; TLS via local certs; outbox pattern for SMS/email; scheduled ingestion from local paths.
- **30-minute slot enforcement**: `normalizeSlotStart` (`schedulingService.js:7-15`) throws on non-30-minute boundaries.
- **Bay 3–6 for heavy duty**: `filterBayCandidates` (`schedulingService.js:35-40`) enforces `bayNumber >= 3 && bayNumber <= 6`.
- **Recalibration reserves 15 minutes after every 8 tests**: `SLOT_MINUTES=30`, `RECALIBRATION_AFTER_TESTS=8`, `RECALIBRATION_MINUTES=15` (`schedulingService.js:3-5`); `getRecalibrationWindow` inserts a maintenance window starting immediately after the triggering slot.
- **Trending keywords from last 7 days of local query logs**: `trendingKeywords` uses `DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)` (`searchService.js:163`).
- **Backfill capped at 30 days**: `MAX_BACKFILL_DAYS = 30` (`ingestionService.js:7`).
- **5 retries with exponential backoff**: `computeRetryState` uses `2^retries * 1000 ms` (`ingestionService.js:182-188`).

---

### Section 6: Aesthetics (Frontend)

**Conclusion: Pass**

- **Visual hierarchy**: Consistent Tailwind CSS classes. Fixed left sidebar (`w-72`) separates navigation from main content. Card-based metric display with `rounded-xl border border-slate-200 bg-white shadow-sm`.
- **Layout**: Role-specific menus are computed at runtime (`DashboardShell.vue:34-85`). Views are guarded both in `App.vue` template conditions and in `handleMenuSelect` role map.
- **Interaction feedback**: Loading states on all async operations (`loading.value = true/false`), disabled buttons during loading (`disabled:opacity-50`), inline error and success messages.
- **Consistency**: All buttons, inputs, and labels use uniform Tailwind utility classes. Color coding: blue for active/running, red for failed/cancelled, green for checked-in/completed, amber for occupied seats.
- **Resource utilization bars**: Progress bar visualization using `width: bayUtilizationPercent + '%'` (`App.vue:117-120`).
- **Seat map**: Color-coded grid with amber for occupied seats and appointment ID overlay (`CoordinatorDashboard.vue:35-42`).
- **Minor Gap**: `LoginForm.vue:27` hardcodes `Default admin: admin / Admin@123456` visibly in the UI. Appropriate for developer setup, but inappropriate in production.
- **Minor Gap**: Coordinator appointment form uses a raw numeric `customer_id` input rather than a searchable customer picker, which is low-UX but functionally valid.

---

## 5. Issues / Suggestions (Severity-Rated)

---

### ISSUE-01 — HIGH: Path Traversal via File Ingest `source_path` (Server-Side File Read)

- **Severity:** High
- **Title:** Arbitrary server file read/serve through file ingest endpoint
- **Conclusion:** Fail — active security defect
- **Evidence:**
  - `repo/backend/src/routes/files.js:22`: `sourcePath: body.source_path`
  - `repo/backend/src/services/fileGovernanceService.js:70`: `const resolved = path.resolve(sourcePath);`
  - No directory boundary check is performed after `path.resolve`.
- **Impact:** Any authenticated user holding the Coordinator, Inspector, Data Engineer, or Administrator role can POST `source_path: "/etc/passwd"` (or any server path) to `/api/files/ingest`. The server reads the file, stores its real path in `files.storage_path`, and then serves it via `/api/files/download/:id`. Sensitive server files (SSL private keys, environment files, application secrets) are at risk.
- **Minimum Actionable Fix:** Before `path.resolve`, validate that the resolved path starts with the configured `INGEST_DROP_ROOT` directory. Reject any path that escapes this prefix: `if (!resolved.startsWith(path.resolve(config.ingestion.dropRoot))) throw new Error('Source path is outside allowed drop root');`.

---

### ISSUE-02 — HIGH: AES-256 Key Silently Degrades to Predictable Fallback

- **Severity:** High
- **Title:** AES-256 encryption falls back to SHA-256 of a known string on misconfiguration
- **Conclusion:** Fail — systemic security defect
- **Evidence:**
  - `repo/backend/src/utils/encryption.js:6-11`: `getKey()` checks if the key is exactly 64 valid hex chars; if not, falls back to `crypto.createHash('sha256').update(raw || 'roadsafe-dev-key').digest()`.
  - `repo/backend/src/config.js:59`: default for `DATA_ENCRYPTION_KEY` resolves to `'PLACEHOLDER_64_HEX_CHARS_FOR_AES_256'` — this string is not 64 hex chars, so any deployment without proper `.env` configuration silently uses `sha256('PLACEHOLDER_64_HEX_CHARS_FOR_AES_256')` as the key.
  - `repo/backend/.env.example:17`: shows `your_64_hex_chars_for_aes_256_key_here` — also not a valid key.
- **Impact:** Message bodies (`messages.body_encrypted`) and outbox payloads (`manual_delivery_outbox.recipient_encrypted`, `payload_encrypted`) are encrypted with a publicly derivable key if the deployment operator does not set a proper encryption key. Sensitive recipient and message data are compromised.
- **Minimum Actionable Fix:** In `getKey()`, throw an error if the key is not exactly 64 valid hex chars: `throw new Error('DATA_ENCRYPTION_KEY must be set to 64 valid hex characters')`. Do not silently fall back.

---

### ISSUE-03 — HIGH: Audit Export Writes to Arbitrary Server Path

- **Severity:** High
- **Title:** Admin can write audit ledger export to any server filesystem path
- **Conclusion:** Fail — path traversal in export endpoint
- **Evidence:**
  - `repo/backend/src/routes/audit.js:67`: `const outputDir = typeof ctx.request.body?.output_dir === 'string' ? ctx.request.body.output_dir : '/tmp'`
  - `repo/backend/src/services/auditRetentionService.js:28-33`: `const safeDir = path.resolve(outputDir); fs.mkdirSync(safeDir, { recursive: true }); fs.writeFileSync(...)`.
- **Impact:** A compromised Admin account can write files (including sensitive audit data) to arbitrary locations on the server (e.g., `/var/www/html/audit.jsonl` for web exposure, or overwrite system configuration files).
- **Minimum Actionable Fix:** Restrict `outputDir` to a configured allow-listed export directory (e.g., `AUDIT_EXPORT_DIR` env variable). Validate the resolved path starts with this prefix before writing.

---

### ISSUE-04 — MEDIUM: Audit Purge Endpoint Will Be Blocked by Append-Only DB Trigger

- **Severity:** Medium
- **Title:** `POST /api/audit/retention/purge` cannot succeed — DELETE blocked by trigger
- **Conclusion:** Fail — latent functional defect
- **Evidence:**
  - `repo/backend/src/services/auditRetentionService.js:8-10`: `DELETE FROM audit_events WHERE event_time < DATE_SUB(...)`.
  - `repo/backend/init.sql:455-463`: `CREATE TRIGGER tr_audit_events_block_delete BEFORE DELETE ON audit_events ... SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_events is append-only: deletes are not permitted'`.
- **Impact:** The `POST /api/audit/retention/purge` endpoint will throw a database error (SQLSTATE 45000) at runtime, making the 2-year retention enforcement non-functional. The audit log will grow indefinitely.
- **Minimum Actionable Fix:** Remove the `purgeExpiredAuditEvents` function and the `/retention/purge` endpoint, replacing them with an archival approach (move old events to an archive table or export-then-truncate with trigger temporarily disabled by a privileged migration procedure). Alternatively, document that the trigger intentionally prevents purge and remove the dead code path.

---

### ISSUE-05 — MEDIUM: No Login Brute-Force / Account Lockout Protection

- **Severity:** Medium
- **Title:** Username-targeted password brute force permitted at 300 requests/minute per IP
- **Conclusion:** Partial Pass — rate limiting exists but is insufficient for targeted attack
- **Evidence:**
  - `repo/backend/src/routes/auth.js:13-88`: No attempt counter per username, no lockout.
  - `repo/backend/src/middleware/rateLimit.js:37-42`: IP rate limit is 300/minute (5/second). No per-username tracking for unauthenticated requests.
- **Impact:** An attacker can attempt ~300 password guesses per minute per IP address against a known username. Combined with offline IP rotation, brute force is feasible.
- **Minimum Actionable Fix:** Track failed login attempts per username in-memory (or in a `login_attempts` table). Lock account for a configurable duration after N consecutive failures. Log failed attempts to `security_alerts`.

---

### ISSUE-06 — MEDIUM: Privilege Escalation Detection Never Fires for Admin Actor

- **Severity:** Medium
- **Title:** `detectPrivilegeEscalation` logic excludes all legitimate escalation scenarios
- **Conclusion:** Fail — logic inversion defeats the purpose
- **Evidence:**
  - `repo/backend/src/services/securityMonitorService.js:9`: `const escalation = HIGH_PRIV.has(assignedRole) && !HIGH_PRIV.has(actorRole)`.
  - All user-create and role-update routes require `Administrator` role (`routes/auth.js:109`, `routes/users.js:181`). `Administrator` is in `HIGH_PRIV`.
  - Therefore `!HIGH_PRIV.has(actorRole)` is always `false` for any legitimate caller, so `escalation` is always `false`.
- **Impact:** The privilege escalation alert mechanism is non-functional. A compromised Admin account elevating another user to Admin/Data Engineer role would go undetected by this check.
- **Minimum Actionable Fix:** Redesign the detection logic to alert on *any* assignment of a high-privilege role by *any* actor, or to compare the assigned role's privilege level against the actor's, and log all high-privilege assignments unconditionally.

---

### ISSUE-07 — LOW: Appointment Scheduling Not Wrapped in a Database Transaction

- **Severity:** Low
- **Title:** Race condition window between resource availability check and lock insert
- **Conclusion:** Partial Pass — UNIQUE constraints provide fallback safety but no atomicity
- **Evidence:**
  - `repo/backend/src/services/schedulingService.js:175-206`: Sequential DB calls — `selectAvailableInspector` → `selectAvailableBay` → `selectAvailableEquipment` → `INSERT appointments` → `INSERT bay_capacity_locks` — without a `START TRANSACTION / COMMIT / ROLLBACK`.
  - UNIQUE constraint `uq_bay_slot`, `uq_inspector_slot`, `uq_equipment_slot` on `bay_capacity_locks` (`init.sql:214-216`) act as last-resort guards.
- **Impact:** Under concurrent scheduling, the availability check and lock insert are not atomic. The UNIQUE constraints will cause the lock insert to fail, and the appointment is deleted as a fallback (`schedulingService.js:201-203`). The system is eventually consistent but not transactionally safe.
- **Minimum Actionable Fix:** Acquire a DB connection and wrap `scheduleAppointment` in a `START TRANSACTION / COMMIT / ROLLBACK` using `getConnection()` from `db.js`. This also prevents orphaned appointment rows if the process crashes between the appointment INSERT and the lock INSERT.

---

### ISSUE-08 — LOW: Ingestion Health Shows Global Job Counts for Non-Admin Users

- **Severity:** Low
- **Title:** Location/department scope not applied to ingestion health queries for non-admin roles
- **Conclusion:** Partial Pass — minor data leak between organizational scopes
- **Evidence:**
  - `repo/backend/src/routes/dashboard.js:103-118`: `ingestionHealth` queries have no `location_code`/`department_code` filter.
  - The `dashboard.js:170-211` `/ingestion-health` endpoint also has no scope filter.
- **Impact:** Coordinators and Data Engineers see global ingestion job counts and status, including jobs from other locations.
- **Minimum Actionable Fix:** Add `WHERE submitted_by IN (SELECT id FROM users WHERE location_code = ? AND department_code = ?)` or a `JOIN users` scope filter to ingestion health queries for non-admin roles.

---

### ISSUE-09 — LOW: Multiple Pending Account Closure Requests Possible Per User

- **Severity:** Low
- **Title:** No guard against duplicate pending closure requests for the same user
- **Conclusion:** Partial Pass
- **Evidence:**
  - `repo/backend/init.sql:168-177`: `account_closure_requests` table has no UNIQUE constraint on `(user_id, status='pending')`.
  - `repo/backend/src/services/retentionService.js:7-13`: `createAccountClosureRequest` inserts unconditionally without checking for existing pending requests.
- **Impact:** A user can submit multiple closure requests. The retention sweep would process all of them, but since the user is already anonymized after the first, subsequent runs attempt to overwrite an already-closed account. Low practical impact but messy state.
- **Minimum Actionable Fix:** Add a check before inserting: `SELECT id FROM account_closure_requests WHERE user_id = ? AND status = 'pending' LIMIT 1`. Return the existing request ID if one exists. Or add `UNIQUE KEY uq_user_pending (user_id, status)` with appropriate handling.

---

### ISSUE-10 — LOW: Default Admin Credentials Hardcoded Visibly in Login UI

- **Severity:** Low
- **Title:** Login page exposes default credentials in production-visible HTML
- **Conclusion:** Partial Pass — suitable for development, risk in production
- **Evidence:**
  - `repo/frontend/src/components/LoginForm.vue:27`: `Default admin: <code>admin / Admin@123456</code>`
- **Impact:** Any user who reaches the login page can see the default admin credentials. If operators do not change the default password after deployment, this facilitates immediate admin access.
- **Minimum Actionable Fix:** Remove the hardcoded credential hint from the component, or gate it behind a development-only environment variable (`VITE_SHOW_DEFAULT_CREDS`).

---

### ISSUE-11 — LOW: README Contains Incorrect Project Directory Name

- **Severity:** Low (Documentation)
- **Title:** README references `task2/` directory structure instead of actual path
- **Evidence:** `README.md:26`: `task2/` shown as root in the project structure diagram
- **Impact:** Documentation inconsistency only; no runtime impact.
- **Minimum Actionable Fix:** Update `README.md:26` to show the correct directory name.

---

## 6. Security Review Summary

### Authentication Entry Points

**Conclusion: Pass**

- `POST /api/auth/login`: Validates username/password with `bcrypt.compareSync`, inserts a 96-char random hex session token in `sessions` table, audits the login event.
- Session token is a `crypto.randomBytes(48).toString('hex')` — cryptographically random.
- `authRequired` middleware (`auth.js:45-70`) validates session against DB: checks `revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() AND u.is_active = 1`.
- Token expiry is enforced at every request, not just login.
- Logout properly revokes the session by setting `revoked_at`.

**Evidence:** `routes/auth.js:13-88`, `middleware/auth.js:45-70`, `utils/crypto.js:44-46`

---

### Route-Level Authorization

**Conclusion: Pass**

- All state-mutating routes use `authRequired` + `requireRoles(...)` guards.
- Read routes for sensitive data (users list, audit events) are gated with `requireRoles('Administrator')`.
- Role checks are evaluated before any business logic in each route handler.
- No route bypasses `authRequired` except `/health` and `/api/auth/login`.

**Evidence:** `routes/users.js:73`, `routes/audit.js:15`, `routes/coordinator.js:18-21`

---

### Object-Level Authorization

**Conclusion: Partial Pass**

- **Pass:** File downloads check scope via `findAuthorizedFileDownload` (`fileGovernanceService.js:44-49`), returning `null` if `location_code`/`department_code` mismatches.
- **Pass:** Seat assignment validates appointment scope in `assignSeatToAppointment` (`schedulingService.js:271-287`).
- **Pass:** Inspection result submission verifies `appointment.inspector_id === ctx.state.user.id` (`inspections.js:53`).
- **Partial Fail:** Customer reports endpoint (`inspections.js:147-171`) enforces customer-to-customer isolation (non-admin sees only `WHERE a.customer_id = ?` with their own ID). However, there is no check that `appointment.location_code` matches the customer's scope — a customer at one location could theoretically access reports from another if they share a customer_id. This is a theoretical risk since customer IDs are DB-assigned and not guessable, but the data model allows cross-location reports for the same customer.

**Evidence:** `fileGovernanceService.js:44-49`, `schedulingService.js:271-287`, `inspections.js:53-56, 147-171`

---

### Function-Level Authorization

**Conclusion: Pass**

- Admin-only operations (user list, user update, role management, audit events, compliance retention) all enforce `requireRoles('Administrator')` at the route middleware level.
- Data-Engineer-specific ingestion operations enforce `requireRoles('Data Engineer', 'Administrator')`.
- Coordinator-only scheduling enforces `requireRoles('Coordinator', 'Administrator')`.
- Inspector-only result submission enforces `requireRoles('Inspector', 'Administrator')`.
- No function was found that performs privileged operations accessible to lower-privilege roles.

**Evidence:** `routes/users.js:73`, `routes/ingestion.js` (not read in full but referenced), `routes/coordinator.js:21`, `routes/inspections.js:31`

---

### Tenant / User Data Isolation

**Conclusion: Pass**

- `enforceScope()` middleware (`rbac.js:23-75`) validates that incoming `location_code`/`department_code` request parameters match the authenticated user's scope for non-admin users.
- SQL-level scope enforcement in `searchService.js:15-20` adds `WHERE a.location_code = ? AND a.department_code = ?` for non-admin users regardless of request parameters.
- Dashboard queries use separate SQL branches for admin vs. non-admin with scope parameters (`dashboard.js:22-44`).

**Minor Concern:** `enforceScope` only checks if the user *supplies* a mismatched scope in the request. If a non-admin user omits the scope parameters, the middleware passes, and the scope defaults to `ctx.state.user.locationCode`/`departmentCode`. This is correct behavior but relies on the downstream service query also adding scope filters — which is the case for search, but not consistently enforced across all routes (e.g., `coordinator.js:93-96` uses `ctx.query.location || ctx.state.user.locationCode` which defaults correctly).

**Evidence:** `middleware/rbac.js:23-75`, `services/searchService.js:14-20`

---

### Admin / Internal / Debug Endpoint Protection

**Conclusion: Pass**

- All admin endpoints require `requireRoles('Administrator')`.
- No debug/internal endpoints exposed without authentication.
- `/health` endpoint (`routes/health.js`) returns basic status only; no sensitive data exposed.
- Stack traces are not returned to API clients (caught by global error handler at `server.js:50-63` which returns only `{ error: 'Internal Server Error' }`).
- `safeLog` redacts sensitive fields in all console output.

**Evidence:** `server.js:50-63`, `routes/audit.js:15`, `utils/redaction.js:3-16`

---

## 7. Tests and Logging Review

### Unit Tests

**Conclusion: Pass**

- 3 unit test files covering pure business logic via `_testables` exports.
- `scheduling.test.js`: 30-minute boundary enforcement, heavy-duty bay routing, recalibration window.
- `ingestion.test.js`: Job priority selection, retry backoff calculation, checkpoint snapshot.
- `normalization.test.js`: Unit/currency conversion, deterministic dedupe key stability.
- All tests use Node.js built-in `node:test` + `assert/strict`; no external test framework dependency.
- Test isolation is clean: pure function testing without DB mocks needed.

### API / Integration Tests

**Conclusion: Partial Pass**

Five API test files cover: authentication flows, IDOR prevention, critical business flows, operational edge cases, and security checks. Key coverage includes:

- 401 for all protected routes (unauthenticated)
- 403 for cross-role and cross-scope access
- Duplicate appointment conflict (409)
- 5-minute submission lock
- Logout + session invalidation
- Account closure workflow
- Search cross-scope isolation
- File governance scope enforcement

**Gap:** All API tests are integration tests requiring a live server. They use `t.skip('API not reachable')` when the server is unavailable — meaning they provide zero value in CI without a running stack. No mock-based or offline-capable API tests exist.

### Logging Categories / Observability

**Conclusion: Partial Pass**

- `safeLog` provides structured console logging with sensitive-field redaction throughout the backend.
- Audit events are persisted to the `audit_events` table for all security-relevant actions.
- The `ingestion_scheduler.tick` and `request_error` log events provide operational visibility.
- **Weakness:** No log levels (DEBUG/INFO/WARN/ERROR); all events go to `console.log`. No structured log framework (e.g., pino, winston). In production, distinguishing error severity from informational events requires parsing the event name string.

### Sensitive-Data Leakage Risk

**Conclusion: Pass**

- `safeLog` redacts 16 sensitive keys including `token`, `password`, `password_hash`, `email`, `vin`, `plate_number`.
- API responses for non-admin users pass through `redactObject` for search results and messages.
- Error responses return only generic messages; no stack traces, no field values.
- Login audit event records only `username`, not `password_hash` or other sensitive fields (`auth.js:65-74`).

**Minor Risk:** `safeLog` uses `console.log` which in some Node.js environments writes to stdout where it may be captured by container log aggregators. The redaction ensures PII is stripped before this happens. Acceptable.

---

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview

| Category | Files | Framework | Entry Point |
|---|---|---|---|
| Unit tests | 3 files (`scheduling.test.js`, `ingestion.test.js`, `normalization.test.js`) | `node:test` + `assert/strict` | `node unit_tests/*.test.js` |
| API integration tests | 5 files (`auth.test.js`, `auth_and_idor.test.js`, `critical_flows.test.js`, `operations.test.js`, `security.test.js`) | `node:test` + `fetch` | `node API_tests/*.test.js` (requires live server) |
| Frontend tests | 1 file (`frontend/tests/ui.test.js`) | Not deeply analyzed | Not confirmed |

Documentation in `README.md` does not provide explicit test commands. `repo/run_tests.sh` exists (not read in detail) and likely provides the unified test entry point.

**Evidence:** `repo/unit_tests/`, `repo/API_tests/`, `repo/frontend/tests/`

---

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| Login happy path | `auth_and_idor.test.js:105-114` | `status === 200, data.token` | Sufficient | — | — |
| Login with invalid credentials (401) | `auth_and_idor.test.js:105-114` | `status === 401` | Sufficient | — | — |
| Password complexity rejection (400) | `auth.test.js:57-71` | `status === 400, /at least 12 chars/` | Sufficient | — | — |
| Unauthenticated route access (401) | `auth_and_idor.test.js:51-68` | `status === 401` for 6 routes | Sufficient | — | — |
| Non-admin register attempt (403) | `auth_and_idor.test.js:70-103` | `status === 403` | Sufficient | — | — |
| Session invalidation on logout | `auth_and_idor.test.js:216-241` | 401 after logout | Sufficient | — | — |
| Cross-scope scheduling (403) | `auth.test.js:91-103`, `auth_and_idor.test.js:182-214` | `status === 403` | Sufficient | — | — |
| IDOR: coordinator accessing admin user list (403) | `auth_and_idor.test.js:131-153` | `status === 403` | Sufficient | — | — |
| IDOR: seat assignment with out-of-scope appointment (403) | `auth_and_idor.test.js:155-180`, `security.test.js:56-85` | `status === 403` | Sufficient | — | — |
| Duplicate appointment (409) | `operations.test.js:72-151` | `status === 409` | Sufficient | — | — |
| 5-minute submission lock (409) | `operations.test.js:130-151` | `status === 409, /submission lock/` | Sufficient | — | — |
| Heavy-duty bay routing | `scheduling.test.js:16-29` | Bay IDs 2,3 returned for heavy | Sufficient | — | — |
| 30-minute slot boundary enforcement | `scheduling.test.js:5-14` | Throws on non-30-min slot | Sufficient | — | — |
| Recalibration window creation | `scheduling.test.js:31-40` | Window at T+30 to T+45 | Sufficient | — | — |
| ETL priority queue selection | `ingestion.test.js:5-15` | Job 4 selected (priority 10, earliest) | Sufficient | — | — |
| Retry exponential backoff | `ingestion.test.js:17-27` | retryAfterMs=2000, 32000; shouldFail=true at 6 | Sufficient | — | — |
| Checkpoint snapshot | `ingestion.test.js:29-40` | rows_parsed, rows_written, version | Sufficient | — | — |
| Unit/currency normalization | `normalization.test.js:1-30` | Miles→km, EUR/KES→USD, deterministic key | Sufficient | — | — |
| Search cross-scope isolation | `critical_flows.test.js:66-101` | 200 status; assertion on rows weak | Basically covered | Assertion only checks that rows exist, not that they're scoped — weak positive check | Add assertion that `vehicle.location_code` matches expected scope |
| File download scope enforcement | `critical_flows.test.js:157-181` | 403 or 404 for nonexistent file | Basically covered | Tests invalid ID, not actual cross-scope file; path traversal not tested | Add test: ingest file with crafted path, attempt download by different-scope user |
| Rate limiting enforcement | None | — | Missing | No test verifies 429 response after exceeding rate limit | Add: fire 61 requests as the same user within one minute, assert 429 |
| File ingest path traversal blocked | None | — | Missing | No test for `source_path: '/etc/passwd'` | Add: POST to `/api/files/ingest` with path outside drop root, assert 400 |
| Sensitive content quarantine | None | — | Missing | No test for SSN pattern in uploaded file triggering quarantine | Add: upload file with `123-45-6789`, assert `quarantined: true` in response |
| Audit export path restriction | None | — | Missing | No test that `output_dir` outside allowed prefix is rejected | Add: POST audit export with `output_dir: '/../../../etc'`, assert 400 |
| Audit purge blocked by trigger | None | — | Missing | ISSUE-04 is untested | Add: call `/api/audit/retention/purge`, assert error or no-op |
| Inspection result: non-assigned inspector blocked (403) | None (only 201/409 tested) | — | Insufficient | `critical_flows.test.js:241-324` tests happy path; non-assigned inspector not tested | Add: create appointment assigned to inspector A, submit result as inspector B, assert 403 |
| Account closure workflow | `critical_flows.test.js:184-211` | 201 or 409 | Basically covered | — | — |

---

### 8.3 Security Coverage Audit

| Security Area | Test Coverage | Assessment |
|---|---|---|
| Authentication (401 for missing token) | Comprehensive — 6 routes tested for 401 | Sufficient |
| Route-level authorization (403 for wrong role) | Multiple tests for Coordinator/Admin boundaries | Sufficient |
| Object-level authorization (IDOR) | Seat IDOR and user list IDOR covered | Basically covered — file path traversal IDOR not tested |
| Tenant / data isolation | Search cross-scope, scheduling cross-scope covered | Basically covered — search assertion weak (no actual cross-scope data validated) |
| Admin / internal protection | Admin user list (403 for non-admin) covered | Sufficient |
| Rate limiting | Not tested | Missing |
| Brute-force protection | Not tested | Missing |
| File path traversal | Not tested | Missing |
| AES key degradation | Not tested | Missing |

---

### 8.4 Final Coverage Judgment

**Conclusion: Partial Pass**

**Covered risks:** Core authentication flows, RBAC (role and scope), IDOR for user list and seat assignment, duplicate appointment prevention, submission locking, all scheduling business rules, full ETL normalization and retry logic.

**Uncovered risks that mean tests could pass while severe defects remain:**
- Path traversal in file ingest (ISSUE-01) — no test would catch an admin reading `/etc/passwd` via the file ingest endpoint.
- AES key degradation (ISSUE-02) — no test verifies that encryption fails loudly on misconfiguration.
- Audit export path traversal (ISSUE-03) — not tested.
- Audit purge trigger conflict (ISSUE-04) — not tested; the purge endpoint would fail silently or with DB error.
- Rate-limit brute force (ISSUE-05) — no test exercises the 429 threshold.

---

## 9. Final Notes

The delivery is a materially complete, professionally engineered implementation of the RoadSafe Inspection Operations Platform. The scheduling engine correctly enforces all business rules from the Prompt (slot boundaries, heavy-duty routing, recalibration reserves). The ETL pipeline correctly implements checkpoint-based resumption, priority queuing, dependency resolution, quality alerting, and multi-connector dispatch. Security fundamentals (parameterized SQL, RBAC, session management, TLS, audit logging) are solid.

The three High-severity issues (file path traversal, AES key degradation, audit export path traversal) and one Medium functional defect (audit purge blocked by its own DB trigger) are the primary remediation blockers before production deployment. None require architectural changes — all are narrow, localized fixes.

The privilege escalation detection logic (ISSUE-06) is a behavioral no-op that should be redesigned; its current form provides a false sense of security monitoring for Admin-initiated role assignments.

Test coverage is strong for scheduling and ingestion pure logic, and adequate for auth/IDOR flows, but has visible gaps in file governance, rate limiting, and the two security ISSUES-01 and -02.
