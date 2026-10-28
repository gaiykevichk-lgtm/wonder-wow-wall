import { describe, it, expect } from 'vitest';
import {
  createEmptyMask,
  getMaskValue,
  setMaskValue,
  drawCircleOnMask,
  applyStrokeToMask,
  countWallPixelsInRect,
  wallCoverageInRect,
  wallCoverageInQuad,
  invertMask,
  totalWallFraction,
} from '../lib/maskUtils';
import type { Point } from '../model/types';

describe('maskUtils', () => {
  describe('createEmptyMask', () => {
    it('creates mask with zeros by default', () => {
      const mask = createEmptyMask(10, 10);
      expect(mask.width).toBe(10);
      expect(mask.height).toBe(10);
      expect(mask.data.length).toBe(100);
      expect(mask.data.every((v) => v === 0)).toBe(true);
    });

    it('creates mask filled with given value', () => {
      const mask = createEmptyMask(5, 5, 255);
      expect(mask.data.every((v) => v === 255)).toBe(true);
    });
  });

  describe('getMaskValue / setMaskValue', () => {
    it('gets and sets values correctly', () => {
      const mask = createEmptyMask(10, 10);
      expect(getMaskValue(mask, 3, 4)).toBe(0);
      setMaskValue(mask, 3, 4, 255);
      expect(getMaskValue(mask, 3, 4)).toBe(255);
    });

    it('returns 0 for out-of-bounds', () => {
      const mask = createEmptyMask(10, 10);
      expect(getMaskValue(mask, -1, 0)).toBe(0);
      expect(getMaskValue(mask, 10, 0)).toBe(0);
      expect(getMaskValue(mask, 0, 10)).toBe(0);
    });

    it('ignores out-of-bounds set', () => {
      const mask = createEmptyMask(10, 10);
      setMaskValue(mask, -1, 0, 255);
      setMaskValue(mask, 10, 0, 255);
      expect(mask.data.every((v) => v === 0)).toBe(true);
    });
  });

  describe('drawCircleOnMask', () => {
    it('draws a circle with brush tool (sets to 255)', () => {
      const mask = createEmptyMask(20, 20);
      const result = drawCircleOnMask(mask, { x: 10, y: 10 }, 3, 'brush');

      // Center should be wall
      expect(getMaskValue(result, 10, 10)).toBe(255);
      // Nearby should be wall
      expect(getMaskValue(result, 11, 10)).toBe(255);
      // Far away should not be wall
      expect(getMaskValue(result, 0, 0)).toBe(0);
    });

    it('erases with eraser tool (sets to 0)', () => {
      const mask = createEmptyMask(20, 20, 255);
      const result = drawCircleOnMask(mask, { x: 10, y: 10 }, 3, 'eraser');

      expect(getMaskValue(result, 10, 10)).toBe(0);
      expect(getMaskValue(result, 0, 0)).toBe(255);
    });

    it('does not modify original mask', () => {
      const mask = createEmptyMask(10, 10);
      drawCircleOnMask(mask, { x: 5, y: 5 }, 2, 'brush');
      expect(getMaskValue(mask, 5, 5)).toBe(0);
    });
  });

  describe('applyStrokeToMask', () => {
    it('applies stroke with multiple points', () => {
      const mask = createEmptyMask(100, 100);
      const points = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 30, y: 10 },
      ];
      const result = applyStrokeToMask(mask, points, 3, 'brush');

      // All stroke points should be wall
      expect(getMaskValue(result, 10, 10)).toBe(255);
      expect(getMaskValue(result, 20, 10)).toBe(255);
      expect(getMaskValue(result, 30, 10)).toBe(255);
      // Interpolated points between should also be wall
      expect(getMaskValue(result, 15, 10)).toBe(255);
    });

    it('returns original mask for empty points', () => {
      const mask = createEmptyMask(10, 10, 255);
      const result = applyStrokeToMask(mask, [], 5, 'brush');
      expect(result).toBe(mask);
    });
  });

  describe('countWallPixelsInRect', () => {
    it('counts wall pixels in a region', () => {
      const mask = createEmptyMask(10, 10, 255);
      expect(countWallPixelsInRect(mask, 0, 0, 5, 5)).toBe(25);
    });

    it('returns 0 for empty mask', () => {
      const mask = createEmptyMask(10, 10, 0);
      expect(countWallPixelsInRect(mask, 0, 0, 5, 5)).toBe(0);
    });

    it('handles out-of-bounds clipping', () => {
      const mask = createEmptyMask(5, 5, 255);
      expect(countWallPixelsInRect(mask, 3, 3, 10, 10)).toBe(4); // only 2x2 in bounds
    });
  });

  describe('wallCoverageInRect', () => {
    it('returns 1.0 for fully covered rect', () => {
      const mask = createEmptyMask(10, 10, 255);
      expect(wallCoverageInRect(mask, 0, 0, 5, 5)).toBe(1);
    });

    it('returns 0 for empty rect', () => {
      const mask = createEmptyMask(10, 10, 0);
      expect(wallCoverageInRect(mask, 0, 0, 5, 5)).toBe(0);
    });

    it('returns 0 for zero-size rect', () => {
      const mask = createEmptyMask(10, 10, 255);
      expect(wallCoverageInRect(mask, 0, 0, 0, 0)).toBe(0);
    });
  });

  describe('wallCoverageInQuad', () => {
    const quad = (
      tl: Point, tr: Point, br: Point, bl: Point,
    ): [Point, Point, Point, Point] => [tl, tr, br, bl];

    it('returns ≈1.0 for axis-aligned quad fully inside wall', () => {
      const mask = createEmptyMask(100, 100, 255);
      const q = quad({ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 });
      expect(wallCoverageInQuad(mask, q)).toBe(1);
    });

    it('returns 0 for axis-aligned quad fully outside mask', () => {
      const mask = createEmptyMask(100, 100, 0);
      const q = quad({ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 });
      expect(wallCoverageInQuad(mask, q)).toBe(0);
    });

    it('returns ≈0.5 when half the quad is on wall, half off', () => {
      // Left half wall, right half empty
      const mask = createEmptyMask(100, 100, 0);
      for (let y = 0; y < 100; y++) {
        for (let x = 0; x < 50; x++) {
          mask.data[y * 100 + x] = 255;
        }
      }
      const q = quad({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 });
      const cov = wallCoverageInQuad(mask, q);
      expect(cov).toBeGreaterThan(0.4);
      expect(cov).toBeLessThan(0.6);
    });

    it('counts out-of-bounds samples toward denominator (penalises overflow)', () => {
      const mask = createEmptyMask(100, 100, 255);
      // Quad extends past the right edge.
      const q = quad({ x: 50, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 50, y: 100 });
      const cov = wallCoverageInQuad(mask, q);
      expect(cov).toBeLessThan(1);
      expect(cov).toBeGreaterThan(0);
    });

    it('returns 0 for invalid samplesPerSide', () => {
      const mask = createEmptyMask(10, 10, 255);
      const q = quad({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 });
      expect(wallCoverageInQuad(mask, q, 0)).toBe(0);
      expect(wallCoverageInQuad(mask, q, NaN)).toBe(0);
    });
  });

  describe('invertMask', () => {
    it('flips all values', () => {
      const mask = createEmptyMask(5, 5, 255);
      setMaskValue(mask, 0, 0, 0);
      const inverted = invertMask(mask);

      expect(getMaskValue(inverted, 0, 0)).toBe(255);
      expect(getMaskValue(inverted, 1, 0)).toBe(0);
    });
  });

  describe('totalWallFraction', () => {
    it('returns 1.0 for full wall', () => {
      const mask = createEmptyMask(10, 10, 255);
      expect(totalWallFraction(mask)).toBe(1);
    });

    it('returns 0 for empty wall', () => {
      const mask = createEmptyMask(10, 10, 0);
      expect(totalWallFraction(mask)).toBe(0);
    });

    it('returns correct fraction for partial wall', () => {
      const mask = createEmptyMask(10, 10, 0);
      // Fill half
      for (let i = 0; i < 50; i++) {
        mask.data[i] = 255;
      }
      expect(totalWallFraction(mask)).toBe(0.5);
    });
  });
});
