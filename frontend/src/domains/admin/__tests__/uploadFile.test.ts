/**
 * Phase 6 — `uploadFile()` helper tests.
 *
 * We mock global `XMLHttpRequest` so the suite runs in pure jsdom without
 * touching the network. The fake records `open()` / header / body calls
 * and lets the test trigger `load`/`error`/`abort`/progress events on
 * demand — that's the only way to assert the contract (auth header,
 * `multipart/form-data` boundary auto-set, `{detail, code}` envelope
 * parsing, AbortSignal wiring).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadFile, UploadError } from '../lib/uploadFile';

// ─── XHR fake ────────────────────────────────────────────────────────

interface FakeUpload {
  onprogress: ((ev: ProgressEvent) => void) | null;
}

class FakeXHR {
  static instances: FakeXHR[] = [];

  // Recorded inputs for assertions
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: FormData | null = null;
  aborted = false;

  // Mocked response
  status = 0;
  statusText = '';
  responseText = '';

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  upload: FakeUpload = { onprogress: null };

  constructor() {
    FakeXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }

  send(body: FormData) {
    this.body = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  // Test helpers — invoked from inside `it` blocks.
  succeed(status: number, body: object) {
    this.status = status;
    this.statusText = 'OK';
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }

  fail(status: number, body: object | string) {
    this.status = status;
    this.statusText = 'Error';
    this.responseText =
      typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }

  networkError() {
    this.onerror?.();
  }

  emitProgress(loaded: number, total: number) {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent);
  }
}

// ─── Wiring ──────────────────────────────────────────────────────────

const realXHR = global.XMLHttpRequest;

beforeEach(() => {
  FakeXHR.instances = [];
  // Cast through unknown — the fake only implements the surface our
  // helper actually uses, not the full XMLHttpRequest interface.
  global.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;

  // Auth-store happy-path: token present so we can assert it ends up on
  // the request. Individual tests override with `localStorage.clear()`
  // when they need the unauthenticated path.
  localStorage.setItem(
    'wow-wall-auth',
    JSON.stringify({ state: { token: 'test-jwt-123' } }),
  );
});

afterEach(() => {
  global.XMLHttpRequest = realXHR;
  localStorage.clear();
  vi.restoreAllMocks();
});

function makeFile(name = 'panel.jpg', type = 'image/jpeg', size = 1024) {
  // Real `File` so multipart bookkeeping (size/type) is honest.
  return new File([new Uint8Array(size)], name, { type });
}

// ─── Request shape ───────────────────────────────────────────────────

describe('uploadFile request shape', () => {
  it('POSTs to /api/admin/media with purpose query param', async () => {
    const promise = uploadFile({
      file: makeFile(),
      purpose: 'PANEL_PHOTO',
    });
    const xhr = FakeXHR.instances[0];
    xhr.succeed(201, {
      id: 'a1', path: 'PANEL_PHOTO/a1.jpg', url: '/uploads/PANEL_PHOTO/a1.jpg',
      mime: 'image/jpeg', size_bytes: 1024, original_name: 'panel.jpg',
      uploaded_by: 'admin-1', purpose: 'PANEL_PHOTO',
      uploaded_at: '2026-04-25T10:00:00Z',
    });
    await promise;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/admin/media?purpose=PANEL_PHOTO');
  });

  it('attaches Authorization Bearer header from localStorage', async () => {
    const promise = uploadFile({
      file: makeFile(), purpose: 'MISC',
    });
    const xhr = FakeXHR.instances[0];
    xhr.succeed(201, {
      id: 'a', path: 'p', url: '/u/p', mime: 'image/png',
      size_bytes: 1, original_name: 'x', uploaded_by: 'a',
      purpose: 'MISC', uploaded_at: 'now',
    });
    await promise;
    expect(xhr.headers['Authorization']).toBe('Bearer test-jwt-123');
  });

  it('skips Authorization header when no token is stored', async () => {
    localStorage.clear();
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.succeed(201, {
      id: 'a', path: 'p', url: '/u/p', mime: 'image/png',
      size_bytes: 1, original_name: 'x', uploaded_by: 'a',
      purpose: 'MISC', uploaded_at: 'now',
    });
    await promise;
    expect(xhr.headers['Authorization']).toBeUndefined();
  });

  it('does NOT manually set Content-Type (browser sets multipart boundary)', async () => {
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.succeed(201, {
      id: 'a', path: 'p', url: '/u/p', mime: 'image/png',
      size_bytes: 1, original_name: 'x', uploaded_by: 'a',
      purpose: 'MISC', uploaded_at: 'now',
    });
    await promise;
    expect(xhr.headers['Content-Type']).toBeUndefined();
  });

  it('sends the file under the "file" form field', async () => {
    const file = makeFile('hello.png', 'image/png', 32);
    const promise = uploadFile({ file, purpose: 'BANNER' });
    const xhr = FakeXHR.instances[0];
    xhr.succeed(201, {
      id: 'a', path: 'p', url: '/u/p', mime: 'image/png',
      size_bytes: 1, original_name: 'x', uploaded_by: 'a',
      purpose: 'BANNER', uploaded_at: 'now',
    });
    await promise;
    expect(xhr.body).toBeInstanceOf(FormData);
    const sent = xhr.body!.get('file');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('hello.png');
  });
});

// ─── Happy path ──────────────────────────────────────────────────────

describe('uploadFile happy path', () => {
  it('resolves with the parsed asset on 2xx', async () => {
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.succeed(201, {
      id: 'asset-99',
      path: 'MISC/asset-99.jpg',
      url: '/uploads/MISC/asset-99.jpg',
      mime: 'image/jpeg',
      size_bytes: 4242,
      original_name: 'real.jpg',
      uploaded_by: 'admin-1',
      purpose: 'MISC',
      uploaded_at: '2026-04-25T12:34:56Z',
    });
    const asset = await promise;
    expect(asset.id).toBe('asset-99');
    expect(asset.url).toBe('/uploads/MISC/asset-99.jpg');
  });

  it('accepts any 2xx, not just 201 (forward-compat with 200)', async () => {
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.succeed(200, {
      id: 'a', path: 'p', url: '/u/p', mime: 'image/png',
      size_bytes: 1, original_name: 'x', uploaded_by: 'a',
      purpose: 'MISC', uploaded_at: 'now',
    });
    await expect(promise).resolves.toBeDefined();
  });

  it('drives onProgress with fraction in [0,1]', async () => {
    const onProgress = vi.fn();
    const promise = uploadFile({
      file: makeFile(), purpose: 'MISC', onProgress,
    });
    const xhr = FakeXHR.instances[0];
    xhr.emitProgress(0, 1000);
    xhr.emitProgress(500, 1000);
    xhr.emitProgress(1000, 1000);
    xhr.succeed(201, {
      id: 'a', path: 'p', url: '/u/p', mime: 'image/png',
      size_bytes: 1000, original_name: 'x', uploaded_by: 'a',
      purpose: 'MISC', uploaded_at: 'now',
    });
    await promise;
    expect(onProgress).toHaveBeenCalledWith(0);
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(onProgress).toHaveBeenCalledWith(1);
  });
});

// ─── Error envelope ──────────────────────────────────────────────────

describe('uploadFile error envelope', () => {
  it('parses {detail, code} on 413 media_too_large', async () => {
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.fail(413, { detail: 'too big', code: 'media_too_large' });
    await expect(promise).rejects.toMatchObject({
      status: 413,
      detail: 'too big',
      code: 'media_too_large',
    });
  });

  it('parses {detail, code} on 415 media_invalid_mime', async () => {
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.fail(415, { detail: 'bad mime', code: 'media_invalid_mime' });
    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.status).toBe(415);
    expect(err.code).toBe('media_invalid_mime');
  });

  it('falls back to status text when body is non-JSON', async () => {
    // nginx 502 — bare HTML page, no envelope. Helper should still
    // surface a usable error rather than crashing the parser.
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.fail(502, '<html>bad gateway</html>');
    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.status).toBe(502);
    expect(err.code).toBeNull();
  });

  it('emits status=0 + code=null on network error', async () => {
    const promise = uploadFile({ file: makeFile(), purpose: 'MISC' });
    const xhr = FakeXHR.instances[0];
    xhr.networkError();
    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.status).toBe(0);
    expect(err.code).toBeNull();
  });
});

// ─── Cancellation ────────────────────────────────────────────────────

describe('uploadFile cancellation', () => {
  it('aborts in-flight request when signal fires', async () => {
    const ctrl = new AbortController();
    const promise = uploadFile({
      file: makeFile(), purpose: 'MISC', signal: ctrl.signal,
    });
    const xhr = FakeXHR.instances[0];
    ctrl.abort();
    expect(xhr.aborted).toBe(true);
    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.code).toBe('aborted');
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const promise = uploadFile({
      file: makeFile(), purpose: 'MISC', signal: ctrl.signal,
    });
    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.code).toBe('aborted');
    // The XHR instance is still constructed (helper opens it before the
    // signal check), but `send()` should not have been called — the
    // abort short-circuits the request.
    const xhr = FakeXHR.instances[0];
    expect(xhr.body).toBeNull();
  });
});
