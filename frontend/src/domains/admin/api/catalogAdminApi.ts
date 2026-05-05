/**
 * Phase 7A — admin Catalog (categories + designs) bindings.
 *
 * Mirrors the cache-key + mutation pattern from `panelsAdminApi`
 * (Phase 7B): `lists` / `detail(id)` are kept under separate prefixes so
 * a list invalidation never evicts a detail cache.
 *
 * Backend:
 *   Categories
 *     * `GET    /api/admin/categories`            — list + designs_count
 *     * `POST   /api/admin/categories`            — create (201)
 *     * `PATCH  /api/admin/categories/{id}`       — partial update
 *     * `DELETE /api/admin/categories/{id}`       — refused if in-use (409)
 *   Designs
 *     * `GET    /api/admin/designs`               — paginated, includes unpublished
 *     * `GET    /api/admin/designs/{id}`          — single
 *     * `POST   /api/admin/designs`               — create (201)
 *     * `PATCH  /api/admin/designs/{id}`          — partial update
 *     * `POST   /api/admin/designs/{id}/toggle-visibility` — flip is_published
 *     * `DELETE /api/admin/designs/{id}`          — hard delete (204)
 *
 * Error envelope `{detail, code}`:
 *   * 404 `category_not_found` / `design_not_found`
 *   * 409 `category_slug_conflict` / `design_slug_conflict` / `category_in_use`
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../../shared/api';

// ─── Wire types ─────────────────────────────────────────────────────────

export interface ApiAdminCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  designs_count: number;
}

export interface ApiAdminCategoryListResponse {
  items: ApiAdminCategory[];
}

export interface CategoryCreatePayload {
  name: string;
  slug: string;
  image?: string;
}

export interface CategoryUpdatePayload {
  name?: string;
  slug?: string;
  image?: string;
}

export interface ApiColor {
  hex: string;
  name: string;
}

export interface ApiAdminDesign {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  style: string;
  image: string;
  preview_image: string;
  description: string;
  price: number;
  colors: ApiColor[];
  rating: number;
  reviews_count: number;
  is_new: boolean;
  is_popular: boolean;
  is_published: boolean;
  created_at: string;
}

export interface ApiAdminDesignListResponse {
  items: ApiAdminDesign[];
  total: number;
  offset: number;
  limit: number;
}

export interface DesignCreatePayload {
  name: string;
  slug: string;
  category_id: string;
  style?: string;
  image?: string;
  preview_image?: string;
  description?: string;
  price: number;
  colors?: ApiColor[];
  is_published?: boolean;
  is_new?: boolean;
  is_popular?: boolean;
}

export interface DesignUpdatePayload {
  name?: string;
  slug?: string;
  category_id?: string;
  style?: string;
  image?: string;
  preview_image?: string;
  description?: string;
  price?: number;
  colors?: ApiColor[];
  is_published?: boolean;
  is_new?: boolean;
  is_popular?: boolean;
}

export interface DesignsAdminFilters {
  categoryId: string | null;
  search: string | null;
}

export interface DesignsAdminQuery extends DesignsAdminFilters {
  page: number;
  size: number;
  sort: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const catalogAdminKeys = {
  categoriesAll: ['admin', 'categories'] as const,
  designsLists: ['admin', 'designs', 'list'] as const,
  designsList: (q: DesignsAdminQuery) => ['admin', 'designs', 'list', q] as const,
  designDetail: (designId: string) =>
    ['admin', 'designs', 'detail', designId] as const,
};

// ─── Hooks: Categories ──────────────────────────────────────────────────

export function useAdminCategories() {
  return useQuery({
    queryKey: catalogAdminKeys.categoriesAll,
    queryFn: () =>
      api.get<ApiAdminCategoryListResponse>('/admin/categories'),
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryCreatePayload) =>
      api.post<ApiAdminCategory>('/admin/categories', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogAdminKeys.categoriesAll });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      body,
    }: {
      categoryId: string;
      body: CategoryUpdatePayload;
    }) => api.patch<ApiAdminCategory>(`/admin/categories/${categoryId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogAdminKeys.categoriesAll });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) =>
      api.delete<void>(`/admin/categories/${categoryId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogAdminKeys.categoriesAll });
      qc.invalidateQueries({ queryKey: catalogAdminKeys.designsLists });
    },
  });
}

// ─── Hooks: Designs ─────────────────────────────────────────────────────

function buildDesignsQueryString(q: DesignsAdminQuery): string {
  const params = new URLSearchParams();
  const offset = (q.page - 1) * q.size;
  params.set('offset', String(offset));
  params.set('limit', String(q.size));
  if (q.categoryId) params.set('category_id', q.categoryId);
  if (q.search) params.set('search', q.search);
  if (q.sort) params.set('sort', q.sort);
  return params.toString();
}

export function useAdminDesigns(q: DesignsAdminQuery) {
  return useQuery({
    queryKey: catalogAdminKeys.designsList(q),
    queryFn: () =>
      api.get<ApiAdminDesignListResponse>(
        `/admin/designs?${buildDesignsQueryString(q)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminDesign(designId: string | undefined) {
  return useQuery({
    queryKey: designId
      ? catalogAdminKeys.designDetail(designId)
      : ['admin', 'designs', 'detail', 'noop'],
    queryFn: () => api.get<ApiAdminDesign>(`/admin/designs/${designId}`),
    enabled: !!designId,
    staleTime: 15_000,
    retry: false,
  });
}

export function useCreateDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DesignCreatePayload) =>
      api.post<ApiAdminDesign>('/admin/designs', body),
    onSuccess: (data) => {
      qc.setQueryData(catalogAdminKeys.designDetail(data.id), data);
      qc.invalidateQueries({ queryKey: catalogAdminKeys.designsLists });
      qc.invalidateQueries({ queryKey: catalogAdminKeys.categoriesAll });
    },
  });
}

export function useUpdateDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      designId,
      body,
    }: {
      designId: string;
      body: DesignUpdatePayload;
    }) => api.patch<ApiAdminDesign>(`/admin/designs/${designId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(catalogAdminKeys.designDetail(data.id), data);
      qc.invalidateQueries({ queryKey: catalogAdminKeys.designsLists });
      qc.invalidateQueries({ queryKey: catalogAdminKeys.categoriesAll });
    },
  });
}

export function useToggleDesignVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (designId: string) =>
      api.post<ApiAdminDesign>(
        `/admin/designs/${designId}/toggle-visibility`,
      ),
    onSuccess: (data) => {
      qc.setQueryData(catalogAdminKeys.designDetail(data.id), data);
      qc.invalidateQueries({ queryKey: catalogAdminKeys.designsLists });
    },
  });
}

export function useDeleteDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (designId: string) =>
      api.delete<void>(`/admin/designs/${designId}`),
    onSuccess: (_data, designId) => {
      qc.removeQueries({ queryKey: catalogAdminKeys.designDetail(designId) });
      qc.invalidateQueries({ queryKey: catalogAdminKeys.designsLists });
      qc.invalidateQueries({ queryKey: catalogAdminKeys.categoriesAll });
    },
  });
}
