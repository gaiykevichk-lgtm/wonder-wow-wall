/**
 * Phase 4A — orders-admin URL <-> filter state.
 *
 * No zustand store this time: filters live in the URL search params so
 * they survive F5 by construction (Definition of Done § "Фильтры и
 * пагинация переживают F5"). A pure helper module is enough; the page
 * uses `useSearchParams` from react-router and converts both directions
 * via the functions here.
 *
 * Why pure helpers (not a store):
 *   * URL is already the single source of truth — duplicating it into a
 *     store would invite drift.
 *   * React Query keys derive from `OrdersAdminQuery`; that DTO is what
 *     we round-trip through the URL.
 */

import type {
  OrderStatusKey,
  OrdersAdminFilters,
  OrdersAdminQuery,
} from '../api/ordersAdminApi';

const VALID_STATUSES: ReadonlyArray<OrderStatusKey> = [
  'placed',
  'confirmed',
  'in_progress',
  'delivered',
  'installed',
  // Phase 4B — terminal "unhappy" states. Kept here so the URL parser
  // accepts them (`?status=cancelled`) without crashing the page.
  'cancelled',
  'refunded',
];

export const DEFAULT_PAGE = 1;
export const DEFAULT_SIZE = 50;
// Mirror of backend `ListOrdersAdmin.MAX_PAGE_SIZE` / Pydantic `Query(le=200)`.
// Kept in sync manually; the store test pins this value so drift is caught.
export const MAX_PAGE_SIZE = 200;

export const EMPTY_FILTERS: OrdersAdminFilters = {
  status: null,
  search: null,
  dateFrom: null,
  dateTo: null,
  userId: null,
};

export const STATUS_OPTIONS: { value: OrderStatusKey; label: string }[] = [
  { value: 'placed', label: 'Оформлен' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'delivered', label: 'Доставлен' },
  { value: 'installed', label: 'Установлен' },
  // Phase 4B — terminal "unhappy" states. Order matters for the filter
  // dropdown (happy chain first, then exits) and pinning is asserted by
  // `STATUS_OPTIONS` test in `ordersAdminStore.test.ts`.
  { value: 'cancelled', label: 'Отменён' },
  { value: 'refunded', label: 'Возврат' },
];

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Like `parsePositiveInt`, but clamps to `[1, max]`. Prevents `?size=9999`
 *  in URL from firing a doomed request that the backend rejects with 422. */
function parseClampedInt(raw: string | null, fallback: number, max: number): number {
  const n = parsePositiveInt(raw, fallback);
  return n > max ? max : n;
}

function parseStatus(raw: string | null): OrderStatusKey | null {
  return raw && (VALID_STATUSES as ReadonlyArray<string>).includes(raw)
    ? (raw as OrderStatusKey)
    : null;
}

function parseString(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build the canonical query DTO from URL search params. Unknown values
 * collapse to defaults so a hand-edited URL never crashes the page.
 */
export function queryFromSearchParams(params: URLSearchParams): OrdersAdminQuery {
  return {
    status: parseStatus(params.get('status')),
    search: parseString(params.get('search')),
    dateFrom: parseString(params.get('from')),
    dateTo: parseString(params.get('to')),
    userId: parseString(params.get('user_id')),
    page: parsePositiveInt(params.get('page'), DEFAULT_PAGE),
    size: parseClampedInt(params.get('size'), DEFAULT_SIZE, MAX_PAGE_SIZE),
  };
}

/**
 * Inverse of `queryFromSearchParams`. Defaults are *omitted* so the URL
 * stays clean for the common case (`/admin/orders` rather than
 * `/admin/orders?page=1&size=50`).
 */
export function searchParamsFromQuery(q: OrdersAdminQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.search) params.set('search', q.search);
  if (q.dateFrom) params.set('from', q.dateFrom);
  if (q.dateTo) params.set('to', q.dateTo);
  if (q.userId) params.set('user_id', q.userId);
  if (q.page !== DEFAULT_PAGE) params.set('page', String(q.page));
  if (q.size !== DEFAULT_SIZE) params.set('size', String(q.size));
  return params;
}

/**
 * Apply a partial filter patch and reset page to 1. Used by every filter
 * UI control — changing a filter while on page 5 should land on page 1
 * of the new result set, not silently keep stale pagination.
 */
export function applyFilterPatch(
  current: OrdersAdminQuery,
  patch: Partial<OrdersAdminFilters>,
): OrdersAdminQuery {
  return {
    ...current,
    ...patch,
    page: DEFAULT_PAGE,
  };
}
