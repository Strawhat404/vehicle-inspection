import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../../src/services/api.js', () => ({
  fetchIngestionHealth: vi.fn()
}));

import IngestionDashboard from '../../src/components/IngestionDashboard.vue';
import { fetchIngestionHealth } from '../../src/services/api.js';

const HEALTH_DATA = {
  statuses: [
    { status: 'running', count: 3 },
    { status: 'failed', count: 1 },
    { status: 'completed', count: 15 }
  ]
};

beforeEach(() => {
  fetchIngestionHealth.mockResolvedValue(HEALTH_DATA);
});

describe('IngestionDashboard', () => {
  it('renders status cards with Running, Failed, Completed headings', async () => {
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Running');
    expect(wrapper.text()).toContain('Failed');
    expect(wrapper.text()).toContain('Completed');
  });

  it('displays correct counts from API', async () => {
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('3');
    expect(wrapper.text()).toContain('1');
    expect(wrapper.text()).toContain('15');
  });

  it('has a Refresh button', async () => {
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const refreshBtn = wrapper.findAll('button').find(b => b.text().includes('Refresh'));
    expect(refreshBtn).toBeTruthy();
  });

  it('calls fetchIngestionHealth on mount with token', async () => {
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(fetchIngestionHealth).toHaveBeenCalledWith('test-token');
  });

  it('calls fetchIngestionHealth again when Refresh is clicked', async () => {
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const callsBefore = fetchIngestionHealth.mock.calls.length;
    const refreshBtn = wrapper.findAll('button').find(b => b.text().includes('Refresh'));
    await refreshBtn.trigger('click');
    await flushPromises();
    expect(fetchIngestionHealth.mock.calls.length).toBe(callsBefore + 1);
  });

  it('shows 0 for statuses missing from API response', async () => {
    fetchIngestionHealth.mockResolvedValue({ statuses: [] });
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    // All three count cards should show 0
    const boldNumbers = wrapper.findAll('p.text-2xl');
    for (const el of boldNumbers) {
      expect(el.text()).toBe('0');
    }
  });

  it('shows error message when API fails', async () => {
    fetchIngestionHealth.mockRejectedValue(new Error('Service unavailable'));
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Service unavailable');
  });

  it('renders Data Ingestion Health heading', async () => {
    const wrapper = mount(IngestionDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Data Ingestion Health');
  });
});
