/**
 * Phase 7B — pull live panel prices from the API with constants fallback.
 *
 * Background: before Phase 7B the constructor priced placed panels from
 * the static `BASE_PANEL_PRICES` map in `shared/config/constants.ts`.
 * Phase 7B introduced an admin CRUD for panels and the public
 * `GET /api/panels` endpoint, so the constructor must now reflect
 * admin-edited prices without a redeploy.
 *
 * Strategy (see Phase 7B plan, R6):
 *   * Fetch the active catalogue via `usePanels()`.
 *   * Build a key → price map keyed by `"<width_mm>x<height_mm>"` to
 *     match the legacy constants vocabulary — calling code stays
 *     identical to the pre-API path, only the source changes.
 *   * If the API call hasn't resolved or returned no rows, fall back to
 *     `BASE_PANEL_PRICES`. This keeps the constructor functional when
 *     the backend is offline (e.g. local dev without a server) and is
 *     the "compatibility on 1 release" guarantee from the plan.
 *
 * The shape mirrors `BASE_PANEL_PRICES` (Record<string, number>) so the
 * call sites swap with a one-line edit instead of a refactor.
 */
import { useMemo } from 'react';

import { BASE_PANEL_PRICES } from '../../../shared/config/constants';
import { usePanels } from '../../catalog/api/catalogApi';

export interface EffectivePanelPrices {
  /** key = `"<width_mm>x<height_mm>"`, value = price in ₽. */
  prices: Record<string, number>;
  /** True when the prices come from the live API (not constants fallback). */
  fromApi: boolean;
}

export function useEffectivePanelPrices(): EffectivePanelPrices {
  const { data } = usePanels();

  return useMemo<EffectivePanelPrices>(() => {
    const items = data?.items;
    if (!items || items.length === 0) {
      return { prices: BASE_PANEL_PRICES, fromApi: false };
    }
    // Start from the constants so any size the admin hasn't loaded yet
    // (e.g. during a partial migration) still has a price. API rows
    // override on conflict — same key wins.
    const merged: Record<string, number> = { ...BASE_PANEL_PRICES };
    for (const p of items) {
      const key = `${p.width_mm}x${p.height_mm}`;
      merged[key] = p.base_price;
    }
    return { prices: merged, fromApi: true };
  }, [data]);
}
