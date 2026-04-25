/**
 * Phase 9 — audit-log URL <-> filter state.
 *
 * Same convention as `usersAdminStore.ts` / `ordersAdminStore.ts`: the
 * URL is the single source of truth so filters and pagination survive
 * F5. No zustand. The helpers below round-trip URL ↔ DTO.
 *
 * Filter axes (mirror backend `AuditFilters` and the route's Query
 * params):
 *   * action       — single AuditAction key, null = all
 *   * actorId      — exact user id, null = all
 *   * targetType   — restrict to one resource family, null = all
 *   * targetId     — exact id of one entity, null = all
 *   * dateFrom/To  — inclusive ISO date range (YYYY-MM-DD)
 */

import type {
  AuditActionKey,
  AuditFilters,
  AuditQuery,
  AuditTargetTypeKey,
} from '../api/auditApi';

const VALID_ACTIONS: ReadonlyArray<AuditActionKey> = [
  'user_block',
  'user_unblock',
  'role_grant',
  'role_revoke',
  'order_status_change',
  'order_refund',
  'order_note_add',
  'design_delete',
  'panel_delete',
  'settings_update',
  'media_upload_suspicious',
];

const VALID_TARGETS: ReadonlyArray<AuditTargetTypeKey> = [
  'user',
  'order',
  'design',
  'panel',
  'settings',
  'media',
];

export const DEFAULT_PAGE = 1;
export const DEFAULT_SIZE = 50;
// Mirror of backend `Query(le=200)` in admin/audit.py — pinned by store
// test so a backend bump surfaces here.
export const MAX_PAGE_SIZE = 200;

export const EMPTY_FILTERS: AuditFilters = {
  action: null,
  actorId: null,
  targetType: null,
  targetId: null,
  dateFrom: null,
  dateTo: null,
};

/**
 * Russian labels per `AuditActionKey`. Used by the table cell, the
 * filter dropdown, and (in future) the activity timeline on the user
 * detail page. Kept in the store module so JSX-free consumers can
 * import them without dragging AntD.
 */
export const AUDIT_ACTION_LABELS: Record<AuditActionKey, string> = {
  user_block: 'Блокировка пользователя',
  user_unblock: 'Разблокировка пользователя',
  role_grant: 'Назначение администратором',
  role_revoke: 'Снятие прав администратора',
  order_status_change: 'Смена статуса заказа',
  order_refund: 'Возврат по заказу',
  order_note_add: 'Заметка к заказу',
  design_delete: 'Удаление дизайна',
  panel_delete: 'Удаление панели',
  settings_update: 'Изменение настроек магазина',
  media_upload_suspicious: 'Подозрительная загрузка',
};

/** Russian labels per `AuditTargetTypeKey`. */
export const AUDIT_TARGET_LABELS: Record<AuditTargetTypeKey, string> = {
  user: 'Пользователь',
  order: 'Заказ',
  design: 'Дизайн',
  panel: 'Панель',
  settings: 'Настройки',
  media: 'Файл',
};

export const ACTION_OPTIONS: { value: AuditActionKey; label: string }[] =
  VALID_ACTIONS.map((value) => ({ value, label: AUDIT_ACTION_LABELS[value] }));

export const TARGET_OPTIONS: { value: AuditTargetTypeKey; label: string }[] =
  VALID_TARGETS.map((value) => ({ value, label: AUDIT_TARGET_LABELS[value] }));

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseClampedInt(raw: string | null, fallback: number, max: number): number {
  const n = parsePositiveInt(raw, fallback);
  return n > max ? max : n;
}

function parseAction(raw: string | null): AuditActionKey | null {
  return raw && (VALID_ACTIONS as ReadonlyArray<string>).includes(raw)
    ? (raw as AuditActionKey)
    : null;
}

function parseTarget(raw: string | null): AuditTargetTypeKey | null {
  return raw && (VALID_TARGETS as ReadonlyArray<string>).includes(raw)
    ? (raw as AuditTargetTypeKey)
    : null;
}

function parseString(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ISO date — accept only YYYY-MM-DD or full ISO that starts with one.
// Anything else collapses to null so a hand-edited URL with garbage
// can't crash the page or send 422 to the backend.
function parseDate(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null;
  return trimmed;
}

export function queryFromSearchParams(params: URLSearchParams): AuditQuery {
  return {
    action: parseAction(params.get('action')),
    actorId: parseString(params.get('actor_id')),
    targetType: parseTarget(params.get('target_type')),
    targetId: parseString(params.get('target_id')),
    dateFrom: parseDate(params.get('from')),
    dateTo: parseDate(params.get('to')),
    page: parsePositiveInt(params.get('page'), DEFAULT_PAGE),
    size: parseClampedInt(params.get('size'), DEFAULT_SIZE, MAX_PAGE_SIZE),
  };
}

/** Inverse of `queryFromSearchParams`. Defaults are omitted to keep URLs clean. */
export function searchParamsFromQuery(q: AuditQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (q.action) params.set('action', q.action);
  if (q.actorId) params.set('actor_id', q.actorId);
  if (q.targetType) params.set('target_type', q.targetType);
  if (q.targetId) params.set('target_id', q.targetId);
  if (q.dateFrom) params.set('from', q.dateFrom);
  if (q.dateTo) params.set('to', q.dateTo);
  if (q.page !== DEFAULT_PAGE) params.set('page', String(q.page));
  if (q.size !== DEFAULT_SIZE) params.set('size', String(q.size));
  return params;
}

/**
 * Apply a partial filter patch and reset page to 1. Same reset rule as
 * the other admin list pages: changing a filter while on page 5 should
 * land on page 1 of the new result set rather than silently keep stale
 * pagination.
 */
export function applyFilterPatch(
  current: AuditQuery,
  patch: Partial<AuditFilters>,
): AuditQuery {
  return {
    ...current,
    ...patch,
    page: DEFAULT_PAGE,
  };
}

/**
 * Resolve a deep-link path for `(target_type, target_id)`. Returns null
 * when the pair can't be linked (e.g. settings — singleton, no detail
 * page). Used by the table cell to render `target_id` as a link.
 */
export function targetDeepLink(
  type: AuditTargetTypeKey | null,
  id: string | null,
): string | null {
  if (!type || !id) return null;
  switch (type) {
    case 'user':
      return `/admin/users/${id}`;
    case 'order':
      return `/admin/orders/${id}`;
    // No detail pages for the rest yet — return null so the cell
    // renders plain text instead of a broken link.
    default:
      return null;
  }
}
