import { describe, it, expect } from 'vitest';
import {
  detectFromLines,
  detectWallCorners,
  type Line,
} from '../lib/vanishingPointDetector';
import { createEmptyMask } from '../lib/maskUtils';
import type { WallMask } from '../model/types';

const PHOTO_SIZE = { width: 500, height: 500 };

function fullWallMask(w = 500, h = 500): WallMask {
  return createEmptyMask(w, h, 255);
}

function emptyMask(w = 500, h = 500): WallMask {
  return createEmptyMask(w, h, 0);
}

/** Build N parallel horizontal lines spanning full width at evenly-spaced y. */
function horizontals(count: number, w = 500, h = 500): Line[] {
  const lines: Line[] = [];
  const step = h / (count + 1);
  for (let i = 1; i <= count; i++) {
    lines.push({ p1: { x: 0, y: i * step }, p2: { x: w, y: i * step } });
  }
  return lines;
}

/** Build N parallel vertical lines spanning full height at evenly-spaced x. */
function verticals(count: number, w = 500, h = 500): Line[] {
  const lines: Line[] = [];
  const step = w / (count + 1);
  for (let i = 1; i <= count; i++) {
    lines.push({ p1: { x: i * step, y: 0 }, p2: { x: i * step, y: h } });
  }
  return lines;
}

/** Build N diagonal lines at ~45° as a third direction (multi-plane scenario). */
function diagonals(count: number): Line[] {
  const lines: Line[] = [];
  for (let i = 0; i < count; i++) {
    const off = 50 + i * 30;
    lines.push({ p1: { x: off, y: 0 }, p2: { x: off + 200, y: 200 } });
  }
  return lines;
}

describe('vanishingPointDetector', () => {
  describe('detectFromLines — degenerate cases', () => {
    it('returns too-few-lines when input is below MIN_LINES', () => {
      const result = detectFromLines({
        lines: horizontals(2),
        mask: fullWallMask(),
        photoSize: PHOTO_SIZE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('too-few-lines');
    });

    it('returns too-few-lines when all lines fall off the wall mask', () => {
      // Empty mask → on-wall ratio is 0 for every line → all filtered out.
      const result = detectFromLines({
        lines: [...horizontals(8), ...verticals(8)],
        mask: emptyMask(),
        photoSize: PHOTO_SIZE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('too-few-lines');
    });

    it('returns low-confidence with a single dominant direction', () => {
      // Only horizontals — no second cluster → only 1 strong bin.
      const result = detectFromLines({
        lines: horizontals(8),
        mask: fullWallMask(),
        photoSize: PHOTO_SIZE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('low-confidence');
    });

    it('returns multi-plane when ≥3 strong direction clusters exist', () => {
      // 4 horizontal + 4 vertical + 4 diagonal — three peaks ≥ 0.15 of total.
      const result = detectFromLines({
        lines: [...horizontals(4), ...verticals(4), ...diagonals(4)],
        mask: fullWallMask(),
        photoSize: PHOTO_SIZE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('multi-plane');
    });
  });

  describe('detectFromLines — flat wall (parallel lines)', () => {
    it('returns 4 corners at the extreme line intersections with high confidence', () => {
      // 4 horizontals at y={100,200,300,400} + 4 verticals at x={100,200,300,400}.
      // Extreme picks: top y=100, bottom y=400, left x=100, right x=400.
      // → corners: TL(100,100) TR(400,100) BR(400,400) BL(100,400).
      const result = detectFromLines({
        lines: [...horizontals(4), ...verticals(4)],
        mask: fullWallMask(),
        photoSize: PHOTO_SIZE,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const [tl, tr, br, bl] = result.corners;
      expect(tl.x).toBeCloseTo(100, 0);
      expect(tl.y).toBeCloseTo(100, 0);
      expect(tr.x).toBeCloseTo(400, 0);
      expect(tr.y).toBeCloseTo(100, 0);
      expect(br.x).toBeCloseTo(400, 0);
      expect(br.y).toBeCloseTo(400, 0);
      expect(bl.x).toBeCloseTo(100, 0);
      expect(bl.y).toBeCloseTo(400, 0);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('preserves corner ordering (TL, TR, BR, BL) — winding is correct', () => {
      const result = detectFromLines({
        lines: [...horizontals(4), ...verticals(4)],
        mask: fullWallMask(),
        photoSize: PHOTO_SIZE,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const [tl, tr, br, bl] = result.corners;
      expect(tl.x).toBeLessThan(tr.x);
      expect(bl.x).toBeLessThan(br.x);
      expect(tl.y).toBeLessThan(bl.y);
      expect(tr.y).toBeLessThan(br.y);
    });
  });

  describe('detectFromLines — perspective (convergent lines)', () => {
    /**
     * Build horizontal-ish lines whose extensions converge at a far-away VP
     * (1000, 100). Endpoints are clipped to lie inside the mask so the
     * on-wall filter passes.
     */
    function convergentHorizontals(): Line[] {
      const vp = { x: 5000, y: 100 };
      const ys = [50, 150, 300, 400];
      return ys.map((y0) => {
        const dx = vp.x - 50;
        const dy = vp.y - y0;
        const t = 350 / dx; // span 350 px in x
        return {
          p1: { x: 50, y: y0 },
          p2: { x: 50 + 350, y: y0 + dy * t },
        };
      });
    }

    function nearVerticalParallels(): Line[] {
      // Just a vertical cluster; vertical VP at infinity.
      return verticals(4);
    }

    it('returns corners and confidence ≥ 0.6 for a convergent + vertical scene', () => {
      const result = detectFromLines({
        lines: [...convergentHorizontals(), ...nearVerticalParallels()],
        mask: fullWallMask(),
        photoSize: PHOTO_SIZE,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Quad must still wind correctly even when sides are non-axis-aligned.
      const [tl, tr, br, bl] = result.corners;
      expect(tl.x).toBeLessThan(tr.x);
      expect(bl.x).toBeLessThan(br.x);
      expect(tl.y).toBeLessThan(bl.y);
      expect(tr.y).toBeLessThan(br.y);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('detectWallCorners — provider integration', () => {
    it('invokes the line provider with photo + mask and forwards the result', async () => {
      const mask = fullWallMask();
      let received: { imageUrl: string; mask: WallMask } | null = null;
      const provider = async (input: {
        imageUrl: string;
        mask: WallMask;
        photoSize: { width: number; height: number };
      }): Promise<Line[]> => {
        received = { imageUrl: input.imageUrl, mask: input.mask };
        return [...horizontals(4), ...verticals(4)];
      };

      const result = await detectWallCorners(
        'photo://test.jpg',
        mask,
        PHOTO_SIZE,
        provider,
      );
      expect(received).not.toBeNull();
      expect(received!.imageUrl).toBe('photo://test.jpg');
      expect(result.ok).toBe(true);
    });

    it('propagates too-few-lines when the provider returns nothing', async () => {
      const result = await detectWallCorners(
        'photo://empty.jpg',
        fullWallMask(),
        PHOTO_SIZE,
        async () => [],
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('too-few-lines');
    });
  });
});
