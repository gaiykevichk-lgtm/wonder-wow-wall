import { describe, it, expect } from 'vitest';
import { calculateCost } from '../lib/costCalculator';
import type { PlacedPanel } from '../model/types';

function makePanel(sizeKey: PlacedPanel['sizeKey']): PlacedPanel {
  return {
    id: `p-${Math.random()}`,
    designId: 'd1',
    designName: 'Test',
    designImage: 'test.jpg',
    sizeKey,
    color: '#FFF',
    colorName: 'White',
    x: 0,
    y: 0,
    renderWidth: 100,
    renderHeight: 100,
  };
}

describe('costCalculator', () => {
  it('returns zero cost for empty panels', () => {
    const cost = calculateCost([], false);
    expect(cost.totalPanels).toBe(0);
    expect(cost.totalCost).toBe(0);
    expect(cost.coveredAreaM2).toBe(0);
  });

  it('calculates cost for 30x30 panels without subscription', () => {
    const panels = [makePanel('30x30'), makePanel('30x30')];
    const cost = calculateCost(panels, false);

    expect(cost.panelsBySize['30x30']).toBe(2);
    expect(cost.totalPanels).toBe(2);
    expect(cost.basePanelsCost).toBe(2 * 890);
    expect(cost.overlaysCost).toBe(2 * 1200);
    expect(cost.overlayDiscount).toBe(0);
    expect(cost.totalCost).toBe(2 * 890 + 2 * 1200);
    expect(cost.coveredAreaM2).toBe(0.18); // 2 * 0.09
  });

  it('calculates cost with subscription (overlays free)', () => {
    const panels = [makePanel('30x30'), makePanel('30x60')];
    const cost = calculateCost(panels, true);

    expect(cost.basePanelsCost).toBe(890 + 1490);
    expect(cost.overlaysCost).toBe(0);
    expect(cost.overlayDiscount).toBe(2 * 1200);
    expect(cost.totalCost).toBe(890 + 1490);
  });

  it('calculates cost for mixed sizes', () => {
    const panels = [
      makePanel('30x30'),
      makePanel('30x60'),
      makePanel('60x60'),
    ];
    const cost = calculateCost(panels, false);

    expect(cost.panelsBySize['30x30']).toBe(1);
    expect(cost.panelsBySize['30x60']).toBe(1);
    expect(cost.panelsBySize['60x60']).toBe(1);
    expect(cost.totalPanels).toBe(3);
    expect(cost.basePanelsCost).toBe(890 + 1490 + 2490);
    expect(cost.overlaysCost).toBe(3 * 1200);
    expect(cost.coveredAreaM2).toBe(0.63); // 0.09 + 0.18 + 0.36
  });
});
