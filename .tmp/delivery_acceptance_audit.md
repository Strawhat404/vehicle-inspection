# Delivery Acceptance / Project Architecture Audit

## Scope & Method
- Audit target: `/home/pirate/Documents/Projects/task2/repo`
- Standard: user-provided Acceptance/Scoring Criteria only
- Runtime policy observed: **No Docker commands executed**
- Executed verification commands:
  - `cd repo && ./run_tests.sh`
  - `cd repo/backend && timeout 12s npm start`
  - `cd repo/frontend && npm run build`

## Issue Severity Summary
- **Blocker**
  - Startup instructions path mismatch and environment coupling prevents direct run per docs.
- **High**
  - Core Prompt requirements missing/partial: connector plugin breadth, hourly scheduling, full search filters/sorting UX, report lineage trace UX, file download token/hotlink controls, 2-year audit retention/export workflow, admin policy/location configuration depth.
  - Security controls incomplete vs Prompt: TLS not default, CSRF/XSS controls not evidenced, partial at-rest encryption only.
  - Test coverage is insufficient for major defect detection (API auth/IDOR/error-path gaps; frontend tests placeholder).
- **Medium**
  - Potential authorization/data-integrity gap in seat assignment (`appointment_id` scope/ownership validation missing).
  - Logging strategy inconsistent with “redact identifiers by default.”
- **Low**
  - UI aesthetics and interaction are functional but basic and minimally differentiated.

---

## 1. Hard Thresholds

### 1.1 Can the delivered product actually run and be verified?

#### 1.1.a Clear startup or execution instructions provided?
- **Conclusion**: **Partial**
- **Reason**: Instructions exist but point to non-existent folder (`cd fullstack`). Actual code is under `repo/`.
- **Evidence**:
  - `docs/README.md:11`
  - repository root listing shows `repo/`, not `fullstack`
- **Reproduction**:
  1. `cd /home/pirate/Documents/Projects/task2`
  2. Read `docs/README.md`
  3. Run `ls -la` and verify no `fullstack/`

#### 1.1.b Can it be started/run without modifying core code?
- **Conclusion**: **Partial**
- **Reason**: Backend can start only with reachable MySQL host (`mysql` default), typically via Docker compose or env override. In this environment, direct start fails DNS for `mysql`.
- **Evidence**:
  - Default DB host points to `mysql`: `repo/backend/src/config.js:13`
  - Startup failure from actual run: `getaddrinfo EAI_AGAIN mysql`
  - Backend startup depends on DB schema check before listen: `repo/backend/src/server.js:149-153`
- **Reproduction**:
  1. `cd /home/pirate/Documents/Projects/task2/repo/backend`
  2. `timeout 12s npm start`

#### 1.1.c Do actual running results match instructions?
- **Conclusion**: **Partial**
- **Reason**: Tests run successfully as documented, but frontend tests are placeholder only; backend runtime in non-Docker local context not directly runnable with default settings.
- **Evidence**:
  - Test entrypoint exists: `repo/run_tests.sh:6-16`
  - Frontend test placeholder: `repo/frontend/package.json:10`
  - Build works: `repo/frontend/package.json:8`
- **Reproduction**:
  1. `cd /home/pirate/Documents/Projects/task2/repo && ./run_tests.sh`
  2. `cd frontend && npm run build`

### 1.2 Prompt theme alignment

#### 1.2.a Centered around business goals/scenarios?
- **Conclusion**: **Pass**
- **Reason**: Roles, scheduling, search, ingestion, messaging, compliance, and audit modules map to the Prompt domain.
- **Evidence**:
  - Roles & auth routes: `repo/backend/src/routes/auth.js:107-174`
  - Coordinator scheduling: `repo/backend/src/routes/coordinator.js:17-55`
  - Ingestion routes: `repo/backend/src/routes/ingestion.js:13-103`
  - UI role modules: `repo/frontend/src/components/DashboardShell.vue:34-85`
