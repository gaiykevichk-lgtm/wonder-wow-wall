/**
 * Panel Warp Renderer — rasterise a flat panel design onto a perspective quad
 * using a piecewise-affine mesh warp on an offscreen <canvas>.
 *
 * See docs/design-docs/PANEL-WARP-RENDERER.md for the design rationale.
 *
 * Architecture:
 *   - `buildMeshTriangles()` and `affineFromTriangles()` are pure math —
 *     unit-testable without a real <canvas>.
 *   - `renderPanelToQuad()` does the actual canvas rendering and caches
 *     results by (designUrl, quadHash, opacity, colorTint).
 *
 * No external dependencies; relies only on `perspectiveEngine.ts`.
 */

import type { PerspectiveTransform, Quad } from './perspectiveEngine';
import { transformPoint } from './perspectiveEngine';
import type { Point } from '../model/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Triangle {
  a: Point;
  b: Point;
  c: Point;
}

export interface MeshTriangle {
  /** Triangle in source (flat wall) space — pixels relative to wallRect.x/y. */
  src: Triangle;
  /** Triangle in destination (photo) space — absolute pixels. */
  dst: Triangle;
}

/** 2×3 affine matrix in canvas form: [a, b, c, d, e, f]
 *  meaning x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type AffineMatrix = [number, number, number, number, number, number];

export interface WallRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WarpOptions {
  designUrl: string;
  designImage: HTMLImageElement;
  perspective: PerspectiveTransform;
  wallRect: WallRect;
  opacity: number;
  colorTint?: string;
  /** Mesh subdivision (NxN cells). Default 8 → 128 triangles. */
  gridSize?: number;
  /**
   * Optional pre-computed destination quad (the four wallRect corners passed
   * through `perspective`). When the caller already has this — e.g.
   * `KonvaCanvas` derives it from `transformRect` to draw the outline — pass
   * it here to avoid four redundant `transformPoint` calls inside the renderer.
   */
  dstQuad?: Quad;
}

export interface WarpResult {
  canvas: HTMLCanvasElement;
  /** Bounding box of the warped quad in photo coordinates. */
  bbox: WallRect;
}

// ─── Pure math: mesh + affine ───────────────────────────────────────────────

/**
 * Subdivide `wallRect` into a `gridSize × gridSize` grid of cells, then split
 * each cell into 2 triangles. For each triangle, project its vertices through
 * `perspective` to get the destination triangle on the photo.
 *
 * Source coordinates are **relative to wallRect.x / wallRect.y** so they can
 * be used directly as pixel coordinates inside a flat texture canvas.
 */
export function buildMeshTriangles(
  perspective: PerspectiveTransform,
  wallRect: WallRect,
  gridSize: number,
): MeshTriangle[] {
  if (gridSize < 1 || !Number.isFinite(gridSize)) {
    throw new Error(`buildMeshTriangles: gridSize must be a positive integer, got ${gridSize}`);
  }
  const triangles: MeshTriangle[] = [];
  const cellW = wallRect.width / gridSize;
  const cellH = wallRect.height / gridSize;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Cell corners in source space (relative to wallRect origin)
      const sx0 = col * cellW;
      const sy0 = row * cellH;
      const sx1 = sx0 + cellW;
      const sy1 = sy0 + cellH;

      // Cell corners in absolute wall space (for transform)
      const tl = { x: wallRect.x + sx0, y: wallRect.y + sy0 };
      const tr = { x: wallRect.x + sx1, y: wallRect.y + sy0 };
      const br = { x: wallRect.x + sx1, y: wallRect.y + sy1 };
      const bl = { x: wallRect.x + sx0, y: wallRect.y + sy1 };

      const dTL = transformPoint(perspective, tl);
      const dTR = transformPoint(perspective, tr);
      const dBR = transformPoint(perspective, br);
      const dBL = transformPoint(perspective, bl);

      // Triangle 1: TL → TR → BR
      triangles.push({
        src: {
          a: { x: sx0, y: sy0 },
          b: { x: sx1, y: sy0 },
          c: { x: sx1, y: sy1 },
        },
        dst: { a: dTL, b: dTR, c: dBR },
      });
      // Triangle 2: TL → BR → BL
      triangles.push({
        src: {
          a: { x: sx0, y: sy0 },
          b: { x: sx1, y: sy1 },
          c: { x: sx0, y: sy1 },
        },
        dst: { a: dTL, b: dBR, c: dBL },
      });
    }
  }
  return triangles;
}

