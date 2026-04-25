/**
 * Phase 5 — admin users bindings.
 *
 * `GET /api/admin/users` accepts optional filters (role, is_blocked,
 * free-text search) plus 1-based pagination. Mirrors the cache-key
 * structure introduced for orders in Phase 4A:
 *   * `lists` is the prefix for paginated/filtered list queries — used
 *     for invalidation that should NOT touch the detail cache.
 *   * `detail(id)` lives under a separate prefix so a list invalidation
 *     never accidentally evicts the detail (the bug we hit and fixed in
 *     Phase 4B's audit).
 *
 * Block / unblock / grant / revoke all return the full updated detail
 * (server-side bundles `recent_orders` so the UI can `setQueryData(detail)`
 * on success without an extra GET).
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../../shared/api';
import type { OrderStatusKey } from './ordersAdminApi';

// ─── Wire types — mirror backend pydantic responses 1:1 ─────────────────

export type UserRoleKey = 'CUSTOMER' | 'ADMIN';

export interface ApiUserListItem {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRoleKey;
  is_blocked: boolean;
  created_at: string;
}

export interface ApiUsersListResponse {
  items: ApiUserListItem[];
  total: number;
  page: number;
  size: number;
}

export interface ApiUserAddress {
  id: string;
  label: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  postal_code: string;
  is_default: boolean;
}

export interface ApiRecentOrder {
  id: string;
  number: string;
  status: OrderStatusKey;
  status_label: string;
  total: number;
  created_at: string;
}

export interface ApiUserDetail {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRoleKey;
  is_blocked: boolean;
  created_at: string;
  addresses: ApiUserAddress[];
  recent_orders: ApiRecentOrder[];
}

// ─── Filter contract used by store + URL sync ───────────────────────────

export interface UsersAdminFilters {
  role: UserRoleKey | null;
  /** null = "all", true = "blocked only", false = "active only" */
  isBlocked: boolean | null;
  search: string | null;
}

export interface UsersAdminQuery extends UsersAdminFilters {
  page: number;
  size: number;
}

// ─── Query key helpers ──────────────────────────────────────────────────

export const usersAdminKeys = {
  // Narrower than `['admin','users']` to avoid the prefix-overlap bug we
  // hit in Phase 4B: invalidating `['admin','users']` would also evict
  // every `['admin','users','detail',id]` entry.
  lists: ['admin', 'users', 'list'] as const,
  list: (q: UsersAdminQuery) => ['admin', 'users', 'list', q] as const,
  detail: (userId: string) => ['admin', 'users', 'detail', userId] as const,
};

function buildQueryString(q: UsersAdminQuery): string {
  const params = new URLSearchParams();
  if (q.role) params.set('role', q.role);
  if (q.isBlocked !== null) params.set('is_blocked', String(q.isBlocked));
  if (q.search) params.set('search', q.search);
  params.set('page', String(q.page));
  params.set('size', String(q.size));
  return params.toString();
}

// ─── Hooks ──────────────────────────────────────────────────────────────

export function useUsersAdminList(q: UsersAdminQuery) {
  return useQuery({
    queryKey: usersAdminKeys.list(q),
    queryFn: () =>
      api.get<ApiUsersListResponse>(`/admin/users?${buildQueryString(q)}`),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}

export function useUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? usersAdminKeys.detail(userId) : ['admin', 'users', 'detail', 'noop'],
    queryFn: () => api.get<ApiUserDetail>(`/admin/users/${userId}`),
    enabled: !!userId,
    staleTime: 15_000,
    retry: false,
  });
}

// ─── Mutations: block / unblock / grant / revoke ────────────────────────

/**
 * Shared post-success cache update. All four actions return the full
 * `ApiUserDetail`; we put it directly into the detail cache and then
 * invalidate ONLY the `lists` prefix so the table re-fetches without
 * evicting the detail we just primed.
 */
function makeUserActionMutation(action: 'block' | 'unblock' | 'grant-admin' | 'revoke-admin') {
  return function useUserAction() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (userId: string) =>
        api.post<ApiUserDetail>(`/admin/users/${userId}/${action}`, {}),
      onSuccess: (data) => {
        qc.setQueryData(usersAdminKeys.detail(data.id), data);
        qc.invalidateQueries({ queryKey: usersAdminKeys.lists });
      },
    });
  };
}

export const useBlockUser = makeUserActionMutation('block');
export const useUnblockUser = makeUserActionMutation('unblock');
export const useGrantAdmin = makeUserActionMutation('grant-admin');
export const useRevokeAdmin = makeUserActionMutation('revoke-admin');
