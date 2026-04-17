import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// Mock the api module before importing the component
vi.mock('../../src/services/api.js', () => ({
  login: vi.fn().mockResolvedValue({
    token: 'test-token',
    user: {
      id: 1,
      username: 'admin',
      role: 'Administrator',
      fullName: 'Admin',
      locationCode: 'HQ',
      departmentCode: 'OPS'
    }
  }),
  me: vi.fn().mockResolvedValue({
    user: {
      id: 1,
      username: 'admin',
      role: 'Administrator',
      fullName: 'Admin',
      locationCode: 'HQ',
      departmentCode: 'OPS'
    }
  }),
  logout: vi.fn().mockResolvedValue({}),
  fetchSummary: vi.fn().mockResolvedValue({
    metrics: {
      todays_appointments: 0,
      upcoming_appointments: 0,
      total_inspections: 0,
      active_resources: 0,
      ingestion_running: 0,
      ingestion_failed: 0
    }
  }),
  fetchCoordinatorView: vi.fn().mockResolvedValue({ seats: [], bayUtilization: [] }),
  fetchIngestionHealth: vi.fn().mockResolvedValue({ statuses: [] }),
  apiGet: vi.fn().mockResolvedValue({ rows: [], messages: [], keywords: [], suggestions: [] }),
  apiPost: vi.fn().mockResolvedValue({}),
  apiPut: vi.fn().mockResolvedValue({})
}));

import App from '../../src/App.vue';
import { me, login, fetchSummary } from '../../src/services/api.js';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};
vi.stubGlobal('localStorage', localStorageMock);

const MOCK_USER = {
  id: 1,
  username: 'admin',
  role: 'Administrator',
  fullName: 'Admin',
  locationCode: 'HQ',
  departmentCode: 'OPS'
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
  // Re-establish mock implementations after clearAllMocks
  login.mockResolvedValue({ token: 'test-token', user: MOCK_USER });
  me.mockResolvedValue({ user: MOCK_USER });
  fetchSummary.mockResolvedValue({
    metrics: {
      todays_appointments: 0,
      upcoming_appointments: 0,
      total_inspections: 0,
      active_resources: 0,
      ingestion_running: 0,
      ingestion_failed: 0
    }
  });
});

describe('App', () => {
  it('shows LoginForm when no user is logged in', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('RoadSafe');
    expect(wrapper.text()).toContain('Sign In');
  });

  it('does not show dashboard when not logged in', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).not.toContain('Operations Menu');
  });

  it('shows login portal heading before authentication', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Secure internal access portal');
  });

  it('shows dashboard after login via LoginForm emit', async () => {
    const wrapper = mount(App);
    const loginForm = wrapper.findComponent({ name: 'LoginForm' });
    if (loginForm.exists()) {
      await loginForm.vm.$emit('login', { username: 'admin', password: 'Admin@123456' });
      await flushPromises();
      // After login, dashboard section appears with Welcome message
      expect(wrapper.text()).toContain('Welcome');
    }
  });

  it('shows user role info on dashboard after login', async () => {
    const wrapper = mount(App);
    const loginForm = wrapper.findComponent({ name: 'LoginForm' });
    if (loginForm.exists()) {
      await loginForm.vm.$emit('login', { username: 'admin', password: 'Admin@123456' });
      await flushPromises();
      expect(wrapper.text()).toContain('Administrator');
    }
  });

  it('restores session from localStorage on mount', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ token: 'saved-token' }));
    mount(App);
    await flushPromises();
    expect(me).toHaveBeenCalledWith('saved-token');
  });

  it('clears session on failed localStorage restore', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ token: 'invalid' }));
    me.mockRejectedValueOnce(new Error('Invalid token'));
    mount(App);
    await flushPromises();
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });

  it('calls localStorage.getItem with session key on mount', async () => {
    mount(App);
    await flushPromises();
    expect(localStorageMock.getItem).toHaveBeenCalledWith('roadsafe_session');
  });

  it('does not call me() when localStorage has no session', async () => {
    localStorageMock.getItem.mockReturnValue(null);
    mount(App);
    await flushPromises();
    expect(me).not.toHaveBeenCalled();
  });

  it('saves session to localStorage after successful login', async () => {
    const wrapper = mount(App);
    const loginForm = wrapper.findComponent({ name: 'LoginForm' });
    if (loginForm.exists()) {
      await loginForm.vm.$emit('login', { username: 'admin', password: 'Admin@123456' });
      await flushPromises();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'roadsafe_session',
        expect.stringContaining('test-token')
      );
    }
  });

  it('shows metric cards on dashboard after login', async () => {
    const wrapper = mount(App);
    const loginForm = wrapper.findComponent({ name: 'LoginForm' });
    if (loginForm.exists()) {
      await loginForm.vm.$emit('login', { username: 'admin', password: 'Admin@123456' });
      await flushPromises();
      expect(wrapper.text()).toContain("Today's Appointments");
      expect(wrapper.text()).toContain('Total Inspections');
    }
  });
});
