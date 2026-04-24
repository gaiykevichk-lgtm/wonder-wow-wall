/**
 * Scale Estimator — converts a detected reference object (outlet, door, …)
 * into a `ScaleCalibration` (`pixelsPerCm`).
 *
 * Phase 4 algorithmic core. **No ML dependencies** — the actual detection of
 * candidates lives in `referenceDetector.ts` behind a pluggable provider; this
 * module only does the geometry. Splitting them keeps the math unit-testable
 * without loading `onnxruntime-web`.
 *
 * Perspective handling
 * ────────────────────
 * If a `PerspectiveTransform` is supplied, the candidate bounding box is first
 * back-projected from the photo into the wall plane via `inverseTransformPoint`.
 * The reference dimension (width for outlets/switches, height for doors) is
 * then measured in **wall-plane pixels**, so `pixelsPerCm` is consistent with
 * how panels are placed on the warped wall surface.
 *
 * Without perspective, the screen-space bbox dimension is used directly. This
 * matches the behaviour of the existing manual calibration flow
 * (`applyCalibration` in the store).
 */

import type { Point, BoundingBox, ScaleCalibration } from '../model/types';
import type { PerspectiveTransform } from './perspectiveEngine';
import { inverseTransformPoint } from './perspectiveEngine';

// ─── Reference catalog ───────────────────────────────────────────────────────

/**
 * Known reference objects whose real-world size is approximately constant
 * across Russian residential interiors. Sizes are calibration-grade (median
 * across common manufacturers); consumers should treat the resulting
 * `pixelsPerCm` as an estimate, not gospel.
 */
export type ReferenceType = 'outlet' | 'switch' | 'door' | 'window' | 'baseboard';

/** Which side of the bbox carries the most stable real-world dimension. */
type ReferenceAxis = 'width' | 'height';

interface ReferenceSpec {
  /** Real-world size in centimetres of the chosen axis. */
  knownSizeCm: number;
  /** Which side of the bbox to measure. */
  axis: ReferenceAxis;
  /**
   * Soft trust score (0..1). Used as a priority hint for the UI when multiple
   * candidates are detected — outlets are extremely uniform, doors vary more.
   */
  trust: number;
}

export const REFERENCE_CATALOG: Record<ReferenceType, ReferenceSpec> = {
  // Russian double socket faceplate ≈ 80×80 mm
  outlet: { knownSizeCm: 8, axis: 'width', trust: 0.95 },
  // Standard light switch ≈ 80×80 mm
  switch: { knownSizeCm: 8, axis: 'width', trust: 0.9 },
  // Russian standard interior door 2050 mm tall (GOST 6629-88)
  door: { knownSizeCm: 205, axis: 'height', trust: 0.7 },
  // Window width varies a lot — kept for opportunistic use, low trust.
  window: { knownSizeCm: 140, axis: 'width', trust: 0.4 },
  // Baseboard / plinth height ≈ 10 cm (typical 70-120 mm)
  baseboard: { knownSizeCm: 10, axis: 'height', trust: 0.55 },
};

// ─── Public types ────────────────────────────────────────────────────────────

export interface ReferenceCandidate {
  type: ReferenceType;
  /** Bounding box in **photo (screen) coordinates**, before any perspective unwarp. */
  bbox: BoundingBox;
  /** Detector confidence (0..1). */
  confidence: number;
}

/**
 * Result of `estimateScaleFromReference`. Mirrors `ScaleCalibration` from
 * `model/types.ts` but tags the source so the UI can phrase the banner
 * ("Масштаб определён по розетке"). The store is responsible for stripping
 * `source` when persisting (it stores only the `ScaleCalibration` shape).
 */
export interface EstimatedScale {
  calibration: ScaleCalibration;
  source: ReferenceType;
  /** Combined detector × catalog trust (0..1). */
  trust: number;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

function bboxCorners(b: BoundingBox): { tl: Point; tr: Point; br: Point; bl: Point } {
  return {
    tl: { x: b.x, y: b.y },
    tr: { x: b.x + b.width, y: b.y },
    br: { x: b.x + b.width, y: b.y + b.height },
    bl: { x: b.x, y: b.y + b.height },
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Measure the chosen axis on the bbox, optionally after back-projecting it
 * into the wall plane. For a quad in wall plane we average the two parallel
 * sides — this dampens the bias from the candidate not being exactly
 * axis-aligned in the projection.
 */
function measureAxisLengthPx(
  bbox: BoundingBox,
  axis: ReferenceAxis,
  perspective: PerspectiveTransform | undefined,
): number {
  if (!perspective) {
    return axis === 'width' ? bbox.width : bbox.height;
  }
  const c = bboxCorners(bbox);
  const tl = inverseTransformPoint(perspective, c.tl);
  const tr = inverseTransformPoint(perspective, c.tr);
  const br = inverseTransformPoint(perspective, c.br);
  const bl = inverseTransformPoint(perspective, c.bl);
  if (axis === 'width') {
    return 0.5 * (distance(tl, tr) + distance(bl, br));
  }
  return 0.5 * (distance(tl, bl) + distance(tr, br));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a detected reference into a `ScaleCalibration`. Returns `null` if
 * the candidate is unusable (zero / negative axis length, unknown type, NaN
 * after projection — typically a bbox that lies outside the wall quad).
 *
 * Caller is responsible for picking *which* candidate to feed in (e.g. by
 * `confidence × catalog.trust`) — this function is intentionally pure and
 * stateless.
 */
export function estimateScaleFromReference(
  candidate: ReferenceCandidate,
  perspective?: PerspectiveTransform,
): EstimatedScale | null {
  const spec = REFERENCE_CATALOG[candidate.type];
  // Defensive: catalog should be exhaustive for `ReferenceType` but a future
  // detector might emit an unmapped class via `as` casts.
  if (!spec) return null;

  const lengthPx = measureAxisLengthPx(candidate.bbox, spec.axis, perspective);
  if (!Number.isFinite(lengthPx) || lengthPx <= 0) return null;

  const pixelsPerCm = lengthPx / spec.knownSizeCm;
  if (!Number.isFinite(pixelsPerCm) || pixelsPerCm <= 0) return null;

  return {
    calibration: { method: 'auto', pixelsPerCm },
    source: candidate.type,
    trust: spec.trust * clamp01(candidate.confidence),
  };
}

/**
 * Pick the most trustworthy candidate from a list. Returns `null` for empty
 * input. Tie-breaks by detector confidence then by bbox area (larger = less
 * affected by sub-pixel detector jitter).
 */
export function pickBestCandidate(
  candidates: readonly ReferenceCandidate[],
): ReferenceCandidate | null {
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestScore = scoreCandidate(best);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = scoreCandidate(c);
    if (
      s > bestScore ||
      (s === bestScore && c.confidence > best.confidence) ||
      (s === bestScore &&
        c.confidence === best.confidence &&
        bboxArea(c.bbox) > bboxArea(best.bbox))
    ) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

function scoreCandidate(c: ReferenceCandidate): number {
  const spec = REFERENCE_CATALOG[c.type];
  if (!spec) return 0;
  return spec.trust * clamp01(c.confidence);
}

function bboxArea(b: BoundingBox): number {
  return Math.max(0, b.width) * Math.max(0, b.height);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
