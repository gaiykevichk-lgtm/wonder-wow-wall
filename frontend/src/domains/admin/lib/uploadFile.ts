/**
 * Phase 6 — XHR-based upload helper with onProgress.
 *
 * Why XMLHttpRequest and not `fetch()`:
 *   `fetch()` only resolves once the response is in — it doesn't expose
 *   request body progress. The admin UI needs a real progress bar (10MB
 *   panel photos take a noticeable second on slow connections), so we
 *   reach for `XMLHttpRequest.upload.onprogress`. Once `fetch` ships
 *   `Request.duplex: 'half'` + a streaming `body` everywhere, this can
 *   collapse back to a one-liner — until then, XHR is the path of least
 *   surprise.
 *
 * Auth strategy mirrors `shared/api/client.ts`: read the JWT from the
 * persisted Zustand auth store. We re-read on every call (NOT cache at
 * module load) because the user may log in/out during the session — a
 * stale token would surface as a confusing 401 mid-upload.
 *
 * Cancellation: callers pass an `AbortSignal`. We `xhr.abort()` on
 * `signal.aborted` — same UX guarantee as the rest of the API client
 * (the visualizer's debounced PATCH established this contract).
 *
 * Error envelope: matches the backend `{detail, code}` flat shape that
 * `media_too_large_handler` and friends emit. We do NOT throw a generic
 * `Error` — the UI branches on `code` to render specific messages
 * ("Файл слишком большой (макс 10 МБ)" vs "Неподдерживаемый формат").
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface MediaAssetResponse {
  id: string;
  path: string;
  url: string;
  mime: string;
  size_bytes: number;
  original_name: string;
  uploaded_by: string;
  purpose: string;
  uploaded_at: string;
}

export type MediaPurpose = 'DESIGN_PREVIEW' | 'PANEL_PHOTO' | 'BANNER' | 'MISC';

export interface UploadFileOptions {
  file: File;
  purpose: MediaPurpose;
  /**
   * 0..1 — fraction of bytes uploaded. Fires on every XHR progress event;
   * may be called many times. Throttling is the caller's responsibility
   * (AntD's progress bar absorbs high-frequency updates fine).
   */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export class UploadError extends Error {
  // `status`, `detail`, `code` are declared as plain fields (not
  // constructor-parameter properties) because `tsconfig.app.json` enables
  // `erasableSyntaxOnly`, which forbids the param-property shorthand.
  status: number;
  detail: string;
  /**
   * Backend `code` from the `{detail, code}` envelope. `null` when the
   * server returned non-JSON or a 5xx without our envelope (network
   * errors, nginx 502, etc.) — callers must handle the null case.
   */
  code: string | null;

  constructor(status: number, detail: string, code: string | null) {
    super(detail);
    this.name = 'UploadError';
    this.status = status;
    this.detail = detail;
    this.code = code;
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

/**
 * Upload a single file via `multipart/form-data` to
 * `POST /api/admin/media?purpose=…`.
 *
 * Returns the `MediaAssetResponse` so callers can pipe the new `path`
 * straight into the parent form (e.g. `Design.image_path`). On any
 * non-2xx, throws `UploadError` carrying the parsed `{detail, code}` so
 * the UI can branch.
 */
export function uploadFile({
  file,
  purpose,
  onProgress,
  signal,
}: UploadFileOptions): Promise<MediaAssetResponse> {
  return new Promise<MediaAssetResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Query-string `purpose` matches the backend signature
    // (`purpose: MediaPurpose = Query(...)`); the multipart body is
    // just the file. See backend `admin/media.py` for the rationale.
    const url = `${API_BASE_URL}/admin/media?purpose=${encodeURIComponent(purpose)}`;
    xhr.open('POST', url);

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Do NOT set Content-Type — the browser must set the
    // `multipart/form-data; boundary=...` header automatically. Setting
    // it manually drops the boundary and the server can't parse the body.

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (ev: ProgressEvent) => {
        if (ev.lengthComputable && ev.total > 0) {
          onProgress(ev.loaded / ev.total);
        }
      };
    }

    xhr.onload = () => {
      // 2xx → resolve with the parsed body. We accept any 2xx (POST
      // returns 201 today; future PUT-style replace would be 200) so a
      // backend status tweak doesn't silently break this path.
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MediaAssetResponse);
        } catch (e) {
          reject(new UploadError(xhr.status, 'Invalid JSON in response', null));
        }
        return;
      }
      // Error path — try to parse the `{detail, code}` envelope. If the
      // server returned non-JSON (nginx 502, 504), fall back to status
      // text so the user sees *something* meaningful.
      let detail = xhr.statusText || 'Upload failed';
      let code: string | null = null;
      try {
        const body = JSON.parse(xhr.responseText) as {
          detail?: string;
          code?: string;
        };
        if (typeof body.detail === 'string') detail = body.detail;
        if (typeof body.code === 'string') code = body.code;
      } catch {
        // Non-JSON body — keep the status-text fallback.
      }
      reject(new UploadError(xhr.status, detail, code));
    };

    xhr.onerror = () => {
      // Network-level failure (CORS, DNS, dropped connection). No
      // response body to parse — surface a synthetic envelope so callers
      // can still pattern-match.
      reject(new UploadError(0, 'Network error during upload', null));
    };

    xhr.onabort = () => {
      // Caller cancelled via AbortSignal; surface a distinct code so the
      // UI can suppress error toasts for user-initiated aborts.
      reject(new UploadError(0, 'Upload aborted', 'aborted'));
    };

    if (signal) {
      if (signal.aborted) {
        // Already aborted before we sent — short-circuit.
        reject(new UploadError(0, 'Upload aborted', 'aborted'));
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    const fd = new FormData();
    fd.append('file', file, file.name);
    xhr.send(fd);
  });
}
