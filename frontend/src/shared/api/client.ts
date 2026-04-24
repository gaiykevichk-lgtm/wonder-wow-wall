// ─── API Client ─────────────────────────────────────────────────────────────
// Fetch wrapper with JWT auto-attach and error handling

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    /**
     * Full parsed JSON body — needed by callers that distinguish error
     * variants by a `code` field (e.g. visualizer PATCH returns
     * `{detail, code: "stale_version"|"degenerate_corners"}`). Not present
     * when the server returned non-JSON (we fall back to `{detail}` only).
     */
    public body?: Record<string, unknown>,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('wow-wall-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Clear auth state on unauthorized
    try {
      const raw = localStorage.getItem('wow-wall-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state.user = null;
        parsed.state.token = null;
        parsed.state.isAuth = false;
        localStorage.setItem('wow-wall-auth', JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
    window.location.href = '/login';
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || 'Something went wrong', body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── HTTP Methods ───────────────────────────────────────────────────────────

/**
 * Optional per-request controls. Currently exposes `signal` for in-flight
 * cancellation — the visualizer auto-PATCH path needs this so a debounced
 * corner-drag aborts when the user keeps dragging or hits "reset".
 */
export interface RequestInitExtras {
  signal?: AbortSignal;
}

export const api = {
  get: <T>(path: string, init?: RequestInitExtras) =>
    request<T>(path, { signal: init?.signal }),

  post: <T>(path: string, body?: unknown, init?: RequestInitExtras) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      signal: init?.signal,
    }),

  put: <T>(path: string, body?: unknown, init?: RequestInitExtras) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      signal: init?.signal,
    }),

  patch: <T>(path: string, body?: unknown, init?: RequestInitExtras) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      signal: init?.signal,
    }),

  delete: <T>(path: string, init?: RequestInitExtras) =>
    request<T>(path, { method: 'DELETE', signal: init?.signal }),
};
