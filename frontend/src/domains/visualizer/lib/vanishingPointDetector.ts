/**
 * Vanishing-point based wall corner auto-detection.
 *
 * Pure-JS algorithmic core: takes a set of 2-D line segments (extracted by
 * ANY upstream provider — OpenCV.js LSD in production, synthetic fixtures in
 * tests) plus the wall mask, and returns the 4 wall corners in photo
 * coordinates with a confidence score. **No OpenCV dependency**, so this can
 * be unit-tested without a WASM round-trip.
 *
 * Pipeline (per Phase 3 of PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO):
 *   1. Drop lines that don't lie on the wall mask (≥80% of length inside).
 *   2. Cluster lines by orientation in [0°, 180°). Expect exactly 2 dominant
 *      directions (≈horizontal + ≈vertical for an axis-aligned wall).
 *      ≥3 strong directions → multi-plane scene → bail.
 *   3. RANSAC each cluster to find its vanishing point: candidate VPs are
 *      pair-intersections; score = inlier count by line-to-point distance.
 *   4. Pick the most-extreme inlier line on each side of each cluster as the
 *      4 wall edges; intersect them pairwise → 4 corners (TL, TR, BR, BL).
 *   5. Confidence = inlier coverage × cluster strength × corners-inside-mask
 *      ratio. Anything < 0.6 → return `low-confidence` so the UI prompts
 *      manual setup instead of guessing.
 *
 * Coordinates are always in **photo pixels**. Callers that supply lines from
 * a downsampled mask (e.g. SegFormer 512×512 vs photo 4032×3024) MUST
 * upscale before calling — the detector does not rescale, see [T4] in the
 * plan.
 */

import type { Point, WallMask, PerspectiveCorners } from '../model/types';

/** A 2-D line segment. */
export interface Line {
  p1: Point;
  p2: Point;
}

export interface DetectInput {
  lines: Line[];
  mask: WallMask;
  photoSize: { width: number; height: number };
}

export type DetectResult =
  | { ok: true; corners: PerspectiveCorners; confidence: number }
  | { ok: false; reason: 'low-confidence' | 'multi-plane' | 'too-few-lines' };

/**
 * Pluggable line-source. In production it wraps OpenCV.js LSD running inside
 * `cvWorkerHost`. In tests it returns a hand-crafted `Line[]`.
 */
export type LineProvider = (input: {
  imageUrl: string;
  mask: WallMask;
  photoSize: { width: number; height: number };
}) => Promise<Line[]>;

// ─── Tunables ────────────────────────────────────────────────────────────────

/** A line is on-wall if at least this fraction of its length is inside the mask. */
const ON_WALL_RATIO = 0.8;
/** Samples along a line when checking on-wall coverage. */
const COVERAGE_SAMPLES = 20;
/** Width of an angle histogram bin in degrees. 180° / 18 = 10° per bin. */
const ANGLE_BIN_DEG = 10;
const NUM_ANGLE_BINS = 180 / ANGLE_BIN_DEG;
/** A cluster is "strong" if its bin holds ≥ this fraction of all on-wall lines. */
const STRONG_CLUSTER_FRAC = 0.15;
/** Inlier distance (px) from a candidate VP to a line's infinite extension. */
const RANSAC_INLIER_DIST = 8;
/** RANSAC iterations per cluster. Bounded; cluster sizes are tiny (≤ a few hundred). */
const RANSAC_ITERS = 200;
/** Minimum total on-wall lines required to even attempt detection. */
const MIN_LINES = 6;
/** Minimum inliers per cluster required for a usable VP. */
const MIN_CLUSTER_INLIERS = 3;
/** Confidence floor below which we report `low-confidence`. */
const CONFIDENCE_FLOOR = 0.6;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * High-level convenience wrapper that fetches lines via the provider and
 * runs the pure pipeline. Kept thin so production code can swap the
 * provider (OpenCV worker) without touching the algorithm.
 */
export async function detectWallCorners(
  imageUrl: string,
  mask: WallMask,
  photoSize: { width: number; height: number },
  provider: LineProvider,
): Promise<DetectResult> {
  const lines = await provider({ imageUrl, mask, photoSize });
  return detectFromLines({ lines, mask, photoSize });
}

/**
 * Pure pipeline: lines → corners. Exported for direct unit testing.
 */
