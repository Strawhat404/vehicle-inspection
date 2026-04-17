import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// Mock must be declared before any component import that uses api.js
vi.mock('../../src/services/api.js', () => ({
  apiGet: vi.fn()
}));

import CustomerView from '../../src/components/CustomerView.vue';
import { apiGet } from '../../src/services/api.js';

const VEHICLE_ROW = { id: 1, plate_number: 'KAA123A', brand: 'Toyota', model_name: 'Corolla' };
const REPORT_ROW = { report_id: 1, outcome: 'pass', completed_at: '2026-01-01', appointment_id: 1 };

function defaultApiGet(path) {
  if (path.includes('/api/search/vehicles')) {
    return Promise.resolve({ rows: [VEHICLE_ROW] });
  }
  if (path.includes('/api/inspections/customer/reports')) {
    return Promise.resolve({ rows: [REPORT_ROW] });
  }
  return Promise.resolve({});
}

beforeEach(() => {
  apiGet.mockImplementation(defaultApiGet);
});

describe('CustomerView', () => {
  it('renders My Vehicles and My Inspection Reports headings', async () => {
    const wrapper = mount(CustomerView, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('My Vehicles');
    expect(wrapper.text()).toContain('My Inspection Reports');
  });

  it('renders vehicle data from API', async () => {
    const wrapper = mount(CustomerView, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Toyota');
    expect(wrapper.text()).toContain('Corolla');
    expect(wrapper.text()).toContain('KAA123A');
  });

  it('renders report data from API', async () => {
    const wrapper = mount(CustomerView, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('pass');
  });

  it('shows empty state when no vehicles', async () => {
    apiGet.mockImplementation((path) => {
      if (path.includes('/api/search/vehicles')) {
        return Promise.resolve({ rows: [] });
      }
      if (path.includes('/api/inspections/customer/reports')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({});
    });
    const wrapper = mount(CustomerView, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('No vehicles found');
  });

  it('shows empty reports state when no reports', async () => {
    apiGet.mockImplementation((path) => {
      if (path.includes('/api/search/vehicles')) {
        return Promise.resolve({ rows: [] });
      }
      if (path.includes('/api/inspections/customer/reports')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({});
    });
    const wrapper = mount(CustomerView, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('No reports published yet');
  });

  it('calls apiGet with vehicle and report endpoints on mount', async () => {
    const wrapper = mount(CustomerView, { props: { token: 'test-token' } });
    await flushPromises();
    const calls = apiGet.mock.calls.map(c => c[0]);
    expect(calls.some(p => p.includes('/api/search/vehicles'))).toBe(true);
    expect(calls.some(p => p.includes('/api/inspections/customer/reports'))).toBe(true);
  });

  it('shows error when API fails', async () => {
    apiGet.mockRejectedValue(new Error('Network error'));
    const wrapper = mount(CustomerView, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Network error');
  });
});
