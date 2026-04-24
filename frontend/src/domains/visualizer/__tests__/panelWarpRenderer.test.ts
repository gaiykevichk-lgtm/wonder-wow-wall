import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildMeshTriangles,
  affineFromTriangles,
  quadBoundingBox,
  renderPanelToQuad,
  clearWarpCache,
  getWarpCacheSize,
  type Triangle,
  type WarpOptions,
} from '../lib/panelWarpRenderer';
import { createPerspective } from '../lib/perspectiveEngine';
import type { Quad } from '../lib/perspectiveEngine';

// ─── Pure math: buildMeshTriangles ──────────────────────────────────────────

describe('panelWarpRenderer / buildMeshTriangles', () => {
  // Identity perspective (wall == photo)
  const wallSize = { w: 100, h: 100 };
  const identityCorners: Quad = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const identityPerspective = createPerspective(identityCorners, wallSize);

  it('produces 2*N*N triangles for an NxN grid', () => {
    const t1 = buildMeshTriangles(identityPerspective, { x: 0, y: 0, width: 100, height: 100 }, 1);
    expect(t1.length).toBe(2);
    const t4 = buildMeshTriangles(identityPerspective, { x: 0, y: 0, width: 100, height: 100 }, 4);
    expect(t4.length).toBe(2 * 4 * 4);
    const t8 = buildMeshTriangles(identityPerspective, { x: 0, y: 0, width: 100, height: 100 }, 8);
    expect(t8.length).toBe(2 * 8 * 8);
  });

  it('source coordinates are in [0, width] x [0, height] (relative to wallRect)', () => {
    const tris = buildMeshTriangles(identityPerspective, { x: 50, y: 50, width: 60, height: 40 }, 4);
    for (const t of tris) {
      for (const p of [t.src.a, t.src.b, t.src.c]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(60);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(40);
      }
    }
  });

  it('under identity perspective, dst points equal src points + wallRect.x/y offset', () => {
    const wallRect = { x: 30, y: 20, width: 40, height: 40 };
    const tris = buildMeshTriangles(identityPerspective, wallRect, 2);
    for (const t of tris) {
      expect(t.dst.a.x).toBeCloseTo(t.src.a.x + wallRect.x, 5);
      expect(t.dst.a.y).toBeCloseTo(t.src.a.y + wallRect.y, 5);
      expect(t.dst.b.x).toBeCloseTo(t.src.b.x + wallRect.x, 5);
      expect(t.dst.b.y).toBeCloseTo(t.src.b.y + wallRect.y, 5);
    }
  });

  it('under trapezoidal perspective, top-row dst is narrower than bottom-row dst', () => {
    // Trapezoid: top narrower than bottom (classic floor/wall perspective)
    const trapezoid: Quad = [
      { x: 20, y: 10 },   // TL
      { x: 80, y: 10 },   // TR — top width = 60
      { x: 100, y: 100 }, // BR
      { x: 0, y: 100 },   // BL — bottom width = 100
    ];
    const transform = createPerspective(trapezoid, { w: 100, h: 100 });
    const tris = buildMeshTriangles(transform, { x: 0, y: 0, width: 100, height: 100 }, 4);

    // Find min-y and max-y triangles (top-row vs bottom-row)
    const allDstPoints = tris.flatMap((t) => [t.dst.a, t.dst.b, t.dst.c]);
    const topY = Math.min(...allDstPoints.map((p) => p.y));
    const bottomY = Math.max(...allDstPoints.map((p) => p.y));

    expect(topY).toBeCloseTo(10, 0);
    expect(bottomY).toBeCloseTo(100, 0);

    // Width spread at top vs bottom
    const topPoints = allDstPoints.filter((p) => Math.abs(p.y - topY) < 1);
    const bottomPoints = allDstPoints.filter((p) => Math.abs(p.y - bottomY) < 1);
    const topWidth = Math.max(...topPoints.map((p) => p.x)) - Math.min(...topPoints.map((p) => p.x));
    const bottomWidth = Math.max(...bottomPoints.map((p) => p.x)) - Math.min(...bottomPoints.map((p) => p.x));

    expect(topWidth).toBeLessThan(bottomWidth);
  });

  it('throws on invalid gridSize', () => {
    expect(() =>
      buildMeshTriangles(identityPerspective, { x: 0, y: 0, width: 10, height: 10 }, 0),
    ).toThrow();
    expect(() =>
      buildMeshTriangles(identityPerspective, { x: 0, y: 0, width: 10, height: 10 }, NaN),
    ).toThrow();
  });
});

