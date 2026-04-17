import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DashboardShell from '../../src/components/DashboardShell.vue';

function mountShell(role, selectedView = 'dashboard') {
  return mount(DashboardShell, {
    props: {
      user: { id: 1, username: 'test', role, fullName: 'Test User', locationCode: 'HQ', departmentCode: 'OPS' },
      selectedView
    }
  });
}

describe('DashboardShell', () => {
  it('displays user role', () => {
    const wrapper = mountShell('Administrator');
    expect(wrapper.text()).toContain('Administrator');
  });

  it('Administrator sees all menu items including User Management and Audit Logs', () => {
    const wrapper = mountShell('Administrator');
    const text = wrapper.text();
    expect(text).toContain('Dashboard');
    expect(text).toContain('Search');
    expect(text).toContain('Coordinator');
    expect(text).toContain('Data Ingestion');
    expect(text).toContain('Messages');
    expect(text).toContain('User Management');
    expect(text).toContain('Audit Logs');
  });

  it('Coordinator sees Dashboard, Search, Scheduling, Messages only', () => {
    const wrapper = mountShell('Coordinator');
    const text = wrapper.text();
    expect(text).toContain('Dashboard');
    expect(text).toContain('Search');
    expect(text).toContain('Scheduling');
    expect(text).toContain('Messages');
    expect(text).not.toContain('User Management');
    expect(text).not.toContain('Audit Logs');
    expect(text).not.toContain('Data Ingestion');
  });

  it('Data Engineer sees Data Ingestion but not User Management', () => {
    const wrapper = mountShell('Data Engineer');
    const text = wrapper.text();
    expect(text).toContain('Data Ingestion');
    expect(text).toContain('Messages');
    expect(text).not.toContain('User Management');
    expect(text).not.toContain('Audit Logs');
  });

  it('Inspector sees Inspections and Messages', () => {
    const wrapper = mountShell('Inspector');
    const text = wrapper.text();
    expect(text).toContain('Inspections');
    expect(text).toContain('Messages');
    expect(text).not.toContain('User Management');
  });

  it('Customer sees My Reports only', () => {
    const wrapper = mountShell('Customer');
    const text = wrapper.text();
    expect(text).toContain('My Reports');
    expect(text).not.toContain('User Management');
    expect(text).not.toContain('Messages');
  });

  it('emits logout on Sign Out click', async () => {
    const wrapper = mountShell('Administrator');
    const signOut = wrapper.findAll('button').find(b => b.text().includes('Sign Out'));
    expect(signOut).toBeTruthy();
    await signOut.trigger('click');
    expect(wrapper.emitted('logout')).toBeTruthy();
  });

  it('emits select-view when menu item clicked', async () => {
    const wrapper = mountShell('Administrator');
    const menuButtons = wrapper.findAll('ul button');
    expect(menuButtons.length).toBeGreaterThan(0);
    await menuButtons[1].trigger('click'); // Click second item (Search)
    expect(wrapper.emitted('select-view')).toBeTruthy();
    expect(wrapper.emitted('select-view')[0][0]).toBe('search');
  });

  it('highlights selected view with active styling', () => {
    const wrapper = mountShell('Administrator', 'dashboard');
    const dashboardBtn = wrapper.findAll('ul button').find(b => b.text() === 'Dashboard');
    expect(dashboardBtn.classes()).toContain('bg-slate-900');
  });

  it('Sign Out button exists for every role', () => {
    for (const role of ['Administrator', 'Coordinator', 'Inspector', 'Data Engineer', 'Customer']) {
      const wrapper = mountShell(role);
      const signOut = wrapper.findAll('button').find(b => b.text().includes('Sign Out'));
      expect(signOut).toBeTruthy();
    }
  });
});
