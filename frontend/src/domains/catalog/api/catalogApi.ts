import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api';
import type { ApiDesignListResponse, ApiDesign, ApiCategory, ApiReview } from '../../../shared/api/types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const catalogKeys = {
  designs: (params?: Record<string, string | number | undefined>) => ['designs', params] as const,
  design: (id: string) => ['designs', id] as const,
  categories: () => ['categories'] as const,
  reviews: (designId: string) => ['reviews', designId] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useDesigns(params?: {
  category?: string;
  search?: string;
  sort?: string;
  offset?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: catalogKeys.designs(params),
    queryFn: () => api.get<ApiDesignListResponse>(`/designs${qs ? `?${qs}` : ''}`),
  });
}

export function useDesign(id: string) {
  return useQuery({
    queryKey: catalogKeys.design(id),
    queryFn: () => api.get<ApiDesign>(`/designs/${id}`),
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: () => api.get<ApiCategory[]>('/categories'),
    staleTime: 5 * 60 * 1000, // categories rarely change
  });
}

export function useDesignReviews(designId: string) {
  return useQuery({
    queryKey: catalogKeys.reviews(designId),
    queryFn: () => api.get<ApiReview[]>(`/designs/${designId}/reviews`),
    enabled: !!designId,
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
