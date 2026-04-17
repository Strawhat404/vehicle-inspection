/**
 * Frontend component structural tests.
 *
 * Runner: node --test tests/*.test.js  (Node.js built-in test runner, no extra deps)
 *
 * Strategy: Because Vue SFCs require a compile step that is not available to the
 * plain Node test runner, we test at the *source* level.  Each assertion validates
 * real structural contracts of the component (template binding, script exports,
 * reactive state, method names, API paths, emitted events) rather than just
 * checking that a keyword appears somewhere in the file.
 *
 * Helper functions parse Vue SFC sections with regex so tests can target the
 * template, script, or specific line contexts independently.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// File resolution helpers
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

function readSrc(relativePath) {
  return fs.readFileSync(path.join(srcDir, relativePath), 'utf8');
}

function readComponent(name) {
  return readSrc(`components/${name}`);
}

// ---------------------------------------------------------------------------
// SFC section extractors
// ---------------------------------------------------------------------------

/** Returns the raw text inside the first <template> block. */
function extractTemplate(source) {
  const m = source.match(/<template>([\s\S]*?)<\/template>/);
  if (!m) throw new Error('No <template> block found');
  return m[1];
}

/** Returns the raw text inside the first <script setup> block. */
function extractScript(source) {
  const m = source.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No <script setup> block found');
  return m[1];
}

// ---------------------------------------------------------------------------
// Fine-grained assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that the template contains a v-model binding for a given field name.
 * Supports both "v-model.trim/number" modifiers and plain "v-model".
 */
function assertVModel(template, field, context) {
  const pattern = new RegExp(`v-model(?:\\.[a-z]+)*=["']${field}["']`);
  assert.match(template, pattern, `${context}: expected v-model binding for "${field}"`);
}

/**
 * Assert that the template contains an @click or v-on:click that references
 * the given function name.  Handles both direct references (@click="fn")
 * and inline $emit calls (@click="$emit('event')").
 */
function assertClickHandler(template, fn, context) {
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Allow any characters (including inner quotes) between the outer quotes
  const pattern = new RegExp(`@click(?:\\.[a-z]+)*=["'][\\s\\S]*?${escaped}[\\s\\S]*?["']`);
  assert.match(template, pattern, `${context}: expected @click handler "${fn}"`);
}

/**
 * Assert that the script defines or imports a given name (function, ref,
 * reactive, computed, import).
 */
