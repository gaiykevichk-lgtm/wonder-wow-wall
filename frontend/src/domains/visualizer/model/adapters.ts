/**
 * Anti-Corruption Layer — maps Visualizer domain objects to other domains.
 */

import type { CartItem } from '../../order/model/types';
import type { PlacedPanel, PanelSizeKey } from './types';

function sizeKeyToPriceKey(sizeKey: PanelSizeKey): string {
  switch (sizeKey) {
    case '30x30': return '300x300';
    case '30x60': return '300x600';
    case '60x60': return '600x600';
  }
}

function sizeKeyToArea(sizeKey: PanelSizeKey): number {
  switch (sizeKey) {
    case '30x30': return 0.09;
    case '30x60': return 0.18;
    case '60x60': return 0.36;
  }
}

/**
 * Group identical panels (same design + size + color) and convert to CartItems.
 */
export function placedPanelsToCartItems(
  panels: PlacedPanel[],
  basePrices: Record<string, number>,
  overlayPrice: number,
  hasSubscription: boolean,
): CartItem[] {
  const grouped = new Map<string, { panel: PlacedPanel; count: number }>();

  for (const panel of panels) {
    const key = `${panel.designId}-${panel.sizeKey}-${panel.color}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(key, { panel, count: 1 });
    }
  }

  const items: CartItem[] = [];

  for (const [, { panel, count }] of grouped) {
    const priceKey = sizeKeyToPriceKey(panel.sizeKey);
    const basePrice = basePrices[priceKey] ?? 0;
    const overlay = hasSubscription ? 0 : overlayPrice;
    const unitPrice = basePrice + overlay;

    items.push({
      id: `viz-${panel.designId}-${panel.sizeKey}-${panel.color}`,
      productId: panel.designId,
      name: panel.designName,
      image: panel.designImage,
      price: unitPrice,
      quantity: count,
      area: sizeKeyToArea(panel.sizeKey),
      color: panel.color,
      colorName: panel.colorName,
      size: panel.sizeKey,
    });
  }

  return items;
}
