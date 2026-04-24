/**
 * Layout Engine — алгоритм размещения панелей на WallMask.
 *
 * В flat-режиме координаты `(x, y)` и `renderWidth/Height` живут в photo-space.
 * В perspective-режиме они интерпретируются как wall-space и проецируются
 * на photo через `transformRect` для проверки покрытия.
 */

import type {
  WallMask,
  PlacedPanel,
  PanelSizeKey,
  PanelSize,
  ScaleCalibration,
  AccentZone,
  Obstacle,
  Point,
} from '../model/types';
import { PANEL_SIZE_OPTIONS } from '../model/types';
import { wallCoverageInRect, wallCoverageInQuad } from './maskUtils';
import {
  type PerspectiveTransform,
  transformRect,
} from './perspectiveEngine';

/** Minimum wall coverage in a grid cell to place a panel */
const WALL_COVERAGE_THRESHOLD = 0.7;

/**
 * Thrown when `autoFillWall` cannot proceed without a real calibration —
 * specifically when the user is in perspective mode and the only available
 * `pixelsPerCm` came from the upload-time heuristic (`method === 'auto'`
 * without `wallWidthCm`) or from no calibration at all. The store catches
 * this and prompts the user to calibrate before retrying.
 */
export class AutoFillBlockedError extends Error {
  readonly code: 'no-calibration';
  constructor(message: string) {
    super(message);
    this.name = 'AutoFillBlockedError';
    this.code = 'no-calibration';
  }
}

/**
 * A calibration is "trusted" for perspective auto-fill when:
 *  - method is 'reference' or 'manual' (user-confirmed), OR
 *  - method is 'auto' AND `wallWidthCm` is present — the latter marks
 *    bbox-derived seeds produced by `runAutoPerspective` after successful
 *    depth-based wall detection. Those seeds use the detected wall's pixel
 *    extent ÷ an assumed 3 m width, which is a significantly tighter prior
 *    than the upload-time heuristic (`photoWidth / 400`) that omits the
 *    field.
 *
 * This keeps the upload-time placeholder blocked (still produces a banner
 * and refuses perspective fill) while unlocking the flow once real wall
 * geometry is available.
 */
function isTrustedCalibration(
  calibration: ScaleCalibration | null,
): calibration is ScaleCalibration {
  if (!calibration) return false;
  if (calibration.method !== 'auto') return true;
  return typeof calibration.wallWidthCm === 'number' && calibration.wallWidthCm > 0;
}

export function generatePanelId(): string {
  // Prefer crypto.randomUUID when available (browser, Node 19+, jsdom).
  // Fall back to a time + random suffix to keep the function usable in
  // exotic environments without leaking a process-global counter.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `panel-${c.randomUUID()}`;
  return `panel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Get panel size config by key.
 */
export function getPanelSizeConfig(key: PanelSizeKey): PanelSize {
  const found = PANEL_SIZE_OPTIONS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown panel size: ${key}`);
  return found;
}

/**
 * Calculate panel dimensions in pixels based on calibration.
 * If no calibration, falls back to default (1 cm = 5 px) for preview only.
 */
export function panelSizeInPixels(
  sizeKey: PanelSizeKey,
  calibration: ScaleCalibration | null,
): { widthPx: number; heightPx: number } {
  const config = getPanelSizeConfig(sizeKey);
  const pxPerCm = calibration?.pixelsPerCm ?? 5;
  return {
    widthPx: Math.round(config.widthCm * pxPerCm),
    heightPx: Math.round(config.heightCm * pxPerCm),
  };
}

/**
 * Check if a rectangle overlaps with an obstacle's bounding box.
 */
