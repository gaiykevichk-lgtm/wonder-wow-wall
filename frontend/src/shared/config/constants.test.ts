import { describe, it, expect } from 'vitest';
import { PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from './constants';

describe('pricing constants', () => {
  describe('PANEL_SIZES', () => {
    it('has exactly 3 sizes', () => {
      expect(PANEL_SIZES).toHaveLength(3);
    });

    it('sizes are 30x30, 30x60, 60x60', () => {
      expect(PANEL_SIZES[0]).toMatchObject({ width: 300, height: 300 });
      expect(PANEL_SIZES[1]).toMatchObject({ width: 300, height: 600 });
      expect(PANEL_SIZES[2]).toMatchObject({ width: 600, height: 600 });
    });

    it('each size has label and labelShort', () => {
      for (const size of PANEL_SIZES) {
        expect(size.label).toBeTruthy();
        expect(size.labelShort).toBeTruthy();
        expect(size.label).toContain('см');
      }
    });
  });

  describe('BASE_PANEL_PRICES', () => {
    it('has prices for all 3 sizes', () => {
      expect(Object.keys(BASE_PANEL_PRICES)).toHaveLength(3);
    });

    it('30x30 is cheapest, 60x60 is most expensive', () => {
      expect(BASE_PANEL_PRICES['300x300']).toBe(890);
      expect(BASE_PANEL_PRICES['300x600']).toBe(1490);
      expect(BASE_PANEL_PRICES['600x600']).toBe(2490);
    });

    it('prices increase with size', () => {
      expect(BASE_PANEL_PRICES['300x300']).toBeLessThan(BASE_PANEL_PRICES['300x600']);
      expect(BASE_PANEL_PRICES['300x600']).toBeLessThan(BASE_PANEL_PRICES['600x600']);
    });

    it('all prices are positive integers', () => {
      for (const price of Object.values(BASE_PANEL_PRICES)) {
        expect(price).toBeGreaterThan(0);
        expect(Number.isInteger(price)).toBe(true);
      }
    });
  });

  describe('DESIGN_OVERLAY_PRICE', () => {
    it('is 1200 roubles', () => {
      expect(DESIGN_OVERLAY_PRICE).toBe(1200);
    });

    it('is a positive integer', () => {
      expect(DESIGN_OVERLAY_PRICE).toBeGreaterThan(0);
      expect(Number.isInteger(DESIGN_OVERLAY_PRICE)).toBe(true);
    });
  });

  describe('business logic: total panel cost', () => {
    it('30x30 panel + overlay = 890 + 1200 = 2090', () => {
      expect(BASE_PANEL_PRICES['300x300'] + DESIGN_OVERLAY_PRICE).toBe(2090);
    });

    it('30x60 panel + overlay = 1490 + 1200 = 2690', () => {
      expect(BASE_PANEL_PRICES['300x600'] + DESIGN_OVERLAY_PRICE).toBe(2690);
    });

    it('60x60 panel + overlay = 2490 + 1200 = 3690', () => {
      expect(BASE_PANEL_PRICES['600x600'] + DESIGN_OVERLAY_PRICE).toBe(3690);
    });
  });
});
