import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mock setup - top-level await requires the file to be an ES module
const apiModule = await import('../../src/services/api.js');
const { apiGet, apiPost, apiPut, login, me, logout } = apiModule;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({})
  });
});

describe('api.js service', () => {
  it('apiGet sends GET with auth headers', async () => {
    await apiGet('/test', 'my-token');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe('Bearer my-token');
    expect(opts.headers['X-CSRF-Token']).toBe('my-token');
  });

  it('apiPost sends POST with JSON body and auth headers', async () => {
    await apiPost('/test', 'tok', { key: 'val' });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ key: 'val' }));
    expect(opts.headers.Authorization).toBe('Bearer tok');
  });

  it('apiPut sends PUT with auth headers', async () => {
    await apiPut('/test', 'tok', { a: 1 });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('PUT');
    expect(opts.headers.Authorization).toBe('Bearer tok');
  });

  it('apiPut sends correct body', async () => {
    await apiPut('/test', 'tok', { a: 1 });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('login posts to /api/auth/login without auth headers', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ token: 'abc' }) });
    const result = await login('admin', 'pass');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/auth/login');
    expect(opts.method).toBe('POST');
    expect(result.token).toBe('abc');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' })
    });
    await expect(apiGet('/test', 'tok')).rejects.toThrow('Unauthorized');
  });

  it('includes Content-Type application/json', async () => {
    await apiGet('/test', 'tok');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('login sends no auth headers since token is empty string', async () => {
    await login('user', 'pass');
    const [, opts] = mockFetch.mock.calls[0];
    // authHeaders returns empty object when token is falsy
    expect(opts.headers.Authorization).toBeUndefined();
    expect(opts.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('me() calls /api/auth/me with token', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ user: { id: 1 } }) });
    const result = await me('my-token');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/auth/me');
    expect(opts.headers.Authorization).toBe('Bearer my-token');
    expect(result.user.id).toBe(1);
  });

  it('logout() calls /api/auth/logout with token', async () => {
    await logout('my-token');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/auth/logout');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer my-token');
  });

  it('throws with error message from response body on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Access denied' })
    });
    await expect(apiPost('/secure', 'tok', {})).rejects.toThrow('Access denied');
  });

  it('throws with fallback message when response body has no error field', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({})
    });
    await expect(apiGet('/broken', 'tok')).rejects.toThrow('Request failed: 500');
  });

  it('apiGet constructs URL with API base prepended', async () => {
    await apiGet('/api/search/vehicles', 'tok');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/search/vehicles');
  });

  it('apiPost sends empty object body when no payload given', async () => {
    await apiPost('/test', 'tok');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBe(JSON.stringify({}));
  });

  it('apiPut sends empty object body when no payload given', async () => {
    await apiPut('/test', 'tok');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBe(JSON.stringify({}));
  });
});
