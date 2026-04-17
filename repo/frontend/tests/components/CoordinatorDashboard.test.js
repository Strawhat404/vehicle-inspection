import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../../src/services/api.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn()
}));

import CoordinatorDashboard from '../../src/components/CoordinatorDashboard.vue';
import { apiGet, apiPost, apiPut } from '../../src/services/api.js';

const MOCK_SEATS = [
  { id: 1, seat_label: 'A1', occupied_by_appointment_id: null },
  { id: 2, seat_label: 'A2', occupied_by_appointment_id: 5 },
  { id: 3, seat_label: 'B1', occupied_by_appointment_id: null }
];

const MOCK_OPEN_APPOINTMENTS = [
  { id: 5, status: 'checked_in' },
  { id: 8, status: 'scheduled' }
];

beforeEach(() => {
  apiGet.mockImplementation((path) => {
    if (path.includes('/api/dashboard/coordinator-view')) {
      return Promise.resolve({ seats: MOCK_SEATS, bayUtilization: [] });
    }
    if (path.includes('/api/coordinator/open-appointments')) {
      return Promise.resolve({ appointments: MOCK_OPEN_APPOINTMENTS });
    }
    return Promise.resolve({});
  });
  apiPost.mockResolvedValue({ appointmentId: 99 });
  apiPut.mockResolvedValue({ success: true });
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('CoordinatorDashboard', () => {
  it('renders Coordinator Scheduling heading', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Coordinator Scheduling');
  });

  it('renders scheduling form fields', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Customer ID');
    expect(text).toContain('Vehicle Type');
    expect(text).toContain('Scheduled At');
    expect(text).toContain('Notes');
  });

  it('has a Create Appointment button', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create Appointment'));
    expect(createBtn).toBeTruthy();
  });

  it('renders Waiting Room Seats heading', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Waiting Room Seats');
  });

  it('renders seat buttons from API response', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('A1');
    expect(text).toContain('A2');
    expect(text).toContain('B1');
  });

  it('renders seat occupied indicator for occupied seats', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    // A2 is occupied by appointment 5
    expect(wrapper.text()).toContain('A#5');
  });

  it('has a Save Seat Layout button', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Seat Layout'));
    expect(saveBtn).toBeTruthy();
  });

  it('clicking Save Seat Layout calls apiPut after confirm', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Seat Layout'));
    await saveBtn.trigger('click');
    await flushPromises();
    const saveCalls = apiPut.mock.calls.filter(c => c[0].includes('/api/coordinator/waiting-room/seats'));
    expect(saveCalls.length).toBeGreaterThan(0);
  });

  it('does not call apiPut when user cancels Save Seat Layout confirm', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    apiPut.mockClear();
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Seat Layout'));
    await saveBtn.trigger('click');
    await flushPromises();
    const saveCalls = apiPut.mock.calls.filter(c => c[0].includes('/api/coordinator/waiting-room/seats'));
    expect(saveCalls.length).toBe(0);
  });

  it('clicking Create Appointment calls apiPost on /api/coordinator/appointments/schedule', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create Appointment'));
    await createBtn.trigger('click');
    await flushPromises();
    const scheduleCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/coordinator/appointments/schedule'));
    expect(scheduleCalls.length).toBeGreaterThan(0);
  });

  it('does not call apiPost when user cancels Create Appointment confirm', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    apiPost.mockClear();
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create Appointment'));
    await createBtn.trigger('click');
    await flushPromises();
    const scheduleCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/coordinator/appointments/schedule'));
    expect(scheduleCalls.length).toBe(0);
  });

  it('shows scheduled appointment message after successful Create Appointment', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create Appointment'));
    await createBtn.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Scheduled appointment #99');
  });

  it('shows Seat Layout saved message after successful Save Seat Layout', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Seat Layout'));
    await saveBtn.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Seat layout saved');
  });

  it('calls apiGet on coordinator-view and open-appointments on mount', async () => {
    mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const coordCalls = apiGet.mock.calls.filter(c => c[0].includes('/api/dashboard/coordinator-view'));
    const aptCalls = apiGet.mock.calls.filter(c => c[0].includes('/api/coordinator/open-appointments'));
    expect(coordCalls.length).toBeGreaterThan(0);
    expect(aptCalls.length).toBeGreaterThan(0);
  });

  it('renders Vehicle Type select with Light and Heavy Duty options', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Light');
    expect(text).toContain('Heavy Duty');
  });

  it('renders Appointment For Seat Assignment dropdown with open appointments', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Appointment For Seat Assignment');
    // Open appointments should appear in dropdown
    expect(wrapper.text()).toContain('#5');
    expect(wrapper.text()).toContain('#8');
  });

  it('renders correct number of seat label texts', async () => {
    const wrapper = mount(CoordinatorDashboard, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    // All seat labels from mock data should appear
    for (const seat of MOCK_SEATS) {
      expect(text).toContain(seat.seat_label);
    }
  });
});
