/**
 * Mask manipulation utilities for the Visualizer domain.
 * All operations work on flat Uint8Array (0 = not wall, 255 = wall).
 */

import type { Point, WallMask, MaskTool } from '../model/types';

/**
 * Create an empty mask filled with a given value.
 */
export function createEmptyMask(
  width: number,
  height: number,
  fillValue: number = 0,
): WallMask {
  const data = new Uint8Array(width * height);
  if (fillValue !== 0) data.fill(fillValue);
  return { data, width, height };
}

/**
 * Get mask value at (x, y). Returns 0 for out-of-bounds.
 */
export function getMaskValue(mask: WallMask, x: number, y: number): number {
  if (x < 0 || x >= mask.width || y < 0 || y >= mask.height) return 0;
  return mask.data[y * mask.width + x]!;
}

/**
 * Set mask value at (x, y). No-op for out-of-bounds.
 */
export function setMaskValue(
  mask: WallMask,
  x: number,
  y: number,
  value: number,
): void {
  if (x < 0 || x >= mask.width || y < 0 || y >= mask.height) return;
  mask.data[y * mask.width + x] = value;
}

/**
 * Draw a filled circle on the mask (for brush/eraser tool).
 * Returns a new WallMask with the circle applied.
 */
export function drawCircleOnMask(
  mask: WallMask,
  center: Point,
  radius: number,
  tool: MaskTool,
): WallMask {
  const newData = new Uint8Array(mask.data);
  const value = tool === 'brush' ? 255 : 0;

  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const r2 = radius * radius;

  const minY = Math.max(0, cy - radius);
  const maxY = Math.min(mask.height - 1, cy + radius);
  const minX = Math.max(0, cx - radius);
  const maxX = Math.min(mask.width - 1, cx + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        newData[y * mask.width + x] = value;
      }
    }
  }

  return { data: newData, width: mask.width, height: mask.height };
}

/** Paint a circle directly onto an existing mutable data array (no copy). */
function paintCircle(
  data: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  value: number,
): void {
  const r2 = radius * radius;
  const minY = Math.max(0, Math.round(cy) - radius);
  const maxY = Math.min(height - 1, Math.round(cy) + radius);
  const minX = Math.max(0, Math.round(cx) - radius);
  const maxX = Math.min(width - 1, Math.round(cx) + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        data[y * width + x] = value;
      }
    }
  }
}

/**
 * Apply a stroke (series of points) on the mask — interpolated line drawing.
 * Copies the mask data ONCE, then mutates in place for all points.
 */
export function applyStrokeToMask(
  mask: WallMask,
  points: Point[],
  brushSize: number,
  tool: MaskTool,
): WallMask {
  if (points.length === 0) return mask;

  const newData = new Uint8Array(mask.data);
  const value = tool === 'brush' ? 255 : 0;
  const { width, height } = mask;

  for (let i = 0; i < points.length; i++) {
    const current = points[i]!;

    if (i === 0) {
      paintCircle(newData, width, height, current.x, current.y, brushSize, value);
      continue;
    }

    const prev = points[i - 1]!;
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / (brushSize * 0.5)));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      paintCircle(newData, width, height, prev.x + dx * t, prev.y + dy * t, brushSize, value);
    }
  }

  return { data: newData, width, height };
}

/**
 * Count wall pixels (value === 255) in a rectangular region.
 */
export function countWallPixelsInRect(
  mask: WallMask,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  let count = 0;
  const x2 = Math.min(x + width, mask.width);
  const y2 = Math.min(y + height, mask.height);
  const x1 = Math.max(0, x);
  const y1 = Math.max(0, y);

  for (let row = y1; row < y2; row++) {
    for (let col = x1; col < x2; col++) {
      if (mask.data[row * mask.width + col] === 255) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Calculate coverage ratio of wall pixels in a rectangular region (0..1).
 */
export function wallCoverageInRect(
  mask: WallMask,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const total = width * height;
  if (total === 0) return 0;
  return countWallPixelsInRect(mask, x, y, width, height) / total;
}

/**
 * Estimate wall coverage inside a perspective quadrilateral on the photo.
 *
 * The 4-corner quad is sampled with bilinear interpolation on a regular
 * `samplesPerSide × samplesPerSide` grid in the unit square [0,1]². Each
 * sample's photo-space pixel is checked against the wall mask. Out-of-bounds
 * samples count toward the denominator (matching `wallCoverageInRect`'s
 * convention of penalising panels that extend past the photo).
 *
 * Bilinear interpolation is approximate for true perspective quads, but for
 * coverage thresholds (~0.7) it agrees with full rasterisation to within ~2%
 * for typical interior-wall warps — accurate enough for placement decisions
 * and ~100× cheaper than walking the bounding box.
 *
 * @param mask Wall mask in photo coordinates (255 = wall).
 * @param quad Photo-space quadrilateral in [TL, TR, BR, BL] order.
 * @param samplesPerSide Grid resolution (default 8 → 64 samples).
 */
export function wallCoverageInQuad(
  mask: WallMask,
  quad: [Point, Point, Point, Point],
  samplesPerSide: number = 8,
): number {
  if (samplesPerSide < 1 || !Number.isFinite(samplesPerSide)) return 0;
  const total = samplesPerSide * samplesPerSide;
  if (total === 0) return 0;

  const [tl, tr, br, bl] = quad;
  let onWall = 0;

  for (let i = 0; i < samplesPerSide; i++) {
    const u = (i + 0.5) / samplesPerSide;
    // Top edge (TL → TR) and bottom edge (BL → BR) at parameter u.
    const topX = tl.x + (tr.x - tl.x) * u;
    const topY = tl.y + (tr.y - tl.y) * u;
    const botX = bl.x + (br.x - bl.x) * u;
    const botY = bl.y + (br.y - bl.y) * u;

    for (let j = 0; j < samplesPerSide; j++) {
      const v = (j + 0.5) / samplesPerSide;
      const px = Math.round(topX + (botX - topX) * v);
      const py = Math.round(topY + (botY - topY) * v);
      if (px >= 0 && py >= 0 && px < mask.width && py < mask.height) {
        if (mask.data[py * mask.width + px] === 255) onWall++;
      }
    }
  }

  return onWall / total;
}

/**
 * Convert WallMask to ImageData for rendering on canvas.
 * Wall pixels → green semi-transparent, non-wall → transparent.
 */
export function wallMaskToImageData(
  mask: WallMask,
  color: [number, number, number] = [76, 175, 80],
  opacity: number = 0.3,
): ImageData {
  const imageData = new ImageData(mask.width, mask.height);
  const alpha = Math.round(opacity * 255);

  for (let i = 0; i < mask.data.length; i++) {
    const offset = i * 4;
    if (mask.data[i] === 255) {
      imageData.data[offset] = color[0];
      imageData.data[offset + 1] = color[1];
      imageData.data[offset + 2] = color[2];
      imageData.data[offset + 3] = alpha;
    }
    // non-wall pixels remain transparent (0,0,0,0)
  }

  return imageData;
}

/**
 * Invert mask (wall ↔ not wall).
 */
export function invertMask(mask: WallMask): WallMask {
  const newData = new Uint8Array(mask.data.length);
  for (let i = 0; i < mask.data.length; i++) {
    newData[i] = mask.data[i] === 255 ? 0 : 255;
  }
  return { data: newData, width: mask.width, height: mask.height };
}

/**
 * Calculate total wall area as a fraction of total image area (0..1).
 */
export function totalWallFraction(mask: WallMask): number {
  let wallPixels = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] === 255) wallPixels++;
  }
  return wallPixels / mask.data.length;
}
