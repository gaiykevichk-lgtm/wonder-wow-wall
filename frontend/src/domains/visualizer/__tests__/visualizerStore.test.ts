import { describe, it, expect, beforeEach } from 'vitest';
import { useVisualizerStore } from '../model/visualizerStore';
import { createEmptyMask } from '../lib/maskUtils';
import type { Scene, PlacedPanel } from '../model/types';

function makeScene(): Scene {
  return {
    photo: { url: 'test.jpg', width: 500, height: 500 },
    wallMask: createEmptyMask(500, 500, 255),
    objectMask: { obstacles: [] },
    calibration: { method: 'manual', pixelsPerCm: 5 },
    segmentationStatus: 'ready',
  };
}

function makePanel(id: string): PlacedPanel {
  return {
    id,
    designId: 'd1',
    designName: 'Test',
    designImage: 'test.jpg',
    sizeKey: '30x30',
    color: '#FFF',
    colorName: 'White',
    x: 0,
    y: 0,
    renderWidth: 150,
    renderHeight: 150,
  };
}

describe('visualizerStore', () => {
  beforeEach(() => {
    useVisualizerStore.getState().reset();
  });

  describe('scene management', () => {
    it('sets scene', () => {
      const scene = makeScene();
      useVisualizerStore.getState().setScene(scene);
      expect(useVisualizerStore.getState().scene).toEqual(scene);
    });

    it('updates wall mask', () => {
      useVisualizerStore.getState().setScene(makeScene());
      const newMask = createEmptyMask(500, 500, 0);
      useVisualizerStore.getState().updateWallMask(newMask);
      expect(useVisualizerStore.getState().scene!.wallMask).toEqual(newMask);
    });

    it('sets segmentation status', () => {
      useVisualizerStore.getState().setScene(makeScene());
      useVisualizerStore.getState().setSegmentationStatus('error', 'fail');
      const scene = useVisualizerStore.getState().scene!;
      expect(scene.segmentationStatus).toBe('error');
      expect(scene.segmentationError).toBe('fail');
    });
  });

  describe('panel selection', () => {
    it('sets selected design', () => {
      useVisualizerStore.getState().setSelectedDesign('d2', 'Design 2', 'img2.jpg');
      const state = useVisualizerStore.getState();
      expect(state.selectedDesignId).toBe('d2');
      expect(state.selectedDesignName).toBe('Design 2');
    });

    it('sets selected size', () => {
      useVisualizerStore.getState().setSelectedSize('60x60');
      expect(useVisualizerStore.getState().selectedSizeKey).toBe('60x60');
    });

    it('sets selected color', () => {
      useVisualizerStore.getState().setSelectedColor('#F00', 'Red');
      expect(useVisualizerStore.getState().selectedColor).toBe('#F00');
      expect(useVisualizerStore.getState().selectedColorName).toBe('Red');
    });
  });

  describe('layout management', () => {
    it('adds panel', () => {
      const panel = makePanel('p1');
      useVisualizerStore.getState().addPanel(panel);
      expect(useVisualizerStore.getState().layout.panels).toHaveLength(1);
      expect(useVisualizerStore.getState().layout.panels[0]).toEqual(panel);
    });

    it('removes panel', () => {
      useVisualizerStore.getState().addPanel(makePanel('p1'));
      useVisualizerStore.getState().addPanel(makePanel('p2'));
      useVisualizerStore.getState().removePanel('p1');
      const panels = useVisualizerStore.getState().layout.panels;
      expect(panels).toHaveLength(1);
      expect(panels[0]!.id).toBe('p2');
    });

    it('clears panels', () => {
      useVisualizerStore.getState().addPanel(makePanel('p1'));
      useVisualizerStore.getState().addPanel(makePanel('p2'));
      useVisualizerStore.getState().clearPanels();
      expect(useVisualizerStore.getState().layout.panels).toHaveLength(0);
    });

    it('sets placement mode', () => {
      useVisualizerStore.getState().setPlacementMode('auto');
      expect(useVisualizerStore.getState().layout.placementMode).toBe('auto');
    });

    it('updates all designs', () => {
      useVisualizerStore.getState().addPanel(makePanel('p1'));
      useVisualizerStore.getState().addPanel(makePanel('p2'));
      useVisualizerStore.getState().updateAllDesigns('d3', 'New Design', 'new.jpg');
      const panels = useVisualizerStore.getState().layout.panels;
      expect(panels.every((p) => p.designId === 'd3')).toBe(true);
      expect(panels.every((p) => p.designName === 'New Design')).toBe(true);
    });
  });

  describe('mask editing', () => {
    it('sets mask tool', () => {
      useVisualizerStore.getState().setMaskTool('eraser');
      expect(useVisualizerStore.getState().maskTool).toBe('eraser');
    });

    it('sets brush size', () => {
      useVisualizerStore.getState().setBrushSize(50);
      expect(useVisualizerStore.getState().brushSize).toBe(50);
    });

    it('toggles mask visibility', () => {
      expect(useVisualizerStore.getState().maskVisible).toBe(true);
      useVisualizerStore.getState().toggleMaskVisible();
      expect(useVisualizerStore.getState().maskVisible).toBe(false);
    });
  });

  describe('undo', () => {
    it('pushes and pops undo stack', () => {
      const scene = makeScene();
      useVisualizerStore.getState().setScene(scene);

      const mask1 = createEmptyMask(500, 500, 128);
      useVisualizerStore.getState().pushUndo(mask1);
      expect(useVisualizerStore.getState().undoStack).toHaveLength(1);

      useVisualizerStore.getState().undo();
      expect(useVisualizerStore.getState().scene!.wallMask).toEqual(mask1);
      expect(useVisualizerStore.getState().undoStack).toHaveLength(0);
    });

    it('limits undo stack to 20', () => {
      const scene = makeScene();
      useVisualizerStore.getState().setScene(scene);

      for (let i = 0; i < 25; i++) {
        useVisualizerStore.getState().pushUndo(createEmptyMask(10, 10, i));
      }
      expect(useVisualizerStore.getState().undoStack).toHaveLength(20);
    });
  });

  describe('cost', () => {
    it('recalculates cost', () => {
      useVisualizerStore.getState().addPanel(makePanel('p1'));
      useVisualizerStore.getState().recalculateCost(false);
      const cost = useVisualizerStore.getState().cost;
      expect(cost.totalPanels).toBe(1);
      expect(cost.totalCost).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('resets all state', () => {
      useVisualizerStore.getState().setScene(makeScene());
      useVisualizerStore.getState().addPanel(makePanel('p1'));
      useVisualizerStore.getState().setSelectedDesign('d2', 'D2', 'img.jpg');
      useVisualizerStore.getState().reset();

      const state = useVisualizerStore.getState();
      expect(state.scene).toBeNull();
      expect(state.layout.panels).toHaveLength(0);
      expect(state.selectedDesignId).toBe('');
      expect(state.undoStack).toHaveLength(0);
    });
  });
});
