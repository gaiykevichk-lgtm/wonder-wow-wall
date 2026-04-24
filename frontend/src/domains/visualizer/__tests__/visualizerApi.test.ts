/**
 * Phase 5C — visualizerApi.ts contract tests.
 *
 * Mocks the global `fetch` (same pattern as `shared/api/__tests__/client.test.ts`).
 * Validates:
 *  - happy-path round-trips (snake↔camel conversion, version bump propagated)
 *  - `409 + code:stale_version` → `StaleVersionError`
 *  - `422 + code:degenerate_corners` → `DegenerateCornersError`
 *  - generic 4xx without code → bare `ApiError`
 *  - AbortSignal threads through to fetch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from '../../../shared/api/client';
import {
  DegenerateCornersError,
  StaleVersionError,
  saveProject,
  updateCalibration,
  updatePerspective,
} from '../lib/visualizerApi';
import type { PerspectiveCorners, ScaleCalibration } from '../model/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const okResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'OK',
  json: vi.fn().mockResolvedValue(body),
});

const errorResponse = (status: number, body: unknown) => ({
  ok: false,
  status,
  statusText: 'ERR',
  json: vi.fn().mockResolvedValue(body),
});

const wireProject = {
  id: 'proj-1',
  name: 'Test',
  photo_url: 'data:img',
  photo_width: 800,
  photo_height: 600,
  wall_mask_base64: '',
  calibration_pixels_per_cm: 6.5,
  panels: [],
  perspective_corners: [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 100 }, { x: 0, y: 100 },
  ],
  placement_mode: 'manual',
  created_at: '2026-04-24T00:00:00',
  updated_at: '2026-04-24T00:00:00',
  calibration: {
    method: 'reference' as const,
    pixels_per_cm: 6.5,
    wall_width_cm: 300,
    wall_height_cm: null,
  },
  perspective_auto_detected: true,
  calibration_auto_detected: false,
  version: 7,
};

const square: PerspectiveCorners = [
  { x: 0, y: 0 }, { x: 100, y: 0 },
  { x: 100, y: 100 }, { x: 0, y: 100 },
];

const cal: ScaleCalibration = {
  method: 'manual',
  pixelsPerCm: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Happy paths ────────────────────────────────────────────────────

describe('saveProject', () => {
  it('POSTs to /api/visualizer/projects and returns camelCase DTO', async () => {
    mockFetch.mockResolvedValue(okResponse(201, wireProject));

    const result = await saveProject({ name: 'Test' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/visualizer/projects',
      expect.objectContaining({ method: 'POST' }),
    );
    // Snake → camel mapping
    expect(result.calibrationPixelsPerCm).toBe(6.5);
    expect(result.perspectiveAutoDetected).toBe(true);
    expect(result.calibrationAutoDetected).toBe(false);
    expect(result.version).toBe(7);
    // Calibration nested mapping with optional wall_height_cm = null
    expect(result.calibration).toEqual({
      method: 'reference',
      pixelsPerCm: 6.5,
      wallWidthCm: 300,
      wallHeightCm: undefined,
    });
    // Corners array → tuple
    expect(result.perspectiveCorners).toHaveLength(4);
  });
});

describe('updatePerspective happy path', () => {
  it('PATCHes corners with version and snake-case body', async () => {
    mockFetch.mockResolvedValue(okResponse(200, { ...wireProject, version: 8 }));

    const result = await updatePerspective('proj-1', square, 7);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/visualizer/projects/proj-1/perspective',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          corners: [
            { x: 0, y: 0 }, { x: 100, y: 0 },
            { x: 100, y: 100 }, { x: 0, y: 100 },
          ],
          version: 7,
        }),
      }),
    );
    expect(result.version).toBe(8);
  });

  it('serializes corners=null when clearing', async () => {
    mockFetch.mockResolvedValue(okResponse(200, { ...wireProject, perspective_corners: null }));

    await updatePerspective('proj-1', null, 7);

    const call = mockFetch.mock.calls[0]!;
    const body = JSON.parse(call[1].body as string);
    expect(body.corners).toBeNull();
  });

  it('threads AbortSignal through to fetch', async () => {
    mockFetch.mockResolvedValue(okResponse(200, wireProject));
    const ctrl = new AbortController();

    await updatePerspective('proj-1', square, 7, { signal: ctrl.signal });

    const call = mockFetch.mock.calls[0]!;
    expect(call[1].signal).toBe(ctrl.signal);
  });
});

describe('updateCalibration happy path', () => {
  it('PATCHes calibration body in wire snake-case', async () => {
    mockFetch.mockResolvedValue(okResponse(200, { ...wireProject, version: 8 }));

    await updateCalibration('proj-1', cal, 7);

    const body = JSON.parse((mockFetch.mock.calls[0]![1].body) as string);
    // Wire format: snake_case + null-not-undefined for missing optional fields
    expect(body).toEqual({
      calibration: {
        method: 'manual',
        pixels_per_cm: 8,
        wall_width_cm: null,
        wall_height_cm: null,
      },
      version: 7,
    });
  });
});

// ─── Discriminated error mapping ────────────────────────────────────

describe('updatePerspective error variants', () => {
  it('throws DegenerateCornersError on 422+code:degenerate_corners', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(422, { detail: 'Degenerate quad', code: 'degenerate_corners' }),
    );
    await expect(updatePerspective('proj-1', square, 7)).rejects.toBeInstanceOf(
      DegenerateCornersError,
    );
  });

  it('throws StaleVersionError on 409+code:stale_version', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(409, { detail: 'stale', code: 'stale_version', server_version: 12 }),
    );
    let caught: unknown;
    await updatePerspective('proj-1', square, 7).catch((e) => { caught = e; });
    expect(caught).toBeInstanceOf(StaleVersionError);
    expect((caught as StaleVersionError).serverVersion).toBe(12);
  });

  it('rethrows bare ApiError when 422 has no code (e.g. Pydantic validation)', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(422, { detail: [{ msg: 'value missing' }] }),
    );
    await expect(updatePerspective('proj-1', square, 7)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('updateCalibration error variants', () => {
  it('also maps 409 to StaleVersionError', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(409, { detail: 'stale', code: 'stale_version' }),
    );
    await expect(updateCalibration('proj-1', cal, 7)).rejects.toBeInstanceOf(
      StaleVersionError,
    );
  });
});
