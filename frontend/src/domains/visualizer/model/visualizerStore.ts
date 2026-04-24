/**
 * Zustand store for the Visualizer domain.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Point,
  Scene,
  PanelLayout,
  PlacedPanel,
  PanelSizeKey,
  PlacementMode,
  WallMask,
  AccentZone,
  MaskTool,
  CostBreakdown,
  ScaleCalibration,
  EditorMode,
  CalibrationPoints,
  PerspectiveCorners,
} from './types';
import { message } from 'antd';
import { calculateCost } from '../lib/costCalculator';
import { autoFillWall, AutoFillBlockedError } from '../lib/layoutEngine';
import { createEmptyMask } from '../lib/maskUtils';
import { createPerspective } from '../lib/perspectiveEngine';
import { uint8ArrayToBase64, base64ToUint8Array } from '../lib/maskSerialization';
import { detectFromLines, type LineProvider } from '../lib/vanishingPointDetector';
import {
  estimateScaleFromReference,
  type ReferenceCandidate,
} from '../lib/scaleEstimator';
import type { ReferenceDetector } from '../lib/referenceDetector';

interface VisualizerState {
  // Scene
  scene: Scene | null;
  segmentationProgress: number;
  setScene: (scene: Scene) => void;
  updateWallMask: (mask: WallMask) => void;
  setSegmentationStatus: (status: Scene['segmentationStatus'], error?: string) => void;
  setSegmentationProgress: (percent: number) => void;
  setCalibration: (calibration: ScaleCalibration) => void;

  // Panel selection
  selectedDesignId: string;
  selectedDesignName: string;
  selectedDesignImage: string;
  selectedSizeKey: PanelSizeKey;
  selectedColor: string;
  selectedColorName: string;
  setSelectedDesign: (id: string, name: string, image: string) => void;
  setSelectedSize: (key: PanelSizeKey) => void;
  setSelectedColor: (hex: string, name: string) => void;

  // Layout
  layout: PanelLayout;
  addPanel: (panel: PlacedPanel) => void;
  removePanel: (id: string) => void;
  movePanel: (id: string, x: number, y: number) => void;
  clearPanels: () => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setAccentZone: (zone: AccentZone | null) => void;
  autoFill: () => void;
  updateAllDesigns: (designId: string, designName: string, designImage: string) => void;

  // Editor mode (calibration / perspective)
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  calibrationPoints: CalibrationPoints;
  setCalibrationPoint: (which: 'start' | 'end', point: Point) => void;
  setCalibrationReference: (cm: number) => void;
  applyCalibration: () => boolean;
  resetCalibration: () => void;
  perspectiveCorners: PerspectiveCorners | null;
  setPerspectiveCorners: (corners: PerspectiveCorners | null) => void;
  /**
   * Run vanishing-point auto-detection. Sets segmentationStatus to
   * `'detecting-perspective'` while running, transitions back to `'ready'`
   * unconditionally on completion. On success, populates
   * `perspectiveCorners` and `scene.perspectiveAutoDetected`. Failures
   * (low confidence, multi-plane, OpenCV adapter unavailable) are silent —
   * the user can still set corners manually.
   */
  runAutoPerspective: (provider: LineProvider) => Promise<void>;
  /**
   * Run reference-object detection (Phase 4). Stores the result in
   * `scene.referenceCandidates`. Failures (model unavailable, network) are
   * silent — manual two-point calibration is always available. Race-protected
   * against photo swap (snapshots `photo.url` at start, bails on mismatch).
   */
  runAutoReferenceDetection: (detector: ReferenceDetector) => Promise<void>;
  /**
   * Apply one of the detected reference candidates as the active calibration.
   * Writes `scene.calibration = { method: 'auto', pixelsPerCm }` and sets
   * `scene.calibrationAutoDetected = true`. Returns `false` if the candidate
   * cannot be converted (zero bbox / unknown type).
   *
   * If `perspectiveCorners` are set, the bbox is back-projected into the wall
   * plane before measurement — without that, an outlet near a foreshortened
   * edge would yield a wildly off-scale result.
   */
  applyReferenceCandidate: (candidate: ReferenceCandidate) => boolean;
  wallBrightness: number;
  setWallBrightness: (brightness: number) => void;

  // Mask editing
  maskTool: MaskTool;
  brushSize: number;
  maskOpacity: number;
  maskVisible: boolean;
  setMaskTool: (tool: MaskTool) => void;
  setBrushSize: (size: number) => void;
  setMaskOpacity: (opacity: number) => void;
  toggleMaskVisible: () => void;

  // Undo
  undoStack: WallMask[];
  pushUndo: (mask: WallMask) => void;
  undo: () => void;

  // Cost
  cost: CostBreakdown;
  recalculateCost: (hasSubscription: boolean) => void;

  // Persistence (API — explicit user action)
  getProjectPayload: () => Record<string, unknown> | null;

  // Reset
  reset: () => void;
}

