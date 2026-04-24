/**
 * Phase 5C — REST client for the visualizer bounded context.
 *
 * Why a hand-rolled module rather than `useMutation` hooks (the pattern used
 * for `auth`/`catalog`):
 *  - The autosave path is *imperative*, fired from inside zustand actions
 *    (`setPerspectiveCorners`, `setCalibration`) on a debounce timer. Hooks
 *    only fit React component lifecycles.
 *  - Each PATCH is in-flight cancellable via `AbortController` (D6 in plan):
 *    when the user keeps dragging a corner, the previous PATCH must be
 *    aborted to avoid out-of-order writes and a 409 storm.
 *  - The frontend distinguishes two error variants by `code`:
 *      `degenerate_corners` → silent retry-skip (intermediate drag state)
 *      `stale_version`      → trigger a "data changed elsewhere" toast and
 *                              force a re-load
 *    The shared `ApiError.body.code` carries this discriminant.
 *
 * The wire format is *snake_case* (matches backend DTOs); this module is the
 * single conversion point — callers in the store pass camelCase domain types
 * and get camelCase responses back.
 */

import { api, ApiError } from '../../../shared/api/client';
import type {
  PerspectiveCorners,
  ScaleCalibration,
} from '../model/types';

// ─── Wire types (snake_case, matching backend) ────────────────────────

interface WireCalibration {
  method: 'reference' | 'manual' | 'auto';
  pixels_per_cm: number;
  wall_width_cm?: number | null;
  wall_height_cm?: number | null;
}

interface WirePoint {
  x: number;
  y: number;
}

interface WireProjectResponse {
  id: string;
  name: string;
  photo_url: string;
  photo_width: number;
  photo_height: number;
  wall_mask_base64: string;
  calibration_pixels_per_cm: number;
  panels: unknown[];
  perspective_corners: WirePoint[] | null;
  placement_mode: string;
  created_at: string;
  updated_at: string;
  calibration: WireCalibration | null;
  perspective_auto_detected: boolean;
  calibration_auto_detected: boolean;
  version: number;
}

// ─── Camel-case façade returned to callers ────────────────────────────

export interface VisualizationProjectDTO {
  id: string;
  name: string;
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  wallMaskBase64: string;
  calibrationPixelsPerCm: number;
  perspectiveCorners: PerspectiveCorners | null;
  placementMode: string;
  createdAt: string;
  updatedAt: string;
  calibration: ScaleCalibration | null;
  perspectiveAutoDetected: boolean;
  calibrationAutoDetected: boolean;
  version: number;
  /** Panel payload — opaque on this seam; the store re-hydrates it. */
  panels: unknown[];
}

// ─── Discriminated error variants ─────────────────────────────────────

/**
 * Distinct from `ApiError` so callers can `catch (e) { if (e instanceof
 * StaleVersionError) … }`. Both wrap the same `ApiError` for stack-trace
 * fidelity.
 */
export class StaleVersionError extends Error {
  readonly serverVersion: number | undefined;
  constructor(detail: string, serverVersion?: number) {
    super(detail);
    this.name = 'StaleVersionError';
    this.serverVersion = serverVersion;
  }
}

export class DegenerateCornersError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'DegenerateCornersError';
  }
}

function rethrowVisualizerError(err: unknown): never {
  if (err instanceof ApiError) {
    const code = err.body?.code as string | undefined;
    if (err.status === 409 && code === 'stale_version') {
      const serverVersion = (err.body?.server_version as number | undefined) ?? undefined;
      throw new StaleVersionError(err.detail, serverVersion);
    }
    if (err.status === 422 && code === 'degenerate_corners') {
      throw new DegenerateCornersError(err.detail);
    }
  }
  throw err;
}

// ─── Wire ↔ DTO mappers ───────────────────────────────────────────────

function calibrationFromWire(w: WireCalibration | null): ScaleCalibration | null {
  if (!w) return null;
  return {
    method: w.method,
    pixelsPerCm: w.pixels_per_cm,
    wallWidthCm: w.wall_width_cm ?? undefined,
    wallHeightCm: w.wall_height_cm ?? undefined,
  };
}

