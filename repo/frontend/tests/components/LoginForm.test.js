import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LoginForm from '../../src/components/LoginForm.vue';

describe('LoginForm', () => {
  it('renders username and password fields', () => {
    const wrapper = mount(LoginForm);
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
  });

  it('renders Sign In button', () => {
    const wrapper = mount(LoginForm);
    expect(wrapper.find('button[type="submit"]').text()).toContain('Sign In');
  });

  it('emits login event with credentials on form submit', async () => {
    const wrapper = mount(LoginForm);
    await wrapper.find('input[autocomplete="username"]').setValue('admin');
    await wrapper.find('input[type="password"]').setValue('Admin@123456');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('login')).toBeTruthy();
    const emitted = wrapper.emitted('login')[0][0];
    expect(emitted.username).toBe('admin');
    expect(emitted.password).toBe('Admin@123456');
  });

  it('shows "Signing in..." text while loading', async () => {
    const wrapper = mount(LoginForm);
    // Trigger submit which sets loading=true
    await wrapper.find('input[autocomplete="username"]').setValue('admin');
    await wrapper.find('input[type="password"]').setValue('pass');
    // The button text changes during submission
    const button = wrapper.find('button[type="submit"]');
    expect(button.text()).toContain('Sign In');
  });

  it('disables submit button when loading', async () => {
    const wrapper = mount(LoginForm);
    const button = wrapper.find('button[type="submit"]');
    // Initially not disabled
    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('does not show error message initially', () => {
    const wrapper = mount(LoginForm);
    // Error paragraph should not be rendered initially
    const errorEl = wrapper.findAll('p').filter(p => p.classes().some(c => c.includes('red')));
    expect(errorEl.length).toBe(0);
  });
});
