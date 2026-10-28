/**
 * Cost calculator for visualizer projects.
 * Reuses shared pricing constants.
 *
 * Phase 8D — `overlayPrice` is now a parameter (was the hardcoded
 * `DESIGN_OVERLAY_PRICE` constant). Callers resolve the live value from
 * `useShopSettings().designOverlayPrice` at the React layer and pass it
 * down. Default kept as the legacy constant so existing tests keep
 * passing without forcing a parameter on every callsite.
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
 * @param overlayPrice - per-overlay price (Phase 8D — admin-editable
 *   via `useShopSettings`). Defaults to the legacy constant for tests
 *   and CLI scripts that don't have repo access.
 */
export function calculateCost(
  panels: PlacedPanel[],
  hasSubscription: boolean,
  overlayPrice: number = DESIGN_OVERLAY_PRICE,
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
  const overlaysCostFull = totalPanels * overlayPrice;
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
