/**
 * Phase 9 — admin audit-log bindings.
 *
 * `GET /api/admin/audit?action=&actor_id=&target_type=&target_id=&from=&to=&page=&size=`
 * returns a paginated, DESC-by-`created_at` list of admin actions. Wire
 * types mirror the backend pydantic responses field-for-field so a typo
 * surfaces at compile time.
 *
 * Cache key shape mirrors `usersAdminKeys`: a `lists` prefix that is safe
 * to invalidate without evicting an unrelated detail cache (we don't
 * have a detail view yet, but reserving the prefix keeps the future
 * change a one-line addition rather than a key restructure).
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api';

// ─── Wire types — keep in sync with backend `AuditEntryResponse` ───────

/** Mirror of `AuditAction` enum on the server. */
export type AuditActionKey =
  | 'user_block'
  | 'user_unblock'
  | 'role_grant'
  | 'role_revoke'
  | 'order_status_change'
  | 'order_refund'
  | 'order_note_add'
  | 'design_delete'
  | 'panel_delete'
  | 'settings_update'
  | 'media_upload_suspicious';

/** Mirror of `AuditTargetType` enum on the server. */
export type AuditTargetTypeKey =
  | 'user'
  | 'order'
  | 'design'
  | 'panel'
  | 'settings'
  | 'media';

export interface ApiAuditEntry {
  id: string;
  actor_id: string;
  action: AuditActionKey;
  target_type: AuditTargetTypeKey | null;
  target_id: string | null;
  // Payload is intentionally typed as Record<string, unknown> — its
  // shape varies per action and is rendered as collapsible JSON in the
  // table. Action-specific narrowing happens in `auditPayloadSummary.ts`
  // (kept out of the wire type so a new payload field doesn't fail
  // compilation in unrelated callers).
  payload: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

export interface ApiAuditListResponse {
  items: ApiAuditEntry[];
  total: number;
  page: number;
  size: number;
}

// ─── Filter contract used by store + URL sync ──────────────────────────

export interface AuditFilters {
  action: AuditActionKey | null;
  actorId: string | null;
  targetType: AuditTargetTypeKey | null;
  targetId: string | null;
  /** ISO date string (YYYY-MM-DD), inclusive on both ends. */
  dateFrom: string | null;
  dateTo: string | null;
}

export interface AuditQuery extends AuditFilters {
  page: number;
  size: number;
}

// ─── Query key helpers ─────────────────────────────────────────────────

export const auditKeys = {
  // Same `lists` prefix convention as the other admin sections — leaves
  // room for a future `detail(entryId)` without re-keying.
  lists: ['admin', 'audit', 'list'] as const,
  list: (q: AuditQuery) => ['admin', 'audit', 'list', q] as const,
};

function buildQueryString(q: AuditQuery): string {
  const params = new URLSearchParams();
  if (q.action) params.set('action', q.action);
  if (q.actorId) params.set('actor_id', q.actorId);
  if (q.targetType) params.set('target_type', q.targetType);
  if (q.targetId) params.set('target_id', q.targetId);
  // Backend reads `from` / `to` (the "date_" prefix is internal-only).
  // Strings round-trip through Pydantic's datetime parser, so plain
  // YYYY-MM-DD works (interpreted as midnight UTC start-of-day).
  if (q.dateFrom) params.set('from', q.dateFrom);
  if (q.dateTo) params.set('to', q.dateTo);
  params.set('page', String(q.page));
  params.set('size', String(q.size));
  return params.toString();
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useAuditList(q: AuditQuery) {
  return useQuery({
    queryKey: auditKeys.list(q),
    queryFn: () =>
      api.get<ApiAuditListResponse>(`/admin/audit?${buildQueryString(q)}`),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}
