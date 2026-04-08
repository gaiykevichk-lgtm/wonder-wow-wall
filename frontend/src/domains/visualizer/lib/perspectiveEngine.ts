/**
 * Perspective Engine — homographic transformation for wall panels.
 *
 * Maps between a flat rectangle (wall surface) and a quadrilateral on the photo
 * (wall in perspective). Uses 8-parameter homography matrix.
 *
 * No external dependencies — the math is implemented inline.
 */

import type { Point } from '../model/types';

/** Four corner points: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/**
 * 3×3 homography matrix stored as a flat 9-element array (row-major).
 * Transforms source points to destination points.
 */
export interface PerspectiveTransform {
  /** Forward matrix (wall → screen) */
  matrix: number[];
  /** Inverse matrix (screen → wall) */
  inverseMatrix: number[];
  /** Source quad (flat wall rectangle) */
  src: Quad;
  /** Destination quad (perspective quadrilateral on photo) */
  dst: Quad;
}

/**
 * Solve a system of linear equations Ax = b using Gaussian elimination.
 * A is n×n, b is n×1. Returns x.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Augmented matrix
  const aug = A.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row]![col]!) > Math.abs(aug[maxRow]![col]!)) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow]!, aug[col]!];

    const pivot = aug[col]![col]!;
    if (Math.abs(pivot) < 1e-12) {
      throw new Error('Singular matrix — perspective corners are degenerate');
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row]![col]! / pivot;
      for (let j = col; j <= n; j++) {
        aug[row]![j]! -= factor * aug[col]![j]!;
      }
    }
  }

  // Back substitution
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i]![n]!;
    for (let j = i + 1; j < n; j++) {
      x[i]! -= aug[i]![j]! * x[j]!;
    }
    x[i]! /= aug[i]![i]!;
  }
  return x;
}

/**
 * Compute the 3×3 homography matrix that maps `src` quad to `dst` quad.
 * Returns the 9 coefficients in row-major order: [h0, h1, h2, h3, h4, h5, h6, h7, 1].
 */
function computeHomography(src: Quad, dst: Quad): number[] {
  // Set up the 8×8 system of equations
  // For each point pair (sx, sy) → (dx, dy):
  //   dx = (h0*sx + h1*sy + h2) / (h6*sx + h7*sy + 1)
  //   dy = (h3*sx + h4*sy + h5) / (h6*sx + h7*sy + 1)
  // Rearranged:
  //   h0*sx + h1*sy + h2 - h6*sx*dx - h7*sy*dx = dx
  //   h3*sx + h4*sy + h5 - h6*sx*dy - h7*sy*dy = dy

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i]!.x;
    const sy = src[i]!.y;
    const dx = dst[i]!.x;
    const dy = dst[i]!.y;

    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = solveLinearSystem(A, b);
  return [...h, 1]; // h8 = 1
}

/**
 * Create a perspective transform from wall corners on the photo.
 *
 * @param corners Four points on the photo defining the wall quadrilateral (TL, TR, BR, BL)
 * @param wallSize Size of the flat wall in pixels (before perspective)
 */
export function createPerspective(
  corners: Quad,
  wallSize: { w: number; h: number },
): PerspectiveTransform {
  const src: Quad = [
    { x: 0, y: 0 },
    { x: wallSize.w, y: 0 },
    { x: wallSize.w, y: wallSize.h },
    { x: 0, y: wallSize.h },
  ];

  const matrix = computeHomography(src, corners);
  const inverseMatrix = computeHomography(corners, src);

  return { matrix, inverseMatrix, src, dst: corners };
}

/**
 * Transform a point from wall coordinates to screen (photo) coordinates.
 */
export function transformPoint(
  transform: PerspectiveTransform,
  point: Point,
): Point {
  return applyHomography(transform.matrix, point);
}

/**
 * Transform a point from screen (photo) coordinates back to wall coordinates.
 */
export function inverseTransformPoint(
  transform: PerspectiveTransform,
  point: Point,
): Point {
  return applyHomography(transform.inverseMatrix, point);
}

/**
 * Transform a rectangle from wall coordinates to a quadrilateral on screen.
 * Returns four corners: TL, TR, BR, BL.
 */
export function transformRect(
  transform: PerspectiveTransform,
  rect: { x: number; y: number; width: number; height: number },
): Quad {
  return [
    transformPoint(transform, { x: rect.x, y: rect.y }),
    transformPoint(transform, { x: rect.x + rect.width, y: rect.y }),
    transformPoint(transform, { x: rect.x + rect.width, y: rect.y + rect.height }),
    transformPoint(transform, { x: rect.x, y: rect.y + rect.height }),
  ];
}

/**
 * Apply a 3×3 homography matrix to a 2D point.
 */
function applyHomography(h: number[], p: Point): Point {
  const w = h[6]! * p.x + h[7]! * p.y + h[8]!;
  return {
    x: (h[0]! * p.x + h[1]! * p.y + h[2]!) / w,
    y: (h[3]! * p.x + h[4]! * p.y + h[5]!) / w,
  };
}

/**
 * Flatten a Quad to a flat array [x0,y0, x1,y1, x2,y2, x3,y3] for Konva <Line>.
 */
export function quadToFlatPoints(quad: Quad): number[] {
  return quad.flatMap((p) => [p.x, p.y]);
}

/**
 * Compute average brightness of pixels within a wall mask region.
 * Returns value 0–255. Used to adjust panel brightness to match photo lighting.
 *
 * @param imageData Canvas ImageData of the photo
 * @param mask Wall mask (255 = wall)
 */
export function computeWallBrightness(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  mask: { data: Uint8Array; width: number; height: number },
): number {
  let sum = 0;
  let count = 0;

  // Sample every 4th pixel for performance
  const step = 4;
  for (let y = 0; y < mask.height; y += step) {
    for (let x = 0; x < mask.width; x += step) {
      if (mask.data[y * mask.width + x] === 255) {
        const idx = (y * imageData.width + x) * 4;
        // Perceived brightness (ITU-R BT.601)
        const r = imageData.data[idx]!;
        const g = imageData.data[idx + 1]!;
        const b = imageData.data[idx + 2]!;
        sum += 0.299 * r + 0.587 * g + 0.114 * b;
        count++;
      }
    }
  }

  return count > 0 ? sum / count : 128;
}

/**
 * Compute brightness adjustment factor for panels based on wall brightness.
 * Returns a value suitable for Konva's Brighten filter (-1 to 1 range).
 *
 * - Dark walls (brightness < 100): darken panels slightly
 * - Neutral walls (100-200): no adjustment
 * - Bright walls (brightness > 200): brighten panels slightly
 */
export function computeBrightnessAdjustment(wallBrightness: number): number {
  if (wallBrightness < 100) {
    return -(100 - wallBrightness) / 400; // range: -0.25 to 0
  }
  if (wallBrightness > 200) {
    return (wallBrightness - 200) / 400; // range: 0 to 0.14
  }
  return 0;
}
