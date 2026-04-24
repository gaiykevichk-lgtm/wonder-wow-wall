import { describe, it, expect } from 'vitest';
import {
  estimateScaleFromReference,
  pickBestCandidate,
  REFERENCE_CATALOG,
  type ReferenceCandidate,
} from '../lib/scaleEstimator';
import { createPerspective } from '../lib/perspectiveEngine';

describe('scaleEstimator', () => {
  describe('estimateScaleFromReference (no perspective)', () => {
    it('outlet: bbox 100px wide → pixelsPerCm = 100 / 8 = 12.5', () => {
      const candidate: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 200, y: 300, width: 100, height: 100 },
        confidence: 0.9,
      };
      const result = estimateScaleFromReference(candidate);
      expect(result).not.toBeNull();
      expect(result!.calibration.pixelsPerCm).toBeCloseTo(12.5, 5);
      expect(result!.calibration.method).toBe('auto');
      expect(result!.source).toBe('outlet');
      // trust = catalog (0.95) × confidence (0.9)
      expect(result!.trust).toBeCloseTo(0.95 * 0.9, 5);
    });

    it('door: uses height (knownSizeCm=205), not width', () => {
      const candidate: ReferenceCandidate = {
        type: 'door',
        // Tall narrow box — height is the meaningful dim
        bbox: { x: 100, y: 50, width: 80, height: 410 },
        confidence: 1,
      };
      const result = estimateScaleFromReference(candidate);
      expect(result).not.toBeNull();
      // 410 / 205 = 2 px/cm
      expect(result!.calibration.pixelsPerCm).toBeCloseTo(2, 5);
    });

    it('returns null for zero-width bbox', () => {
      const candidate: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 0, height: 100 },
        confidence: 0.9,
      };
      expect(estimateScaleFromReference(candidate)).toBeNull();
    });

    it('returns null for unknown reference type (defensive)', () => {
      const candidate = {
        type: 'unknown' as never,
        bbox: { x: 0, y: 0, width: 50, height: 50 },
        confidence: 0.9,
      } as ReferenceCandidate;
      expect(estimateScaleFromReference(candidate)).toBeNull();
    });

    it('clamps confidence > 1 in trust', () => {
      const candidate: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 80, height: 80 },
        confidence: 5,
      };
      const result = estimateScaleFromReference(candidate)!;
      expect(result.trust).toBeCloseTo(REFERENCE_CATALOG.outlet.trust, 5);
    });

    it('clamps negative confidence in trust', () => {
      const candidate: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 80, height: 80 },
        confidence: -0.5,
      };
      expect(estimateScaleFromReference(candidate)!.trust).toBe(0);
    });
  });

  describe('estimateScaleFromReference (with perspective)', () => {
    it('identity perspective (corners == photo rect): same result as no perspective', () => {
      // When wall corners equal the photo rectangle, the perspective is the
      // identity → wall-plane measurement should match screen measurement.
      const photoSize = { w: 1000, h: 800 };
      const transform = createPerspective(
        [
          { x: 0, y: 0 },
          { x: photoSize.w, y: 0 },
          { x: photoSize.w, y: photoSize.h },
          { x: 0, y: photoSize.h },
        ],
        photoSize,
      );
      const candidate: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 400, y: 350, width: 80, height: 80 },
        confidence: 0.9,
      };
      const withPersp = estimateScaleFromReference(candidate, transform)!;
      const withoutPersp = estimateScaleFromReference(candidate)!;
      expect(withPersp.calibration.pixelsPerCm).toBeCloseTo(
        withoutPersp.calibration.pixelsPerCm,
        4,
      );
    });

    it('foreshortened wall: an outlet near a "far" edge measures larger in wall plane', () => {
      // Wall is a trapezoid: top edge is half the width of the bottom edge,
      // simulating a wall receding to the right (top-right pulled in toward
      // the centre). An outlet drawn near the "far" (top-right) edge appears
      // smaller in screen pixels but should be larger when back-projected.
      //
      // Photo size 1000×800. Wall corners:
      //   TL (0,0)   TR (750, 0)   ← top-right pulled in 250 px
      //   BR (1000,800)  BL (0,800)
      // Wall plane size: 1000×800 (matches photo for clarity).
      const photoSize = { w: 1000, h: 800 };
      const corners: [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
      ] = [
        { x: 0, y: 0 },
        { x: 750, y: 0 },
        { x: 1000, y: 800 },
        { x: 0, y: 800 },
      ];
      const transform = createPerspective(corners, photoSize);

      // Outlet drawn near the "far" (top-right) edge of the wall, small in screen.
      const farCandidate: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 700, y: 100, width: 30, height: 30 },
        confidence: 0.9,
      };
      const farResult = estimateScaleFromReference(farCandidate, transform);
      expect(farResult).not.toBeNull();

      // Same pixel size near the bottom-left (camera-near) edge.
      const nearCandidate: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 100, y: 700, width: 30, height: 30 },
        confidence: 0.9,
      };
      const nearResult = estimateScaleFromReference(nearCandidate, transform);
      expect(nearResult).not.toBeNull();

      // The receding wall stretches the far edge in wall coordinates →
      // pixelsPerCm in wall plane should be HIGHER for the far candidate
      // than for the near candidate (since the same screen pixels translate
      // to more wall-plane pixels when projected through the inverse transform
      // at the foreshortened end).
      expect(farResult!.calibration.pixelsPerCm).toBeGreaterThan(
        nearResult!.calibration.pixelsPerCm,
      );
    });
  });

  describe('pickBestCandidate', () => {
    it('returns null for empty list', () => {
      expect(pickBestCandidate([])).toBeNull();
    });

    it('picks outlet over door at equal detector confidence (catalog trust wins)', () => {
      const outlet: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 80, height: 80 },
        confidence: 0.8,
      };
      const door: ReferenceCandidate = {
        type: 'door',
        bbox: { x: 200, y: 0, width: 80, height: 410 },
        confidence: 0.8,
      };
      // outlet trust 0.95 × 0.8 = 0.76 vs door 0.7 × 0.8 = 0.56
      expect(pickBestCandidate([door, outlet])).toBe(outlet);
    });

    it('picks higher detector confidence within same type', () => {
      const a: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 80, height: 80 },
        confidence: 0.6,
      };
      const b: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 100, y: 0, width: 80, height: 80 },
        confidence: 0.95,
      };
      expect(pickBestCandidate([a, b])).toBe(b);
    });

    it('tie-breaks by larger bbox area when score and confidence tie', () => {
      const small: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 40, height: 40 },
        confidence: 0.8,
      };
      const large: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 100, y: 0, width: 120, height: 120 },
        confidence: 0.8,
      };
      expect(pickBestCandidate([small, large])).toBe(large);
    });
  });
});
