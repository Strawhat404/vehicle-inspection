import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../../src/services/api.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn()
}));

import AuditLogs from '../../src/components/AuditLogs.vue';
import { apiGet, apiPost } from '../../src/services/api.js';

const AUDIT_ROWS = [
  {
    id: 1,
    event_time: '2026-01-01T10:00:00Z',
    actor_role: 'Administrator',
    action: 'user.create',
    target_table: 'users',
    target_record_id: 42,
    details: { note: 'created user' }
  },
  {
    id: 2,
    event_time: '2026-01-02T11:00:00Z',
    actor_role: 'Coordinator',
    action: 'appointment.update',
    target_table: 'appointments',
    target_record_id: 7,
    details: null
  }
];

const PAGINATION = { page: 1, totalPages: 3, pageSize: 25, total: 60 };

beforeEach(() => {
  apiGet.mockResolvedValue({ rows: AUDIT_ROWS, pagination: PAGINATION });
  apiPost.mockResolvedValue({ exported: 42, filePath: '/tmp/audit.csv' });
  // Mock window.confirm to return true by default
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('AuditLogs', () => {
  it('renders filter inputs for Action, Actor Role, Target Table', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const labels = wrapper.findAll('label');
    const labelTexts = labels.map(l => l.text());
    expect(labelTexts.some(t => t.includes('Action'))).toBe(true);
    expect(labelTexts.some(t => t.includes('Actor Role'))).toBe(true);
    expect(labelTexts.some(t => t.includes('Target Table'))).toBe(true);
  });

  it('has Export Ledger and Purge buttons', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const buttons = wrapper.findAll('button').map(b => b.text());
    expect(buttons.some(t => t.includes('Export Ledger'))).toBe(true);
    expect(buttons.some(t => t.includes('Purge'))).toBe(true);
  });

  it('renders audit table with correct column headers', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Time');
    expect(text).toContain('Actor Role');
    expect(text).toContain('Action');
    expect(text).toContain('Target');
    expect(text).toContain('Details');
  });

  it('shows "No audit events found." when rows are empty', async () => {
    apiGet.mockResolvedValue({ rows: [], pagination: { page: 1, totalPages: 1 } });
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('No audit events found.');
  });

  it('has Prev and Next pagination buttons', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const buttons = wrapper.findAll('button').map(b => b.text());
    expect(buttons.some(t => t.includes('Prev'))).toBe(true);
    expect(buttons.some(t => t.includes('Next'))).toBe(true);
  });

  it('renders row data from API', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Administrator');
    expect(text).toContain('user.create');
    expect(text).toContain('users');
    expect(text).toContain('Coordinator');
    expect(text).toContain('appointment.update');
  });

  it('displays page info', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Page 1');
    expect(wrapper.text()).toContain('3'); // totalPages
  });

  it('Prev button is disabled on first page', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const prevBtn = wrapper.findAll('button').find(b => b.text().includes('Prev'));
    expect(prevBtn.attributes('disabled')).toBeDefined();
  });

  it('Next button is enabled when totalPages > 1', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('Next'));
    expect(nextBtn.attributes('disabled')).toBeUndefined();
  });

  it('clicking Export Ledger calls apiPost on /api/audit/export', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export Ledger'));
    await exportBtn.trigger('click');
    await flushPromises();
    const exportCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/audit/export'));
    expect(exportCalls.length).toBeGreaterThan(0);
  });

  it('clicking Purge calls apiPost on /api/audit/retention/purge after confirm', async () => {
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const purgeBtn = wrapper.findAll('button').find(b => b.text().includes('Purge'));
    await purgeBtn.trigger('click');
    await flushPromises();
    const purgeCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/audit/retention/purge'));
    expect(purgeCalls.length).toBeGreaterThan(0);
  });

  it('does not call purge API when user cancels confirm dialog', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    apiPost.mockClear();
    const wrapper = mount(AuditLogs, { props: { token: 'test-token' } });
    await flushPromises();
    const purgeBtn = wrapper.findAll('button').find(b => b.text().includes('Purge'));
    await purgeBtn.trigger('click');
    await flushPromises();
    const purgeCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/audit/retention/purge'));
    expect(purgeCalls.length).toBe(0);
  });
});
