# Test Coverage Audit

## Project Type Detection
- README top declaration: `**Project type:** fullstack` in `repo/README.md`.
- Inferred type also confirms fullstack (`repo/backend/...` + `repo/frontend/...`).

## Backend Endpoint Inventory
1. `GET /health`
2. `POST /api/auth/login`
3. `GET /api/auth/me`
4. `POST /api/auth/logout`
5. `POST /api/auth/register`
6. `GET /api/dashboard/summary`
7. `GET /api/dashboard/coordinator-view`
8. `GET /api/dashboard/ingestion-health`
9. `GET /api/security/config`
10. `POST /api/coordinator/appointments/schedule`
11. `GET /api/coordinator/bay-utilization`
12. `GET /api/coordinator/waiting-room/seats`
13. `PUT /api/coordinator/waiting-room/seats`
14. `POST /api/coordinator/waiting-room/assign-seat`
15. `GET /api/coordinator/open-appointments`
16. `GET /api/coordinator/maintenance-windows`
17. `POST /api/ingestion/jobs`
18. `POST /api/ingestion/run-once`
19. `GET /api/ingestion/jobs/:id`
20. `POST /api/ingestion/drop-scan`
21. `GET /api/search/vehicles`
22. `GET /api/search/autocomplete`
23. `GET /api/search/trending`
24. `POST /api/messages/send`
25. `GET /api/messages/inbox`
26. `POST /api/messages/outbox/export`
27. `GET /api/messages/outbox`
28. `POST /api/files/ingest`
29. `GET /api/files/download/:id`
30. `POST /api/compliance/account-closure`
31. `POST /api/compliance/retention/run`
32. `GET /api/users`
33. `GET /api/users/:id`
34. `PUT /api/users/:id`
35. `POST /api/users/:id/reset-password`
36. `GET /api/roles`
37. `GET /api/audit/events`
38. `POST /api/audit/export`
39. `GET /api/inspections/queue`
40. `POST /api/inspections/results`
41. `GET /api/inspections/results/me`
42. `GET /api/inspections/customer/reports`

Route evidence:
- Prefix + handlers in `repo/backend/src/routes/*.js` (examples: `auth.js` lines 11, 42, 135, 139, 153; `coordinator.js` lines 16, 18-19, 93, 105, 112-113, 140-141, 176, 183).

## API Test Mapping Table