/**
 * Given two triangles (src, dst), compute the affine 2×3 matrix that maps
 * src vertices to dst vertices.
 *
 * Returns [a, b, c, d, e, f] in canvas setTransform order:
 *   x' = a*sx + c*sy + e
 *   y' = b*sx + d*sy + f
 *
 * Closed-form solution via Cramer's rule (no allocation).
 *
 * Throws if src triangle is degenerate (zero area).
 */
export function affineFromTriangles(src: Triangle, dst: Triangle): AffineMatrix {
  const { a: s0, b: s1, c: s2 } = src;
  const { a: d0, b: d1, c: d2 } = dst;

  // Determinant of the source-side matrix
  //   | s0.x s0.y 1 |
  //   | s1.x s1.y 1 |
  //   | s2.x s2.y 1 |
  const det =
    s0.x * (s1.y - s2.y) -
    s0.y * (s1.x - s2.x) +
    (s1.x * s2.y - s2.x * s1.y);

  if (Math.abs(det) < 1e-12) {
    throw new Error('affineFromTriangles: degenerate source triangle (zero area)');
  }

  const invDet = 1 / det;

  // For x': solve a*s.x + c*s.y + e = d.x for each pair → linear system
  const a =
    ((d0.x * (s1.y - s2.y)) +
      (d1.x * (s2.y - s0.y)) +
      (d2.x * (s0.y - s1.y))) *
    invDet;

  const c =
    ((d0.x * (s2.x - s1.x)) +
      (d1.x * (s0.x - s2.x)) +
      (d2.x * (s1.x - s0.x))) *
    invDet;

  const e =
    ((d0.x * (s1.x * s2.y - s2.x * s1.y)) +
      (d1.x * (s2.x * s0.y - s0.x * s2.y)) +
      (d2.x * (s0.x * s1.y - s1.x * s0.y))) *
    invDet;

  const b =
    ((d0.y * (s1.y - s2.y)) +
      (d1.y * (s2.y - s0.y)) +
      (d2.y * (s0.y - s1.y))) *
    invDet;

  const d =
    ((d0.y * (s2.x - s1.x)) +
      (d1.y * (s0.x - s2.x)) +
      (d2.y * (s1.x - s0.x))) *
    invDet;

  const f =
    ((d0.y * (s1.x * s2.y - s2.x * s1.y)) +
      (d1.y * (s2.x * s0.y - s0.x * s2.y)) +
      (d2.y * (s0.x * s1.y - s1.x * s0.y))) *
    invDet;

  return [a, b, c, d, e, f];
}

/**
 * Compute the bounding box (in destination/photo space) of a quad.
 * Returns x, y, width, height covering all 4 points.
 */
export function quadBoundingBox(quad: Quad): WallRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of quad) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.max(1, Math.ceil(maxX - Math.floor(minX))),
    height: Math.max(1, Math.ceil(maxY - Math.floor(minY))),
  };
}

// ─── Cache (module-level, FIFO eviction up to MAX_CACHE_ENTRIES) ─────────────

const MAX_CACHE_ENTRIES = 100;
const warpCache = new Map<string, WarpResult>();

function buildCacheKey(opts: WarpOptions, dstQuad: Quad): string {
  const quadHash = dstQuad
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join('_');
  // encodeURIComponent the URL so a stray `|` in the URL can't collide with
  // the field separator (e.g. data URIs or querystrings containing pipes).
  return `${encodeURIComponent(opts.designUrl)}|${quadHash}|${opts.opacity.toFixed(3)}|${opts.colorTint || ''}`;
}

/** Drop all cached warps. Call when perspective corners change. */
export function clearWarpCache(): void {
  warpCache.clear();
}

