/**
 * Layout Engine — алгоритм размещения панелей на WallMask.
 *
 * Работает в «пиксельных» координатах фото.
 * Использует ScaleCalibration для пересчёта размеров панелей (см → px).
 */

import type {
  WallMask,
  PlacedPanel,
  PanelSizeKey,
  PanelSize,
  ScaleCalibration,
  AccentZone,
  Point,
} from '../model/types';
import { PANEL_SIZE_OPTIONS } from '../model/types';
import { wallCoverageInRect } from './maskUtils';

/** Minimum wall coverage in a grid cell to place a panel */
const WALL_COVERAGE_THRESHOLD = 0.7;

let panelIdCounter = 0;

export function generatePanelId(): string {
  return `panel-${Date.now()}-${++panelIdCounter}`;
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
 * If no calibration, falls back to default (1 cm = 5 px).
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
 * Check if a panel can be placed at position (x, y) on the mask.
 * Panel must fit within mask bounds and have sufficient wall coverage.
 */
export function canPlacePanel(
  mask: WallMask,
  x: number,
  y: number,
  widthPx: number,
  heightPx: number,
  existingPanels: PlacedPanel[],
): boolean {
  // Bounds check
  if (x < 0 || y < 0 || x + widthPx > mask.width || y + heightPx > mask.height) {
    return false;
  }

  // Wall coverage check
  const coverage = wallCoverageInRect(mask, x, y, widthPx, heightPx);
  if (coverage < WALL_COVERAGE_THRESHOLD) {
    return false;
  }

  // Overlap check with existing panels
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
    x: Math.round(x / gridStepX) * gridStepX,
    y: Math.round(y / gridStepY) * gridStepY,
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
}

/**
 * Auto-fill: place panels on all available wall surface.
 * Scans the mask in grid steps and places panels where coverage is sufficient.
 */
export function autoFillWall(config: AutoFillConfig): PlacedPanel[] {
  const { mask, sizeKey, calibration, accentZone } = config;
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
      if (canPlacePanel(mask, x, y, widthPx, heightPx, panels)) {
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
): PlacedPanel | null {
  const { widthPx, heightPx } = panelSizeInPixels(sizeKey, calibration);
  const snapped = snapToGrid(clickX, clickY, widthPx, heightPx);

  if (!canPlacePanel(mask, snapped.x, snapped.y, widthPx, heightPx, existingPanels)) {
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
