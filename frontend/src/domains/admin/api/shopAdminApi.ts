/**
 * Phase 8 — admin Shop bindings (settings + banners + plans).
 *
 * Mirrors the cache-key/mutation pattern from `panelsAdminApi` (Phase 7B):
 * `lists` / `detail(id)` are kept under separate prefixes so a list
 * invalidation never evicts a detail cache. On successful mutation we
 * also invalidate the public `shopKeys.*` so the customer-facing UI
 * sees the change after at most a refetch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api';
import { shopKeys } from '../../../shared/api/shopApi';

// ═══════════════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════════════

export interface ApiAdminShopSettings {
  id: string;
  design_overlay_price: number;
  installation_price: number;
  min_order_amount: number;
  recommendations_limit_per_source: number;
  updated_at: string;
}

export interface ShopSettingsUpdatePayload {
  design_overlay_price?: number;
  installation_price?: number;
  min_order_amount?: number;
  recommendations_limit_per_source?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Banners
// ═══════════════════════════════════════════════════════════════════════

export interface ApiAdminBanner {
  id: string;
  title: string;
  subtitle: string;
  image_path: string;
  cta_label: string;
  cta_url: string;
  position: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiAdminBannerListResponse {
  items: ApiAdminBanner[];
}

export interface BannerCreatePayload {
  title: string;
  subtitle?: string;
  image_path?: string;
  cta_label?: string;
  cta_url?: string;
  position?: string;
  priority?: number;
  is_active?: boolean;
}

export interface BannerUpdatePayload {
  title?: string;
  subtitle?: string;
  image_path?: string;
  cta_label?: string;
  cta_url?: string;
  position?: string;
  priority?: number;
  is_active?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Subscription plans
// ═══════════════════════════════════════════════════════════════════════

export interface ApiAdminPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  area_limit_m2: number;
  popular: boolean;
  is_active: boolean;
  sort_order: number;
  features: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiAdminPlanListResponse {
  items: ApiAdminPlan[];
}

export interface PlanCreatePayload {
  id: string;
  name: string;
  price: number;
  period?: string;
  area_limit_m2?: number;
  popular?: boolean;
  is_active?: boolean;
  sort_order?: number;
  features?: string[];
}

export interface PlanUpdatePayload {
  name?: string;
  price?: number;
  period?: string;
  area_limit_m2?: number;
  popular?: boolean;
  is_active?: boolean;
  sort_order?: number;
  features?: string[];
}

// ─── Cache keys ─────────────────────────────────────────────────────────

export const shopAdminKeys = {
  settings: ['admin', 'shop', 'settings'] as const,
  banners: ['admin', 'shop', 'banners'] as const,
  bannersList: ['admin', 'shop', 'banners', 'list'] as const,
  bannerDetail: (id: string) => ['admin', 'shop', 'banners', 'detail', id] as const,
  plans: ['admin', 'subscription-plans'] as const,
  plansList: ['admin', 'subscription-plans', 'list'] as const,
  planDetail: (id: string) => ['admin', 'subscription-plans', 'detail', id] as const,
};

// ─── Settings hooks ─────────────────────────────────────────────────────

export function useAdminShopSettings() {
  return useQuery({
    queryKey: shopAdminKeys.settings,
    queryFn: () => api.get<ApiAdminShopSettings>('/admin/shop/settings'),
    staleTime: 30_000,
    retry: false,
  });
}

export function useUpdateShopSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ShopSettingsUpdatePayload) =>
      api.patch<ApiAdminShopSettings>('/admin/shop/settings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopAdminKeys.settings });
      qc.invalidateQueries({ queryKey: shopKeys.settings });
    },
  });
}

// ─── Banners hooks ──────────────────────────────────────────────────────

export function useAdminBanners() {
  return useQuery({
    queryKey: shopAdminKeys.bannersList,
    queryFn: () =>
      api.get<ApiAdminBannerListResponse>('/admin/shop/banners'),
    staleTime: 15_000,
    retry: false,
  });
}

export function useCreateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BannerCreatePayload) =>
      api.post<ApiAdminBanner>('/admin/shop/banners', body),
    onSuccess: (data) => {
      qc.setQueryData(shopAdminKeys.bannerDetail(data.id), data);
      qc.invalidateQueries({ queryKey: shopAdminKeys.bannersList });
      qc.invalidateQueries({ queryKey: shopKeys.banners() });
    },
  });
}

export function useUpdateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bannerId, body }: { bannerId: string; body: BannerUpdatePayload }) =>
      api.patch<ApiAdminBanner>(`/admin/shop/banners/${bannerId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(shopAdminKeys.bannerDetail(data.id), data);
      qc.invalidateQueries({ queryKey: shopAdminKeys.bannersList });
      qc.invalidateQueries({ queryKey: shopKeys.banners() });
    },
  });
}

export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bannerId: string) =>
      api.delete<void>(`/admin/shop/banners/${bannerId}`),
    onSuccess: (_data, bannerId) => {
      qc.removeQueries({ queryKey: shopAdminKeys.bannerDetail(bannerId) });
      qc.invalidateQueries({ queryKey: shopAdminKeys.bannersList });
      qc.invalidateQueries({ queryKey: shopKeys.banners() });
    },
  });
}

// ─── Plans hooks ────────────────────────────────────────────────────────

export function useAdminPlans() {
  return useQuery({
    queryKey: shopAdminKeys.plansList,
    queryFn: () =>
      api.get<ApiAdminPlanListResponse>('/admin/subscription-plans'),
    staleTime: 15_000,
    retry: false,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PlanCreatePayload) =>
      api.post<ApiAdminPlan>('/admin/subscription-plans', body),
    onSuccess: (data) => {
      qc.setQueryData(shopAdminKeys.planDetail(data.id), data);
      qc.invalidateQueries({ queryKey: shopAdminKeys.plansList });
      qc.invalidateQueries({ queryKey: shopKeys.plans });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, body }: { planId: string; body: PlanUpdatePayload }) =>
      api.patch<ApiAdminPlan>(`/admin/subscription-plans/${planId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(shopAdminKeys.planDetail(data.id), data);
      qc.invalidateQueries({ queryKey: shopAdminKeys.plansList });
      qc.invalidateQueries({ queryKey: shopKeys.plans });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      api.delete<void>(`/admin/subscription-plans/${planId}`),
    onSuccess: (_data, planId) => {
      qc.removeQueries({ queryKey: shopAdminKeys.planDetail(planId) });
      qc.invalidateQueries({ queryKey: shopAdminKeys.plansList });
      qc.invalidateQueries({ queryKey: shopKeys.plans });
    },
  });
}