/** Test/inspection helper. */
export function getWarpCacheSize(): number {
  return warpCache.size;
}

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * Render a panel design as a perspective-warped texture on an offscreen canvas.
 *
 * Returns the canvas plus its bounding-box position in photo coordinates.
 * Caller draws it via <KonvaImage image={result.canvas} x={bbox.x} ... />.
 */
export function renderPanelToQuad(opts: WarpOptions): WarpResult {
  const { designImage, perspective, wallRect, opacity, colorTint } = opts;
  const gridSize = opts.gridSize ?? 8;

  // B8: degenerate wallRect → return an empty 1×1 canvas at the rect origin
  // rather than running the mesh loop (which would produce zero-area triangles
  // and trigger the catch path 128 times).
  if (
    !Number.isFinite(wallRect.width) ||
    !Number.isFinite(wallRect.height) ||
    wallRect.width <= 0 ||
    wallRect.height <= 0
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return {
      canvas,
      bbox: { x: Math.floor(wallRect.x), y: Math.floor(wallRect.y), width: 1, height: 1 },
    };
  }

  // Destination quad: prefer caller-supplied to avoid recomputing the same
  // four perspective projections KonvaCanvas just did via `transformRect`.
  const dstQuad: Quad = opts.dstQuad ?? [
    transformPoint(perspective, { x: wallRect.x, y: wallRect.y }),
    transformPoint(perspective, { x: wallRect.x + wallRect.width, y: wallRect.y }),
    transformPoint(perspective, {
      x: wallRect.x + wallRect.width,
      y: wallRect.y + wallRect.height,
    }),
    transformPoint(perspective, { x: wallRect.x, y: wallRect.y + wallRect.height }),
  ];
  const bbox = quadBoundingBox(dstQuad);

  const key = buildCacheKey(opts, dstQuad);
  const cached = warpCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = bbox.width;
  canvas.height = bbox.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // jsdom or unsupported env — return empty canvas at correct bbox.
    const result: WarpResult = { canvas, bbox };
    return result;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = opacity;

  // Mesh warp: triangulate, draw each triangle via clip + setTransform + drawImage.
  const triangles = buildMeshTriangles(perspective, wallRect, gridSize);
  for (const t of triangles) {
    try {
      const m = affineFromTriangles(t.src, t.dst);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(t.dst.a.x - bbox.x, t.dst.a.y - bbox.y);
      ctx.lineTo(t.dst.b.x - bbox.x, t.dst.b.y - bbox.y);
      ctx.lineTo(t.dst.c.x - bbox.x, t.dst.c.y - bbox.y);
      ctx.closePath();
      ctx.clip();
      // Apply the affine: src(x, y) → photoSpace, then translate by -bbox to
      // land on the offscreen canvas.
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4] - bbox.x, m[5] - bbox.y);
      ctx.drawImage(designImage, 0, 0, wallRect.width, wallRect.height);
      ctx.restore();
    } catch {
      // Degenerate triangle (e.g. quad collapsed to a line near horizon).
      // Skip it silently — the rest of the mesh will still render.
    }
  }

  // B1: Color tint overlay drawn AFTER the image at α=0.25 — matches Phase 1A
  // semantics (Rect over KonvaImage with opacity={0.25}). Drawing under with
  // opacity=0.85 produced ~13% tint contribution; on top with 0.25 produces
  // ~25%, which is what the design system expects.
  if (colorTint) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(dstQuad[0].x - bbox.x, dstQuad[0].y - bbox.y);
    ctx.lineTo(dstQuad[1].x - bbox.x, dstQuad[1].y - bbox.y);
    ctx.lineTo(dstQuad[2].x - bbox.x, dstQuad[2].y - bbox.y);
    ctx.lineTo(dstQuad[3].x - bbox.x, dstQuad[3].y - bbox.y);
    ctx.closePath();
    ctx.fillStyle = colorTint;
    ctx.fill();
  }

  const result: WarpResult = { canvas, bbox };

  // FIFO eviction: drop the oldest entry when over capacity.
  if (warpCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = warpCache.keys().next().value;
    if (firstKey !== undefined) warpCache.delete(firstKey);
  }
  warpCache.set(key, result);

  return result;
}