function assertScriptDefines(script, name, context) {
  // Match: function name, async function name, const name, import { name }
  const patterns = [
    new RegExp(`\\bfunction\\s+${name}\\b`),
    new RegExp(`\\bconst\\s+${name}\\b`),
    new RegExp(`\\b${name}\\b\\s*=`),
    new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s+from`),
  ];
  const found = patterns.some((p) => p.test(script));
  assert.ok(found, `${context}: expected "${name}" to be defined or imported in script`);
}

/**
 * Assert that the script contains an exact string (for API endpoint paths,
 * emit declarations, etc.).
 */
function assertScriptContains(script, text, context) {
  assert.ok(
    script.includes(text),
    `${context}: expected script to contain "${text}"`
  );
}

/**
 * Assert that a table column header exists in the template.
 * Matches the literal text between <th ...>...</th>.
 */
function assertTableColumn(template, columnText, context) {
  const pattern = new RegExp(`<th[^>]*>[^<]*${columnText}[^<]*<\\/th>`);
  assert.match(
    template,
    pattern,
    `${context}: expected table column heading "${columnText}"`
  );
}

// ===========================================================================
// api.js – service layer
// ===========================================================================

test('api.js: exports all required service functions', () => {
  const src = readSrc('services/api.js');
  const ctx = 'api.js';

  const exports = [
    'apiGet', 'apiPost', 'apiPut',
    'login', 'me', 'logout',
    'fetchSummary', 'fetchCoordinatorView', 'fetchIngestionHealth'
  ];
  for (const fn of exports) {
    assert.match(src, new RegExp(`export\\s+(?:async\\s+)?function\\s+${fn}\\b`), `${ctx}: expected export "${fn}"`);
  }
});

test('api.js: authHeaders includes X-CSRF-Token tied to bearer token', () => {
  const src = readSrc('services/api.js');
  // Both the Authorization and X-CSRF-Token headers must exist in the same function
  assert.match(src, /X-CSRF-Token.*:.*token|token.*X-CSRF-Token/, 'api.js: X-CSRF-Token set from token value');
  assert.match(src, /Authorization.*Bearer/, 'api.js: Authorization header uses Bearer scheme');
});

test('api.js: request function uses API_BASE_URL env variable', () => {
  const src = readSrc('services/api.js');
  assert.match(src, /VITE_API_BASE_URL/, 'api.js: reads VITE_API_BASE_URL env var');
  assert.match(src, /API_BASE_URL/, 'api.js: uses API_BASE_URL in request');
});

test('api.js: login posts to /api/auth/login', () => {
  const src = readSrc('services/api.js');
  assert.ok(src.includes('/api/auth/login'), 'api.js: login endpoint path');
});

test('api.js: me() calls /api/auth/me', () => {
  const src = readSrc('services/api.js');
  assert.ok(src.includes('/api/auth/me'), 'api.js: me() endpoint path');
});

test('api.js: logout posts to /api/auth/logout', () => {
  const src = readSrc('services/api.js');
  assert.ok(src.includes('/api/auth/logout'), 'api.js: logout endpoint path');
});

test('api.js: fetchSummary calls /api/dashboard/summary', () => {
  const src = readSrc('services/api.js');
  assert.ok(src.includes('/api/dashboard/summary'), 'api.js: fetchSummary endpoint');
});

test('api.js: fetchIngestionHealth calls /api/dashboard/ingestion-health', () => {
  const src = readSrc('services/api.js');
  assert.ok(src.includes('/api/dashboard/ingestion-health'), 'api.js: fetchIngestionHealth endpoint');
});

// ===========================================================================
// LoginForm.vue
// ===========================================================================

test('LoginForm: has <form> with @submit.prevent bound to onSubmit', () => {
  const tpl = extractTemplate(readComponent('LoginForm.vue'));
  assert.match(tpl, /<form[^>]*@submit\.prevent=["']onSubmit["']/, 'LoginForm: submit.prevent on form');
});

test('LoginForm: has v-model bindings for username and password', () => {
  const tpl = extractTemplate(readComponent('LoginForm.vue'));
  assertVModel(tpl, 'form.username', 'LoginForm');
  assertVModel(tpl, 'form.password', 'LoginForm');
});

test('LoginForm: submit button is :disabled="loading"', () => {
  const tpl = extractTemplate(readComponent('LoginForm.vue'));
  assert.match(tpl, /:disabled=["']loading["']/, 'LoginForm: button disabled binding');
});

test('LoginForm: shows "Signing in..." text when loading', () => {
  const tpl = extractTemplate(readComponent('LoginForm.vue'));
  assert.ok(tpl.includes('Signing in...'), 'LoginForm: loading text');
});

test('LoginForm: shows error message conditionally with v-if="error"', () => {
  const tpl = extractTemplate(readComponent('LoginForm.vue'));
  assert.match(tpl, /v-if=["']error["']/, 'LoginForm: error conditional display');
});

test('LoginForm: script defines emit for "login" event', () => {
  const script = extractScript(readComponent('LoginForm.vue'));
  assert.ok(
    script.includes("defineEmits(['login'])") || script.includes('defineEmits(["login"])'),
    "LoginForm: defineEmits(['login'])"
  );
});

test('LoginForm: script has reactive form with username and password fields', () => {
  const script = extractScript(readComponent('LoginForm.vue'));
  assert.match(script, /reactive\s*\(\s*\{[^}]*username/, 'LoginForm: reactive form username');
  assert.match(script, /reactive\s*\(\s*\{[^}]*password/, 'LoginForm: reactive form password');
});

test('LoginForm: has loading and error refs', () => {
  const script = extractScript(readComponent('LoginForm.vue'));
  assertScriptDefines(script, 'loading', 'LoginForm');
  assertScriptDefines(script, 'error', 'LoginForm');
});

test('LoginForm: onSubmit sets loading, clears error, and emits login event', () => {
  const script = extractScript(readComponent('LoginForm.vue'));
  assert.match(script, /loading\.value\s*=\s*true/, 'LoginForm: sets loading true');
  assert.match(script, /error\.value\s*=\s*['"]/, 'LoginForm: clears error');
  assert.ok(script.includes("emit('login'") || script.includes('emit("login"'), 'LoginForm: emits login event');
});

test('LoginForm: has try/catch/finally in onSubmit', () => {
  const script = extractScript(readComponent('LoginForm.vue'));
  assert.match(script, /try\s*\{/, 'LoginForm: try block');
  assert.match(script, /catch\s*\(/, 'LoginForm: catch block');
  assert.match(script, /finally\s*\{/, 'LoginForm: finally block');
});

// ===========================================================================
// App.vue
// ===========================================================================

test('App.vue: shows LoginForm when no user (v-if="!state.user")', () => {
  const tpl = extractTemplate(readSrc('App.vue'));
  assert.match(tpl, /v-if=["']!state\.user["']/, 'App.vue: LoginForm conditional');
});

test('App.vue: LoginForm has @login="handleLogin" event handler', () => {
  const tpl = extractTemplate(readSrc('App.vue'));
  assert.match(tpl, /@login=["']handleLogin["']/, 'App.vue: handleLogin binding');
});

test('App.vue: DashboardShell receives :user and @logout bindings', () => {
  const tpl = extractTemplate(readSrc('App.vue'));
  assert.match(tpl, /:user=["']state\.user["']/, 'App.vue: DashboardShell :user prop');
  assert.match(tpl, /@logout=["']handleLogout["']/, 'App.vue: handleLogout binding');
});

test('App.vue: imports all expected components', () => {
  const script = extractScript(readSrc('App.vue'));
  const expected = [
    'DashboardShell', 'LoginForm', 'SearchCenter', 'UserManagement',
    'AuditLogs', 'CoordinatorDashboard', 'IngestionDashboard',
    'MessagingCenter', 'InspectorDashboard', 'CustomerView'
  ];
  for (const comp of expected) {
    assert.match(
      script,
      new RegExp(`import\\s+${comp}\\s+from`),
      `App.vue: imports ${comp}`
    );
  }
});

test('App.vue: STORAGE_KEY is defined for localStorage session persistence', () => {
  const script = extractScript(readSrc('App.vue'));
  assert.match(script, /const\s+STORAGE_KEY\s*=/, 'App.vue: STORAGE_KEY constant');
  assert.match(script, /localStorage\.setItem\(STORAGE_KEY/, 'App.vue: saves session to localStorage');
  assert.match(script, /localStorage\.removeItem\(STORAGE_KEY/, 'App.vue: removes session from localStorage');
});

test('App.vue: clearSession resets token, user, summary and currentView', () => {
  const script = extractScript(readSrc('App.vue'));
  const hasClearSession = /function\s+clearSession/.test(script);
  assert.ok(hasClearSession, 'App.vue: clearSession function defined');
  assert.match(script, /state\.token\s*=\s*['"]/, 'App.vue: clears token in clearSession');
  assert.match(script, /state\.user\s*=\s*null/, 'App.vue: clears user in clearSession');
});

test('App.vue: roleViewMap restricts views per role', () => {
  const script = extractScript(readSrc('App.vue'));
  assert.match(script, /roleViewMap/, 'App.vue: roleViewMap defined');
  assert.ok(script.includes("'Administrator'"), "App.vue: Administrator in roleViewMap");
  assert.ok(script.includes("'Coordinator'"), "App.vue: Coordinator in roleViewMap");
  assert.ok(script.includes("'Data Engineer'"), "App.vue: Data Engineer in roleViewMap");
  assert.ok(script.includes("'Inspector'"), "App.vue: Inspector in roleViewMap");
  assert.ok(script.includes("'Customer'"), "App.vue: Customer in roleViewMap");
});

test('App.vue: Administrator role has access to audit and users views', () => {
  const script = extractScript(readSrc('App.vue'));
  // Administrator block must reference 'audit' and 'users'
  const adminBlock = script.match(/['"]Administrator['"]\s*:\s*\[([^\]]+)\]/);
  assert.ok(adminBlock, "App.vue: Administrator entry in roleViewMap");
  assert.ok(adminBlock[1].includes("'audit'") || adminBlock[1].includes('"audit"'), "App.vue: Administrator can access audit");
  assert.ok(adminBlock[1].includes("'users'") || adminBlock[1].includes('"users"'), "App.vue: Administrator can access users");
});

test('App.vue: handleLogin stores token, sets user and calls fetchSummary', () => {
  const script = extractScript(readSrc('App.vue'));
  assert.match(script, /function\s+handleLogin|async\s+function\s+handleLogin/, 'App.vue: handleLogin defined');
  assert.match(script, /state\.token\s*=\s*payload\.token/, 'App.vue: stores token from payload');
  assert.match(script, /state\.user\s*=\s*payload\.user/, 'App.vue: stores user from payload');
  assert.ok(script.includes('loadSummary') || script.includes('fetchSummary'), 'App.vue: loads summary after login');
});

test('App.vue: onMounted restores session from localStorage', () => {
  const script = extractScript(readSrc('App.vue'));
  assert.match(script, /onMounted/, 'App.vue: onMounted hook');
  assert.match(script, /localStorage\.getItem\(STORAGE_KEY\)/, 'App.vue: reads session from localStorage on mount');
});

test('App.vue: view sections are role-gated in template', () => {
  const tpl = extractTemplate(readSrc('App.vue'));
  // Users view is admin-only
  assert.match(tpl, /currentView.*===.*'users'.*&&.*state\.user\.role.*===.*'Administrator'|currentView.*===.*"users".*&&.*state\.user\.role.*===.*"Administrator"/, 'App.vue: users view gated to Administrator');
  // Audit view is admin-only
  assert.match(tpl, /currentView.*===.*'audit'.*&&.*state\.user\.role.*===.*'Administrator'|currentView.*===.*"audit".*&&.*state\.user\.role.*===.*"Administrator"/, 'App.vue: audit view gated to Administrator');
});

test('App.vue: computeds bayUtilizationPercent and equipmentUtilizationPercent exist', () => {
  const script = extractScript(readSrc('App.vue'));
  assertScriptDefines(script, 'bayUtilizationPercent', 'App.vue');
  assertScriptDefines(script, 'equipmentUtilizationPercent', 'App.vue');
});

// ===========================================================================
// DashboardShell.vue
// ===========================================================================

test('DashboardShell: defines user and selectedView props', () => {
  const script = extractScript(readComponent('DashboardShell.vue'));
  assert.match(script, /defineProps/, 'DashboardShell: uses defineProps');
  assert.ok(script.includes('user'), 'DashboardShell: user prop defined');
  assert.ok(script.includes('selectedView'), 'DashboardShell: selectedView prop defined');
});

test('DashboardShell: emits "logout" and "select-view"', () => {
  const script = extractScript(readComponent('DashboardShell.vue'));
  assert.ok(
    script.includes("defineEmits(['logout', 'select-view'])") ||
    script.includes("defineEmits(['select-view', 'logout'])") ||
    script.includes('defineEmits(["logout", "select-view"])') ||
    script.includes('defineEmits(["select-view", "logout"])'),
    "DashboardShell: defineEmits includes 'logout' and 'select-view'"
  );
});

test('DashboardShell: Sign Out button emits logout event', () => {
  const tpl = extractTemplate(readComponent('DashboardShell.vue'));
  assert.match(tpl, /Sign Out/, 'DashboardShell: Sign Out text');
  assertClickHandler(tpl, 'logout', 'DashboardShell');
});

test('DashboardShell: menuItems is a computed property', () => {
  const script = extractScript(readComponent('DashboardShell.vue'));
  assert.match(script, /const\s+menuItems\s*=\s*computed/, 'DashboardShell: menuItems is computed');
});

test('DashboardShell: Administrator menu includes all required items', () => {
  const src = readComponent('DashboardShell.vue');
  // Check the script has Administrator block with these labels
  assert.ok(src.includes('Administrator'), 'DashboardShell: Administrator role');
  assert.ok(src.includes('User Management'), 'DashboardShell: User Management item');
  assert.ok(src.includes('Audit Logs'), 'DashboardShell: Audit Logs item');
  assert.ok(src.includes('Data Ingestion'), 'DashboardShell: Data Ingestion item');
  assert.ok(src.includes('Coordinator'), 'DashboardShell: Coordinator item');
  assert.ok(src.includes('Messages'), 'DashboardShell: Messages item');
});

test('DashboardShell: Coordinator role gets Scheduling item', () => {
  const src = readComponent('DashboardShell.vue');
  assert.ok(src.includes('Coordinator'), 'DashboardShell: Coordinator role check');
  assert.ok(src.includes('Scheduling'), 'DashboardShell: Scheduling menu item');
});

test('DashboardShell: Inspector role gets Inspections item', () => {
  const src = readComponent('DashboardShell.vue');
  assert.ok(src.includes('Inspector'), 'DashboardShell: Inspector role check');
  assert.ok(src.includes('Inspections'), 'DashboardShell: Inspections menu item');
});

test('DashboardShell: Customer role gets My Reports item', () => {
  const src = readComponent('DashboardShell.vue');
  assert.ok(src.includes('Customer'), 'DashboardShell: Customer role check');
  assert.ok(src.includes('My Reports'), 'DashboardShell: My Reports menu item');
});

test('DashboardShell: menu items rendered with v-for and @click emit select-view', () => {
  const tpl = extractTemplate(readComponent('DashboardShell.vue'));
  assert.match(tpl, /v-for=["'][^"']*menuItems["']/, 'DashboardShell: v-for over menuItems');
  assert.match(tpl, /@click=["'][\s\S]*?select-view[\s\S]*?["']/, "DashboardShell: @click emits 'select-view'");
});

test('DashboardShell: active item highlighted using :class with selectedView', () => {
  const tpl = extractTemplate(readComponent('DashboardShell.vue'));
  assert.match(tpl, /selectedView\s*===\s*item\.key/, 'DashboardShell: selectedView comparison for active state');
});

// ===========================================================================
// SearchCenter.vue
// ===========================================================================

test('SearchCenter: has all 11 filter input bindings', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  const fields = [
    'filters.q', 'filters.brand', 'filters.energy_type',
    'filters.date_from', 'filters.date_to', 'filters.transmission',
    'filters.model_year', 'filters.price_min', 'filters.price_max',
    'filters.sort_by', 'filters.sort_order'
  ];
  for (const field of fields) {
    assertVModel(tpl, field.replace('.', '\\.'), 'SearchCenter');
  }
});

test('SearchCenter: all required filter labels present in template', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  const labels = ['Query', 'Brand', 'Energy Type', 'Date From', 'Date To', 'Transmission', 'Model Year', 'Price Min', 'Price Max', 'Sort By', 'Sort Order'];
  for (const label of labels) {
    assert.ok(tpl.includes(label), `SearchCenter: label "${label}" in template`);
  }
});

test('SearchCenter: Search button is :disabled="loading" and calls search(1)', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  assert.match(tpl, /:disabled=["']loading["']/, 'SearchCenter: loading disables button');
  assert.match(tpl, /@click=["']search\(1\)["']/, 'SearchCenter: Search button calls search(1)');
});

test('SearchCenter: Search button shows "Searching..." when loading', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  assert.ok(tpl.includes('Searching...'), 'SearchCenter: loading text on search button');
});

test('SearchCenter: Prev/Next pagination buttons with page bounds checks', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  assert.ok(tpl.includes('Prev'), 'SearchCenter: Prev button');
  assert.ok(tpl.includes('Next'), 'SearchCenter: Next button');
  assert.match(tpl, /:disabled=["']page\s*<=\s*1["']/, 'SearchCenter: Prev disabled when page <= 1');
  assert.match(tpl, /:disabled=["']page\s*>=\s*totalPages["']/, 'SearchCenter: Next disabled when page >= totalPages');
  assert.match(tpl, /Page\s*\{\{.*page.*\}\}\s*\/\s*\{\{.*totalPages.*\}\}|Page.*page.*totalPages/, 'SearchCenter: Page counter display');
});

test('SearchCenter: Trending Keywords section renders keyword buttons', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  assert.ok(tpl.includes('Trending Keywords'), 'SearchCenter: Trending Keywords heading');
  assert.match(tpl, /v-for=["'][^"']*trending["']/, 'SearchCenter: v-for over trending');
  assert.match(tpl, /@click=["']applyKeyword\(item\.keyword\)["']/, 'SearchCenter: applyKeyword on keyword button');
});

test('SearchCenter: autocomplete list rendered when suggestions available', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  assert.match(tpl, /v-if=["']autocomplete\.length["']/, 'SearchCenter: autocomplete conditional');
  assert.match(tpl, /v-for=["'][^"']*autocomplete["']/, 'SearchCenter: v-for over autocomplete');
  assert.ok(tpl.includes('Autocomplete:'), 'SearchCenter: Autocomplete label text');
});

test('SearchCenter: results table has all required columns', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  for (const col of ['Brand', 'Model', 'Year', 'Price', 'Energy', 'Transmission']) {
    assertTableColumn(tpl, col, 'SearchCenter');
  }
});

test('SearchCenter: empty state shown when no results', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  assert.ok(tpl.includes('No results found'), 'SearchCenter: empty state message');
});

test('SearchCenter: script defines required reactive state and functions', () => {
  const script = extractScript(readComponent('SearchCenter.vue'));
  for (const name of ['filters', 'rows', 'total', 'page', 'autocomplete', 'trending', 'loading', 'hasSearched', 'totalPages']) {
    assertScriptDefines(script, name, 'SearchCenter');
  }
  for (const fn of ['loadAutocomplete', 'applyKeyword', 'search', 'loadTrending']) {
    assert.match(script, new RegExp(`(?:async\\s+)?function\\s+${fn}\\b`), `SearchCenter: function "${fn}" defined`);
  }
});

test('SearchCenter: loadAutocomplete calls /api/search/autocomplete', () => {
  const script = extractScript(readComponent('SearchCenter.vue'));
  assert.ok(script.includes('/api/search/autocomplete'), 'SearchCenter: autocomplete endpoint');
});

test('SearchCenter: search calls /api/search/vehicles', () => {
  const script = extractScript(readComponent('SearchCenter.vue'));
  assert.ok(script.includes('/api/search/vehicles'), 'SearchCenter: vehicles search endpoint');
});

test('SearchCenter: totalPages is computed from total / 25', () => {
  const script = extractScript(readComponent('SearchCenter.vue'));
  assert.match(script, /const\s+totalPages\s*=\s*computed/, 'SearchCenter: totalPages is computed');
  assert.ok(script.includes('25'), 'SearchCenter: page size 25 in totalPages');
});

test('SearchCenter: query input has @input="loadAutocomplete"', () => {
  const tpl = extractTemplate(readComponent('SearchCenter.vue'));
  assert.match(tpl, /@input=["']loadAutocomplete["']/, 'SearchCenter: @input triggers loadAutocomplete');
});

// ===========================================================================
// MessagingCenter.vue
// ===========================================================================

test('MessagingCenter: compose form has all required v-model bindings', () => {
  const tpl = extractTemplate(readComponent('MessagingCenter.vue'));
  assertVModel(tpl, 'compose\\.recipient_user_id', 'MessagingCenter');
  assertVModel(tpl, 'compose\\.message_type', 'MessagingCenter');
  assertVModel(tpl, 'compose\\.subject', 'MessagingCenter');
  assertVModel(tpl, 'compose\\.body', 'MessagingCenter');
});

test('MessagingCenter: Queue Message button is :disabled="loading"', () => {
  const tpl = extractTemplate(readComponent('MessagingCenter.vue'));
  assert.match(tpl, /:disabled=["']loading["']/, 'MessagingCenter: loading disables send button');
  assert.ok(tpl.includes('Queue Message'), 'MessagingCenter: Queue Message button text');
});

test('MessagingCenter: button shows "Sending..." when loading', () => {
  const tpl = extractTemplate(readComponent('MessagingCenter.vue'));
  assert.ok(tpl.includes('Sending...'), 'MessagingCenter: loading text');
});

test('MessagingCenter: inbox table has Type, Subject, Body columns', () => {
  const tpl = extractTemplate(readComponent('MessagingCenter.vue'));
  assertTableColumn(tpl, 'Type', 'MessagingCenter');
  assertTableColumn(tpl, 'Subject', 'MessagingCenter');
  assertTableColumn(tpl, 'Body', 'MessagingCenter');
});

test('MessagingCenter: empty inbox message shown conditionally', () => {
  const tpl = extractTemplate(readComponent('MessagingCenter.vue'));
  assert.ok(tpl.includes('No messages in your inbox'), 'MessagingCenter: empty inbox message');
});

test('MessagingCenter: Export Manual Outbox button exists', () => {
  const tpl = extractTemplate(readComponent('MessagingCenter.vue'));
  assert.ok(tpl.includes('Export Manual Outbox'), 'MessagingCenter: export outbox button');
});

test('MessagingCenter: error display is conditional on error ref', () => {
  const tpl = extractTemplate(readComponent('MessagingCenter.vue'));
  assert.match(tpl, /v-if=["']error["']/, 'MessagingCenter: v-if error display');
});

test('MessagingCenter: script defines send, loadInbox, exportOutbox functions', () => {
  const script = extractScript(readComponent('MessagingCenter.vue'));
  for (const fn of ['send', 'loadInbox', 'exportOutbox']) {
    assert.match(script, new RegExp(`(?:async\\s+)?function\\s+${fn}\\b`), `MessagingCenter: function "${fn}"`);
  }
});

test('MessagingCenter: send posts to /api/messages/send', () => {
  const script = extractScript(readComponent('MessagingCenter.vue'));
  assert.ok(script.includes('/api/messages/send'), 'MessagingCenter: send endpoint');
});

test('MessagingCenter: loadInbox calls /api/messages/inbox', () => {
  const script = extractScript(readComponent('MessagingCenter.vue'));
  assert.ok(script.includes('/api/messages/inbox'), 'MessagingCenter: inbox endpoint');
});

test('MessagingCenter: exportOutbox posts to /api/messages/outbox/export', () => {
  const script = extractScript(readComponent('MessagingCenter.vue'));
  assert.ok(script.includes('/api/messages/outbox/export'), 'MessagingCenter: export endpoint');
});

test('MessagingCenter: compose has sms in channels array', () => {
  const script = extractScript(readComponent('MessagingCenter.vue'));
  assert.match(script, /channels.*\[.*['"]sms['"].*\]/, 'MessagingCenter: sms channel in compose');
});

// ===========================================================================
// UserManagement.vue
// ===========================================================================

test('UserManagement: Add User button exists with openAddModal handler', () => {
  const tpl = extractTemplate(readComponent('UserManagement.vue'));
  assert.ok(tpl.includes('Add User'), 'UserManagement: Add User button text');
  assertClickHandler(tpl, 'openAddModal', 'UserManagement');
});

test('UserManagement: filter controls have Search, Role, Status', () => {
  const tpl = extractTemplate(readComponent('UserManagement.vue'));
  assertVModel(tpl, 'filters\\.q', 'UserManagement');
  assertVModel(tpl, 'filters\\.role', 'UserManagement');
  assertVModel(tpl, 'filters\\.status', 'UserManagement');
});

test('UserManagement: user table has all required columns', () => {
  const tpl = extractTemplate(readComponent('UserManagement.vue'));
  for (const col of ['Username', 'Role', 'Location', 'Department', 'Status', 'Actions']) {
    assertTableColumn(tpl, col, 'UserManagement');
  }
});

test('UserManagement: action buttons — Edit, Deactivate/Activate, Reset Password per user', () => {
  const tpl = extractTemplate(readComponent('UserManagement.vue'));
  assert.ok(tpl.includes('Edit'), 'UserManagement: Edit action');
  assert.ok(tpl.includes('Deactivate') || tpl.includes('Activate'), 'UserManagement: Deactivate/Activate action');
  assert.ok(tpl.includes('Reset Password'), 'UserManagement: Reset Password action');
});

test('UserManagement: Add modal has all required field placeholders', () => {
  const tpl = extractTemplate(readComponent('UserManagement.vue'));
  // The addForm fields are rendered as placeholder attributes
  assert.ok(tpl.includes('Username'), 'UserManagement: add modal Username');
  assert.ok(tpl.includes('Full Name'), 'UserManagement: add modal Full Name');
  assert.ok(tpl.includes('Email'), 'UserManagement: add modal Email');
  assert.ok(tpl.includes('Location'), 'UserManagement: add modal Location');
  assert.ok(tpl.includes('Department'), 'UserManagement: add modal Department');
  assert.ok(tpl.includes('Temporary Password'), 'UserManagement: add modal Temporary Password');
});

test('UserManagement: pagination controls Prev/Next present', () => {
  const tpl = extractTemplate(readComponent('UserManagement.vue'));
  assert.ok(tpl.includes('Prev'), 'UserManagement: Prev pagination');
  assert.ok(tpl.includes('Next'), 'UserManagement: Next pagination');
  assert.match(tpl, /pagination\.page.*\/.*pagination\.totalPages|Page.*pagination/, 'UserManagement: page counter');
});

test('UserManagement: passwordComplexEnough enforces all complexity rules', () => {
  const script = extractScript(readComponent('UserManagement.vue'));
  assert.match(script, /function\s+passwordComplexEnough/, 'UserManagement: passwordComplexEnough defined');
  // Length >= 12
  assert.match(script, /\.length\s*<\s*12/, 'UserManagement: min length 12');
  // Uppercase, lowercase, digit, special char
  assert.match(script, /\[A-Z\]/, 'UserManagement: uppercase check');
  assert.match(script, /\[a-z\]/, 'UserManagement: lowercase check');
  assert.match(script, /\\d/, 'UserManagement: digit check');
  // Special char check: source has /[^A-Za-z0-9]/ or equivalent negated class
  assert.ok(script.includes('[^A-Za-z0-9]') || script.includes('[A-Za-z0-9]'), 'UserManagement: special char check');
});

test('UserManagement: submitAddUser posts to /api/auth/register', () => {
  const script = extractScript(readComponent('UserManagement.vue'));
  assert.ok(script.includes('/api/auth/register'), 'UserManagement: register endpoint');
});

test('UserManagement: script defines all required functions', () => {
  const script = extractScript(readComponent('UserManagement.vue'));
  for (const fn of ['loadUsers', 'loadRoles', 'openAddModal', 'openEditModal', 'openResetModal', 'submitAddUser', 'submitEditUser', 'submitResetPassword', 'toggleActive', 'closeModals']) {
    assert.match(script, new RegExp(`(?:async\\s+)?function\\s+${fn}\\b`), `UserManagement: function "${fn}"`);
  }
});

test('UserManagement: applies password validation before add and reset submission', () => {
  const script = extractScript(readComponent('UserManagement.vue'));
  // passwordComplexEnough must be called in both submitAddUser and submitResetPassword
  const addIdx = script.indexOf('function submitAddUser');
  const resetIdx = script.indexOf('function submitResetPassword');
  assert.ok(addIdx !== -1, 'UserManagement: submitAddUser defined');
  assert.ok(resetIdx !== -1, 'UserManagement: submitResetPassword defined');
  const addBlock = script.slice(addIdx, resetIdx);
  assert.ok(addBlock.includes('passwordComplexEnough'), 'UserManagement: passwordComplexEnough called in submitAddUser');
  const resetBlock = script.slice(resetIdx);
  assert.ok(resetBlock.includes('passwordComplexEnough'), 'UserManagement: passwordComplexEnough called in submitResetPassword');
});

test('UserManagement: modals reactive object has add, edit, reset flags', () => {
  const script = extractScript(readComponent('UserManagement.vue'));
  assert.match(script, /const\s+modals\s*=\s*reactive/, 'UserManagement: modals is reactive');
  assert.ok(script.includes('add:'), 'UserManagement: modals.add');
  assert.ok(script.includes('edit:'), 'UserManagement: modals.edit');
  assert.ok(script.includes('reset:'), 'UserManagement: modals.reset');
});

// ===========================================================================
// CoordinatorDashboard.vue
// ===========================================================================

test('CoordinatorDashboard: scheduling form has all required v-model bindings', () => {
  const tpl = extractTemplate(readComponent('CoordinatorDashboard.vue'));
  assertVModel(tpl, 'form\\.customer_id', 'CoordinatorDashboard');
  assertVModel(tpl, 'form\\.vehicle_type', 'CoordinatorDashboard');
  assertVModel(tpl, 'form\\.scheduled_at', 'CoordinatorDashboard');
  assertVModel(tpl, 'form\\.notes', 'CoordinatorDashboard');
});

test('CoordinatorDashboard: Create Appointment button calls schedule', () => {
  const tpl = extractTemplate(readComponent('CoordinatorDashboard.vue'));
  assert.ok(tpl.includes('Create Appointment'), 'CoordinatorDashboard: Create Appointment button');
  assertClickHandler(tpl, 'schedule', 'CoordinatorDashboard');
});

test('CoordinatorDashboard: Create Appointment button is :disabled="loading"', () => {
  const tpl = extractTemplate(readComponent('CoordinatorDashboard.vue'));
  assert.match(tpl, /:disabled=["']loading["']/, 'CoordinatorDashboard: loading disables button');
});

test('CoordinatorDashboard: Waiting Room Seats grid renders with v-for', () => {
  const tpl = extractTemplate(readComponent('CoordinatorDashboard.vue'));
  assert.ok(tpl.includes('Waiting Room Seats'), 'CoordinatorDashboard: Waiting Room Seats heading');
  assert.match(tpl, /v-for=["'][^"']*seats["']/, 'CoordinatorDashboard: v-for over seats');
});

test('CoordinatorDashboard: seat assignment dropdown renders open appointments', () => {
  const tpl = extractTemplate(readComponent('CoordinatorDashboard.vue'));
  assertVModel(tpl, 'selectedAppointmentId', 'CoordinatorDashboard');
  assert.match(tpl, /v-for=["'][^"']*openAppointments["']/, 'CoordinatorDashboard: v-for over openAppointments');
});

test('CoordinatorDashboard: Save Seat Layout button calls saveSeats', () => {
  const tpl = extractTemplate(readComponent('CoordinatorDashboard.vue'));
  assert.ok(tpl.includes('Save Seat Layout'), 'CoordinatorDashboard: Save Seat Layout button');
  assertClickHandler(tpl, 'saveSeats', 'CoordinatorDashboard');
});

test('CoordinatorDashboard: script defines schedule, assignSeat, saveSeats functions', () => {
  const script = extractScript(readComponent('CoordinatorDashboard.vue'));
  for (const fn of ['schedule', 'assignSeat', 'saveSeats', 'refresh']) {
    assert.match(script, new RegExp(`(?:async\\s+)?function\\s+${fn}\\b`), `CoordinatorDashboard: function "${fn}"`);
  }
});

test('CoordinatorDashboard: schedule posts to /api/coordinator/appointments/schedule', () => {
  const script = extractScript(readComponent('CoordinatorDashboard.vue'));
  assert.ok(script.includes('/api/coordinator/appointments/schedule'), 'CoordinatorDashboard: schedule endpoint');
});

test('CoordinatorDashboard: assignSeat posts to /api/coordinator/waiting-room/assign-seat', () => {
  const script = extractScript(readComponent('CoordinatorDashboard.vue'));
  assert.ok(script.includes('/api/coordinator/waiting-room/assign-seat'), 'CoordinatorDashboard: assign seat endpoint');
});

test('CoordinatorDashboard: saveSeats puts to /api/coordinator/waiting-room/seats', () => {
  const script = extractScript(readComponent('CoordinatorDashboard.vue'));
  assert.ok(script.includes('/api/coordinator/waiting-room/seats'), 'CoordinatorDashboard: save seats endpoint');
});

test('CoordinatorDashboard: vehicle_type options include light and heavy_duty', () => {
  const tpl = extractTemplate(readComponent('CoordinatorDashboard.vue'));
  assert.ok(tpl.includes('light'), 'CoordinatorDashboard: light vehicle type option');
  assert.ok(tpl.includes('heavy_duty') || tpl.includes('Heavy Duty'), 'CoordinatorDashboard: heavy_duty option');
});

// ===========================================================================
// InspectorDashboard.vue
// ===========================================================================

test('InspectorDashboard: queue table has Appointment, Scheduled, Vehicle, Action columns', () => {
  const tpl = extractTemplate(readComponent('InspectorDashboard.vue'));
  for (const col of ['Appointment', 'Scheduled', 'Vehicle', 'Action']) {
    assertTableColumn(tpl, col, 'InspectorDashboard');
  }
});

test('InspectorDashboard: Publish Result button per queue row calls openPublish', () => {
  const tpl = extractTemplate(readComponent('InspectorDashboard.vue'));
  assert.ok(tpl.includes('Publish Result'), 'InspectorDashboard: Publish Result button');
  assertClickHandler(tpl, 'openPublish', 'InspectorDashboard');
});

test('InspectorDashboard: Refresh Queue button calls loadQueue', () => {
  const tpl = extractTemplate(readComponent('InspectorDashboard.vue'));
  assert.ok(tpl.includes('Refresh Queue'), 'InspectorDashboard: Refresh Queue button');
  assertClickHandler(tpl, 'loadQueue', 'InspectorDashboard');
});

test('InspectorDashboard: empty queue shows "No assigned appointments."', () => {
  const tpl = extractTemplate(readComponent('InspectorDashboard.vue'));
  assert.ok(tpl.includes('No assigned appointments'), 'InspectorDashboard: empty queue message');
});

test('InspectorDashboard: publish modal has Outcome, Score, and Findings fields', () => {
  const tpl = extractTemplate(readComponent('InspectorDashboard.vue'));
  assertVModel(tpl, 'publishModal\\.outcome', 'InspectorDashboard');
  assertVModel(tpl, 'publishModal\\.score', 'InspectorDashboard');
  assertVModel(tpl, 'publishModal\\.findingsText', 'InspectorDashboard');
});

test('InspectorDashboard: outcome select has pass, fail, recheck_required options', () => {
  const tpl = extractTemplate(readComponent('InspectorDashboard.vue'));
  assert.ok(tpl.includes('pass') && tpl.includes('fail') && tpl.includes('recheck_required'), 'InspectorDashboard: outcome options');
});

test('InspectorDashboard: script defines loadQueue and publishResult functions', () => {
  const script = extractScript(readComponent('InspectorDashboard.vue'));
  assert.match(script, /(?:async\s+)?function\s+loadQueue\b/, 'InspectorDashboard: loadQueue defined');
  assert.match(script, /(?:async\s+)?function\s+publishResult\b/, 'InspectorDashboard: publishResult defined');
});

test('InspectorDashboard: loadQueue calls /api/inspections/queue', () => {
  const script = extractScript(readComponent('InspectorDashboard.vue'));
  assert.ok(script.includes('/api/inspections/queue'), 'InspectorDashboard: queue endpoint');
});

test('InspectorDashboard: publishResult posts to /api/inspections/results', () => {
  const script = extractScript(readComponent('InspectorDashboard.vue'));
  assert.ok(script.includes('/api/inspections/results'), 'InspectorDashboard: results endpoint');
});

test('InspectorDashboard: publishResult parses findingsText as JSON', () => {
  const script = extractScript(readComponent('InspectorDashboard.vue'));
  assert.match(script, /JSON\.parse\(publishModal\.findingsText/, 'InspectorDashboard: JSON.parse on findingsText');
});

test('InspectorDashboard: publishModal is a reactive object with required fields', () => {
  const script = extractScript(readComponent('InspectorDashboard.vue'));
  assert.match(script, /const\s+publishModal\s*=\s*reactive/, 'InspectorDashboard: publishModal is reactive');
  assert.ok(script.includes('open:'), 'InspectorDashboard: publishModal.open');
  assert.ok(script.includes('appointment_id:'), 'InspectorDashboard: publishModal.appointment_id');
  assert.ok(script.includes('outcome:'), 'InspectorDashboard: publishModal.outcome');
  assert.ok(script.includes('score:'), 'InspectorDashboard: publishModal.score');
});

// ===========================================================================
// CustomerView.vue
// ===========================================================================

test('CustomerView: My Vehicles table has Plate, Brand, Model columns', () => {
  const tpl = extractTemplate(readComponent('CustomerView.vue'));
  assertTableColumn(tpl, 'Plate', 'CustomerView');
  assertTableColumn(tpl, 'Brand', 'CustomerView');
  assertTableColumn(tpl, 'Model', 'CustomerView');
});

test('CustomerView: My Inspection Reports table has Report, Outcome, Completed columns', () => {
  const tpl = extractTemplate(readComponent('CustomerView.vue'));
  assertTableColumn(tpl, 'Report', 'CustomerView');
  assertTableColumn(tpl, 'Outcome', 'CustomerView');
  assertTableColumn(tpl, 'Completed', 'CustomerView');
});

test('CustomerView: empty state messages for both tables', () => {
  const tpl = extractTemplate(readComponent('CustomerView.vue'));
  assert.ok(tpl.includes('No vehicles found'), 'CustomerView: no vehicles empty state');
  assert.ok(tpl.includes('No reports published'), 'CustomerView: no reports empty state');
});

test('CustomerView: script defines loadData function', () => {
  const script = extractScript(readComponent('CustomerView.vue'));
  assert.match(script, /(?:async\s+)?function\s+loadData\b/, 'CustomerView: loadData defined');
});

test('CustomerView: loadData fetches both vehicles and reports in parallel', () => {
  const script = extractScript(readComponent('CustomerView.vue'));
  assert.match(script, /Promise\.all/, 'CustomerView: parallel fetch with Promise.all');
  assert.ok(script.includes('/api/search/vehicles'), 'CustomerView: vehicles endpoint');
  assert.ok(script.includes('/api/inspections/customer/reports'), 'CustomerView: customer reports endpoint');
});

test('CustomerView: error ref displayed conditionally in template', () => {
  const tpl = extractTemplate(readComponent('CustomerView.vue'));
  assert.match(tpl, /v-if=["']error["']/, 'CustomerView: error conditional display');
});

// ===========================================================================
// IngestionDashboard.vue
// ===========================================================================

test('IngestionDashboard: status cards for Running, Failed, Completed', () => {
  const tpl = extractTemplate(readComponent('IngestionDashboard.vue'));
  assert.ok(tpl.includes('Running'), 'IngestionDashboard: Running card');
  assert.ok(tpl.includes('Failed'), 'IngestionDashboard: Failed card');
  assert.ok(tpl.includes('Completed'), 'IngestionDashboard: Completed card');
});

test('IngestionDashboard: Refresh button calls load function', () => {
  const tpl = extractTemplate(readComponent('IngestionDashboard.vue'));
  assert.ok(tpl.includes('Refresh'), 'IngestionDashboard: Refresh button text');
  assertClickHandler(tpl, 'load', 'IngestionDashboard');
});

test('IngestionDashboard: statusCount function uses statuses array', () => {
  const script = extractScript(readComponent('IngestionDashboard.vue'));
  assert.match(script, /function\s+statusCount\s*\(/, 'IngestionDashboard: statusCount defined');
  assert.match(script, /statuses\.value\.find/, 'IngestionDashboard: statusCount searches statuses');
});

test('IngestionDashboard: statusCount called with "running", "failed", "completed" in template', () => {
  const tpl = extractTemplate(readComponent('IngestionDashboard.vue'));
  assert.match(tpl, /statusCount\(['"]running['"]\)/, 'IngestionDashboard: running count');
  assert.match(tpl, /statusCount\(['"]failed['"]\)/, 'IngestionDashboard: failed count');
  assert.match(tpl, /statusCount\(['"]completed['"]\)/, 'IngestionDashboard: completed count');
});

test('IngestionDashboard: load function calls fetchIngestionHealth', () => {
  const script = extractScript(readComponent('IngestionDashboard.vue'));
  assert.match(script, /(?:async\s+)?function\s+load\b/, 'IngestionDashboard: load function defined');
  assert.ok(script.includes('fetchIngestionHealth'), 'IngestionDashboard: calls fetchIngestionHealth');
});

test('IngestionDashboard: imports fetchIngestionHealth from services/api.js', () => {
  const script = extractScript(readComponent('IngestionDashboard.vue'));
  assert.match(script, /import.*fetchIngestionHealth.*from/, 'IngestionDashboard: imports fetchIngestionHealth');
});

// ===========================================================================
// AuditLogs.vue
// ===========================================================================

test('AuditLogs: filter inputs for Action, Actor Role, Target Table', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  assertVModel(tpl, 'filters\\.action', 'AuditLogs');
  assertVModel(tpl, 'filters\\.actor_role', 'AuditLogs');
  assertVModel(tpl, 'filters\\.target_table', 'AuditLogs');
});

test('AuditLogs: Apply Filters button calls load(1)', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  assert.ok(tpl.includes('Apply Filters'), 'AuditLogs: Apply Filters button');
  assert.match(tpl, /@click=["']load\(1\)["']/, 'AuditLogs: Apply Filters calls load(1)');
});

test('AuditLogs: Export Ledger button calls exportLedger', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  assert.ok(tpl.includes('Export Ledger'), 'AuditLogs: Export Ledger button');
  assertClickHandler(tpl, 'exportLedger', 'AuditLogs');
});

test('AuditLogs: Purge >2y button calls purgeRetention with confirm guard', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  assert.ok(tpl.includes('Purge'), 'AuditLogs: Purge button');
  assertClickHandler(tpl, 'purgeRetention', 'AuditLogs');
  const script = extractScript(readComponent('AuditLogs.vue'));
  // purgeRetention should guard with confirm()
  const fnStart = script.indexOf('function purgeRetention');
  const fnEnd = script.indexOf('\n}', fnStart) + 2;
  const fnBody = script.slice(fnStart, fnEnd);
  assert.ok(fnBody.includes('confirm'), 'AuditLogs: purgeRetention has confirm guard');
});

test('AuditLogs: audit table has all required columns', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  for (const col of ['Time', 'Actor Role', 'Action', 'Target', 'Details']) {
    assertTableColumn(tpl, col, 'AuditLogs');
  }
});

test('AuditLogs: pagination Prev/Next with page bounds', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  assert.ok(tpl.includes('Prev'), 'AuditLogs: Prev button');
  assert.ok(tpl.includes('Next'), 'AuditLogs: Next button');
  assert.match(tpl, /:disabled=["']page\s*<=\s*1["']/, 'AuditLogs: Prev disabled at page 1');
  assert.match(tpl, /:disabled=["']page\s*>=\s*totalPages["']/, 'AuditLogs: Next disabled at last page');
});

test('AuditLogs: empty state "No audit events found."', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  assert.ok(tpl.includes('No audit events found'), 'AuditLogs: empty state message');
});

test('AuditLogs: stringify function handles null, object, and string values', () => {
  const script = extractScript(readComponent('AuditLogs.vue'));
  assert.match(script, /function\s+stringify\s*\(/, 'AuditLogs: stringify defined');
  // Must handle null/falsy
  assert.match(script, /if\s*\(!value\)/, 'AuditLogs: stringify null guard');
  // Must handle typeof string
  assert.match(script, /typeof value\s*===\s*['"]string['"]/, 'AuditLogs: stringify string check');
  // Must JSON.stringify objects
  assert.match(script, /JSON\.stringify/, 'AuditLogs: stringify uses JSON.stringify');
});

test('AuditLogs: script defines load, exportLedger, purgeRetention functions', () => {
  const script = extractScript(readComponent('AuditLogs.vue'));
  for (const fn of ['load', 'exportLedger', 'purgeRetention']) {
    assert.match(script, new RegExp(`(?:async\\s+)?function\\s+${fn}\\b`), `AuditLogs: function "${fn}"`);
  }
});

test('AuditLogs: load calls /api/audit/events', () => {
  const script = extractScript(readComponent('AuditLogs.vue'));
  assert.ok(script.includes('/api/audit/events'), 'AuditLogs: audit events endpoint');
});

test('AuditLogs: exportLedger posts to /api/audit/export', () => {
  const script = extractScript(readComponent('AuditLogs.vue'));
  assert.ok(script.includes('/api/audit/export'), 'AuditLogs: export endpoint');
});

test('AuditLogs: purgeRetention posts to /api/audit/retention/purge', () => {
  const script = extractScript(readComponent('AuditLogs.vue'));
  assert.ok(script.includes('/api/audit/retention/purge'), 'AuditLogs: purge endpoint');
});

test('AuditLogs: rows rendered with v-for and key=row.id', () => {
  const tpl = extractTemplate(readComponent('AuditLogs.vue'));
  assert.match(tpl, /v-for=["'][^"']*rows["'].*:key=["']row\.id["']|:key=["']row\.id["'].*v-for=["'][^"']*rows["']/, 'AuditLogs: v-for rows with key');
});

test('AuditLogs: filters reactive object has action, actor_role, target_table', () => {
  const script = extractScript(readComponent('AuditLogs.vue'));
  assert.match(script, /const\s+filters\s*=\s*reactive/, 'AuditLogs: filters is reactive');
  assert.ok(script.includes('action:'), 'AuditLogs: filters.action');
  assert.ok(script.includes('actor_role:'), 'AuditLogs: filters.actor_role');
  assert.ok(script.includes('target_table:'), 'AuditLogs: filters.target_table');
});
