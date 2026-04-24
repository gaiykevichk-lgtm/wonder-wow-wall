// ─── Visualizer Domain Types (Bounded Context) ──────────────────────────────

// ─── Value Objects ───────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export type ObstacleType =
  | 'furniture'
  | 'window'
  | 'door'
  | 'decor'
  | 'person'
  | 'outlet'
  | 'other';

export interface Obstacle {
  type: ObstacleType;
  label: string;
  polygon: Point[];
  boundingBox: BoundingBox;
  confidence: number;
}

/**
 * Binary mask representing wall surface.
 * `data` is a flat Uint8Array where 255 = wall, 0 = not wall.
 * Dimensions match the source photo (after resize).
 */
export interface WallMask {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface ObjectMask {
  obstacles: Obstacle[];
}

export interface PhotoAsset {
  url: string;
  width: number;
  height: number;
  file?: File;
}

export type SegmentationStatus =
  | 'idle'
  | 'uploading'
  | 'loading-model'
  | 'segmenting'
  | 'processing'
  | 'detecting-perspective'
  | 'ready'
  | 'error';

export interface ScaleCalibration {
  /**
   * How `pixelsPerCm` was obtained:
   * - `'reference'` — user clicked two points on a known-cm distance (high trust).
   * - `'manual'`   — user typed `pixelsPerCm` directly (high trust).
   * - `'auto'`     — heuristic placeholder set on photo upload (low trust);
   *                  perspective auto-fill refuses to use this and the UI
   *                  surfaces a banner asking the user to calibrate.
   */
  method: 'reference' | 'manual' | 'auto';
  pixelsPerCm: number;
  wallWidthCm?: number;
  wallHeightCm?: number;
}

// ─── Entities ────────────────────────────────────────────────────────────────

export type PanelSizeKey = '30x30' | '30x60' | '60x60';

export interface PanelSize {
  key: PanelSizeKey;
  widthCm: number;
  heightCm: number;
  widthCells: number;
  heightCells: number;
}

export const PANEL_SIZE_OPTIONS: PanelSize[] = [
  { key: '30x30', widthCm: 30, heightCm: 30, widthCells: 1, heightCells: 1 },
  { key: '30x60', widthCm: 30, heightCm: 60, widthCells: 1, heightCells: 2 },
  { key: '60x60', widthCm: 60, heightCm: 60, widthCells: 2, heightCells: 2 },
];

export interface PlacedPanel {
  id: string;
  designId: string;
  designName: string;
  designImage: string;
  sizeKey: PanelSizeKey;
  color: string;
  colorName: string;
  /** Position on photo in pixels */
  x: number;
  y: number;
  /** Rendered dimensions in pixels (after perspective/scale) */
  renderWidth: number;
  renderHeight: number;
}

export type PlacementMode = 'auto' | 'manual' | 'accent';

export interface AccentZone {
  topLeft: Point;
  bottomRight: Point;
}

// ─── Aggregate Root ──────────────────────────────────────────────────────────

export interface Scene {
  photo: PhotoAsset;
  wallMask: WallMask | null;
  objectMask: ObjectMask | null;
  calibration: ScaleCalibration | null;
  segmentationStatus: SegmentationStatus;
  segmentationError?: string;
  /**
   * `true` when Phase-3 vanishing-point detection produced the current
   * perspective corners. Cleared the moment the user drags a corner
   * (manual override). Drives the green inline "Перспектива определена
   * автоматически" banner in `PhotoEditorPage` (data-testid
   * `perspective-auto-banner`).
   */
  perspectiveAutoDetected?: boolean;
}

export interface PanelLayout {
  panels: PlacedPanel[];
  placementMode: PlacementMode;
  accentZone: AccentZone | null;
}

export interface CostBreakdown {
  panelsBySize: Record<PanelSizeKey, number>;
  totalPanels: number;
  coveredAreaM2: number;
  basePanelsCost: number;
  overlaysCost: number;
  overlayDiscount: number;
  totalCost: number;
}

export interface VisualizationProject {
  id: string;
  scene: Scene;
  layout: PanelLayout;
  cost: CostBreakdown;
  selectedDesignId: string;
  selectedSizeKey: PanelSizeKey;
  selectedColor: string;
  selectedColorName: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Perspective & Calibration ──────────────────────────────────────────────

/** Calibration mode for the editor: mask editing, calibrating scale, or adjusting perspective */
export type EditorMode = 'default' | 'calibrating' | 'perspective';

/** Two calibration points on the photo for scale reference */
export interface CalibrationPoints {
  start: Point | null;
  end: Point | null;
  referenceCm: number;
}

/** Four corner points defining wall perspective (TL, TR, BR, BL) */
export type PerspectiveCorners = [Point, Point, Point, Point];

// ─── Mask editing ────────────────────────────────────────────────────────────

export type MaskTool = 'brush' | 'eraser';

export interface MaskEditAction {
  tool: MaskTool;
  points: Point[];
  brushSize: number;
}
