/**
 * Phase 8 — public shop endpoints (settings + banners + plans).
 *
 * Single TanStack Query module so the catalog/constructor/account UIs
 * pull settings/plans/banners through one shared cache. 5-min staleTime
 * matches the backend `Cache-Control: public, max-age=300` header so
 * an admin's PATCH propagates within 5 minutes without a hard refresh.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from './client';
import { DESIGN_OVERLAY_PRICE } from '../config/constants';

// ─── Wire types ─────────────────────────────────────────────────────────

export interface ApiPublicShopSettings {
  id: string;
  design_overlay_price: number;
  installation_price: number;
  min_order_amount: number;
  recommendations_limit_per_source: number;
  updated_at: string;
}

export interface ApiPublicBanner {
  id: string;
  title: string;
  subtitle: string;
  image_path: string;
  cta_label: string;
  cta_url: string;
  position: string;
  priority: number;
}

export interface ApiPublicBannerListResponse {
  items: ApiPublicBanner[];
}

export interface ApiPublicSubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  area_limit_m2: number;
  popular: boolean;
  features: string[];
}

export interface ApiPublicSubscriptionPlanListResponse {
  items: ApiPublicSubscriptionPlan[];
}

// ─── Cache keys ─────────────────────────────────────────────────────────

export const shopKeys = {
  settings: ['shop', 'settings'] as const,
  banners: (position?: string) =>
    position
      ? (['shop', 'banners', position] as const)
      : (['shop', 'banners'] as const),
  plans: ['shop', 'plans'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────

/**
 * Public shop settings with 5-min staleTime. The hook always returns a
 * usable price — when the API hasn't resolved or errored, the fallback
 * mirrors `frontend/src/shared/config/constants.ts:DESIGN_OVERLAY_PRICE`
 * so existing callsites swap with a one-line edit (read `.designOverlayPrice`
 * instead of the constant).
 */
export interface EffectiveShopSettings {
  designOverlayPrice: number;
  installationPrice: number;
  minOrderAmount: number;
  recommendationsLimitPerSource: number;
  /** True when the values come from the live API, false on fallback. */
  fromApi: boolean;
}

export function useShopSettings(): EffectiveShopSettings {
  const { data } = useQuery({
    queryKey: shopKeys.settings,
    queryFn: () => api.get<ApiPublicShopSettings>('/shop/settings'),
    // 5-min cache; matches backend `Cache-Control: max-age=300` so the
    // admin's PATCH lands across the catalog within 5 min without an
    // explicit refetch.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return useMemo<EffectiveShopSettings>(() => {
    if (!data) {
      return {
        designOverlayPrice: DESIGN_OVERLAY_PRICE,
        installationPrice: 0,
        minOrderAmount: 0,
        recommendationsLimitPerSource: 12,
        fromApi: false,
      };
    }
    return {
      designOverlayPrice: data.design_overlay_price,
      installationPrice: data.installation_price,
      minOrderAmount: data.min_order_amount,
      recommendationsLimitPerSource: data.recommendations_limit_per_source,
      fromApi: true,
    };
  }, [data]);
}

export function usePublicBanners(position?: string) {
  return useQuery({
    queryKey: shopKeys.banners(position),
    queryFn: () =>
      api.get<ApiPublicBannerListResponse>(
        position ? `/shop/banners?position=${position}` : '/shop/banners',
      ),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function usePublicSubscriptionPlans() {
  return useQuery({
    queryKey: shopKeys.plans,
    queryFn: () =>
      api.get<ApiPublicSubscriptionPlanListResponse>('/subscription-plans'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
