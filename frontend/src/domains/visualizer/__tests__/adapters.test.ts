import { describe, it, expect } from 'vitest';
import { placedPanelsToCartItems } from '../model/adapters';
import type { PlacedPanel } from '../model/types';

const BASE_PRICES: Record<string, number> = {
  '300x300': 890,
  '300x600': 1490,
  '600x600': 2490,
};

const OVERLAY_PRICE = 1200;

function makePanel(
  designId: string,
  sizeKey: PlacedPanel['sizeKey'],
  color: string = '#FFF',
): PlacedPanel {
  return {
    id: `p-${Math.random()}`,
    designId,
    designName: `Design ${designId}`,
    designImage: `${designId}.jpg`,
    sizeKey,
    color,
    colorName: 'White',
    x: 0,
    y: 0,
    renderWidth: 100,
    renderHeight: 100,
  };
}

describe('adapters', () => {
  describe('placedPanelsToCartItems', () => {
    it('groups identical panels into single cart item', () => {
      const panels = [
        makePanel('d1', '30x30', '#FFF'),
        makePanel('d1', '30x30', '#FFF'),
        makePanel('d1', '30x30', '#FFF'),
      ];

      const items = placedPanelsToCartItems(panels, BASE_PRICES, OVERLAY_PRICE, false);
      expect(items.length).toBe(1);
      expect(items[0]!.quantity).toBe(3);
      expect(items[0]!.price).toBe(890 + 1200);
    });

    it('separates panels with different designs', () => {
      const panels = [
        makePanel('d1', '30x30'),
        makePanel('d2', '30x30'),
      ];

      const items = placedPanelsToCartItems(panels, BASE_PRICES, OVERLAY_PRICE, false);
      expect(items.length).toBe(2);
      expect(items[0]!.quantity).toBe(1);
      expect(items[1]!.quantity).toBe(1);
    });

    it('separates panels with different sizes', () => {
      const panels = [
        makePanel('d1', '30x30'),
        makePanel('d1', '60x60'),
      ];

      const items = placedPanelsToCartItems(panels, BASE_PRICES, OVERLAY_PRICE, false);
      expect(items.length).toBe(2);
    });

    it('separates panels with different colors', () => {
      const panels = [
        makePanel('d1', '30x30', '#FFF'),
        makePanel('d1', '30x30', '#000'),
      ];

      const items = placedPanelsToCartItems(panels, BASE_PRICES, OVERLAY_PRICE, false);
      expect(items.length).toBe(2);
    });

    it('applies subscription discount (overlay = 0)', () => {
      const panels = [makePanel('d1', '30x30')];
      const items = placedPanelsToCartItems(panels, BASE_PRICES, OVERLAY_PRICE, true);

      expect(items[0]!.price).toBe(890); // no overlay charge
    });

    it('returns empty array for no panels', () => {
      const items = placedPanelsToCartItems([], BASE_PRICES, OVERLAY_PRICE, false);
      expect(items.length).toBe(0);
    });

    it('sets correct area for each size', () => {
      const panels = [
        makePanel('d1', '30x30'),
        makePanel('d1', '30x60'),
        makePanel('d1', '60x60'),
      ];

      const items = placedPanelsToCartItems(panels, BASE_PRICES, OVERLAY_PRICE, false);
      const areaBySize = new Map(items.map((i) => [i.size, i.area]));
      expect(areaBySize.get('30x30')).toBe(0.09);
      expect(areaBySize.get('30x60')).toBe(0.18);
      expect(areaBySize.get('60x60')).toBe(0.36);
    });
  });
});
