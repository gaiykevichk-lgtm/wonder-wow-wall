// ─── API Client ─────────────────────────────────────────────────────────────
// Fetch wrapper with JWT auto-attach and error handling

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
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
    throw new ApiError(res.status, body.detail || 'Something went wrong');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── HTTP Methods ───────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