export function detectFromLines(input: DetectInput): DetectResult {
  const { lines, mask, photoSize } = input;

  // 1. Filter lines to those that lie on the wall mask.
  const onWall = lines.filter((l) => onWallRatio(l, mask) >= ON_WALL_RATIO);
  if (onWall.length < MIN_LINES) {
    return { ok: false, reason: 'too-few-lines' };
  }

  // 2. Cluster by orientation.
  const { strongBins, histogram } = clusterByAngle(onWall);
  if (strongBins.length >= 3) {
    return { ok: false, reason: 'multi-plane' };
  }
  if (strongBins.length < 2) {
    return { ok: false, reason: 'low-confidence' };
  }

  // Two dominant directions. Sort so the more-horizontal one is first
  // (smaller angle from 0°), the more-vertical one second. This makes the
  // downstream "horizontal vs vertical edge" assignment deterministic.
  const [dirHIdx, dirVIdx] = pickHorizontalVerticalBins(strongBins);
  const horizontalLines = linesInBin(onWall, dirHIdx);
  const verticalLines = linesInBin(onWall, dirVIdx);

  // 3. RANSAC two vanishing points.
  const horizontalVP = ransacVanishingPoint(horizontalLines);
  const verticalVP = ransacVanishingPoint(verticalLines);
  if (!horizontalVP || !verticalVP) {
    return { ok: false, reason: 'low-confidence' };
  }
  if (horizontalVP.inliers.length < MIN_CLUSTER_INLIERS) {
    return { ok: false, reason: 'low-confidence' };
  }
  if (verticalVP.inliers.length < MIN_CLUSTER_INLIERS) {
    return { ok: false, reason: 'low-confidence' };
  }

  // 4. Pick extreme inlier lines on each side as wall edges, intersect them
  //    to get 4 corners.
  const corners = extractCorners(
    horizontalVP.inliers,
    verticalVP.inliers,
    mask,
  );
  if (!corners) {
    return { ok: false, reason: 'low-confidence' };
  }

  // 5. Confidence score.
  const confidence = scoreConfidence({
    horizontalInliers: horizontalVP.inliers.length,
    verticalInliers: verticalVP.inliers.length,
    totalOnWall: onWall.length,
    histogramMass: (histogram[dirHIdx]! + histogram[dirVIdx]!) / onWall.length,
    corners,
    mask,
    photoSize,
  });
  if (confidence < CONFIDENCE_FLOOR) {
    return { ok: false, reason: 'low-confidence' };
  }

  return { ok: true, corners, confidence };
}

// ─── 1. Mask coverage ────────────────────────────────────────────────────────

function onWallRatio(line: Line, mask: WallMask): number {
  let inside = 0;
  for (let i = 0; i < COVERAGE_SAMPLES; i++) {
    const t = i / (COVERAGE_SAMPLES - 1);
    const x = Math.round(line.p1.x + (line.p2.x - line.p1.x) * t);
    const y = Math.round(line.p1.y + (line.p2.y - line.p1.y) * t);
    if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) continue;
    if ((mask.data[y * mask.width + x] ?? 0) > 127) inside++;
  }
  return inside / COVERAGE_SAMPLES;
}

// ─── 2. Angle clustering ─────────────────────────────────────────────────────

/** Angle of a line in [0°, 180°). */
function lineAngleDeg(line: Line): number {
  const dx = line.p2.x - line.p1.x;
  const dy = line.p2.y - line.p1.y;
  // atan2 gives [-π, π]; we fold to [0, π) since lines are undirected.
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 180;
  if (deg >= 180) deg -= 180;
  return deg;
}

interface ClusterResult {
  /** Bin indices that hold ≥ STRONG_CLUSTER_FRAC of lines, sorted by mass desc. */
  strongBins: number[];
  histogram: number[];
}

