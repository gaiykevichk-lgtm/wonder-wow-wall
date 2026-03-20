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
  | 'processing'
  | 'ready'
  | 'error';

export interface ScaleCalibration {
  method: 'reference' | 'manual';
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

// ─── Mask editing ────────────────────────────────────────────────────────────

export type MaskTool = 'brush' | 'eraser';

export interface MaskEditAction {
  tool: MaskTool;
  points: Point[];
  brushSize: number;
}
