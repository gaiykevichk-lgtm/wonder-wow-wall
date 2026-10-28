/**
 * Phase 5 — users-admin URL <-> filter state.
 *
 * Same pattern as `ordersAdminStore.ts` (Phase 4A): no zustand, the URL
 * is the single source of truth so filters and pagination survive F5.
 * `useSearchParams` from react-router converts both directions through
 * the helpers below.
 *
 * Filter axes (mirror `UsersAdminFilters` and the backend `UserFilters`):
 *   * role        — CUSTOMER / ADMIN, null = all
 *   * isBlocked   — true / false / null = all
 *   * search      — substring on email/name/phone
 */

import type {
  UserRoleKey,
  UsersAdminFilters,
  UsersAdminQuery,
} from '../api/usersAdminApi';

const VALID_ROLES: ReadonlyArray<UserRoleKey> = ['CUSTOMER', 'ADMIN'];

export const DEFAULT_PAGE = 1;
export const DEFAULT_SIZE = 50;
// Mirror of backend `Pydantic Query(le=200)` in admin/users.py.
// Pinned by store test so a backend bump surfaces here.
export const MAX_PAGE_SIZE = 200;

export const EMPTY_FILTERS: UsersAdminFilters = {
  role: null,
  isBlocked: null,
  search: null,
};

export const ROLE_OPTIONS: { value: UserRoleKey; label: string }[] = [
  { value: 'CUSTOMER', label: 'Покупатель' },
  { value: 'ADMIN', label: 'Администратор' },
];

// Tri-state for the is_blocked filter. We keep the value space narrow
// (boolean | null) so a stray URL value collapses cleanly to null.
export const BLOCKED_OPTIONS: { value: 'true' | 'false'; label: string }[] = [
  { value: 'false', label: 'Активные' },
  { value: 'true', label: 'Заблокированные' },
];

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseClampedInt(raw: string | null, fallback: number, max: number): number {
  const n = parsePositiveInt(raw, fallback);
  return n > max ? max : n;
}

function parseRole(raw: string | null): UserRoleKey | null {
  return raw && (VALID_ROLES as ReadonlyArray<string>).includes(raw)
    ? (raw as UserRoleKey)
    : null;
}

function parseBool(raw: string | null): boolean | null {
  // Tolerant parser — accepts 'true'/'false' (the canonical form) plus
  // '1'/'0' (URL-friendlier) so a hand-edited URL Just Works. Anything
  // else collapses to null so we match the "all rows" behaviour rather
  // than silently filtering on `false`.
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return null;
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
export function queryFromSearchParams(params: URLSearchParams): UsersAdminQuery {
  return {
    role: parseRole(params.get('role')),
    isBlocked: parseBool(params.get('is_blocked')),
    search: parseString(params.get('search')),
    page: parsePositiveInt(params.get('page'), DEFAULT_PAGE),
    size: parseClampedInt(params.get('size'), DEFAULT_SIZE, MAX_PAGE_SIZE),
  };
}

/**
 * Inverse of `queryFromSearchParams`. Defaults are *omitted* so the URL
 * stays clean (`/admin/users` rather than `/admin/users?page=1&size=50`).
 */
export function searchParamsFromQuery(q: UsersAdminQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (q.role) params.set('role', q.role);
  if (q.isBlocked !== null) params.set('is_blocked', String(q.isBlocked));
  if (q.search) params.set('search', q.search);
  if (q.page !== DEFAULT_PAGE) params.set('page', String(q.page));
  if (q.size !== DEFAULT_SIZE) params.set('size', String(q.size));
  return params;
}

/**
 * Apply a partial filter patch and reset page to 1. Same reset rule as
 * orders: changing a filter while on page 5 should land on page 1 of
 * the new result set, not silently keep stale pagination.
 */
export function applyFilterPatch(
  current: UsersAdminQuery,
  patch: Partial<UsersAdminFilters>,
): UsersAdminQuery {
  return {
    ...current,
    ...patch,
    page: DEFAULT_PAGE,
  };
}