- **Reproduction**:
  1. Inspect endpoints in `repo/backend/README.md:6-24`
  2. Inspect menus in `repo/frontend/src/components/DashboardShell.vue`

#### 1.2.b Core problem substituted/weakened/ignored?
- **Conclusion**: **Partial**
- **Reason**: Theme retained, but several required constraints are weakened (e.g., connector variety/plugin model depth, hourly incremental scheduling, security/compliance breadth).
- **Evidence**:
  - Only CSV parsing implemented in job processor: `repo/backend/src/services/ingestionService.js:229-299`
  - No scheduler loop/hourly trigger logic found in backend runtime path: `repo/backend/src/server.js:26-69,148-155`
- **Reproduction**:
  1. Search for ingestion runners and cron/scheduler logic in `repo/backend/src`

---

## 2. Delivery Completeness

### 2.1 Coverage of explicit core requirements

#### 2.1.a Role-based login/dashboard
- **Conclusion**: **Pass**
- **Reason**: Username/password login, bearer sessions, role-aware menu and summary dashboard implemented.
- **Evidence**:
  - Login/session creation: `repo/backend/src/routes/auth.js:12-87`
  - Dashboard summary: `repo/backend/src/routes/dashboard.js:8-59`
  - Role menu rendering: `repo/frontend/src/components/DashboardShell.vue:42-82`
- **Reproduction**:
  1. `cd repo && ./run_tests.sh` (sanity)
  2. Run stack with DB available and authenticate at UI

#### 2.1.b Coordinator ledger + seat maps + overbooking/resource constraints
- **Conclusion**: **Pass**
- **Reason**: Seat map CRUD, assignment, bay/inspector/equipment locking, heavy-duty bay routing, recalibration windows are implemented.
- **Evidence**:
  - Seat map endpoints: `repo/backend/src/routes/coordinator.js:69-129`
  - Lock constraints in schema: `repo/backend/init.sql:203-222`
  - Heavy-duty bay 3-6 and recalibration logic: `repo/backend/src/services/schedulingService.js:68-72,121-129`
- **Reproduction**:
  1. Invoke `POST /api/coordinator/appointments/schedule`
  2. Schedule concurrent same-slot resources to verify lock conflict

#### 2.1.c Auto-allocate earliest available bay/slot rules
- **Conclusion**: **Partial**
- **Reason**: Auto-selects available bay for requested slot, but no algorithm to shift to earliest future slot when requested slot is saturated.
- **Evidence**:
  - Slot is fixed from request: `repo/backend/src/services/schedulingService.js:141-143`
  - Resource selection only for that slot: `repo/backend/src/services/schedulingService.js:35-99`
- **Reproduction**:
  1. Request full slot capacity
  2. Re-submit same `scheduled_at`; observe failure, no nearest-slot fallback

#### 2.1.d Advanced search filters + pagination + sort + autocomplete + trending
- **Conclusion**: **Partial**
- **Reason**: Backend supports filters/pagination/sort/autocomplete/trending; frontend omits visible controls for some filters (model year, price band, sort controls) and does not surface trending keywords.
- **Evidence**:
  - Backend supports fields: `repo/backend/src/services/searchService.js:14-61,63-94,103-132`
  - Frontend filter controls omit model year/price/sort UI despite state fields: `repo/frontend/src/components/SearchCenter.vue:5-38,95-107`
  - No trending call in SearchCenter: `repo/frontend/src/components/SearchCenter.vue:125-163`
- **Reproduction**:
  1. Open Search page
  2. Verify no UI controls for `model_year`, `price_min`, `price_max`, sort toggles
  3. Verify no trending keywords section

#### 2.1.e Messaging center + offline SMS/email outbox
- **Conclusion**: **Pass**
- **Reason**: In-app messages persisted, optional channel payloads encrypted and queued for manual export.
- **Evidence**:
  - Message + outbox creation: `repo/backend/src/services/messagingService.js:4-33`
  - Manual export endpoint: `repo/backend/src/routes/messages.js:42-58`