export function overlapsObstacle(
  x: number,
  y: number,
  width: number,
  height: number,
  obstacles: Obstacle[],
): boolean {
  for (const obs of obstacles) {
    const bb = obs.boundingBox;
    if (
      x < bb.x + bb.width &&
      x + width > bb.x &&
      y < bb.y + bb.height &&
      y + height > bb.y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a panel can be placed at position (x, y) on the mask.
 *
 * Without `perspective`, the panel rectangle lives in photo-space and the
 * mask is read directly inside that rectangle.
 *
 * With `perspective`, the rectangle is interpreted in wall-space and
 * projected through the homography to a quad on the photo; coverage and
 * obstacle/panel-overlap are then evaluated against that quad's footprint.
 * Panel-vs-panel overlap is still checked in wall-space (where both panels
 * live), which keeps the auto-fill grid consistent with rendering.
 */
export function canPlacePanel(
  mask: WallMask,
  x: number,
  y: number,
  widthPx: number,
  heightPx: number,
  existingPanels: PlacedPanel[],
  obstacles?: Obstacle[],
  perspective?: PerspectiveTransform | null,
): boolean {
  // Bounds in wall-/photo-space (mask & wall share the src-quad range).
  if (x < 0 || y < 0 || x + widthPx > mask.width || y + heightPx > mask.height) {
    return false;
  }

  if (perspective) {
    const quad = transformRect(perspective, { x, y, width: widthPx, height: heightPx });
    const coverage = wallCoverageInQuad(mask, quad);
    if (coverage < WALL_COVERAGE_THRESHOLD) return false;

    // Obstacles and the wall mask both live in photo-space. Use the quad's
    // axis-aligned bounding box for cheap obstacle intersection (a tighter
    // polygon test isn't worth the cost given that obstacles are themselves
    // stored as AABBs).
    if (obstacles && obstacles.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of quad) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      if (overlapsObstacle(minX, minY, maxX - minX, maxY - minY, obstacles)) {
        return false;
      }
    }
  } else {
    const coverage = wallCoverageInRect(mask, x, y, widthPx, heightPx);
    if (coverage < WALL_COVERAGE_THRESHOLD) return false;
    if (obstacles && obstacles.length > 0 && overlapsObstacle(x, y, widthPx, heightPx, obstacles)) {
      return false;
    }
  }

  // Overlap check with existing panels (always in wall-/photo-space).
  for (const panel of existingPanels) {
    if (
      x < panel.x + panel.renderWidth &&
      x + widthPx > panel.x &&
      y < panel.y + panel.renderHeight &&
      y + heightPx > panel.y
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Snap a position to the nearest grid point.
 */
export function snapToGrid(
  x: number,
  y: number,
  gridStepX: number,
  gridStepY: number,
): Point {
  return {
    x: Math.floor(x / gridStepX) * gridStepX,
    y: Math.floor(y / gridStepY) * gridStepY,
  };
}

export interface AutoFillConfig {
  mask: WallMask;
  sizeKey: PanelSizeKey;
  calibration: ScaleCalibration | null;
  designId: string;
  designName: string;
  designImage: string;
  color: string;
  colorName: string;
  accentZone?: AccentZone | null;
  obstacles?: Obstacle[];
  /**
   * When set, the iteration grid is treated as wall-space and each cell is
   * projected through the perspective for coverage/obstacle checks. When
   * `perspective` is set, `calibration` MUST be trusted (not `'auto'` and
   * not `null`) — otherwise an `AutoFillBlockedError` is thrown.
   */
  perspective?: PerspectiveTransform | null;
}

/**
 * Auto-fill: place panels on all available wall surface.
 * Scans the mask in grid steps and places panels where coverage is sufficient.
 *
 * @throws {AutoFillBlockedError} when `perspective` is set but `calibration`
 *   is `null` or has `method === 'auto'`. The placeholder pixelsPerCm derived
 *   on photo upload is too unreliable under perspective distortion to produce
 *   physically meaningful panel sizes; force the user to calibrate first.
 */
export function autoFillWall(config: AutoFillConfig): PlacedPanel[] {
  const { mask, sizeKey, calibration, accentZone, obstacles, perspective } = config;

  if (perspective && !isTrustedCalibration(calibration)) {
    throw new AutoFillBlockedError(
      'Auto-fill in perspective mode requires a calibrated scale (pixelsPerCm).',
    );
  }

  const { widthPx, heightPx } = panelSizeInPixels(sizeKey, calibration);
  const panels: PlacedPanel[] = [];

  // Determine bounds (full mask or accent zone)
  let startX = 0;
  let startY = 0;
  let endX = mask.width;
  let endY = mask.height;

  if (accentZone) {
    startX = Math.max(0, Math.round(accentZone.topLeft.x));
    startY = Math.max(0, Math.round(accentZone.topLeft.y));
    endX = Math.min(mask.width, Math.round(accentZone.bottomRight.x));
    endY = Math.min(mask.height, Math.round(accentZone.bottomRight.y));
  }

  for (let y = startY; y + heightPx <= endY; y += heightPx) {
    for (let x = startX; x + widthPx <= endX; x += widthPx) {
      if (canPlacePanel(mask, x, y, widthPx, heightPx, panels, obstacles, perspective)) {
        panels.push({
          id: generatePanelId(),
          designId: config.designId,
          designName: config.designName,
          designImage: config.designImage,
          sizeKey,
          color: config.color,
          colorName: config.colorName,
          x,
          y,
          renderWidth: widthPx,
          renderHeight: heightPx,
        });
      }
    }
  }

  return panels;
}

/**
 * Place a single panel at a click position (snapped to grid).
 * Returns the panel if placement is valid, null otherwise.
 *
 * Note: `clickX/clickY` are expected in wall-space when `perspective` is set
 * (the caller is responsible for inverse-transforming the photo-space click
 * — a v2 wallSpace concern). For now the perspective parameter only affects
 * coverage/obstacle checks, not the snap target.
 */
export function placeSinglePanel(
  mask: WallMask,
  clickX: number,
  clickY: number,
  sizeKey: PanelSizeKey,
  calibration: ScaleCalibration | null,
  existingPanels: PlacedPanel[],
  design: { id: string; name: string; image: string },
  color: string,
  colorName: string,
  obstacles?: Obstacle[],
  perspective?: PerspectiveTransform | null,
): PlacedPanel | null {
  const { widthPx, heightPx } = panelSizeInPixels(sizeKey, calibration);
  const snapped = snapToGrid(clickX, clickY, widthPx, heightPx);

  if (!canPlacePanel(mask, snapped.x, snapped.y, widthPx, heightPx, existingPanels, obstacles, perspective)) {
    return null;
  }

  return {
    id: generatePanelId(),
    designId: design.id,
    designName: design.name,
    designImage: design.image,
    sizeKey,
    color,
    colorName,
    x: snapped.x,
    y: snapped.y,
    renderWidth: widthPx,
    renderHeight: heightPx,
  };
}