// ─── Pure math: affineFromTriangles ─────────────────────────────────────────

describe('panelWarpRenderer / affineFromTriangles', () => {
  it('identity triangles produce identity affine matrix', () => {
    const tri: Triangle = {
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      c: { x: 0, y: 10 },
    };
    const m = affineFromTriangles(tri, tri);
    // Identity: a=1, b=0, c=0, d=1, e=0, f=0
    expect(m[0]).toBeCloseTo(1, 5);
    expect(m[1]).toBeCloseTo(0, 5);
    expect(m[2]).toBeCloseTo(0, 5);
    expect(m[3]).toBeCloseTo(1, 5);
    expect(m[4]).toBeCloseTo(0, 5);
    expect(m[5]).toBeCloseTo(0, 5);
  });

  it('translation-only triangles produce a pure-translation matrix', () => {
    const src: Triangle = {
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      c: { x: 0, y: 10 },
    };
    const dst: Triangle = {
      a: { x: 5, y: 7 },
      b: { x: 15, y: 7 },
      c: { x: 5, y: 17 },
    };
    const m = affineFromTriangles(src, dst);
    expect(m[0]).toBeCloseTo(1, 5); // a
    expect(m[3]).toBeCloseTo(1, 5); // d
    expect(m[1]).toBeCloseTo(0, 5);
    expect(m[2]).toBeCloseTo(0, 5);
    expect(m[4]).toBeCloseTo(5, 5); // tx
    expect(m[5]).toBeCloseTo(7, 5); // ty
  });

  it('scale-only triangles produce a pure-scale matrix', () => {
    const src: Triangle = {
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      c: { x: 0, y: 10 },
    };
    const dst: Triangle = {
      a: { x: 0, y: 0 },
      b: { x: 20, y: 0 },
      c: { x: 0, y: 30 },
    };
    const m = affineFromTriangles(src, dst);
    expect(m[0]).toBeCloseTo(2, 5); // sx
    expect(m[3]).toBeCloseTo(3, 5); // sy
    expect(m[1]).toBeCloseTo(0, 5);
    expect(m[2]).toBeCloseTo(0, 5);
    expect(m[4]).toBeCloseTo(0, 5);
    expect(m[5]).toBeCloseTo(0, 5);
  });

  it('throws on degenerate (collinear) source triangle', () => {
    const collinear: Triangle = {
      a: { x: 0, y: 0 },
      b: { x: 5, y: 5 },
      c: { x: 10, y: 10 },
    };
    const dst: Triangle = {
      a: { x: 0, y: 0 },
      b: { x: 1, y: 0 },
      c: { x: 0, y: 1 },
    };
    expect(() => affineFromTriangles(collinear, dst)).toThrow(/degenerate/i);
  });

  it('matrix correctly maps src vertices to dst vertices', () => {
    const src: Triangle = {
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
      c: { x: 0, y: 100 },
    };
    // Arbitrary destination (rotation + skew)
    const dst: Triangle = {
      a: { x: 50, y: 50 },
      b: { x: 80, y: 100 },
      c: { x: 30, y: 90 },
    };
    const [a, b, c, d, e, f] = affineFromTriangles(src, dst);

    const apply = (p: { x: number; y: number }) => ({
      x: a * p.x + c * p.y + e,
      y: b * p.x + d * p.y + f,
    });

    expect(apply(src.a).x).toBeCloseTo(dst.a.x, 4);
    expect(apply(src.a).y).toBeCloseTo(dst.a.y, 4);
    expect(apply(src.b).x).toBeCloseTo(dst.b.x, 4);
    expect(apply(src.b).y).toBeCloseTo(dst.b.y, 4);
    expect(apply(src.c).x).toBeCloseTo(dst.c.x, 4);
    expect(apply(src.c).y).toBeCloseTo(dst.c.y, 4);
  });
});

// ─── Pure math: quadBoundingBox ─────────────────────────────────────────────