- **Reproduction**:
  1. Send message with channel(s)
  2. Call `/api/messages/outbox/export`

#### 2.1.f Ingestion framework: priorities, dependencies, checkpoints, backfill, retries, resume
- **Conclusion**: **Partial**
- **Reason**: Implemented for CSV jobs with dependencies/priorities/checkpoints/retries/backfill cap; lacks broad plugin connectors (network shares/device exports as first-class connectors) and default hourly scheduler.
- **Evidence**:
  - Backfill cap/retries: `repo/backend/src/services/ingestionService.js:6-8,144-146,190-207`
  - Dependencies/priority pick: `repo/backend/src/services/ingestionService.js:168-188`
  - Checkpoint/resume: `repo/backend/src/services/ingestionService.js:218-240,271-275`
  - Route for one-shot execution only: `repo/backend/src/routes/ingestion.js:46-49`
- **Reproduction**:
  1. Enqueue job via `/api/ingestion/jobs`
  2. Process with `/api/ingestion/run-once`
  3. Verify no autonomous hourly scheduler in running server

#### 2.1.g ETL transforms + lineage + anomaly alerts (2% vs 14-run baseline)
- **Conclusion**: **Pass**
- **Reason**: Miles/km and USD normalization, dedupe, lineage in dataset version, and alerting based on deviation over 14-run baseline implemented.
- **Evidence**:
  - Normalization/dedupe: `repo/backend/src/services/ingestionService.js:28-42,63-95`
  - Lineage write: `repo/backend/src/services/ingestionService.js:248-265`
  - 14-run baseline and >2% alerts: `repo/backend/src/services/ingestionService.js:114-128,277-297`
- **Reproduction**:
  1. Seed 14+ dataset versions
  2. Run ingestion with shifted quality metrics

#### 2.1.h Security/compliance envelope
- **Conclusion**: **Partial**
- **Reason**: Strong pieces exist (RBAC, rate limits, password policy, audit events, file governance, retention/account closure), but several explicit Prompt requirements are absent or only placeholder-level.
- **Evidence**:
  - RBAC/rate limits/password policy: `repo/backend/src/middleware/rbac.js:3-75`, `repo/backend/src/middleware/rateLimit.js:36-57`, `repo/backend/src/routes/auth.js:130-135`
  - TLS default disabled: `repo/docker-compose.yml:39`, `repo/backend/src/config.js:28`
  - AES key marked placeholder: `repo/backend/src/config.js:33-35`, `repo/backend/src/routes/security.js:18-20`
  - No file download/hotlink route found in backend routes list
- **Reproduction**:
  1. Inspect `/api/security/config`
  2. Inspect backend routes under `repo/backend/src/routes`

### 2.2 0-to-1 project form

#### 2.2.a Complete project structure and docs
- **Conclusion**: **Pass**
- **Reason**: Full backend/frontend/tests/docs provided.
- **Evidence**:
  - Tree includes `repo/backend`, `repo/frontend`, `repo/unit_tests`, `repo/API_tests`, docs.
- **Reproduction**:
  1. `cd /home/pirate/Documents/Projects/task2 && rg --files`

#### 2.2.b Excessive mocks/hardcoding replacing real logic?
- **Conclusion**: **Partial**
- **Reason**: Core backend is real, but frontend tests are placeholder and some security settings are placeholders.
- **Evidence**:
  - Frontend test placeholder: `repo/frontend/package.json:10`
  - Placeholder AES key default: `repo/backend/src/config.js:34`
- **Reproduction**:
  1. `cd repo/frontend && npm test`

---

## 3. Engineering & Architecture Quality

### 3.1 Structure/modularity