function clusterByAngle(lines: Line[]): ClusterResult {
  const histogram = new Array<number>(NUM_ANGLE_BINS).fill(0);
  for (const l of lines) {
    const bin = Math.min(
      NUM_ANGLE_BINS - 1,
      Math.floor(lineAngleDeg(l) / ANGLE_BIN_DEG),
    );
    histogram[bin]! += 1;
  }

  // Find local peaks by greedy non-max-suppression: pick the largest bin,
  // then suppress its neighbours within ±2 bins (±20°), repeat. This
  // collapses smeared clusters into a single representative direction.
  const masked = histogram.slice();
  const total = lines.length;
  const minMass = total * STRONG_CLUSTER_FRAC;
  const strongBins: number[] = [];
  while (true) {
    let bestIdx = -1;
    let bestVal = 0;
    for (let i = 0; i < NUM_ANGLE_BINS; i++) {
      if (masked[i]! > bestVal) {
        bestVal = masked[i]!;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestVal < minMass) break;
    strongBins.push(bestIdx);
    // Suppress neighbours in a circular ±2 window. Angles wrap mod 180°
    // (NUM_ANGLE_BINS), so 0° and 170° are adjacent.
    for (let d = -2; d <= 2; d++) {
      const idx = (bestIdx + d + NUM_ANGLE_BINS) % NUM_ANGLE_BINS;
      masked[idx] = 0;
    }
    if (strongBins.length >= 4) break; // >=3 already triggers multi-plane upstream
  }
  return { strongBins, histogram };
}

/**
 * Out of ≥2 strong bins, pick the one closest to horizontal (0° or 180°)
 * as the "horizontal" direction and the one closest to vertical (90°) as
 * the "vertical" direction. Returns `[horizontalBinIdx, verticalBinIdx]`.
 */
function pickHorizontalVerticalBins(strongBins: number[]): [number, number] {
  const sorted = strongBins.slice().sort((a, b) => {
    // Distance from horizontal (bin 0 or NUM_ANGLE_BINS).
    const distHA = Math.min(a, NUM_ANGLE_BINS - a);
    const distHB = Math.min(b, NUM_ANGLE_BINS - b);
    return distHA - distHB;
  });
  const h = sorted[0]!;
  // The vertical pick is the strong bin furthest from horizontal that isn't `h`.
  const v =
    sorted.slice(1).sort((a, b) => {
      const dvA = Math.abs(a - NUM_ANGLE_BINS / 2);
      const dvB = Math.abs(b - NUM_ANGLE_BINS / 2);
      return dvA - dvB;
    })[0] ?? sorted[1]!;
  return [h, v];
}

function linesInBin(lines: Line[], binIdx: number): Line[] {
  return lines.filter((l) => {
    const b = Math.min(
      NUM_ANGLE_BINS - 1,
      Math.floor(lineAngleDeg(l) / ANGLE_BIN_DEG),
    );
    // Match the same circular ±2 window used in suppression so a bin is the
    // representative of its smeared cluster.
    const d = Math.min(
      Math.abs(b - binIdx),
      NUM_ANGLE_BINS - Math.abs(b - binIdx),
    );
    return d <= 2;
  });
}

// ─── 3. RANSAC vanishing point ───────────────────────────────────────────────

interface VPResult {
  point: Point;
  inliers: Line[];
}

/**
 * Each line defines an infinite extension `ax + by + c = 0`. Two lines'
 * extensions intersect at a candidate VP. Score = number of OTHER lines
 * whose infinite extension passes within `RANSAC_INLIER_DIST` of that VP.
 *
 * Parallel lines have a "vanishing point at infinity"; we detect that by
 * treating intersection at huge distance as a special case where the inlier
 * set is the whole cluster.
 */
function ransacVanishingPoint(lines: Line[]): VPResult | null {
  if (lines.length < 2) return null;

  let best: VPResult | null = null;

  // Deterministic seed via simple LCG so tests aren't flaky.
  let seed = 0x9e3779b9;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const tryVP = (vp: Point | 'infinity', sampledA: Line, sampledB: Line) => {
    let inliers: Line[];
    if (vp === 'infinity') {
      // Parallel-line case: every line in the cluster is an inlier (already
      // pre-filtered by direction). Use the two sampled lines as the
      // canonical pair and approximate the VP point as a far-away point in
      // the dominant direction so corner extraction still works.
      inliers = lines.slice();
      const dir = unitDir(sampledA);
      vp = {
        x: (sampledA.p1.x + sampledB.p1.x) / 2 + dir.x * 1e6,
        y: (sampledA.p1.y + sampledB.p1.y) / 2 + dir.y * 1e6,
      };
    } else {
      inliers = lines.filter((l) => lineToPointDistance(l, vp as Point) <= RANSAC_INLIER_DIST);
    }
    if (!best || inliers.length > best.inliers.length) {
      best = { point: vp as Point, inliers };
    }
  };

  // Try every pair if cluster is small (≤20 lines), otherwise random sample.
  if (lines.length * (lines.length - 1) <= RANSAC_ITERS * 2) {
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const inter = lineIntersection(lines[i]!, lines[j]!);
        tryVP(inter, lines[i]!, lines[j]!);
      }
    }
  } else {
    for (let k = 0; k < RANSAC_ITERS; k++) {
      const i = Math.floor(rand() * lines.length);
      let j = Math.floor(rand() * lines.length);
      if (j === i) j = (j + 1) % lines.length;
      const inter = lineIntersection(lines[i]!, lines[j]!);
      tryVP(inter, lines[i]!, lines[j]!);
    }
  }

  return best;
}

