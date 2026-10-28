import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, shouldRetryQuery } from '../client';

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
    text: vi
      .fn()
      .mockResolvedValue(body === undefined ? '' : JSON.stringify(body)),
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

  it('uploads FormData without setting Content-Type (browser sets boundary)', async () => {
    mockFetch.mockResolvedValue(mockResponse(201, { id: 's1', photo_url: '/uploads/wall.jpg' }));
    const form = new FormData();
    form.append('file', new File(['fake'], 'wall.jpg', { type: 'image/jpeg' }));

    const result = await api.upload<{ id: string }>('/configurator/sessions', form);

    expect(result.id).toBe('s1');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    // The header MUST NOT be set — the browser adds the multipart boundary
    // itself, and a manual header would break that.
    expect(init.headers?.['Content-Type']).toBeUndefined();
  });

  it('propagates 422 errors from upload with parsed body', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(422, { detail: 'Файл больше 20 МБ' }, false),
    );
    const form = new FormData();
    await expect(api.upload('/configurator/sessions', form)).rejects.toMatchObject({
      status: 422,
      detail: 'Файл больше 20 МБ',
    });
  });

  it('throws ApiError(502) on a 2xx response with an empty body', async () => {
    // Some proxies drop the upstream response body and deliver 200 with no
    // content; `JSON.parse` on an empty string would surface as a confusing
    // "Unexpected end of JSON input". Surface it as a retriable gateway
    // error so React Query's retry policy can recover.
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue(undefined),
      text: vi.fn().mockResolvedValue(''),
    });

    try {
      await api.get('/admin/panels');
      throw new Error('Expected api.get to throw on empty 2xx body');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(502);
      expect((err as ApiError).detail).toBe('Пустой ответ сервера');
    }
  });

  it('throws ApiError(502) when the 2xx body is not valid JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue(undefined),
      text: vi.fn().mockResolvedValue('not-json'),
    });

    try {
      await api.get('/admin/panels');
      throw new Error('Expected api.get to throw on invalid JSON body');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(502);
      expect((err as ApiError).detail).toBe('Некорректный ответ сервера');
    }
  });

  describe('shouldRetryQuery', () => {
    it('retries transient failures and stops after 2 attempts', () => {
      expect(shouldRetryQuery(0, new ApiError(502, 'gateway'))).toBe(true);
      expect(shouldRetryQuery(1, new TypeError('Failed to fetch'))).toBe(true);
      // Give up after 2 attempts regardless of error.
      expect(shouldRetryQuery(2, new ApiError(502, 'gateway'))).toBe(false);
      expect(shouldRetryQuery(3, new TypeError('Failed to fetch'))).toBe(false);
    });

    it('does not retry client errors (4xx)', () => {
      expect(shouldRetryQuery(0, new ApiError(401, 'Unauthorized'))).toBe(false);
      expect(shouldRetryQuery(0, new ApiError(403, 'Forbidden'))).toBe(false);
      expect(shouldRetryQuery(0, new ApiError(404, 'Not found'))).toBe(false);
    });
  });
});