#### 3.1.a Clear module responsibilities?
- **Conclusion**: **Pass**
- **Reason**: Good separation among routes/services/middleware/utils.
- **Evidence**:
  - Server composition: `repo/backend/src/server.js:11-24,56-69`
- **Reproduction**:
  1. Inspect imports and route mounting in server entry

#### 3.1.b Redundant/unnecessary files?
- **Conclusion**: **Partial**
- **Reason**: Duplicate SQL init files with same content can drift (`backend/init.sql` and `backend/db/init.sql`).
- **Evidence**:
  - Both files exist and mirror schema content
- **Reproduction**:
  1. Compare both SQL files

#### 3.1.c Single-file overstacking?
- **Conclusion**: **Pass**
- **Reason**: No monolith file dominating logic; size is moderate and feature-sliced.
- **Evidence**:
  - Distinct files per domain under `routes/` and `services/`
- **Reproduction**:
  1. Inspect `repo/backend/src`

### 3.2 Maintainability/scalability awareness

#### 3.2.a Hardcoded / high coupling concerns?
- **Conclusion**: **Partial**
- **Reason**: Reasonable patterns overall, but ingestion connectors are not pluggable in code shape; only CSV processor path exists.
- **Evidence**:
  - Single `processCsvJob` pipeline: `repo/backend/src/services/ingestionService.js:229-299`
- **Reproduction**:
  1. Search ingestion service for non-CSV processor branches

#### 3.2.b Expandability in core logic?
- **Conclusion**: **Pass**
- **Reason**: Services and schema permit extension (dependencies, checkpoints, alerts, scope fields).
- **Evidence**:
  - Ingestion dependency/checkpoint tables: `repo/backend/init.sql:258-303`
- **Reproduction**:
  1. Review schema sections for extensibility hooks

---

## 4. Engineering Details & Professionalism

### 4.1 Error handling/logging/validation/API design

#### 4.1.a Error handling reliability
- **Conclusion**: **Partial**
- **Reason**: Global try/catch exists but many domain errors throw generic 500; not always mapped to business status codes.
- **Evidence**:
  - Global error wrapper: `repo/backend/src/server.js:28-40`
  - `scheduleAppointment` throws generic `Error`; route doesn’t remap to 409/422 consistently: `repo/backend/src/services/schedulingService.js:146-153`, `repo/backend/src/routes/coordinator.js:27-54`
- **Reproduction**:
  1. Trigger unavailable slot and inspect HTTP response body/status

#### 4.1.b Logging quality and redaction defaults
- **Conclusion**: **Partial**
- **Reason**: `safeLog` redacts, but global and auth error logs use raw `console.error`, potentially leaking identifiers.
- **Evidence**:
  - Redacted logger exists: `repo/backend/src/utils/redaction.js:33-35`
  - Raw request/error logging: `repo/backend/src/server.js:32-37`
  - Raw auth error logging includes username: `repo/backend/src/routes/auth.js:41-44`
- **Reproduction**:
  1. Force auth or runtime error; inspect backend logs

#### 4.1.c Critical input/boundary validation
- **Conclusion**: **Partial**
- **Reason**: Many validations exist, but missing strict validation in some object references.
- **Evidence**:
  - Good validation examples: `repo/backend/src/routes/auth.js:124-136`, `repo/backend/src/routes/inspections.js:33-79`
  - Seat assignment accepts arbitrary `appointment_id` without ownership/scope verification: `repo/backend/src/routes/coordinator.js:120-125`, `repo/backend/src/services/schedulingService.js:241-247`
- **Reproduction**:
  1. Call `/api/coordinator/waiting-room/assign-seat` with seat in scope and unrelated appointment id

### 4.2 Real product vs demo
- **Conclusion**: **Partial**
- **Reason**: Backend depth is product-like, but tests and several compliance/security features remain demo-level/placeholder.
- **Evidence**:
  - Placeholder frontend tests: `repo/frontend/package.json:10`
  - Security config note explicitly says placeholder: `repo/backend/src/config.js:33-35`
