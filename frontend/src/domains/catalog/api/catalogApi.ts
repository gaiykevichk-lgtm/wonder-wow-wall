import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api';
import type { ApiDesignListResponse, ApiDesign, ApiCategory, ApiReview } from '../../../shared/api/types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const catalogKeys = {
  designs: (params?: Record<string, string | number | undefined>) => ['designs', params] as const,
  design: (id: string) => ['designs', id] as const,
  categories: () => ['categories'] as const,
  reviews: (designId: string) => ['reviews', designId] as const,
  // Phase 10 — public «с этим покупают» rail. Keyed by the natural source
  // pair so the same product page survives a navigation round-trip without
  // refetching from scratch.
  recommendations: (sourceType: 'design' | 'panel', sourceId: string) =>
    ['recommendations', sourceType, sourceId] as const,
  // Phase 7B — public panel SKU catalogue. Constructor + visualizer
  // consume this. One key for the full active catalogue (we expect a
  // dozen rows, not paginated UX).
  panels: () => ['panels'] as const,
};

// ─── Phase 7B — public panel SKU catalogue ────────────────────────────────

export interface ApiPublicPanel {
  id: string;
  name: string;
  slug: string;
  width_mm: number;
  height_mm: number;
  size_label: string;
  base_price: number;
  description: string;
  photo_path: string;
  is_active: boolean;
}

export interface ApiPublicPanelListResponse {
  items: ApiPublicPanel[];
  total: number;
}

/**
 * `GET /api/panels` — active panels only (backend hard-codes
 * `include_inactive=False`). Used by the constructor and visualizer to
 * replace the old hard-coded `PANEL_SIZES` / `BASE_PANEL_PRICES`
 * constants. `staleTime: 5min` because admins edit panels rarely; the
 * old constants were effectively immutable, the new API source needs
 * just enough freshness to pick up an admin change without becoming a
 * per-render request.
 *
 * `retry: false` so a transient backend failure falls through to the
 * caller's constants-based fallback without retry-storming.
 */
export function usePanels() {
  return useQuery({
    queryKey: catalogKeys.panels(),
    queryFn: () =>
      api.get<ApiPublicPanelListResponse>('/panels?limit=100'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── Phase 10 — public recommendations ────────────────────────────────────

export type RecommendationTargetTypeKey = 'design' | 'panel';

export interface ApiPublicRecommendationTarget {
  target_type: RecommendationTargetTypeKey;
  target_id: string;
}

export interface ApiPublicRecommendationListResponse {
  items: ApiPublicRecommendationTarget[];
}

/**
 * `GET /api/recommendations/{source_type}/{source_id}` — admin-curated
 * targets first, fallback heuristic fills the tail up to `limit`.
 *
 * Always returns 200 + a list (never null, never 404) so callers can
 * render the rail unconditionally. `retry: false` because the endpoint
 * is non-essential — a transient 5xx should fall back to the page's
 * client-side heuristic, not retry-storm.
 */
export function usePublicRecommendations(params: {
  sourceType: 'design' | 'panel';
  sourceId: string;
  limit?: number;
  enabled?: boolean;
}) {
  const { sourceType, sourceId, limit = 12, enabled = true } = params;
  return useQuery({
    queryKey: catalogKeys.recommendations(sourceType, sourceId),
    queryFn: () =>
      api.get<ApiPublicRecommendationListResponse>(
        `/recommendations/${sourceType}/${sourceId}?limit=${limit}`,
      ),
    enabled: enabled && !!sourceId,
    retry: false,
    staleTime: 60_000,
  });
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useDesigns(params?: {
  category?: string;
  search?: string;
  sort?: string;
  offset?: number;
  limit?: number;
  color?: string;
  style?: string;
  is_new?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.color) searchParams.set('color', params.color);
  if (params?.style) searchParams.set('style', params.style);
  if (params?.is_new !== undefined) searchParams.set('is_new', String(params.is_new));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: catalogKeys.designs(params),
    queryFn: () => api.get<ApiDesignListResponse>(`/designs${qs ? `?${qs}` : ''}`),
    retry: false,
  });
}

export function useDesign(id: string) {
  return useQuery({
    queryKey: catalogKeys.design(id),
    queryFn: () => api.get<ApiDesign>(`/designs/${id}`),
    enabled: !!id,
    retry: false,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: () => api.get<ApiCategory[]>('/categories'),
    staleTime: 5 * 60 * 1000, // categories rarely change
    retry: false,
  });
}

export function useDesignReviews(designId: string) {
  return useQuery({
    queryKey: catalogKeys.reviews(designId),
    queryFn: () => api.get<ApiReview[]>(`/designs/${designId}/reviews`),
    enabled: !!designId,
    retry: false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useAddReview(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rating: number; text: string }) =>
      api.post<ApiReview>(`/designs/${designId}/reviews`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.reviews(designId) });
      qc.invalidateQueries({ queryKey: catalogKeys.design(designId) });
    },
  });
}
