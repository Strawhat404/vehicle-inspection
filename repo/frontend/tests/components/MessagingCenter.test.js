import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('../../src/services/api.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn()
}));

import MessagingCenter from '../../src/components/MessagingCenter.vue';
import { apiGet, apiPost } from '../../src/services/api.js';

beforeEach(() => {
  apiGet.mockResolvedValue({ messages: [] });
  apiPost.mockResolvedValue({ exported: 0 });
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('MessagingCenter', () => {
  it('renders compose form fields', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Recipient User ID');
    expect(text).toContain('Type');
    expect(text).toContain('Subject');
    expect(text).toContain('Body');
  });

  it('has a Queue Message button', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const queueBtn = wrapper.findAll('button').find(b => b.text().includes('Queue Message'));
    expect(queueBtn).toBeTruthy();
  });

  it('has message type select with expected options', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Appointment Confirmation');
    expect(text).toContain('Report Announcement');
    expect(text).toContain('System Notice');
  });

  it('renders Inbox section heading', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Inbox');
  });

  it('renders inbox table headers', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Type');
    expect(text).toContain('Subject');
    expect(text).toContain('Body');
  });

  it('shows empty inbox state when no messages', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('No messages in your inbox.');
  });

  it('renders inbox messages from API response', async () => {
    apiGet.mockResolvedValue({
      messages: [
        { id: 1, message_type: 'system_notice', subject: 'Test Subject', body: 'Hello world' }
      ]
    });
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('system_notice');
    expect(wrapper.text()).toContain('Test Subject');
    expect(wrapper.text()).toContain('Hello world');
  });

  it('has an Export Manual Outbox button', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export Manual Outbox'));
    expect(exportBtn).toBeTruthy();
  });

  it('calls apiGet on /api/messages/inbox on mount', async () => {
    mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const inboxCalls = apiGet.mock.calls.filter(c => c[0].includes('/api/messages/inbox'));
    expect(inboxCalls.length).toBeGreaterThan(0);
  });

  it('clicking Queue Message calls apiPost on /api/messages/send after confirm', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const queueBtn = wrapper.findAll('button').find(b => b.text().includes('Queue Message'));
    await queueBtn.trigger('click');
    await flushPromises();
    const sendCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/messages/send'));
    expect(sendCalls.length).toBeGreaterThan(0);
  });

  it('does not call send API when user cancels confirm on Queue Message', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    apiPost.mockClear();
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const queueBtn = wrapper.findAll('button').find(b => b.text().includes('Queue Message'));
    await queueBtn.trigger('click');
    await flushPromises();
    const sendCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/messages/send'));
    expect(sendCalls.length).toBe(0);
  });

  it('clicking Export Outbox calls apiPost on /api/messages/outbox/export', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export Manual Outbox'));
    await exportBtn.trigger('click');
    await flushPromises();
    const exportCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/messages/outbox/export'));
    expect(exportCalls.length).toBeGreaterThan(0);
  });

  it('does not call export API when user cancels confirm on Export Outbox', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    apiPost.mockClear();
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export Manual Outbox'));
    await exportBtn.trigger('click');
    await flushPromises();
    const exportCalls = apiPost.mock.calls.filter(c => c[0].includes('/api/messages/outbox/export'));
    expect(exportCalls.length).toBe(0);
  });

  it('shows exported count notice after successful Export Outbox', async () => {
    apiPost.mockResolvedValue({ exported: 3 });
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export Manual Outbox'));
    await exportBtn.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Exported 3 payload(s).');
  });

  it('renders multiple inbox messages', async () => {
    apiGet.mockResolvedValue({
      messages: [
        { id: 1, message_type: 'appointment_confirmation', subject: 'Apt Confirmed', body: 'Your appt is confirmed' },
        { id: 2, message_type: 'report_announcement', subject: 'New Report', body: 'See attached report' }
      ]
    });
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('appointment_confirmation');
    expect(wrapper.text()).toContain('report_announcement');
    expect(wrapper.text()).toContain('Apt Confirmed');
    expect(wrapper.text()).toContain('New Report');
  });

  it('renders Messaging Center heading', async () => {
    const wrapper = mount(MessagingCenter, { props: { token: 'test-token' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Messaging Center');
  });
});