- **Reproduction**:
  1. `cd repo/frontend && npm test`

---

## 5. Requirement Understanding & Adaptation

### 5.1 Business goals and implicit constraints fidelity

#### 5.1.a Core business goals achieved?
- **Conclusion**: **Partial**
- **Reason**: Major workflows exist, but not fully complete for all explicit constraints.
- **Evidence**:
  - Implemented core workflows across routes and UI modules (auth/scheduling/search/ingestion/messages)
- **Reproduction**:
  1. Traverse main UI menu items by role and verify endpoint coupling

#### 5.1.b Requirement misunderstandings/semantic misses?
- **Conclusion**: **Fail**
- **Reason**: Explicit requirements partially missed: hourly incremental run default, connector breadth/plugin framing, hotlink-protected downloads, 2-year audit retention export workflow, full search UX controls/trending surfacing.
- **Evidence**:
  - No scheduler loop: `repo/backend/src/server.js:148-155`
  - CSV-only processing: `repo/backend/src/services/ingestionService.js:229-299`
  - No download route under `repo/backend/src/routes`
  - Search UI missing controls/trending section: `repo/frontend/src/components/SearchCenter.vue:5-40,125-163`
- **Reproduction**:
  1. Inspect corresponding files and run feature smoke tests

---

## 6. Aesthetics (Frontend)

### 6.1 Visual/interaction suitability

#### 6.1.a Functional area distinction / consistency / feedback
- **Conclusion**: **Pass**
- **Reason**: Layout is consistent and readable; hover/click feedback from buttons/forms present by default styles and state messages.
- **Evidence**:
  - Layout shell and section cards: `repo/frontend/src/App.vue:13-80`, `repo/frontend/src/components/DashboardShell.vue:2-21`
  - Error/notice feedback patterns in major components (e.g., `SearchCenter.vue:42`, `CoordinatorDashboard.vue:5-7`)
- **Reproduction**:
  1. Run frontend and navigate views

#### 6.1.b Aesthetic polish
- **Conclusion**: **Partial**
- **Reason**: Clean but basic system-like styling; no distinctive visual system beyond utility defaults.
- **Evidence**:
  - Empty custom stylesheet: `repo/frontend/src/styles.css:1`
- **Reproduction**:
  1. Inspect CSS sources and rendered UI theme depth

---

## Testing Coverage Evaluation (Static Audit)

### Overview
- Framework/entry:
  - Node test runner via backend script: `repo/backend/package.json:10`
  - Combined executor: `repo/run_tests.sh:6-16`
- Frontend tests:
  - Placeholder only: `repo/frontend/package.json:10`

### Coverage Mapping Table
| Requirement / Risk | Test Case | Assertion Evidence | Coverage Status |
|---|---|---|---|
| 30-min slot boundary | `unit_tests/scheduling.test.js` | boundary accept/reject assertions `:5-12` | Basic |
| Heavy-duty detection helper | `unit_tests/scheduling.test.js`, `API_tests/messaging_and_retention.test.js` | `:14-17`, `:6-10` | Basic |
| Bay metadata extraction | `unit_tests/scheduling.test.js` | `:19-21` | Basic |
| Miles/km + FX normalization | `unit_tests/normalization.test.js`, `API_tests/search_and_security.test.js` | `:5-12`, `:23-26` | Basic |
| Deterministic key + dedupe helper | `unit_tests/normalization.test.js`, `API_tests/messaging_and_retention.test.js` | `:14-46`, `:12-25` | Basic |
| Redaction utility | `API_tests/search_and_security.test.js` | `:7-14` | Basic |
| Encryption round-trip | `API_tests/search_and_security.test.js` | `:16-21` | Basic |
| Auth 401/403 paths | No API integration tests for routes | N/A | Missing |
| IDOR/object ownership checks | No tests on cross-user/resource access | N/A | Missing |
| 404/409 behavior on APIs | No route-level integration tests | N/A | Missing |
| Pagination boundaries | No tests for page min/max or total pages | N/A | Missing |
| Concurrency/transaction integrity | No simultaneous scheduling lock tests | N/A | Missing |
| Frontend behavior | Placeholder command only | `frontend/package.json:10` | Missing |

