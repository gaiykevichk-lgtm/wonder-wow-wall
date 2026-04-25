/**
 * Phase 7B — admin panels (SKU) bindings.
 *
 * Mirrors the cache-key + mutation pattern established by usersAdminApi
 * (Phase 5): `lists` / `detail(id)` are kept under separate prefixes so
 * a list invalidation never evicts the detail cache (Phase 4B audit fix).
 *
 * Backend:
 *   * `GET    /api/admin/panels`           — paginated, includes inactive
 *   * `GET    /api/admin/panels/{id}`      — single
 *   * `POST   /api/admin/panels`           — create (201)
 *   * `PATCH  /api/admin/panels/{id}`      — partial update (None = "don't touch")
 *   * `DELETE /api/admin/panels/{id}`      — hard delete (204)
 *
 * Error envelope `{detail, code}`:
 *   * 404 + `panel_not_found`
 *   * 409 + `panel_slug_conflict`
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../../shared/api';

// ─── Wire types — mirror backend Pydantic responses 1:1 ─────────────────

export interface ApiPanel {
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
  created_at: string;
}

export interface ApiPanelListResponse {
  items: ApiPanel[];
  total: number;
  offset: number;
  limit: number;
}

// `null` on optional fields means "don't touch" (PATCH semantics on the
// backend — `Field(default=None)`). To CLEAR an optional string the
// caller passes `""` explicitly. Same shape as backend `PanelUpdate`.
export interface PanelUpdatePayload {
  name?: string;
  slug?: string;
  width_mm?: number;
  height_mm?: number;
  size_label?: string;
  base_price?: number;
  description?: string;
  photo_path?: string;
  is_active?: boolean;
}

export interface PanelCreatePayload {
  name: string;
  slug: string;
  width_mm: number;
  height_mm: number;
  size_label?: string;
  base_price: number;
  description?: string;
  photo_path?: string;
  is_active?: boolean;
}

// ─── Filter contract used by store + URL sync ───────────────────────────

export interface PanelsAdminFilters {
  /** null = "all", true = "active only", false = "inactive only" */
  isActive: boolean | null;
  /** Free-text on name/slug — applied client-side (backend has no filter yet). */
  search: string | null;
}

export interface PanelsAdminQuery extends PanelsAdminFilters {
  page: number;
  size: number;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const panelsAdminKeys = {
  // Narrower than `['admin','panels']` so a `lists` invalidation never
  // evicts `detail(id)` (Phase 4B prefix-overlap fix).
  lists: ['admin', 'panels', 'list'] as const,
  list: (q: PanelsAdminQuery) => ['admin', 'panels', 'list', q] as const,
  detail: (panelId: string) => ['admin', 'panels', 'detail', panelId] as const,
};

function buildListQueryString(q: PanelsAdminQuery): string {
  // Phase 7B remediation 2 (FE-B) — filters now travel to the backend
  // (`is_active`, `search`) so paginated `total` reflects the visible
  // set and we don't burn bandwidth re-fetching the same page for each
  // filter combination. The query DTO still drives the React Query
  // cache key, so the cache layer behaves identically (one entry per
  // unique filter combo) while the wire payload is smaller.
  const params = new URLSearchParams();
  const offset = (q.page - 1) * q.size;
  params.set('offset', String(offset));
  params.set('limit', String(q.size));
  if (q.isActive !== null) params.set('is_active', String(q.isActive));
  if (q.search) params.set('search', q.search);
  return params.toString();
}

// ─── Hooks ──────────────────────────────────────────────────────────────

export function usePanelsAdminList(q: PanelsAdminQuery) {
  return useQuery({
    queryKey: panelsAdminKeys.list(q),
    queryFn: () =>
      api.get<ApiPanelListResponse>(
        `/admin/panels?${buildListQueryString(q)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}

export function usePanelDetail(panelId: string | undefined) {
  return useQuery({
    queryKey: panelId
      ? panelsAdminKeys.detail(panelId)
      : ['admin', 'panels', 'detail', 'noop'],
    queryFn: () => api.get<ApiPanel>(`/admin/panels/${panelId}`),
    enabled: !!panelId,
    staleTime: 15_000,
    retry: false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────

export function useCreatePanel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PanelCreatePayload) =>
      api.post<ApiPanel>('/admin/panels', body),
    onSuccess: (data) => {
      // Prime the detail cache so an immediate "edit" navigation skips a
      // round-trip; invalidate only `lists` so we don't blow the prime away.
      qc.setQueryData(panelsAdminKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: panelsAdminKeys.lists });
    },
  });
}

export function useUpdatePanel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ panelId, body }: { panelId: string; body: PanelUpdatePayload }) =>
      api.patch<ApiPanel>(`/admin/panels/${panelId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(panelsAdminKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: panelsAdminKeys.lists });
    },
  });
}

export function useDeletePanel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (panelId: string) =>
      api.delete<void>(`/admin/panels/${panelId}`),
    onSuccess: (_data, panelId) => {
      qc.removeQueries({ queryKey: panelsAdminKeys.detail(panelId) });
      qc.invalidateQueries({ queryKey: panelsAdminKeys.lists });
    },
  });
}
