/**
 * Phase 8D — pull live shop settings from the public `GET /api/shop/settings`
 * endpoint with a constants-bundle fallback.
 *
 * Background: Phase 8A added the admin singleton CRUD for shop settings,
 * but the catalog/account/pricing-page UIs still read `DESIGN_OVERLAY_PRICE`
 * from `shared/config/constants.ts`, so an admin price change wasn't
 * visible to customers without a redeploy. This hook closes the DoD
 * "≤5-minute TTL" requirement.
 *
 * Strategy (mirrors `useEffectivePanelPrices` from Phase 7B):
 *   * Fetch from `/api/shop/settings` via TanStack Query, 5-minute
 *     `staleTime` so the catalog isn't a per-render fetch.
 *   * `retry: false` so a transient backend failure falls through to
 *     the constants fallback without retry-storming the admin URL.
 *   * On `data === undefined` (loading / error / no network) return the
 *     legacy `DESIGN_OVERLAY_PRICE` so the UI prices accurately even
 *     before the request resolves. `fromApi: false` lets callers
 *     surface a "price may be stale" hint if they want.
 *
 * Shape mirrors the API response 1:1 (snake_case from the wire) plus a
 * convenience `fromApi` boolean — the bare price scalar is also exposed
 * as `designOverlayPrice` so call sites that only need that one number
 * don't have to reach through the object.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '../api';
import { DESIGN_OVERLAY_PRICE } from '../config/constants';

export interface ApiPublicShopSettings {
  design_overlay_price: number;
  installation_price: number;
  min_order_amount: number;
  recommendations_limit_per_source: number;
  updated_at: string;
}

export interface EffectiveShopSettings {
  designOverlayPrice: number;
  installationPrice: number;
  minOrderAmount: number;
  recommendationsLimitPerSource: number;
  fromApi: boolean;
}

const FALLBACK: EffectiveShopSettings = {
  designOverlayPrice: DESIGN_OVERLAY_PRICE,
  installationPrice: 0,
  minOrderAmount: 0,
  recommendationsLimitPerSource: 12,
  fromApi: false,
};

export const shopSettingsKey = ['shop', 'settings'] as const;

export function usePublicShopSettings() {
  return useQuery({
    queryKey: shopSettingsKey,
    queryFn: () => api.get<ApiPublicShopSettings>('/shop/settings'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useShopSettings(): EffectiveShopSettings {
  const { data } = usePublicShopSettings();
  return useMemo<EffectiveShopSettings>(() => {
    if (!data) return FALLBACK;
    return {
      designOverlayPrice: data.design_overlay_price,
      installationPrice: data.installation_price,
      minOrderAmount: data.min_order_amount,
      recommendationsLimitPerSource: data.recommendations_limit_per_source,
      fromApi: true,
    };
  }, [data]);
}
