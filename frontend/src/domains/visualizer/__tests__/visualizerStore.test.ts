import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVisualizerStore } from '../model/visualizerStore';
import { createEmptyMask } from '../lib/maskUtils';
import type { Scene, PlacedPanel, PerspectiveCorners } from '../model/types';

// antd's `message` is a singleton with side effects (DOM mounting). Mock it
// so we can assert the autoFill catch-handler emits the right notification.
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
  };
});

import { message } from 'antd';

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
    vi.mocked(message.warning).mockClear();
    vi.mocked(message.info).mockClear();
    vi.mocked(message.error).mockClear();
    vi.mocked(message.success).mockClear();
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

  describe('autoFill', () => {
    const corners: PerspectiveCorners = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 },
    ];

    function setupReadyScene(calibrationMethod: 'auto' | 'manual' | null = 'manual') {
      const scene: Scene = {
        photo: { url: 'test.jpg', width: 500, height: 500 },
        wallMask: createEmptyMask(500, 500, 255),
        objectMask: { obstacles: [] },
        calibration: calibrationMethod ? { method: calibrationMethod, pixelsPerCm: 5 } : null,
        segmentationStatus: 'ready',
      };
      useVisualizerStore.getState().setScene(scene);
      useVisualizerStore.getState().setSelectedDesign('d1', 'Design 1', 'img.jpg');
    }

    it('warns and bails when no scene', () => {
      useVisualizerStore.getState().autoFill();
      expect(message.warning).toHaveBeenCalledWith(expect.stringContaining('фото'));
    });

    it('warns and bails when no design selected', () => {
      const scene: Scene = {
        photo: { url: 'test.jpg', width: 500, height: 500 },
        wallMask: createEmptyMask(500, 500, 255),
        objectMask: { obstacles: [] },
        calibration: { method: 'manual', pixelsPerCm: 5 },
        segmentationStatus: 'ready',
      };
      useVisualizerStore.getState().setScene(scene);
      useVisualizerStore.getState().autoFill();
      expect(message.warning).toHaveBeenCalledWith(expect.stringContaining('дизайн'));
    });

    it('fills panels in flat mode (no perspective)', () => {
      setupReadyScene('manual');
      useVisualizerStore.getState().autoFill();
      const panels = useVisualizerStore.getState().layout.panels;
      expect(panels.length).toBeGreaterThan(0);
      expect(message.warning).not.toHaveBeenCalled();
    });

    it('warns when perspective + auto calibration (AutoFillBlockedError)', () => {
      setupReadyScene('auto');
      useVisualizerStore.getState().setPerspectiveCorners(corners);
      const panelsBefore = useVisualizerStore.getState().layout.panels;

      useVisualizerStore.getState().autoFill();

      expect(message.warning).toHaveBeenCalledWith(
        expect.stringContaining('Откалибруйте масштаб'),
      );
      // Existing panels should NOT be wiped on the blocked path.
      expect(useVisualizerStore.getState().layout.panels).toBe(panelsBefore);
    });

    it('warns when perspective + null calibration (AutoFillBlockedError)', () => {
      setupReadyScene(null);
      useVisualizerStore.getState().setPerspectiveCorners(corners);

      useVisualizerStore.getState().autoFill();

      expect(message.warning).toHaveBeenCalledWith(
        expect.stringContaining('Откалибруйте масштаб'),
      );
    });

    it('does not wipe existing panels when no new spots fit (empty result)', () => {
      // Set up a scene where the wall mask is FULLY EMPTY (no wall pixels)
      // — autoFill will return 0 panels. Pre-existing panels in the layout
      // must be preserved.
      const scene: Scene = {
        photo: { url: 'test.jpg', width: 500, height: 500 },
        wallMask: createEmptyMask(500, 500, 0), // empty mask → 0 cells admitted
        objectMask: { obstacles: [] },
        calibration: { method: 'manual', pixelsPerCm: 5 },
        segmentationStatus: 'ready',
      };
      useVisualizerStore.getState().setScene(scene);
      useVisualizerStore.getState().setSelectedDesign('d1', 'Design 1', 'img.jpg');

      const existing = makePanel('keep-me');
      useVisualizerStore.getState().addPanel(existing);
      expect(useVisualizerStore.getState().layout.panels).toHaveLength(1);

      useVisualizerStore.getState().autoFill();

      expect(message.info).toHaveBeenCalledWith(
        expect.stringContaining('недостаточно места'),
      );
      // Pre-existing panel must survive.
      const after = useVisualizerStore.getState().layout.panels;
      expect(after).toHaveLength(1);
      expect(after[0]!.id).toBe('keep-me');
    });

    it('proceeds when perspective + manual calibration', () => {
      setupReadyScene('manual');
      useVisualizerStore.getState().setPerspectiveCorners(corners);

      useVisualizerStore.getState().autoFill();

      // Should NOT warn about calibration; should populate panels.
      const calibrationWarn = vi.mocked(message.warning).mock.calls.find((c) =>
        String(c[0]).includes('Откалибруйте'),
      );
      expect(calibrationWarn).toBeUndefined();
      expect(useVisualizerStore.getState().layout.panels.length).toBeGreaterThan(0);
    });
  });

  describe('runAutoPerspective', () => {
    function setupReadyScene() {
      const scene: Scene = {
        photo: { url: 'test.jpg', width: 500, height: 500 },
        wallMask: createEmptyMask(500, 500, 255),
        objectMask: { obstacles: [] },
        calibration: { method: 'manual', pixelsPerCm: 5 },
        segmentationStatus: 'ready',
      };
      useVisualizerStore.getState().setScene(scene);
    }

    /** Provider that returns 4 horizontal + 4 vertical lines on a full-mask
     *  image — same fixture used in vanishingPointDetector tests. */
    const successfulProvider = async () => {
      const lines = [];
      for (let i = 1; i <= 4; i++) {
        const y = (500 / 5) * i;
        lines.push({ p1: { x: 0, y }, p2: { x: 500, y } });
      }
      for (let i = 1; i <= 4; i++) {
        const x = (500 / 5) * i;
        lines.push({ p1: { x, y: 0 }, p2: { x, y: 500 } });
      }
      return lines;
    };

    it('does nothing when there is no scene', async () => {
      await useVisualizerStore.getState().runAutoPerspective(successfulProvider);
      expect(useVisualizerStore.getState().perspectiveCorners).toBeNull();
    });

    it('populates corners and flag on detector success', async () => {
      setupReadyScene();
      await useVisualizerStore.getState().runAutoPerspective(successfulProvider);
      const state = useVisualizerStore.getState();
      expect(state.perspectiveCorners).not.toBeNull();
      expect(state.scene!.perspectiveAutoDetected).toBe(true);
      expect(state.scene!.segmentationStatus).toBe('ready');
    });

    it('leaves corners null when provider throws (adapter unavailable)', async () => {
      setupReadyScene();
      const failingProvider = async () => {
        throw new Error('opencv-not-installed');
      };
      await useVisualizerStore.getState().runAutoPerspective(failingProvider);
      const state = useVisualizerStore.getState();
      expect(state.perspectiveCorners).toBeNull();
      expect(state.scene!.perspectiveAutoDetected).toBeFalsy();
      // Status must be back to 'ready' — never leave the user stuck on
      // the 'detecting-perspective' spinner.
      expect(state.scene!.segmentationStatus).toBe('ready');
    });

    it('leaves corners null when detector returns low-confidence', async () => {
      setupReadyScene();
      // Single direction (only horizontals) → low-confidence reason.
      const horizontalsOnly = async () => {
        const lines = [];
        for (let i = 1; i <= 6; i++) {
          const y = (500 / 7) * i;
          lines.push({ p1: { x: 0, y }, p2: { x: 500, y } });
        }
        return lines;
      };
      await useVisualizerStore.getState().runAutoPerspective(horizontalsOnly);
      const state = useVisualizerStore.getState();
      expect(state.perspectiveCorners).toBeNull();
      expect(state.scene!.segmentationStatus).toBe('ready');
    });

    it('clears perspectiveAutoDetected flag when corners are manually changed', async () => {
      setupReadyScene();
      await useVisualizerStore.getState().runAutoPerspective(successfulProvider);
      expect(useVisualizerStore.getState().scene!.perspectiveAutoDetected).toBe(true);

      // Simulate user dragging a corner.
      useVisualizerStore.getState().setPerspectiveCorners([
        { x: 10, y: 10 },
        { x: 490, y: 10 },
        { x: 490, y: 490 },
        { x: 10, y: 490 },
      ]);
      expect(useVisualizerStore.getState().scene!.perspectiveAutoDetected).toBe(false);
    });

    it('transitions through detecting-perspective status while running', async () => {
      setupReadyScene();
      const observed: string[] = [];
      // Provider whose promise we resolve manually so we can sample status
      // mid-flight.
      let resolveLines!: (lines: { p1: { x: number; y: number }; p2: { x: number; y: number } }[]) => void;
      const slowProvider = () =>
        new Promise<ReturnType<typeof successfulProvider> extends Promise<infer L> ? L : never>(
          (res) => {
            resolveLines = res as never;
          },
        );
      const promise = useVisualizerStore.getState().runAutoPerspective(slowProvider);
      observed.push(useVisualizerStore.getState().scene!.segmentationStatus);
      resolveLines(await successfulProvider());
      await promise;
      observed.push(useVisualizerStore.getState().scene!.segmentationStatus);
      expect(observed).toEqual(['detecting-perspective', 'ready']);
    });

    it('does not pollute a newer scene if a stale detection settles after photo swap', async () => {
      setupReadyScene();
      let resolveLines!: (lines: Awaited<ReturnType<typeof successfulProvider>>) => void;
      const slowProvider = () =>
        new Promise<Awaited<ReturnType<typeof successfulProvider>>>((res) => {
          resolveLines = res;
        });
      const promise = useVisualizerStore.getState().runAutoPerspective(slowProvider);
      // Simulate user uploading a different photo before detection resolves.
      useVisualizerStore.getState().setScene({
        photo: { url: 'OTHER.jpg', width: 800, height: 600 },
        wallMask: createEmptyMask(800, 600, 255),
        objectMask: { obstacles: [] },
        calibration: { method: 'manual', pixelsPerCm: 5 },
        segmentationStatus: 'ready',
      });
      // Now resolve the stale provider with valid lines that *would* succeed.
      resolveLines(await successfulProvider());
      await promise;
      const state = useVisualizerStore.getState();
      // New scene must be untouched: no auto-detected flag, no corners written
      // for the wrong photo.
      expect(state.scene!.photo.url).toBe('OTHER.jpg');
      expect(state.scene!.perspectiveAutoDetected).toBeFalsy();
      expect(state.perspectiveCorners).toBeNull();
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
