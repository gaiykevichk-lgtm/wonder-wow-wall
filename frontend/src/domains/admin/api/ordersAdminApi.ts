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

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../../shared/api';

// ─── Wire types — mirror the backend pydantic response 1:1 ──────────────

// Phase 4B — added `cancelled` and `refunded` (terminal "unhappy" states).
// Mirrors backend `OrderStatus` enum; the store's `STATUS_OPTIONS` test
// pins this list so a backend rename forces a synchronised frontend update.
export type OrderStatusKey =
  | 'placed'
  | 'confirmed'
  | 'in_progress'
  | 'delivered'
  | 'installed'
  | 'cancelled'
  | 'refunded';

// Statuses the admin can transition TO via PATCH /status. PLACED is excluded
// because "uncreating" an order is not a valid action — see backend
// `_STATUS_TRANSITIONS` for the canonical list.
export type OrderStatusUpdateKey = Exclude<OrderStatusKey, 'placed'>;

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

// ─── Hooks ──────────────────────────────────────────────────────────────

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


// ═══════════════════════════════════════════════════════════════════════
// Phase 4B — order detail / status transition / notes
// ═══════════════════════════════════════════════════════════════════════

export interface ApiOrderItemDetail {
  id: string;
  design_id: string;
  design_name: string;
  design_image: string;
  size_key: string;
  color: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface ApiOrderNote {
  id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at: string;
}

export interface ApiOrderAddress {
  city: string;
  street: string;
  building: string;
  apartment: string;
  postal_code: string;
}

export interface ApiOrderDetail {
  id: string;
  number: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: OrderStatusKey;
  status_label: string;
  total: number;
  address: string;
  address_full: ApiOrderAddress;
  installation_date: string | null;
  cancel_reason: string | null;
  items: ApiOrderItemDetail[];
  notes: ApiOrderNote[];
  created_at: string;
  updated_at: string;
}

export const orderDetailKeys = {
  detail: (orderId: string) => ['admin', 'orders', 'detail', orderId] as const,
};

export function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: orderId ? orderDetailKeys.detail(orderId) : ['admin', 'orders', 'detail', 'noop'],
    queryFn: () => api.get<ApiOrderDetail>(`/admin/orders/${orderId}`),
    enabled: !!orderId,
    staleTime: 15_000,
    retry: false,
  });
}

export interface UpdateStatusInput {
  orderId: string;
  status: OrderStatusUpdateKey;
  reason?: string;
}

/**
 * PATCH /api/admin/orders/{id}/status. On success, the response is the
 * full updated detail — we put it directly into the cache so the page
 * re-renders with the new status without an extra GET round-trip.
 *
 * Errors:
 *   * 409 with `code: "invalid_transition"` → forbidden transition; UI
 *     surfaces a toast and refetches (state on the server changed).
 *   * 422 → reason missing / unknown status; UI shows the validation
 *     message inline.
 */
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, reason }: UpdateStatusInput) =>
      api.patch<ApiOrderDetail>(`/admin/orders/${orderId}/status`, {
        status,
        reason,
      }),
    onSuccess: (data) => {
      qc.setQueryData(orderDetailKeys.detail(data.id), data);
      // Also invalidate the list so the table reflects the new status
      // when the admin navigates back. We don't know which page they
      // were on, so a coarse `all` invalidation is the safe choice.
      qc.invalidateQueries({ queryKey: ordersAdminKeys.all });
    },
  });
}

export interface AddNoteInput {
  orderId: string;
  text: string;
}

export function useAddOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, text }: AddNoteInput) =>
      api.post<ApiOrderNote>(`/admin/orders/${orderId}/notes`, { text }),
    onSuccess: (note, vars) => {
      // Append to the cached detail without refetching — saves a round-
      // trip on the common "add a note" flow.
      qc.setQueryData<ApiOrderDetail | undefined>(
        orderDetailKeys.detail(vars.orderId),
        (prev) => (prev ? { ...prev, notes: [...prev.notes, note] } : prev),
      );
    },
  });
}