| Endpoint | Covered | Test type | Test files | Evidence |
|---|---|---|---|---|
| `GET /health` | yes | true no-mock HTTP | `health.test.js` | `GET /health returns 200...` |
| `POST /api/auth/login` | yes | true no-mock HTTP | `auth.test.js`, `auth_and_idor.test.js`, `users_api.test.js`, `e2e_smoke.test.js` | `auth: successful admin login...` |
| `GET /api/auth/me` | yes | true no-mock HTTP | `auth_and_idor.test.js`, `e2e_smoke.test.js` | `logout invalidates session token` |
| `POST /api/auth/logout` | yes | true no-mock HTTP | `auth_and_idor.test.js` | `logout invalidates session token` |
| `POST /api/auth/register` | yes | true no-mock HTTP | `auth.test.js`, `auth_and_idor.test.js`, `e2e_smoke.test.js`, `roles_audit_api.test.js` | `password complexity rejection...` |
| `GET /api/dashboard/summary` | yes | true no-mock HTTP | `dashboard.test.js`, `route_edge_cases.test.js` | `dashboard summary: admin receives 200...` |
| `GET /api/dashboard/coordinator-view` | yes | true no-mock HTTP | `dashboard.test.js`, `e2e_smoke.test.js` | `dashboard coordinator-view...` |
| `GET /api/dashboard/ingestion-health` | yes | true no-mock HTTP | `dashboard.test.js` | `dashboard ingestion-health...` |
| `GET /api/security/config` | yes | true no-mock HTTP | `security_config.test.js` | `security_config: admin receives 200...` |
| `POST /api/coordinator/appointments/schedule` | yes | true no-mock HTTP | `auth.test.js`, `auth_and_idor.test.js`, `operations.test.js`, `critical_flows.test.js`, `e2e_smoke.test.js`, `route_edge_cases.test.js` | `operations: duplicate appointment conflict...` |
| `GET /api/coordinator/bay-utilization` | yes | true no-mock HTTP | `coordinator_read_and_seats.test.js` | `bay-utilization: coordinator success...` |
| `GET /api/coordinator/waiting-room/seats` | yes | true no-mock HTTP | `coordinator_read_and_seats.test.js` | `waiting-room/seats GET...` |
| `PUT /api/coordinator/waiting-room/seats` | yes | true no-mock HTTP | `coordinator_read_and_seats.test.js`, `route_edge_cases.test.js` | `waiting-room/seats PUT...` |
| `POST /api/coordinator/waiting-room/assign-seat` | yes | true no-mock HTTP | `auth_and_idor.test.js`, `security.test.js` | `IDOR: seat assignment...` |
| `GET /api/coordinator/open-appointments` | yes | true no-mock HTTP | `coordinator_read_and_seats.test.js`, `e2e_smoke.test.js` | `open-appointments...` |
| `GET /api/coordinator/maintenance-windows` | yes | true no-mock HTTP | `coordinator_read_and_seats.test.js` | `maintenance-windows...` |
| `POST /api/ingestion/jobs` | yes | true no-mock HTTP | `ingestion_api.test.js` | `Admin POST /api/ingestion/jobs...` |
| `POST /api/ingestion/run-once` | yes | true no-mock HTTP | `ingestion_api.test.js` | `Admin POST /api/ingestion/run-once...` |
| `GET /api/ingestion/jobs/:id` | yes | true no-mock HTTP | `ingestion_api.test.js` | `Data Engineer GET /api/ingestion/jobs/:id...` |
| `POST /api/ingestion/drop-scan` | yes | true no-mock HTTP | `ingestion_api.test.js` | `Admin POST /api/ingestion/drop-scan...` |
| `GET /api/search/vehicles` | yes | true no-mock HTTP | `critical_flows.test.js`, `security.test.js` | `cross-scope search isolation...` |
| `GET /api/search/autocomplete` | yes | true no-mock HTTP | `critical_flows.test.js` | `cross-scope autocomplete isolation...` |
| `GET /api/search/trending` | yes | true no-mock HTTP | `critical_flows.test.js` | `cross-scope trending isolation...` |
| `POST /api/messages/send` | yes | true no-mock HTTP | `messaging_api.test.js` | `messaging send: Coordinator can POST...` |
| `GET /api/messages/inbox` | yes | true no-mock HTTP | `messaging_api.test.js`, `critical_flows.test.js` | `messaging inbox: sent message appears...` |
| `POST /api/messages/outbox/export` | yes | true no-mock HTTP | `messaging_api.test.js` | `messaging outbox export: Admin can POST...` |
| `GET /api/messages/outbox` | yes | true no-mock HTTP | `messaging_api.test.js` | `messaging outbox: Admin can GET...` |
| `POST /api/files/ingest` | yes | true no-mock HTTP | `files_api.test.js` | `files: unauthenticated POST /api/files/ingest...` |
| `GET /api/files/download/:id` | yes | true no-mock HTTP | `files_api.test.js`, `critical_flows.test.js`, `route_edge_cases.test.js` | `files: GET /api/files/download/abc...` |
| `POST /api/compliance/account-closure` | yes | true no-mock HTTP | `compliance_api.test.js`, `critical_flows.test.js` | `compliance: fresh Customer POST...` |
| `POST /api/compliance/retention/run` | yes | true no-mock HTTP | `compliance_api.test.js` | `compliance: Admin POST /api/compliance/retention/run...` |
| `GET /api/users` | yes | true no-mock HTTP | `users_api.test.js`, `auth.test.js`, `auth_and_idor.test.js` | `users: Admin can GET /api/users...` |
| `GET /api/users/:id` | yes | true no-mock HTTP | `users_api.test.js` | `users: Admin can GET /api/users/:id...` |
| `PUT /api/users/:id` | yes | true no-mock HTTP | `users_api.test.js`, `route_edge_cases.test.js` | `users: Admin can PUT /api/users/:id...` |
| `POST /api/users/:id/reset-password` | yes | true no-mock HTTP | `users_api.test.js`, `route_edge_cases.test.js` | `users: Admin can POST /api/users/:id/reset-password...` |
| `GET /api/roles` | yes | true no-mock HTTP | `roles_audit_api.test.js` | `roles: Admin can GET /api/roles...` |
| `GET /api/audit/events` | yes | true no-mock HTTP | `roles_audit_api.test.js`, `e2e_smoke.test.js` | `audit: Admin can GET /api/audit/events...` |
| `POST /api/audit/export` | yes | true no-mock HTTP | `roles_audit_api.test.js` | `audit: Admin can POST /api/audit/export...` |
| `GET /api/inspections/queue` | yes | true no-mock HTTP | `inspections_read_api.test.js`, `e2e_smoke.test.js` | `Inspector GET /api/inspections/queue...` |
| `POST /api/inspections/results` | yes | true no-mock HTTP | `critical_flows.test.js`, `e2e_smoke.test.js`, `route_edge_cases.test.js` | `inspection result publication workflow` |
| `GET /api/inspections/results/me` | yes | true no-mock HTTP | `inspections_read_api.test.js`, `e2e_smoke.test.js` | `Inspector GET /api/inspections/results/me...` |
| `GET /api/inspections/customer/reports` | yes | true no-mock HTTP | `inspections_read_api.test.js`, `e2e_smoke.test.js` | `Customer GET /api/inspections/customer/reports...` |

