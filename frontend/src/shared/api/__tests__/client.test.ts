import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../client';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResponse = (status: number, body: unknown, ok = true) => ({
    ok: ok && status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue(body),
  });

  it('makes GET request with correct URL', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { data: 'test' }));

    const result = await api.get('/designs');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/designs',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({ data: 'test' });
  });

  it('makes POST request with body', async () => {
    const body = { name: 'test' };
    mockFetch.mockResolvedValue(mockResponse(201, { id: '1' }));

    const result = await api.post('/orders', body);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
    expect(result).toEqual({ id: '1' });
  });

  it('makes PATCH request', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { name: 'updated' }));

    await api.patch('/auth/me', { name: 'Updated' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('makes DELETE request', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { status: 'deleted' }));

    await api.delete('/projects/123');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('attaches JWT token from localStorage', async () => {
    localStorage.setItem(
      'wow-wall-auth',
      JSON.stringify({ state: { token: 'test-jwt-token', user: {}, isAuth: true } }),
    );

    mockFetch.mockResolvedValue(mockResponse(200, {}));

    await api.get('/auth/me');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
      }),
    );
  });

  it('does not attach token when not authenticated', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}));

    await api.get('/designs');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue({ detail: 'Email already exists' }),
    });

    await expect(api.post('/auth/register', {})).rejects.toThrow(ApiError);

    try {
      await api.post('/auth/register', {});
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).detail).toBe('Email already exists');
    }
  });

  it('handles 401 by clearing auth state and redirecting', async () => {
    // Set auth state
    localStorage.setItem(
      'wow-wall-auth',
      JSON.stringify({ state: { token: 'old-token', user: { id: '1' }, isAuth: true } }),
    );

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: vi.fn().mockResolvedValue({ detail: 'Unauthorized' }),
    });

    await expect(api.get('/auth/me')).rejects.toThrow(ApiError);

    // Check auth was cleared in localStorage
    const stored = JSON.parse(localStorage.getItem('wow-wall-auth')!);
    expect(stored.state.token).toBeNull();
    expect(stored.state.isAuth).toBe(false);

    // Check redirect
    expect(window.location.href).toBe('/login');

    // Restore
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('handles PUT request', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { updated: true }));

    await api.put('/projects/1', { name: 'updated' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'updated' }),
      }),
    );
  });
});