describe('panelWarpRenderer / quadBoundingBox', () => {
  it('axis-aligned quad → exact bbox', () => {
    const quad: Quad = [
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 60 },
      { x: 10, y: 60 },
    ];
    const bbox = quadBoundingBox(quad);
    expect(bbox.x).toBe(10);
    expect(bbox.y).toBe(20);
    expect(bbox.width).toBe(40);
    expect(bbox.height).toBe(40);
  });

  it('rotated quad → bbox covers all corners', () => {
    const quad: Quad = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ];
    const bbox = quadBoundingBox(quad);
    expect(bbox.x).toBeLessThanOrEqual(0);
    expect(bbox.y).toBeLessThanOrEqual(0);
    expect(bbox.x + bbox.width).toBeGreaterThanOrEqual(100);
    expect(bbox.y + bbox.height).toBeGreaterThanOrEqual(100);
  });

  it('returns at least 1×1 for collapsed quad', () => {
    const quad: Quad = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    const bbox = quadBoundingBox(quad);
    expect(bbox.width).toBeGreaterThanOrEqual(1);
    expect(bbox.height).toBeGreaterThanOrEqual(1);
  });
});

// ─── Renderer + cache (canvas mocked by jsdom) ──────────────────────────────

// jsdom returns null from canvas.getContext('2d'). Polyfill it with a stub
// so the renderer's drawing code-path executes (and populates the cache).
const origCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
  const el = origCreateElement(tag, options);
  if (tag === 'canvas') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (el as any).getContext = () => ({
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      globalAlpha: 1,
      fillStyle: '',
    });
  }
  return el;
});

describe('panelWarpRenderer / renderPanelToQuad + cache', () => {
  const wallSize = { w: 200, h: 200 };
  const corners: Quad = [
    { x: 20, y: 10 },
    { x: 180, y: 10 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ];
  const perspective = createPerspective(corners, wallSize);

  // Minimal HTMLImageElement stub — jsdom's <img> works for our purposes
  const fakeImage = (() => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'width', { value: 100, configurable: true });
    Object.defineProperty(img, 'height', { value: 100, configurable: true });
    return img;
  })();

  const baseOpts: WarpOptions = {
    designUrl: 'test-design.jpg',
    designImage: fakeImage,
    perspective,
    wallRect: { x: 50, y: 50, width: 60, height: 60 },
    opacity: 0.85,
    colorTint: '#FF0000',
  };

  beforeEach(() => {
    clearWarpCache();
  });

  it('returns a canvas with bbox matching the warped quad', () => {
    const result = renderPanelToQuad(baseOpts);
    expect(result.canvas).toBeDefined();
    expect(result.canvas.width).toBe(result.bbox.width);
    expect(result.canvas.height).toBe(result.bbox.height);
    expect(result.bbox.width).toBeGreaterThan(0);
    expect(result.bbox.height).toBeGreaterThan(0);
  });

  it('caches results by (designUrl, quad, opacity, colorTint)', () => {
    expect(getWarpCacheSize()).toBe(0);
    const r1 = renderPanelToQuad(baseOpts);
    expect(getWarpCacheSize()).toBe(1);
    const r2 = renderPanelToQuad(baseOpts);
    expect(getWarpCacheSize()).toBe(1);
    // Same canvas instance returned from cache
    expect(r2.canvas).toBe(r1.canvas);
  });

  it('different opacity → cache miss', () => {
    renderPanelToQuad(baseOpts);
    renderPanelToQuad({ ...baseOpts, opacity: 0.5 });
    expect(getWarpCacheSize()).toBe(2);
  });

  it('different colorTint → cache miss', () => {
    renderPanelToQuad(baseOpts);
    renderPanelToQuad({ ...baseOpts, colorTint: '#00FF00' });
    expect(getWarpCacheSize()).toBe(2);
  });

  it('different wallRect (changes dst quad) → cache miss', () => {
    renderPanelToQuad(baseOpts);
    renderPanelToQuad({ ...baseOpts, wallRect: { x: 100, y: 100, width: 60, height: 60 } });
    expect(getWarpCacheSize()).toBe(2);
  });

  it('clearWarpCache empties the cache', () => {
    renderPanelToQuad(baseOpts);
    expect(getWarpCacheSize()).toBe(1);
    clearWarpCache();
    expect(getWarpCacheSize()).toBe(0);
  });
});