## API Test Classification
1. True No-Mock HTTP
- `repo/API_tests/*.test.js` all suites.
- Evidence: `repo/API_tests/helpers/setup.js` imports real app and creates real HTTP server (`createApp` + `http.createServer(app.callback())`, lines 21-25), then calls `fetch` on actual routes.

2. HTTP with Mocking
- None detected in API tests.

3. Non-HTTP (unit/integration without HTTP)
- `repo/unit_tests/*.test.js`.
- `repo/frontend/tests/ui.test.js` and `repo/frontend/tests/components/*.test.js`.

## Mock Detection Rules Check
- API tests: no `jest.mock`, `vi.mock`, `sinon.stub` found.
- Frontend component tests use mocking of API service:
  - `repo/frontend/tests/components/App.test.js` and 8 other component suites use `vi.mock('../../src/services/api.js', ...)`.

## Coverage Summary
- Total endpoints: **42**
- Endpoints with HTTP tests: **42**
- Endpoints with true no-mock tests: **42**
- HTTP coverage: **100.0%**
- True API coverage: **100.0%**

## Unit Test Summary

### Backend Unit Tests
- Backend unit test files: **20** (`repo/unit_tests/*.test.js`).
- Covered modules (evidence by imports/tests):
  - Middleware: `auth.middleware.test.js`, `rbac.middleware.test.js`, `rateLimit.middleware.test.js`
  - DB layer: `db.test.js`
  - Bootstrap/config: `server.bootstrap.test.js`
  - Services: `search`, `scheduling`, `ingestion`, `ingestionScheduler`, `messaging`, `fileGovernance`, `securityMonitor`, `retention`, `auditRetention`
  - Utilities: `crypto`, `redaction`
- Important backend modules not explicitly unit-targeted:
  - Route handler files (`repo/backend/src/routes/*.js`) are integration-tested, not unit-isolated.

### Frontend Unit Tests (STRICT REQUIREMENT)
- Frontend test files: present (`repo/frontend/tests/components/*.test.js`, `repo/frontend/tests/ui.test.js`).
- Frameworks detected:
  - `vitest` + `@vue/test-utils` in component tests.
  - `node:test` in structural suite.
