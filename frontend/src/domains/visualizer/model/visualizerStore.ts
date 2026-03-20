/**
 * Zustand store for the Visualizer domain.
 */

import { create } from 'zustand';
import type {
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
} from './types';
import { calculateCost } from '../lib/costCalculator';
import { autoFillWall } from '../lib/layoutEngine';

interface VisualizerState {
  // Scene
  scene: Scene | null;
  setScene: (scene: Scene) => void;
  updateWallMask: (mask: WallMask) => void;
  setSegmentationStatus: (status: Scene['segmentationStatus'], error?: string) => void;
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
  clearPanels: () => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setAccentZone: (zone: AccentZone | null) => void;
  autoFill: () => void;
  updateAllDesigns: (designId: string, designName: string, designImage: string) => void;

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

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  // Scene
  scene: null,
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
  setCalibration: (calibration) => {
    const scene = get().scene;
    if (scene) {
      set({ scene: { ...scene, calibration } });
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
  clearPanels: () =>
    set((state) => ({ layout: { ...state.layout, panels: [] } })),
  setPlacementMode: (mode) =>
    set((state) => ({ layout: { ...state.layout, placementMode: mode } })),
  setAccentZone: (zone) =>
    set((state) => ({ layout: { ...state.layout, accentZone: zone } })),

  autoFill: () => {
    const state = get();
    const { scene, selectedSizeKey, selectedDesignId, selectedDesignName, selectedDesignImage, selectedColor, selectedColorName, layout } = state;
    if (!scene?.wallMask || !selectedDesignId) return;

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
    });

    set({ layout: { ...layout, panels } });
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

  // Reset
  reset: () =>
    set({
      scene: null,
      layout: { ...EMPTY_LAYOUT },
      cost: { ...EMPTY_COST },
      undoStack: [],
      selectedDesignId: '',
      selectedDesignName: '',
      selectedDesignImage: '',
      selectedSizeKey: '30x30',
      selectedColor: '',
      selectedColorName: '',
    }),
}));
