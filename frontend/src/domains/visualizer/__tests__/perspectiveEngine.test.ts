import { describe, it, expect } from 'vitest';
import {
  createPerspective,
  transformPoint,
  inverseTransformPoint,
  transformRect,
  quadToFlatPoints,
  computeWallBrightness,
  computeBrightnessAdjustment,
} from '../lib/perspectiveEngine';
import type { Quad } from '../lib/perspectiveEngine';

describe('perspectiveEngine', () => {
  describe('identity transform (rectangle → same rectangle)', () => {
    const wallSize = { w: 800, h: 600 };
    const corners: Quad = [
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 800, y: 600 },
      { x: 0, y: 600 },
    ];
    const transform = createPerspective(corners, wallSize);

    it('maps origin to origin', () => {
      const p = transformPoint(transform, { x: 0, y: 0 });
      expect(p.x).toBeCloseTo(0, 5);
      expect(p.y).toBeCloseTo(0, 5);
    });

    it('maps center to center', () => {
      const p = transformPoint(transform, { x: 400, y: 300 });
      expect(p.x).toBeCloseTo(400, 5);
      expect(p.y).toBeCloseTo(300, 5);
    });

    it('inverse returns original point', () => {
      const p = inverseTransformPoint(transform, { x: 200, y: 150 });
      expect(p.x).toBeCloseTo(200, 5);
      expect(p.y).toBeCloseTo(150, 5);
    });
  });

  describe('trapezoidal perspective', () => {
    const wallSize = { w: 100, h: 100 };
    // Trapezoid: top is narrower than bottom
    const corners: Quad = [
      { x: 20, y: 10 },
      { x: 80, y: 10 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const transform = createPerspective(corners, wallSize);

    it('maps wall corners to photo corners', () => {
      const tl = transformPoint(transform, { x: 0, y: 0 });
      expect(tl.x).toBeCloseTo(20, 3);
      expect(tl.y).toBeCloseTo(10, 3);

      const br = transformPoint(transform, { x: 100, y: 100 });
      expect(br.x).toBeCloseTo(100, 3);
      expect(br.y).toBeCloseTo(100, 3);
    });

    it('round-trips through forward + inverse', () => {
      const original = { x: 50, y: 50 };
      const screen = transformPoint(transform, original);
      const back = inverseTransformPoint(transform, screen);
      expect(back.x).toBeCloseTo(original.x, 3);
      expect(back.y).toBeCloseTo(original.y, 3);
    });
  });

  describe('transformRect', () => {
    it('returns 4-point quad for a rectangle', () => {
      const wallSize = { w: 200, h: 200 };
      const corners: Quad = [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 200 },
        { x: 0, y: 200 },
      ];
      const transform = createPerspective(corners, wallSize);
      const quad = transformRect(transform, { x: 10, y: 10, width: 50, height: 50 });

      expect(quad).toHaveLength(4);
      expect(quad[0].x).toBeCloseTo(10, 3);
      expect(quad[0].y).toBeCloseTo(10, 3);
      expect(quad[2].x).toBeCloseTo(60, 3);
      expect(quad[2].y).toBeCloseTo(60, 3);
    });
  });

  describe('quadToFlatPoints', () => {
    it('flattens quad to [x0,y0,x1,y1,x2,y2,x3,y3]', () => {
      const quad: Quad = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
      ];
      expect(quadToFlatPoints(quad)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe('computeWallBrightness', () => {
    it('returns 128 for empty mask', () => {
      const imageData = {
        data: new Uint8ClampedArray(16 * 4),
        width: 4,
        height: 4,
      };
      const mask = {
        data: new Uint8Array(16), // all zeros — no wall pixels
        width: 4,
        height: 4,
      };
      expect(computeWallBrightness(imageData, mask)).toBe(128);
    });

    it('computes brightness for white wall', () => {
      const w = 4;
      const h = 4;
      const imgData = new Uint8ClampedArray(w * h * 4);
      const maskData = new Uint8Array(w * h);

      // Fill with white pixels and wall mask
      for (let i = 0; i < w * h; i++) {
        imgData[i * 4] = 255;     // R
        imgData[i * 4 + 1] = 255; // G
        imgData[i * 4 + 2] = 255; // B
        imgData[i * 4 + 3] = 255; // A
        maskData[i] = 255;
      }

      const brightness = computeWallBrightness(
        { data: imgData, width: w, height: h },
        { data: maskData, width: w, height: h },
      );
      expect(brightness).toBeCloseTo(255, 0);
    });

    it('computes brightness for black wall', () => {
      const w = 4;
      const h = 4;
      const imgData = new Uint8ClampedArray(w * h * 4); // all zeros
      const maskData = new Uint8Array(w * h).fill(255);

      const brightness = computeWallBrightness(
        { data: imgData, width: w, height: h },
        { data: maskData, width: w, height: h },
      );
      expect(brightness).toBe(0);
    });
  });

  describe('computeBrightnessAdjustment', () => {
    it('returns 0 for neutral brightness (128)', () => {
      expect(computeBrightnessAdjustment(128)).toBe(0);
    });

    it('returns 0 for brightness at boundaries (100, 200)', () => {
      expect(computeBrightnessAdjustment(100)).toBe(0);
      expect(computeBrightnessAdjustment(200)).toBe(0);
    });

    it('returns negative for dark walls', () => {
      const adj = computeBrightnessAdjustment(0);
      expect(adj).toBe(-0.25);
    });

    it('returns positive for bright walls', () => {
      const adj = computeBrightnessAdjustment(255);
      expect(adj).toBeCloseTo(0.1375, 4);
    });

    it('stays within -0.25 to 0.14 range', () => {
      for (let b = 0; b <= 255; b++) {
        const adj = computeBrightnessAdjustment(b);
        expect(adj).toBeGreaterThanOrEqual(-0.25);
        expect(adj).toBeLessThanOrEqual(0.14);
      }
    });
  });
});