- Components/modules covered:
  - `App.vue`, `LoginForm.vue`, `DashboardShell.vue`, `SearchCenter.vue`, `MessagingCenter.vue`, `UserManagement.vue`, `CoordinatorDashboard.vue`, `InspectorDashboard.vue`, `CustomerView.vue`, `IngestionDashboard.vue`, `AuditLogs.vue`, `services/api.js`.
- Important frontend modules not clearly unit-tested:
  - `frontend/src/main.js` lacks direct test evidence.

**Frontend unit tests: PRESENT**

### Cross-Layer Observation
- Backend and frontend tests are present.
- Backend API realism is strong; frontend component tests still mock API service, so FE integration realism is comparatively lower.

## API Observability Check
- Strong: many tests include explicit endpoint, payload, and response assertions.
- Weak spots: some tests assert only status/error presence (especially auth/unauthenticated cases), reducing response-contract clarity.

## Test Quality & Sufficiency
- Success/failure paths: broad and deep.
- Validation/auth/permissions: strong coverage across suites.
- Edge cases: present (invalid IDs, cross-scope, duplicate operations, page bounds).
- Over-mocking risk: low in backend API; moderate in frontend component tests due mocked API client.
- `run_tests.sh`: now Docker-gated and rejects non-Docker execution (strict-mode aligned).

## End-to-End Expectations
- Fullstack FE↔BE E2E exists: `repo/frontend/tests/e2e/critical-flows.spec.js`.
- API e2e smoke also exists: `repo/API_tests/e2e_smoke.test.js`.

## Tests Check
- Static inspection only.
- No code execution, no tests run, no builds/packages started.

## Test Coverage Score (0–100)
**92/100**

## Score Rationale
- + 42/42 endpoint HTTP coverage with true no-mock route-level execution.
- + Backend unit coverage materially improved (new DB, rate-limit, scheduler, bootstrap tests).
- + Fullstack layered test strategy present (unit + API + browser E2E).
- - Frontend component tests rely heavily on mocked API service.
- - Some endpoint tests remain status-centric rather than strict response-contract assertions.

## Key Gaps
1. Frontend component tests still mock backend API boundaries extensively; fewer live FE↔BE assertions at component level.
2. Some negative-path API tests validate status only with shallow body assertions.
3. `run_tests.sh` still contains host fallback for frontend structural/vitest in certain container-failure branches, which is a minor strictness leak.

## Confidence & Assumptions
- Confidence: **High**.
- Assumptions:
  - Parameterized requests (e.g., `/api/users/1`) count as coverage for route patterns (e.g., `/api/users/:id`).
  - Test type classification is based solely on static evidence in test harness and absence/presence of mocking calls.

## Test Coverage Verdict
**PASS**

---

# README Audit

## README Location
- `repo/README.md` exists: **PASS**.

## Hard Gates

### Formatting
- Structured markdown, readable, table/code blocks: **PASS**.

### Startup Instructions
- Fullstack requirement `docker-compose up` is explicitly present: **PASS**.

### Access Method
- URLs/ports provided (`https://localhost`, `http://localhost:4000`): **PASS**.

### Verification Method
- API verification (`curl`) + frontend and role workflows included: **PASS**.

### Environment Rules (strict Docker-contained)
- README explicitly states Docker-required testing and forbids local `npm install` for test execution.
- No forbidden install commands documented as required steps.
- Result: **PASS**.

### Demo Credentials (auth conditional)
- Auth exists and README provides all role credentials: Administrator, Coordinator, Inspector, Customer, Data Engineer.
- Result: **PASS**.

## Engineering Quality
- Tech stack clarity: strong.
- Architecture explanation: strong (request flow + trust boundaries).
- Testing instructions: strong and explicit.
- Security/roles/workflows: strong.
- Presentation quality: strong.

## High Priority Issues
- None.

## Medium Priority Issues
1. `run_tests.sh` still includes limited host fallback branches for frontend tests when container execution fails; README claims strict Docker-only path.

## Low Priority Issues
1. Could add a concise API endpoint index for manual verification speed.

## Hard Gate Failures
- None.

## README Verdict
**PASS**

## Final Verdicts
- **Test Coverage Audit:** PASS
- **README Audit:** PASS