function unitDir(line: Line): Point {
  const dx = line.p2.x - line.p1.x;
  const dy = line.p2.y - line.p1.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Standard form coefficients (a, b, c) such that ax + by + c = 0. */
function lineCoeffs(line: Line): { a: number; b: number; c: number } {
  const a = line.p2.y - line.p1.y;
  const b = line.p1.x - line.p2.x;
  const c = line.p2.x * line.p1.y - line.p1.x * line.p2.y;
  return { a, b, c };
}

function lineToPointDistance(line: Line, p: Point): number {
  const { a, b, c } = lineCoeffs(line);
  const denom = Math.hypot(a, b) || 1;
  return Math.abs(a * p.x + b * p.y + c) / denom;
}

/**
 * Intersection of two infinite lines `a·x + b·y + c = 0`. Returns
 * `'infinity'` if parallel. Cramer's rule on the system rewritten as
 * `a·x + b·y = −c`.
 */
function lineIntersection(l1: Line, l2: Line): Point | 'infinity' {
  const c1 = lineCoeffs(l1);
  const c2 = lineCoeffs(l2);
  const det = c1.a * c2.b - c2.a * c1.b;
  if (Math.abs(det) < 1e-9) return 'infinity';
  const x = (c1.b * c2.c - c2.b * c1.c) / det;
  const y = (c2.a * c1.c - c1.a * c2.c) / det;
  return { x, y };
}

// ─── 4. Corner extraction ────────────────────────────────────────────────────

/**
 * Given inlier lines for the horizontal and vertical clusters, pick the
 * topmost / bottommost horizontal lines and the leftmost / rightmost
 * vertical lines (by midpoint coordinate within the mask bbox), then
 * intersect them pairwise to get 4 corners.
 */
function extractCorners(
  horizontals: Line[],
  verticals: Line[],
  mask: WallMask,
): PerspectiveCorners | null {
  const bbox = maskBoundingBox(mask);
  if (!bbox) return null;

  const sortedH = horizontals
    .slice()
    .sort((a, b) => midpoint(a).y - midpoint(b).y);
  const sortedV = verticals
    .slice()
    .sort((a, b) => midpoint(a).x - midpoint(b).x);

  const top = sortedH[0]!;
  const bottom = sortedH[sortedH.length - 1]!;
  const left = sortedV[0]!;
  const right = sortedV[sortedV.length - 1]!;

  const tl = lineIntersection(top, left);
  const tr = lineIntersection(top, right);
  const br = lineIntersection(bottom, right);
  const bl = lineIntersection(bottom, left);
  if (
    tl === 'infinity' ||
    tr === 'infinity' ||
    br === 'infinity' ||
    bl === 'infinity'
  ) {
    return null;
  }
  // Sanity: corners should be ordered correctly (TL above BL, TR above BR,
  // TL left of TR). If the picked extreme lines were degenerate, bail.
  if (!(tl.y < bl.y && tr.y < br.y && tl.x < tr.x && bl.x < br.x)) {
    return null;
  }
  return [tl, tr, br, bl];
}

function midpoint(line: Line): Point {
  return {
    x: (line.p1.x + line.p2.x) / 2,
    y: (line.p1.y + line.p2.y) / 2,
  };
}

interface MaskBBox { minX: number; minY: number; maxX: number; maxY: number }

function maskBoundingBox(mask: WallMask): MaskBBox | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if ((mask.data[y * mask.width + x] ?? 0) > 127) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

// ─── 5. Confidence ──────────────────────────────────────────────────────────

interface ScoreInput {
  horizontalInliers: number;
  verticalInliers: number;
  totalOnWall: number;
  histogramMass: number; // fraction of on-wall lines that are in the two strong bins
  corners: PerspectiveCorners;
  mask: WallMask;
  photoSize: { width: number; height: number };
}

function scoreConfidence(s: ScoreInput): number {
  // Inlier coverage: how many of the on-wall lines were actually used to
  // determine the two VPs. High coverage = clean, geometric scene.
  const inlierCoverage = Math.min(
    1,
    (s.horizontalInliers + s.verticalInliers) / Math.max(s.totalOnWall, 1),
  );

  // Cluster strength: are the two strong bins really dominant?
  const clusterStrength = s.histogramMass; // already in [0,1]

  // Corner sanity: corners should be inside the photo and approximately fill
  // the wall mask's bounding box (no shrunk-to-a-point pathologies).
  const cornersInside =
    s.corners.filter(
      (c) =>
        c.x >= -s.photoSize.width * 0.1 &&
        c.x <= s.photoSize.width * 1.1 &&
        c.y >= -s.photoSize.height * 0.1 &&
        c.y <= s.photoSize.height * 1.1,
    ).length / 4;

  const bbox = maskBoundingBox(s.mask);
  let bboxFit = 0;
  if (bbox) {
    const cornerW = Math.max(...s.corners.map((c) => c.x)) - Math.min(...s.corners.map((c) => c.x));
    const cornerH = Math.max(...s.corners.map((c) => c.y)) - Math.min(...s.corners.map((c) => c.y));
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    if (bboxW > 0 && bboxH > 0) {
      bboxFit = Math.min(
        1,
        Math.min(cornerW / bboxW, cornerH / bboxH),
      );
    }
  }

  return inlierCoverage * 0.4 + clusterStrength * 0.2 + cornersInside * 0.2 + bboxFit * 0.2;
}