const EMPTY_LAYOUT: PanelLayout = {
  panels: [],
  placementMode: 'manual',
  accentZone: null,
};

const EMPTY_COST: CostBreakdown = {
  panelsBySize: { '30x30': 0, '30x60': 0, '60x60': 0 },
  totalPanels: 0,
  coveredAreaM2: 0,
  basePanelsCost: 0,
  overlaysCost: 0,
  overlayDiscount: 0,
  totalCost: 0,
};

export const useVisualizerStore = create<VisualizerState>()(
  persist(
  (set, get) => ({
  // Scene
  scene: null,
  segmentationProgress: 0,
  setScene: (scene) => set({ scene }),
  updateWallMask: (mask) => {
    const scene = get().scene;
    if (scene) {
      set({ scene: { ...scene, wallMask: mask } });
    }
  },
  setSegmentationStatus: (status, error) => {
    const scene = get().scene;
    if (scene) {
      set({
        scene: { ...scene, segmentationStatus: status, segmentationError: error },
      });
    }
  },
  setSegmentationProgress: (percent) => set({ segmentationProgress: percent }),
  setCalibration: (calibration) => {
    const scene = get().scene;
    if (scene) {
      // Direct calibration writes are always treated as manual — clear the
      // auto-detected flag so the UI status chip reflects user intent.
      set({ scene: { ...scene, calibration, calibrationAutoDetected: false } });
    }
  },

  // Panel selection
  selectedDesignId: '',
  selectedDesignName: '',
  selectedDesignImage: '',
  selectedSizeKey: '30x30',
  selectedColor: '',
  selectedColorName: '',
  setSelectedDesign: (id, name, image) =>
    set({ selectedDesignId: id, selectedDesignName: name, selectedDesignImage: image }),
  setSelectedSize: (key) => set({ selectedSizeKey: key }),
  setSelectedColor: (hex, name) => set({ selectedColor: hex, selectedColorName: name }),

  // Layout
  layout: { ...EMPTY_LAYOUT },
  addPanel: (panel) =>
    set((state) => ({
      layout: { ...state.layout, panels: [...state.layout.panels, panel] },
    })),
  removePanel: (id) =>
    set((state) => ({
      layout: {
        ...state.layout,
        panels: state.layout.panels.filter((p) => p.id !== id),
      },
    })),
  movePanel: (id, x, y) =>
    set((state) => ({
      layout: {
        ...state.layout,
        panels: state.layout.panels.map((p) =>
          p.id === id ? { ...p, x, y } : p,
        ),
      },
    })),
  clearPanels: () =>
    set((state) => ({ layout: { ...state.layout, panels: [] } })),
  setPlacementMode: (mode) =>
    set((state) => ({ layout: { ...state.layout, placementMode: mode } })),
  setAccentZone: (zone) =>
    set((state) => ({ layout: { ...state.layout, accentZone: zone } })),

  autoFill: () => {
    const state = get();
    const { scene, selectedSizeKey, selectedDesignId, selectedDesignName, selectedDesignImage, selectedColor, selectedColorName, layout, perspectiveCorners } = state;

    if (!scene?.wallMask) {
      message.warning('Сначала загрузите фото и дождитесь распознавания стены');
      return;
    }
    if (!selectedDesignId) {
      message.warning('Сначала выберите дизайн панели');
      return;
    }

    // Derive perspective transform from corners + photo bounds (wall-space
    // is sized to the photo for now; v2 will introduce a separate wallSpace).
    const perspective = perspectiveCorners
      ? createPerspective(perspectiveCorners, {
          w: scene.photo.width,
          h: scene.photo.height,
        })
      : null;

    try {
      const panels = autoFillWall({
        mask: scene.wallMask,
        sizeKey: selectedSizeKey,
        calibration: scene.calibration,
        designId: selectedDesignId,
        designName: selectedDesignName,
        designImage: selectedDesignImage,
        color: selectedColor,
        colorName: selectedColorName,
        accentZone: layout.accentZone,
        obstacles: scene.objectMask?.obstacles,
        perspective,
      });

      if (panels.length === 0) {
        // Don't wipe existing panels just because auto-fill found no new
        // spots (e.g. all cells covered by obstacles or below the coverage
        // threshold). The user explicitly clears via Clear All.
        message.info('Не удалось разместить панели — недостаточно места на стене');
        return;
      }

      set({ layout: { ...layout, panels } });
    } catch (err) {
      if (err instanceof AutoFillBlockedError) {
        message.warning(
          'Откалибруйте масштаб (две точки на известной длине) перед автозаполнением в режиме перспективы.',
        );
        return;
      }
      console.error('autoFill error:', err);
      message.error('Ошибка при автозаполнении');
    }
  },

  updateAllDesigns: (designId, designName, designImage) =>
    set((state) => ({
      layout: {
        ...state.layout,
        panels: state.layout.panels.map((p) => ({
          ...p,
          designId,
          designName,
          designImage,
        })),
      },
    })),

  // Editor mode (calibration / perspective)
  editorMode: 'default',
  setEditorMode: (mode) => set({ editorMode: mode }),
  calibrationPoints: { start: null, end: null, referenceCm: 200 },
  setCalibrationPoint: (which, point) =>
    set((s) => ({
      calibrationPoints: { ...s.calibrationPoints, [which]: point },
    })),
  setCalibrationReference: (cm) =>
    set((s) => ({
      calibrationPoints: { ...s.calibrationPoints, referenceCm: cm },
    })),
  applyCalibration: () => {
    const { calibrationPoints, scene } = get();
    const { start, end, referenceCm } = calibrationPoints;
    if (!start || !end || !scene || referenceCm <= 0) return false;
    const distPx = Math.hypot(end.x - start.x, end.y - start.y);
    if (distPx < 5) return false;
    const pixelsPerCm = distPx / referenceCm;
    set({
      scene: {
        ...scene,
        calibration: { method: 'reference', pixelsPerCm },
        // Manual two-point calibration overrides any prior auto-detection.
        calibrationAutoDetected: false,
      },
      editorMode: 'default',
    });
    return true;
  },
  resetCalibration: () =>
    set({ calibrationPoints: { start: null, end: null, referenceCm: 200 } }),
  perspectiveCorners: null,
  setPerspectiveCorners: (corners) => {
    // Any external corner change (drag, manual override, reset) means the
    // current corners are no longer "auto-detected" from the user's POV.
    const scene = get().scene;
    set({
      perspectiveCorners: corners,
      scene: scene ? { ...scene, perspectiveAutoDetected: false } : scene,
    });
  },
  runAutoPerspective: async (provider) => {
    const scene = get().scene;
    if (!scene?.wallMask) return;
    // Snapshot identity of the scene we kicked off detection for. After every
    // `await` we re-read the store and bail if the user has swapped photos,
    // reset, or otherwise moved on — otherwise a slow detection on photo A
    // would clobber state belonging to photo B (B1 in audit). URL is a
    // sufficient discriminant because `setScene` always mints a new PhotoAsset.
    const startedFor = scene.photo.url;
    const photoSize = { width: scene.photo.width, height: scene.photo.height };
    const stillCurrent = (): Scene | null => {
      const s = get().scene;
      return s && s.photo.url === startedFor ? s : null;
    };
    set({
      scene: { ...scene, segmentationStatus: 'detecting-perspective' },
    });
    try {
      const lines = await provider({
        imageUrl: scene.photo.url,
        mask: scene.wallMask,
        photoSize,
      });
      const current = stillCurrent();
      if (!current) return;
      const result = detectFromLines({ lines, mask: scene.wallMask, photoSize });
      if (result.ok) {
        set({
          perspectiveCorners: result.corners,
          scene: {
            ...current,
            segmentationStatus: 'ready',
            perspectiveAutoDetected: true,
          },
        });
      } else {
        set({
          scene: { ...current, segmentationStatus: 'ready' },
        });
      }
    } catch (err) {
      // Adapter unavailable / OpenCV not installed / WASM blocked.
      // Don't surface to the user — manual perspective is always available.
      // Only log in dev: in prod the stub adapter throws on every call by
      // design, and we don't want the noise in browser consoles.
      if (import.meta.env.DEV) {
        console.warn('[runAutoPerspective] provider failed:', err);
      }
      const current = stillCurrent();
      if (current) {
        set({ scene: { ...current, segmentationStatus: 'ready' } });
      }
    }
  },
  runAutoReferenceDetection: async (detector) => {
    const scene = get().scene;
    if (!scene) return;
    // Same race-protection pattern as runAutoPerspective: snapshot the photo
    // identity, bail post-await if the user swapped photos. Detection is
    // photo-specific, mis-applying it to a newer scene would be confusing.
    const startedFor = scene.photo.url;
    try {
      const candidates = await detector({
        imageUrl: scene.photo.url,
        photoSize: { width: scene.photo.width, height: scene.photo.height },
      });
      const current = get().scene;
      if (!current || current.photo.url !== startedFor) return;
      set({
        scene: { ...current, referenceCandidates: candidates },
      });
    } catch (err) {
      // Adapter unavailable / ONNX runtime missing / inference error.
      // Fail silently — manual calibration is always available.
      if (import.meta.env.DEV) {
        console.warn('[runAutoReferenceDetection] detector failed:', err);
      }
    }
  },
  applyReferenceCandidate: (candidate) => {
    const state = get();
    const scene = state.scene;
    if (!scene) return false;
    // Cache perspectiveCorners once (B14): the previous code re-read
    // `get().perspectiveCorners` three times — collapse to a single read.
    const corners = state.perspectiveCorners;
    const perspective = corners
      ? createPerspective(corners, {
          w: scene.photo.width,
          h: scene.photo.height,
        })
      : undefined;
    const estimated = estimateScaleFromReference(candidate, perspective);
    if (!estimated) return false;
    // Only close the calibration overlay if the user invoked this *from* it
    // (B16). Future call sites (e.g. Konva bbox-overlay in 4.2a) must not
    // silently flip the editor mode from under the user.
    const closeOverlay = state.editorMode === 'calibrating';
    set({
      scene: {
        ...scene,
        calibration: estimated.calibration,
        calibrationAutoDetected: true,
      },
      ...(closeOverlay ? { editorMode: 'default' as const } : {}),
    });
    return true;
  },
  wallBrightness: 128,
  setWallBrightness: (brightness) => set({ wallBrightness: brightness }),

  // Mask editing
  maskTool: 'brush',
  brushSize: 20,
  maskOpacity: 0.3,
  maskVisible: true,
  setMaskTool: (tool) => set({ maskTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setMaskOpacity: (opacity) => set({ maskOpacity: opacity }),
  toggleMaskVisible: () => set((s) => ({ maskVisible: !s.maskVisible })),

  // Undo
  undoStack: [],
  pushUndo: (mask) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-19), mask],
    })),
  undo: () => {
    const { undoStack, scene } = get();
    if (undoStack.length === 0 || !scene) return;
    const prevMask = undoStack[undoStack.length - 1]!;
    set({
      scene: { ...scene, wallMask: prevMask },
      undoStack: undoStack.slice(0, -1),
    });
  },

  // Cost
  cost: { ...EMPTY_COST },
  recalculateCost: (hasSubscription) => {
    const panels = get().layout.panels;
    set({ cost: calculateCost(panels, hasSubscription) });
  },

  // Persistence (API payload builder — explicit user action)
  getProjectPayload: () => {
    const state = get();
    if (!state.scene) return null;
    return {
      name: 'Мой проект',
      photo_url: state.scene.photo.url,
      photo_width: state.scene.photo.width,
      photo_height: state.scene.photo.height,
      wall_mask_base64: state.scene.wallMask
        ? uint8ArrayToBase64(state.scene.wallMask.data)
        : '',
      calibration_pixels_per_cm: state.scene.calibration?.pixelsPerCm ?? 5,
      panels: state.layout.panels.map((p) => ({
        design_id: p.designId,
        design_name: p.designName,
        design_image: p.designImage,
        size_key: p.sizeKey,
        color: p.color,
        color_name: p.colorName,
        x: p.x,
        y: p.y,
        render_width: p.renderWidth,
        render_height: p.renderHeight,
      })),
      perspective_corners: state.perspectiveCorners
        ? state.perspectiveCorners.map((c) => ({ x: c.x, y: c.y }))
        : null,
      placement_mode: state.layout.placementMode,
    };
  },

  // Reset
  reset: () => {
    try {
      localStorage.removeItem('wow-wall-visualizer');
    } catch {
      // ignore
    }
    set({
      scene: null,
      segmentationProgress: 0,
      layout: { ...EMPTY_LAYOUT },
      cost: { ...EMPTY_COST },
      undoStack: [],
      selectedDesignId: '',
      selectedDesignName: '',
      selectedDesignImage: '',
      selectedSizeKey: '30x30',
      selectedColor: '',
      selectedColorName: '',
      editorMode: 'default',
      calibrationPoints: { start: null, end: null, referenceCm: 200 },
      perspectiveCorners: null,
      wallBrightness: 128,
    });
  },
}),
  {
    name: 'wow-wall-visualizer',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      scene: state.scene
        ? {
            photo: state.scene.photo,
            wallMask: state.scene.wallMask
              ? {
                  _base64: uint8ArrayToBase64(state.scene.wallMask.data),
                  width: state.scene.wallMask.width,
                  height: state.scene.wallMask.height,
                }
              : null,
            objectMask: state.scene.objectMask,
            calibration: state.scene.calibration,
            segmentationStatus: state.scene.segmentationStatus,
            perspectiveAutoDetected: state.scene.perspectiveAutoDetected,
            // calibrationAutoDetected: persisted because it reflects which
            // mode produced the active calibration (user-chosen state).
            // referenceCandidates is intentionally NOT persisted — it's a
            // runtime ML output, regenerated on next photo open (D2 in plan).
            calibrationAutoDetected: state.scene.calibrationAutoDetected,
          }
        : null,
      layout: {
        panels: state.layout.panels,
        placementMode: state.layout.placementMode,
        accentZone: state.layout.accentZone,
      },
      selectedDesignId: state.selectedDesignId,
      selectedDesignName: state.selectedDesignName,
      selectedDesignImage: state.selectedDesignImage,
      selectedSizeKey: state.selectedSizeKey,
      selectedColor: state.selectedColor,
      selectedColorName: state.selectedColorName,
      perspectiveCorners: state.perspectiveCorners,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRehydrateStorage: () => (state: any) => {
      if (!state?.scene?.wallMask) return;
      // Restore Uint8Array from base64
      const wm = state.scene.wallMask;
      if (wm._base64) {
        state.scene.wallMask = {
          data: base64ToUint8Array(wm._base64),
          width: wm.width,
          height: wm.height,
        };
      }
    },
  },
));