### Security Coverage Audit (Auth, IDOR, Data Isolation)
- **Auth tests**: Missing route-level authentication/authorization tests.
- **IDOR tests**: Missing object ownership/scope tests (appointments, messages, files, seats).
- **Data isolation tests**: Missing tenant/scope cross-access tests for non-admin roles.
- **Evidence**:
  - Only utility-level tests in all test files: `repo/unit_tests/*.test.js`, `repo/API_tests/*.test.js`

### Overall Testing Sufficiency Judgment
- **Conclusion**: **Fail**
- **Reason**: Current tests can detect utility regressions, but cannot reliably detect major defects in API security, authorization, data isolation, and real workflow behavior.

---

## Security & Logs Focus Chapter

### Key Findings
1. **Route-level authorization generally present** (Pass)
- `authRequired` + `requireRoles` + `enforceScope` are widely applied.
- Evidence: `repo/backend/src/routes/*.js` (e.g., `coordinator.js:17-22`, `inspections.js:9,31,128`).

2. **IDOR / object-level risk in seat assignment** (Medium)
- `appointment_id` applied directly to seat row without validating appointment ownership/scope/existence.
- Evidence: `repo/backend/src/routes/coordinator.js:120-125`, `repo/backend/src/services/schedulingService.js:241-247`.
- Repro: assign seat using unrelated appointment id while authenticated coordinator in same location scope.

3. **Audit immutability implemented at DB trigger level** (Pass)
- Update/delete blocked on `audit_events`.
- Evidence: `repo/backend/init.sql:446-462`.

4. **Prompt-level security requirements only partially met** (High)
- TLS disabled by default deployment config.
- AES-256 key and at-rest model partly placeholder.
- No evidenced CSRF-specific control layer.
- No file download token/hotlink protection route.
- Evidence: `repo/docker-compose.yml:39`, `repo/backend/src/config.js:33-35`, route inventory under `repo/backend/src/routes`.

5. **Log redaction not default across all paths** (Medium)
- `safeLog` exists but raw `console.error` used for request/auth errors.
- Evidence: `repo/backend/src/utils/redaction.js:33-35`, `repo/backend/src/server.js:32-37`, `repo/backend/src/routes/auth.js:41-44`.

---

## Final Acceptance Judgment
- **Hard Threshold Verdict**: **Partial Pass** (with Blocker-level documentation/runtime path defect)
- **Overall Delivery Verdict**: **Partial**
- **Primary reason**: Good foundational architecture and core modules, but multiple explicit Prompt constraints remain incomplete, and testing/security verification depth is below acceptance-grade for a production audit.

## Currently Confirmed vs Unconfirmed Boundaries
- **Confirmed (runtime or static evidence)**:
  - Backend unit/API utility tests pass (`./run_tests.sh`), frontend builds, modular backend routes/services exist.
- **Unconfirmed due environment limits / no Docker execution**:
  - Full end-to-end runtime behavior with MySQL + frontend + backend integration under documented one-click deployment.
- **Environment Limits (not counted as product defect)**:
  - Docker startup was not executed per audit rule; backend direct start failed due missing reachable `mysql` host in this environment.

## Local Reproduction Command Set
1. `cd /home/pirate/Documents/Projects/task2/repo && ./run_tests.sh`
2. `cd /home/pirate/Documents/Projects/task2/repo/frontend && npm run build`
3. `cd /home/pirate/Documents/Projects/task2/repo/backend && timeout 12s npm start`
4. (If allowed in your own environment) start MySQL + app stack and validate API/UI workflows end-to-end.
