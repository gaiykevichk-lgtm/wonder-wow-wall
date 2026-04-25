import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

    it('setPerspectiveCorners seeds trusted calibration when only upload-heuristic exists', () => {
      setupReadyScene('auto');
      useVisualizerStore.getState().setPerspectiveCorners(corners);
      const cal = useVisualizerStore.getState().scene!.calibration;
      // Corners imply a wall quad — the store derives a bbox-width/300 scale
      // and marks it with `wallWidthCm` so `isTrustedCalibration` accepts it
      // for perspective auto-fill. Upload heuristic is replaced.
      expect(cal).toMatchObject({ method: 'auto', wallWidthCm: 300 });
      expect(cal!.pixelsPerCm).toBeGreaterThan(0);

      // autoFill now succeeds (no AutoFillBlockedError warning).
      useVisualizerStore.getState().autoFill();
      expect(message.warning).not.toHaveBeenCalledWith(
        expect.stringContaining('Откалибруйте масштаб'),
      );
      expect(useVisualizerStore.getState().layout.panels.length).toBeGreaterThan(0);
    });

    it('setPerspectiveCorners seeds trusted calibration when calibration was null', () => {
      setupReadyScene(null);
      useVisualizerStore.getState().setPerspectiveCorners(corners);
      const cal = useVisualizerStore.getState().scene!.calibration;
      expect(cal).toMatchObject({ method: 'auto', wallWidthCm: 300 });

      useVisualizerStore.getState().autoFill();
      expect(message.warning).not.toHaveBeenCalledWith(
        expect.stringContaining('Откалибруйте масштаб'),
      );
      expect(useVisualizerStore.getState().layout.panels.length).toBeGreaterThan(0);
    });

    it('setPerspectiveCorners preserves a real reference/manual calibration', () => {
      setupReadyScene('manual');
      const before = useVisualizerStore.getState().scene!.calibration;
      useVisualizerStore.getState().setPerspectiveCorners(corners);
      const after = useVisualizerStore.getState().scene!.calibration;
      // User-confirmed calibration must never be clobbered by the corner seed.
      expect(after).toEqual(before);
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

    it('falls back to mask-bbox trapezoid when provider throws (adapter unavailable)', async () => {
      setupReadyScene();
      const failingProvider = async () => {
        throw new Error('opencv-not-installed');
      };
      await useVisualizerStore.getState().runAutoPerspective(failingProvider);
      const state = useVisualizerStore.getState();
      // New contract: when no ML detector is available, we seed a
      // trapezoidal starting shape from the wall-mask bbox so the panels
      // still render with visible perspective. The user then refines in
      // the editor. perspectiveAutoDetected stays FALSE to keep UI copy
      // honest — "starting shape", not "detected".
      expect(state.perspectiveCorners).not.toBeNull();
      expect(state.scene!.perspectiveAutoDetected).toBe(false);
      // Status must be back to 'ready' — never leave the user stuck on
      // the 'detecting-perspective' spinner.
      expect(state.scene!.segmentationStatus).toBe('ready');
    });

    it('falls back to mask-bbox trapezoid when detector returns low-confidence', async () => {
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
      // Same new contract as above — heuristic fires when ML returns null.
      expect(state.perspectiveCorners).not.toBeNull();
      expect(state.scene!.perspectiveAutoDetected).toBe(false);
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

    /**
     * Helper: after invoking runAutoPerspective, the store first awaits the
     * backend depth call (Stage 1). In the test environment there is no
     * real server → fetch rejects synchronously, but the rejection lands in
     * microtasks. Tests that need to interact with Stage 2 (the OpenCV
     * provider) must flush enough microtasks for the backend catch to
     * unwind and the provider to be invoked. A small setTimeout(0) flushes
     * both microtask AND task queue, which covers every intermediate
     * async boundary (await api.post, await mapError, etc.) in one call.
     */
    const flushToStage2 = () =>
      new Promise<void>((res) => setTimeout(res, 0));

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
      // Stage 1 backend fetch must fail and unwind before the provider runs.
      await flushToStage2();
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
      // Stage 1 backend fetch must fail and unwind before the provider runs.
      await flushToStage2();
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

  describe('runAutoReferenceDetection', () => {
    function setupReadyScene() {
      const scene: Scene = {
        photo: { url: 'photo-A.jpg', width: 800, height: 600 },
        wallMask: createEmptyMask(800, 600, 255),
        objectMask: { obstacles: [] },
        calibration: { method: 'manual', pixelsPerCm: 5 },
        segmentationStatus: 'ready',
      };
      useVisualizerStore.getState().setScene(scene);
    }

    const successDetector = async () => [
      {
        type: 'outlet' as const,
        bbox: { x: 100, y: 200, width: 80, height: 80 },
        confidence: 0.92,
      },
    ];

    it('does nothing when there is no scene', async () => {
      await useVisualizerStore.getState().runAutoReferenceDetection(successDetector);
      expect(useVisualizerStore.getState().scene).toBeNull();
    });

    it('writes referenceCandidates on detector success', async () => {
      setupReadyScene();
      await useVisualizerStore.getState().runAutoReferenceDetection(successDetector);
      const state = useVisualizerStore.getState();
      expect(state.scene!.referenceCandidates).toHaveLength(1);
      expect(state.scene!.referenceCandidates![0]!.type).toBe('outlet');
      // calibration must NOT change just because candidates were detected —
      // the user has to apply one explicitly via applyReferenceCandidate.
      expect(state.scene!.calibration?.method).toBe('manual');
      expect(state.scene!.calibrationAutoDetected).toBeFalsy();
    });

    it('silently swallows detector errors (model unavailable)', async () => {
      setupReadyScene();
      const failing = async () => {
        throw new Error('onnx-not-installed');
      };
      await useVisualizerStore.getState().runAutoReferenceDetection(failing);
      const state = useVisualizerStore.getState();
      expect(state.scene!.referenceCandidates).toBeUndefined();
      // Original calibration / mask intact.
      expect(state.scene!.calibration?.method).toBe('manual');
    });

    it('does not pollute a newer scene if a stale detection settles after photo swap', async () => {
      setupReadyScene();
      let resolveDetect!: (cands: Awaited<ReturnType<typeof successDetector>>) => void;
      const slow = () =>
        new Promise<Awaited<ReturnType<typeof successDetector>>>((res) => {
          resolveDetect = res;
        });
      const promise = useVisualizerStore.getState().runAutoReferenceDetection(slow);
      // Simulate user uploading a different photo before detection resolves.
      useVisualizerStore.getState().setScene({
        photo: { url: 'photo-B.jpg', width: 1024, height: 768 },
        wallMask: createEmptyMask(1024, 768, 255),
        objectMask: { obstacles: [] },
        calibration: { method: 'manual', pixelsPerCm: 5 },
        segmentationStatus: 'ready',
      });
      resolveDetect(await successDetector());
      await promise;
      // New scene must be untouched.
      expect(useVisualizerStore.getState().scene!.photo.url).toBe('photo-B.jpg');
      expect(useVisualizerStore.getState().scene!.referenceCandidates).toBeUndefined();
    });
  });

  describe('applyReferenceCandidate', () => {
    function setupReadyScene() {
      const scene: Scene = {
        photo: { url: 'photo.jpg', width: 800, height: 600 },
        wallMask: createEmptyMask(800, 600, 255),
        objectMask: { obstacles: [] },
        calibration: { method: 'manual', pixelsPerCm: 5 },
        segmentationStatus: 'ready',
      };
      useVisualizerStore.getState().setScene(scene);
    }

    it('returns false when there is no scene', () => {
      const ok = useVisualizerStore.getState().applyReferenceCandidate({
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 80, height: 80 },
        confidence: 0.9,
      });
      expect(ok).toBe(false);
    });

    it('writes auto calibration and sets the flag on success', () => {
      setupReadyScene();
      const ok = useVisualizerStore.getState().applyReferenceCandidate({
        type: 'outlet',
        bbox: { x: 100, y: 100, width: 80, height: 80 },
        confidence: 0.9,
      });
      expect(ok).toBe(true);
      const scene = useVisualizerStore.getState().scene!;
      // outlet 80px wide / 8 cm = 10 px/cm
      expect(scene.calibration!.method).toBe('auto');
      expect(scene.calibration!.pixelsPerCm).toBeCloseTo(10, 5);
      expect(scene.calibrationAutoDetected).toBe(true);
    });

    it('returns false for an unusable candidate (zero bbox)', () => {
      setupReadyScene();
      const ok = useVisualizerStore.getState().applyReferenceCandidate({
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 0, height: 0 },
        confidence: 0.9,
      });
      expect(ok).toBe(false);
      // Original calibration must remain.
      expect(useVisualizerStore.getState().scene!.calibration?.method).toBe('manual');
    });

    it('manual setCalibration after auto-apply clears the flag', () => {
      setupReadyScene();
      useVisualizerStore.getState().applyReferenceCandidate({
        type: 'outlet',
        bbox: { x: 100, y: 100, width: 80, height: 80 },
        confidence: 0.9,
      });
      expect(useVisualizerStore.getState().scene!.calibrationAutoDetected).toBe(true);
      useVisualizerStore.getState().setCalibration({ method: 'manual', pixelsPerCm: 7 });
      expect(useVisualizerStore.getState().scene!.calibrationAutoDetected).toBe(false);
    });

    it('closes the calibration overlay when invoked from calibrating mode', () => {
      setupReadyScene();
      useVisualizerStore.getState().setEditorMode('calibrating');
      const ok = useVisualizerStore.getState().applyReferenceCandidate({
        type: 'outlet',
        bbox: { x: 100, y: 100, width: 80, height: 80 },
        confidence: 0.9,
      });
      expect(ok).toBe(true);
      expect(useVisualizerStore.getState().editorMode).toBe('default');
    });

    it('preserves editorMode when invoked from a non-calibrating mode (B16)', () => {
      setupReadyScene();
      useVisualizerStore.getState().setEditorMode('perspective');
      const ok = useVisualizerStore.getState().applyReferenceCandidate({
        type: 'outlet',
        bbox: { x: 100, y: 100, width: 80, height: 80 },
        confidence: 0.9,
      });
      expect(ok).toBe(true);
      // Mode must NOT be reset — future call sites (e.g. Konva bbox overlay)
      // can apply a candidate without yanking the user out of perspective edit.
      expect(useVisualizerStore.getState().editorMode).toBe('perspective');
      expect(useVisualizerStore.getState().scene!.calibrationAutoDetected).toBe(true);
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

// ─── Phase 5C — backend autosave wiring ────────────────────────────

import * as visualizerApi from '../lib/visualizerApi';
import { __syncInternals } from '../model/visualizerStore';

describe('visualizerStore — backend autosave (Phase 5C)', () => {
  beforeEach(() => {
    useVisualizerStore.getState().reset();
    __syncInternals.cancelAll();
    vi.useFakeTimers();
    vi.mocked(message.warning).mockClear();
    vi.mocked(message.error).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const dto = (overrides: Partial<visualizerApi.VisualizationProjectDTO> = {}): visualizerApi.VisualizationProjectDTO => ({
    id: 'proj-1',
    name: 'P',
    photoUrl: '',
    photoWidth: 0,
    photoHeight: 0,
    wallMaskBase64: '',
    calibrationPixelsPerCm: 5,
    perspectiveCorners: null,
    placementMode: 'manual',
    createdAt: '',
    updatedAt: '',
    calibration: null,
    perspectiveAutoDetected: false,
    calibrationAutoDetected: false,
    version: 1,
    panels: [],
    ...overrides,
  });

  const square = (): PerspectiveCorners => [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 100 }, { x: 0, y: 100 },
  ];

  describe('setLoadedProject', () => {
    it('hydrates projectId, version, corners, calibration', () => {
      useVisualizerStore.getState().setScene(makeScene());
      useVisualizerStore.getState().setLoadedProject(dto({
        id: 'srv-42',
        version: 9,
        perspectiveCorners: square(),
        calibration: { method: 'manual', pixelsPerCm: 7 },
      }));

      const s = useVisualizerStore.getState();
      expect(s.projectId).toBe('srv-42');
      expect(s.serverVersion).toBe(9);
      expect(s.perspectiveCorners).toEqual(square());
      expect(s.scene!.calibration).toEqual({ method: 'manual', pixelsPerCm: 7 });
    });
  });

  describe('setPerspectiveCornersAndSync', () => {
    it('is a no-op (network) when projectId is null', async () => {
      const spy = vi.spyOn(visualizerApi, 'updatePerspective')
        .mockResolvedValue(dto());

      // No setLoadedProject — projectId stays null.
      useVisualizerStore.getState().setPerspectiveCornersAndSync(square());
      await vi.advanceTimersByTimeAsync(2000);

      // Local state still updates so the UI is responsive.
      expect(useVisualizerStore.getState().perspectiveCorners).toEqual(square());
      // …but the backend is never touched while the project is unsaved.
      expect(spy).not.toHaveBeenCalled();
    });

    it('debounces ~1s and PATCHes once with current version', async () => {
      const spy = vi.spyOn(visualizerApi, 'updatePerspective')
        .mockResolvedValue(dto({ version: 5 }));
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 4 }));

      const setter = useVisualizerStore.getState().setPerspectiveCornersAndSync;
      // Three rapid edits inside the debounce window collapse to one PATCH.
      setter(square());
      setter(square());
      setter(square());

      // Just before the debounce fires.
      await vi.advanceTimersByTimeAsync(900);
      expect(spy).not.toHaveBeenCalled();

      // After the debounce window.
      await vi.advanceTimersByTimeAsync(200);
      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0]!;
      expect(args[0]).toBe('p1');
      expect(args[2]).toBe(4); // version we loaded
      // Server's bumped version is committed.
      expect(useVisualizerStore.getState().serverVersion).toBe(5);
    });

    it('on stale-version error: warns the user but keeps local state', async () => {
      vi.spyOn(visualizerApi, 'updatePerspective').mockRejectedValue(
        new visualizerApi.StaleVersionError('stale', 12),
      );
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 4 }));

      useVisualizerStore.getState().setPerspectiveCornersAndSync(square());
      await vi.advanceTimersByTimeAsync(1100);
      // microtask flush so the rejected promise's catch runs
      await Promise.resolve();
      await Promise.resolve();

      expect(message.warning).toHaveBeenCalledWith(
        expect.stringContaining('другом окне'),
      );
      // Local edit is preserved — the user can still see what they were doing.
      expect(useVisualizerStore.getState().perspectiveCorners).toEqual(square());
    });

    it('on degenerate-corners error: silent skip (intermediate drag state)', async () => {
      vi.spyOn(visualizerApi, 'updatePerspective').mockRejectedValue(
        new visualizerApi.DegenerateCornersError('degenerate'),
      );
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 4 }));

      useVisualizerStore.getState().setPerspectiveCornersAndSync(square());
      await vi.advanceTimersByTimeAsync(1100);
      await Promise.resolve();
      await Promise.resolve();

      // No toast, no console.error path
      expect(message.warning).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
    });
  });

  describe('setCalibrationAndSync', () => {
    it('debounces and PATCHes calibration with version', async () => {
      const spy = vi.spyOn(visualizerApi, 'updateCalibration')
        .mockResolvedValue(dto({ version: 5 }));
      useVisualizerStore.getState().setScene(makeScene());
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 4 }));

      useVisualizerStore.getState().setCalibrationAndSync({
        method: 'manual',
        pixelsPerCm: 8,
      });
      await vi.advanceTimersByTimeAsync(1100);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![2]).toBe(4);
      expect(useVisualizerStore.getState().serverVersion).toBe(5);
      // Local mirror updated immediately, before the network round trip.
      expect(useVisualizerStore.getState().scene!.calibration?.pixelsPerCm).toBe(8);
    });
  });

  // X9 closure — before this coverage, `applyCalibration` and
  // `applyReferenceCandidate` wrote `scene.calibration` via direct `set()`
  // without firing any PATCH. The audit caught the regression only because
  // the apply-methods were reviewed manually; these tests make the sync
  // contract executable so future refactors cannot silently unwire it.
  describe('applyCalibration — X1 sync wiring', () => {
    it('triggers a debounced PATCH when projectId is set', async () => {
      const spy = vi.spyOn(visualizerApi, 'updateCalibration')
        .mockResolvedValue(dto({ version: 5 }));
      useVisualizerStore.getState().setScene(makeScene());
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 4 }));

      const store = useVisualizerStore.getState();
      store.setCalibrationPoint('start', { x: 0, y: 0 });
      store.setCalibrationPoint('end', { x: 100, y: 0 });
      store.setCalibrationReference(100); // 100cm, 100px → pixels_per_cm = 1
      const ok = store.applyCalibration();
      expect(ok).toBe(true);

      // Local state reflects the manual calibration immediately.
      const after = useVisualizerStore.getState();
      expect(after.scene!.calibration?.method).toBe('reference');
      expect(after.scene!.calibration?.pixelsPerCm).toBeCloseTo(1);
      expect(after.scene!.calibrationAutoDetected).toBe(false);

      // Debounced PATCH fires after the window.
      await vi.advanceTimersByTimeAsync(1100);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![0]).toBe('p1');
      expect(spy.mock.calls[0]![2]).toBe(4);
      expect(useVisualizerStore.getState().serverVersion).toBe(5);
    });

    it('is local-only when projectId is null (unsaved scene)', async () => {
      const spy = vi.spyOn(visualizerApi, 'updateCalibration')
        .mockResolvedValue(dto());
      useVisualizerStore.getState().setScene(makeScene());
      // No setLoadedProject — projectId remains null.

      const store = useVisualizerStore.getState();
      store.setCalibrationPoint('start', { x: 0, y: 0 });
      store.setCalibrationPoint('end', { x: 100, y: 0 });
      store.setCalibrationReference(100);
      store.applyCalibration();
      await vi.advanceTimersByTimeAsync(2000);

      // Backend never touched on an unsaved scene — PATCH would 404.
      expect(spy).not.toHaveBeenCalled();
      // Local mirror still updates so the user sees immediate feedback.
      expect(useVisualizerStore.getState().scene!.calibration?.method).toBe('reference');
    });
  });

  describe('applyReferenceCandidate — X1 sync wiring', () => {
    it('triggers a debounced PATCH when projectId is set', async () => {
      const spy = vi.spyOn(visualizerApi, 'updateCalibration')
        .mockResolvedValue(dto({ version: 6 }));
      useVisualizerStore.getState().setScene(makeScene());
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 5 }));

      // Outlet candidate (≈86 × 86 mm = 8.6 cm), bbox 86 px → ~10 px/cm.
      useVisualizerStore.getState().applyReferenceCandidate({
        type: 'outlet',
        bbox: { x: 10, y: 10, width: 86, height: 86 },
        confidence: 0.9,
      });

      const after = useVisualizerStore.getState();
      expect(after.scene!.calibration?.method).toBe('auto');
      expect(after.scene!.calibrationAutoDetected).toBe(true);

      await vi.advanceTimersByTimeAsync(1100);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![0]).toBe('p1');
      expect(spy.mock.calls[0]![2]).toBe(5);
      expect(useVisualizerStore.getState().serverVersion).toBe(6);
    });
  });

  // X10 closure — `_perspectiveSyncCtrl` and `_calibrationSyncCtrl` are
  // per-kind: an in-flight calibration PATCH must not be aborted by a new
  // perspective drag, and vice versa. This was documented in the module-
  // level comment but never exercised.
  describe('per-kind AbortController independence (X10)', () => {
    it('a new perspective edit does not abort an in-flight calibration PATCH', async () => {
      // Calibration PATCH takes 2s to resolve — still in flight when we
      // fire the perspective edit.
      vi.spyOn(visualizerApi, 'updateCalibration').mockImplementation(
        (_pid, _cal, _ver, opts) =>
          new Promise((resolve, reject) => {
            opts?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
            setTimeout(() => resolve(dto({ version: 5 })), 2000);
          }),
      );
      const pSpy = vi.spyOn(visualizerApi, 'updatePerspective')
        .mockResolvedValue(dto({ version: 6 }));

      useVisualizerStore.getState().setScene(makeScene());
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 4 }));

      // Kick off calibration PATCH: debounces 1s, then request flies.
      useVisualizerStore.getState().setCalibrationAndSync({
        method: 'manual',
        pixelsPerCm: 8,
      });
      await vi.advanceTimersByTimeAsync(1000); // calibration PATCH now in flight

      // Fire perspective edit while calibration is still pending — should
      // use a *separate* AbortController (per-kind).
      useVisualizerStore.getState().setPerspectiveCornersAndSync(square());
      await vi.advanceTimersByTimeAsync(1100); // perspective PATCH fires

      // Perspective PATCH completed on its own controller.
      expect(pSpy).toHaveBeenCalledTimes(1);
      // Calibration PATCH is still in flight, *not* aborted.
      // Let it resolve and verify it lands cleanly.
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      await Promise.resolve();
      // The calibration controller signal never aborted → no AbortError warning.
      expect(message.warning).not.toHaveBeenCalled();
    });
  });

  describe('cancelPendingSync / reset', () => {
    it('reset() aborts pending PATCH', async () => {
      const spy = vi.spyOn(visualizerApi, 'updatePerspective')
        .mockResolvedValue(dto());
      useVisualizerStore.getState().setLoadedProject(dto({ id: 'p1', version: 4 }));
      useVisualizerStore.getState().setPerspectiveCornersAndSync(square());
      // Don't advance timers — debounce is pending.

      useVisualizerStore.getState().reset();
      await vi.advanceTimersByTimeAsync(2000);

      // The pending debounce was cleared by reset → no PATCH ever fired.
      expect(spy).not.toHaveBeenCalled();
      expect(useVisualizerStore.getState().projectId).toBeNull();
    });
  });
});
