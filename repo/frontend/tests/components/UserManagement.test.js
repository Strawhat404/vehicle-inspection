import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../../src/services/api.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn()
}));

import UserManagement from '../../src/components/UserManagement.vue';
import { apiGet, apiPost, apiPut } from '../../src/services/api.js';

const MOCK_ROLES = [
  { id: 1, name: 'Administrator' },
  { id: 2, name: 'Coordinator' },
  { id: 3, name: 'Inspector' },
  { id: 4, name: 'Data Engineer' },
  { id: 5, name: 'Customer' }
];

const MOCK_USERS = [
  { id: 1, username: 'admin', role: 'Administrator', location_code: 'HQ', department_code: 'OPS', status: 'Active', is_active: true },
  { id: 2, username: 'coord1', role: 'Coordinator', location_code: 'NBO', department_code: 'COORD', status: 'Active', is_active: true }
];

const MOCK_PAGINATION = { page: 1, totalPages: 2, pageSize: 25, total: 30 };

beforeEach(() => {
  apiGet.mockImplementation((path) => {
    if (path.includes('/api/roles')) return Promise.resolve({ roles: MOCK_ROLES });
    if (path.match(/\/api\/users\/\d+$/)) {
      return Promise.resolve({ user: { id: 1, username: 'admin', role: 'Administrator', location_code: 'HQ', department_code: 'OPS', status: 'Active' } });
    }
    return Promise.resolve({ rows: MOCK_USERS, pagination: MOCK_PAGINATION });
  });
  apiPost.mockResolvedValue({ id: 10, username: 'newuser' });
  apiPut.mockResolvedValue({ success: true });
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('UserManagement', () => {
  it('renders Add User button', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add User'));
    expect(addBtn).toBeTruthy();
  });

  it('renders filter controls for Search, Role, and Status', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Search');
    expect(text).toContain('Role');
    expect(text).toContain('Status');
  });

  it('renders user table column headers', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Username');
    expect(text).toContain('Role');
    expect(text).toContain('Location');
    expect(text).toContain('Department');
    expect(text).toContain('Status');
    expect(text).toContain('Actions');
  });

  it('renders user rows from API response', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('admin');
    expect(text).toContain('coord1');
    expect(text).toContain('Administrator');
    expect(text).toContain('Coordinator');
  });

  it('renders pagination Prev and Next buttons', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const buttons = wrapper.findAll('button').map(b => b.text());
    expect(buttons.some(t => t.includes('Prev'))).toBe(true);
    expect(buttons.some(t => t.includes('Next'))).toBe(true);
  });

  it('shows page info with current page and total pages', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Page 1');
    expect(wrapper.text()).toContain('2'); // totalPages
  });

  it('Prev button is disabled on first page', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const prevBtn = wrapper.findAll('button').find(b => b.text().includes('Prev'));
    expect(prevBtn.attributes('disabled')).toBeDefined();
  });

  it('Next button is enabled when totalPages > current page', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('Next'));
    expect(nextBtn.attributes('disabled')).toBeUndefined();
  });

  it('calls apiGet on /api/roles and /api/users on mount', async () => {
    mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const rolesCalls = apiGet.mock.calls.filter(c => c[0].includes('/api/roles'));
    const usersCalls = apiGet.mock.calls.filter(c => c[0].includes('/api/users'));
    expect(rolesCalls.length).toBeGreaterThan(0);
    expect(usersCalls.length).toBeGreaterThan(0);
  });

  it('clicking Add User opens modal with Add User heading', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add User'));
    await addBtn.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Add User');
    // Modal form fields
    const inputs = wrapper.findAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('modal has Username, Full Name, Email, Location, Department inputs when Add User is open', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add User'));
    await addBtn.trigger('click');
    await wrapper.vm.$nextTick();
    const placeholders = wrapper.findAll('input').map(i => i.attributes('placeholder') || '');
    expect(placeholders.some(p => p.includes('Username'))).toBe(true);
    expect(placeholders.some(p => p.includes('Full Name'))).toBe(true);
    expect(placeholders.some(p => p.includes('Email'))).toBe(true);
    expect(placeholders.some(p => p.includes('Location'))).toBe(true);
    expect(placeholders.some(p => p.includes('Department'))).toBe(true);
  });

  it('modal has Cancel button when open', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add User'));
    await addBtn.trigger('click');
    await wrapper.vm.$nextTick();
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel');
    expect(cancelBtn).toBeTruthy();
  });

  it('modal closes on Cancel click', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add User'));
    await addBtn.trigger('click');
    await wrapper.vm.$nextTick();
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel');
    await cancelBtn.trigger('click');
    await wrapper.vm.$nextTick();
    // Modal div should be gone
    expect(wrapper.find('.fixed').exists()).toBe(false);
  });

  it('Apply Filters button calls apiGet to reload users', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const callsBefore = apiGet.mock.calls.filter(c => c[0].includes('/api/users')).length;
    const applyBtn = wrapper.findAll('button').find(b => b.text().includes('Apply Filters'));
    await applyBtn.trigger('click');
    await flushPromises();
    const callsAfter = apiGet.mock.calls.filter(c => c[0].includes('/api/users')).length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it('renders Edit and Reset Password action buttons for each user row', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    const editBtns = wrapper.findAll('button').filter(b => b.text() === 'Edit');
    const resetBtns = wrapper.findAll('button').filter(b => b.text().includes('Reset Password'));
    expect(editBtns.length).toBe(MOCK_USERS.length);
    expect(resetBtns.length).toBe(MOCK_USERS.length);
  });

  it('User Management heading is visible', async () => {
    const wrapper = mount(UserManagement, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('User Management');
  });
});
