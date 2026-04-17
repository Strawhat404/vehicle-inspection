import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../../src/services/api.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn()
}));

import InspectorDashboard from '../../src/components/InspectorDashboard.vue';
import { apiGet, apiPost } from '../../src/services/api.js';

const QUEUE_ROWS = [
  { id: 10, scheduled_at: '2026-01-15 09:00', brand: 'Toyota', model_name: 'Corolla', plate_number: 'KAA001A' },
  { id: 11, scheduled_at: '2026-01-15 10:00', brand: 'Honda', model_name: 'Civic', plate_number: 'KAA002B' }
];

beforeEach(() => {
  apiGet.mockResolvedValue({ rows: QUEUE_ROWS });
  apiPost.mockResolvedValue({ success: true });
});

describe('InspectorDashboard', () => {
  it('renders queue table with correct column headers', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Appointment');
    expect(text).toContain('Scheduled');
    expect(text).toContain('Vehicle');
    expect(text).toContain('Action');
  });

  it('shows "No assigned appointments." when queue is empty', async () => {
    apiGet.mockResolvedValue({ rows: [] });
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('No assigned appointments.');
  });

  it('has a Refresh Queue button', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const refreshBtn = wrapper.findAll('button').find(b => b.text().includes('Refresh Queue'));
    expect(refreshBtn).toBeTruthy();
  });

  it('Refresh Queue button calls apiGet again', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const callsBefore = apiGet.mock.calls.length;
    const refreshBtn = wrapper.findAll('button').find(b => b.text().includes('Refresh Queue'));
    await refreshBtn.trigger('click');
    await flushPromises();
    expect(apiGet.mock.calls.length).toBe(callsBefore + 1);
  });

  it('renders queue row data from API', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Toyota');
    expect(text).toContain('Corolla');
    expect(text).toContain('KAA001A');
    expect(text).toContain('Honda');
    expect(text).toContain('KAA002B');
  });

  it('has a Publish Result button for each queue row', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const publishBtns = wrapper.findAll('button').filter(b => b.text().includes('Publish Result'));
    expect(publishBtns.length).toBe(QUEUE_ROWS.length);
  });

  it('clicking Publish Result opens modal with appointment id', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const publishBtns = wrapper.findAll('button').filter(b => b.text().includes('Publish Result'));
    await publishBtns[0].trigger('click');
    await wrapper.vm.$nextTick();
    // Modal should contain appointment reference
    expect(wrapper.text()).toContain('Publish Inspection Result');
    expect(wrapper.text()).toContain('10'); // appointment id
  });

  it('calls apiGet on /api/inspections/queue on mount', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const queueCalls = apiGet.mock.calls.filter(c => c[0].includes('/api/inspections/queue'));
    expect(queueCalls.length).toBeGreaterThan(0);
  });

  it('shows appointment IDs in table rows', async () => {
    const wrapper = mount(InspectorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('#10');
    expect(wrapper.text()).toContain('#11');
  });
});