function calibrationToWire(c: ScaleCalibration): WireCalibration {
  return {
    method: c.method,
    pixels_per_cm: c.pixelsPerCm,
    wall_width_cm: c.wallWidthCm ?? null,
    wall_height_cm: c.wallHeightCm ?? null,
  };
}

function cornersFromWire(w: WirePoint[] | null): PerspectiveCorners | null {
  if (!w || w.length !== 4) return null;
  return [
    { x: w[0]!.x, y: w[0]!.y },
    { x: w[1]!.x, y: w[1]!.y },
    { x: w[2]!.x, y: w[2]!.y },
    { x: w[3]!.x, y: w[3]!.y },
  ];
}

function projectFromWire(w: WireProjectResponse): VisualizationProjectDTO {
  return {
    id: w.id,
    name: w.name,
    photoUrl: w.photo_url,
    photoWidth: w.photo_width,
    photoHeight: w.photo_height,
    wallMaskBase64: w.wall_mask_base64,
    calibrationPixelsPerCm: w.calibration_pixels_per_cm,
    perspectiveCorners: cornersFromWire(w.perspective_corners),
    placementMode: w.placement_mode,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    calibration: calibrationFromWire(w.calibration),
    perspectiveAutoDetected: w.perspective_auto_detected,
    calibrationAutoDetected: w.calibration_auto_detected,
    version: w.version,
    panels: w.panels,
  };
}

// ─── Save / Load (full-scene) ────────────────────────────────────────

/**
 * Body shape for POST/PUT — wire-format snake_case. The store builds this
 * directly via `getProjectPayload()` to avoid a double conversion (camel →
 * snake here is a no-op when the source is already snake).
 */
export type SaveProjectBody = Record<string, unknown>;

export async function saveProject(body: SaveProjectBody): Promise<VisualizationProjectDTO> {
  const wire = await api.post<WireProjectResponse>('/visualizer/projects', body);
  return projectFromWire(wire);
}

export async function loadProject(projectId: string): Promise<VisualizationProjectDTO> {
  const wire = await api.get<WireProjectResponse>(`/visualizer/projects/${projectId}`);
  return projectFromWire(wire);
}

// ─── Partial PATCH endpoints ─────────────────────────────────────────

export interface UpdatePerspectiveOptions {
  signal?: AbortSignal;
}

/**
 * PATCH the four perspective corners. `corners=null` clears them on the server.
 *
 * Throws:
 *  - `DegenerateCornersError` on 422 — caller should *swallow* this. It means
 *    a debounced PATCH carried an intermediate drag state that flattened the
 *    quad. The next debounce will resend the user's final position.
 *  - `StaleVersionError` on 409 — caller should refetch and merge.
 *  - `ApiError` (or rejection) on transport errors / 4xx/5xx without a code.
 */
export async function updatePerspective(
  projectId: string,
  corners: PerspectiveCorners | null,
  version: number,
  options: UpdatePerspectiveOptions = {},
): Promise<VisualizationProjectDTO> {
  const body = {
    corners: corners
      ? corners.map((c) => ({ x: c.x, y: c.y }))
      : null,
    version,
  };
  try {
    const wire = await api.patch<WireProjectResponse>(
      `/visualizer/projects/${projectId}/perspective`,
      body,
      { signal: options.signal },
    );
    return projectFromWire(wire);
  } catch (err) {
    rethrowVisualizerError(err);
  }
}

export interface UpdateCalibrationOptions {
  signal?: AbortSignal;
}

export async function updateCalibration(
  projectId: string,
  calibration: ScaleCalibration,
  version: number,
  options: UpdateCalibrationOptions = {},
): Promise<VisualizationProjectDTO> {
  const body = {
    calibration: calibrationToWire(calibration),
    version,
  };
  try {
    const wire = await api.patch<WireProjectResponse>(
      `/visualizer/projects/${projectId}/calibration`,
      body,
      { signal: options.signal },
    );
    return projectFromWire(wire);
  } catch (err) {
    rethrowVisualizerError(err);
  }
}
