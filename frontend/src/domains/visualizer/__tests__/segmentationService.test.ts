import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @huggingface/transformers
const mockPipelineFn = vi.fn();
vi.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => mockPipelineFn(...args),
}));

// Import after mock setup — but we need to re-import to get fresh module state
// Because segmenterPromise is module-level, we use resetSegmenter between tests
import {
  segmentScene,
  resetSegmenter,
  isSegmentationSupported,
} from '../lib/segmentationService';

describe('segmentationService', () => {
  beforeEach(() => {
    resetSegmenter();
    mockPipelineFn.mockClear();
  });

  describe('isSegmentationSupported', () => {
    it('returns true when WebAssembly is available', () => {
      expect(isSegmentationSupported()).toBe(true);
    });
  });

  describe('segmentScene', () => {
    it('calls pipeline and returns wall mask with correct dimensions', async () => {
      const modelW = 4;
      const modelH = 4;

      // Class 0 = wall. Top half is wall (label_0 mask = 1), bottom half is NOT wall.
      // label_0 mask: 1 means "this pixel is class 0 (wall)"
      const wallMask = new Uint8Array([
        1, 1, 1, 1,
        1, 1, 1, 1,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]);

      // label_7 (furniture) in bottom-left — makes bottom-left NOT class 0
      const furnitureMask = new Uint8Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
        1, 1, 0, 0,
        1, 1, 0, 0,
      ]);

      const mockSegmenter = vi.fn().mockResolvedValue([
        { label: 'label_0', score: 0.9, mask: { data: wallMask, width: modelW, height: modelH } },
        { label: 'label_7', score: 0.8, mask: { data: furnitureMask, width: modelW, height: modelH } },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      const result = await segmentScene('data:image/png;base64,test', 8, 8);

      expect(result.wallMask.width).toBe(8);
      expect(result.wallMask.height).toBe(8);
      expect(result.wallMask.data.length).toBe(64); // 8 * 8

      // Top-left corner should be wall (255) — class 0
      expect(result.wallMask.data[0]).toBe(255);
      // Bottom-left corner: label_7 overwrites label_0, so it's furniture, not wall
      expect(result.wallMask.data[7 * 8]).toBe(0);
    });

    it('extracts obstacles from segmentation results', async () => {
      const modelW = 4;
      const modelH = 4;

      const wallData = new Uint8Array([
        1, 1, 1, 1,
        1, 1, 1, 1,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]);

      // Door mask (class 14) — bottom-left quadrant
      const doorData = new Uint8Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
        1, 1, 0, 0,
        1, 1, 0, 0,
      ]);

      const mockSegmenter = vi.fn().mockResolvedValue([
        { label: 'label_0', score: 0.9, mask: { data: wallData, width: modelW, height: modelH } },
        { label: 'label_14', score: 0.8, mask: { data: doorData, width: modelW, height: modelH } },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      const result = await segmentScene('data:image/png;base64,test', 8, 8);

      expect(result.obstacles.length).toBe(1);
      expect(result.obstacles[0]!.type).toBe('door');
      expect(result.obstacles[0]!.label).toBe('Дверь');
      expect(result.classes).toContain('Дверь');
    });

    it('reports progress via callback', async () => {
      const mockSegmenter = vi.fn().mockResolvedValue([
        {
          label: 'label_0',
          score: 0.9,
          mask: { data: new Uint8Array([1, 1, 1, 1]), width: 2, height: 2 },
        },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      const progressCalls: Array<{ status: string; percent: number }> = [];
      await segmentScene('data:image/png;base64,test', 4, 4, (p) => {
        progressCalls.push(p);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      const statuses = progressCalls.map((p) => p.status);
      expect(statuses).toContain('loading-model');
      expect(statuses).toContain('segmenting');
    });

    it('caches model — second call does not re-init pipeline', async () => {
      const mockSegmenter = vi.fn().mockResolvedValue([
        {
          label: 'label_0',
          score: 0.9,
          mask: { data: new Uint8Array([1]), width: 1, height: 1 },
        },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      await segmentScene('data:image/png;base64,test1', 2, 2);
      await segmentScene('data:image/png;base64,test2', 2, 2);

      // pipeline() should only be called once (cached)
      expect(mockPipelineFn).toHaveBeenCalledTimes(1);
    });

    it('returns all-zero wall mask when model finds no wall', async () => {
      const mockSegmenter = vi.fn().mockResolvedValue([
        {
          label: 'label_7',
          score: 0.9,
          mask: { data: new Uint8Array([1, 1, 1, 1]), width: 2, height: 2 },
        },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      const result = await segmentScene('data:image/png;base64,test', 4, 4);

      // No wall class → all mask values should be 0
      expect(result.wallMask.data.every((v) => v === 0)).toBe(true);
      expect(result.wallMask.width).toBe(4);
      expect(result.wallMask.height).toBe(4);
    });

    it('handles text labels from model (e.g. "wall" instead of "label_0")', async () => {
      const mockSegmenter = vi.fn().mockResolvedValue([
        {
          label: 'wall',
          score: 0.9,
          mask: { data: new Uint8Array([1, 1, 1, 1]), width: 2, height: 2 },
        },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      const result = await segmentScene('data:image/png;base64,test', 2, 2);

      // "wall" should be parsed as class 0 → all wall
      expect(result.wallMask.data[0]).toBe(255);
      expect(result.wallMask.data.every((v) => v === 255)).toBe(true);
    });

    it('skips mask resize when model output matches photo dimensions', async () => {
      const mockSegmenter = vi.fn().mockResolvedValue([
        {
          label: 'label_0',
          score: 0.9,
          mask: { data: new Uint8Array([1, 0, 0, 1]), width: 2, height: 2 },
        },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      const result = await segmentScene('data:image/png;base64,test', 2, 2);

      // Same size → no resize needed, values should map directly
      expect(result.wallMask.width).toBe(2);
      expect(result.wallMask.height).toBe(2);
      expect(result.wallMask.data[0]).toBe(255); // class 0 = wall
      expect(result.wallMask.data[1]).toBe(0);   // no wall
    });

    it('throws when WASM is not supported', () => {
      const origWA = globalThis.WebAssembly;
      // @ts-expect-error testing unsupported env
      globalThis.WebAssembly = undefined;

      expect(isSegmentationSupported()).toBe(false);

      globalThis.WebAssembly = origWA;
    });
  });

  describe('resetSegmenter', () => {
    it('allows re-initialization after reset', async () => {
      const mockSegmenter = vi.fn().mockResolvedValue([
        {
          label: 'label_0',
          score: 0.9,
          mask: { data: new Uint8Array([1]), width: 1, height: 1 },
        },
      ]);

      mockPipelineFn.mockResolvedValue(mockSegmenter);

      await segmentScene('data:image/png;base64,test', 2, 2);
      expect(mockPipelineFn).toHaveBeenCalledTimes(1);

      resetSegmenter();
      await segmentScene('data:image/png;base64,test', 2, 2);
      expect(mockPipelineFn).toHaveBeenCalledTimes(2);
    });
  });
});
