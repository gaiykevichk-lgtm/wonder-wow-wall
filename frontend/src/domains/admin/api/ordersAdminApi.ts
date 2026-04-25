/**
 * Phase 4A — admin orders list bindings.
 *
 * `GET /api/admin/orders` accepts optional filters (status, user_id,
 * date window via from/to, free-text search) plus 1-based pagination.
 * The query key includes every filter axis so filter changes invalidate
 * the right slice without nuking unrelated caches; the `keepPreviousData`
 * pattern is left to the caller via `placeholderData` so table doesn't
 * flicker between page changes.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api';

// ─── Wire types — mirror the backend pydantic response 1:1 ──────────────

export type OrderStatusKey =
  | 'placed'
  | 'confirmed'
  | 'in_progress'
  | 'delivered'
  | 'installed';

export interface ApiOrderListItem {
  id: string;
  number: string;
  user_id: string;
  status: OrderStatusKey;
  status_label: string;
  total: number;
  address: string;
  created_at: string;
  items_count: number;
}

export interface ApiOrdersListResponse {
  items: ApiOrderListItem[];
  total: number;
  page: number;
  size: number;
}

// ─── Filter contract used by store + URL sync ───────────────────────────

export interface OrdersAdminFilters {
  status: OrderStatusKey | null;
  search: string | null;
  /** ISO datetime string, inclusive lower bound. */
  dateFrom: string | null;
  /** ISO datetime string, exclusive upper bound. */
  dateTo: string | null;
  userId: string | null;
}

export interface OrdersAdminQuery extends OrdersAdminFilters {
  page: number;
  size: number;
}

// ─── Query key helpers ──────────────────────────────────────────────────

export const ordersAdminKeys = {
  all: ['admin', 'orders'] as const,
  list: (q: OrdersAdminQuery) => ['admin', 'orders', 'list', q] as const,
};

function buildQueryString(q: OrdersAdminQuery): string {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.search) params.set('search', q.search);
  if (q.dateFrom) params.set('from', q.dateFrom);
  if (q.dateTo) params.set('to', q.dateTo);
  if (q.userId) params.set('user_id', q.userId);
  params.set('page', String(q.page));
  params.set('size', String(q.size));
  return params.toString();
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useOrdersAdminList(q: OrdersAdminQuery) {
  return useQuery({
    queryKey: ordersAdminKeys.list(q),
    queryFn: () =>
      api.get<ApiOrdersListResponse>(`/admin/orders?${buildQueryString(q)}`),
    // keepPreviousData → table holds prior page rows while next page loads,
    // avoiding a full unmount/remount flash. Standard pattern for paginated
    // tables in TanStack Query v5.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}
