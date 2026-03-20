/**
 * Cost calculator for visualizer projects.
 * Reuses shared pricing constants.
 */

import { BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';
import type { PlacedPanel, PanelSizeKey, CostBreakdown } from '../model/types';

function sizeKeyToPriceKey(sizeKey: PanelSizeKey): string {
  switch (sizeKey) {
    case '30x30': return '300x300';
    case '30x60': return '300x600';
    case '60x60': return '600x600';
  }
}

function sizeKeyToAreaM2(sizeKey: PanelSizeKey): number {
  switch (sizeKey) {
    case '30x30': return 0.09;
    case '30x60': return 0.18;
    case '60x60': return 0.36;
  }
}

/**
 * Calculate full cost breakdown for a panel layout.
 * @param panels - placed panels
 * @param hasSubscription - whether user has active subscription
 */
export function calculateCost(
  panels: PlacedPanel[],
  hasSubscription: boolean,
): CostBreakdown {
  const panelsBySize: Record<PanelSizeKey, number> = {
    '30x30': 0,
    '30x60': 0,
    '60x60': 0,
  };

  let basePanelsCost = 0;
  let coveredAreaM2 = 0;

  for (const panel of panels) {
    panelsBySize[panel.sizeKey]++;
    const priceKey = sizeKeyToPriceKey(panel.sizeKey);
    basePanelsCost += BASE_PANEL_PRICES[priceKey] ?? 0;
    coveredAreaM2 += sizeKeyToAreaM2(panel.sizeKey);
  }

  const totalPanels = panels.length;
  const overlaysCostFull = totalPanels * DESIGN_OVERLAY_PRICE;
  const overlayDiscount = hasSubscription ? overlaysCostFull : 0;
  const overlaysCost = overlaysCostFull - overlayDiscount;
  const totalCost = basePanelsCost + overlaysCost;

  return {
    panelsBySize,
    totalPanels,
    coveredAreaM2: Math.round(coveredAreaM2 * 100) / 100,
    basePanelsCost,
    overlaysCost,
    overlayDiscount,
    totalCost,
  };
}
