/**
 * Phase 9 — audit-log URL <-> state round-trip tests.
 *
 * Mirrors `usersAdminStore.test.ts` / `ordersAdminStore.test.ts`: pins
 * the round-trip identity, the defaults-omitted serialiser, the junk-
 * collapse parser, and small ergonomics (page reset on filter patch,
 * deep-link resolver, label maps).
 */
import { describe, expect, it } from 'vitest';

import type { AuditQuery } from '../api/auditApi';
import {
  ACTION_OPTIONS,
  applyFilterPatch,
  AUDIT_ACTION_LABELS,
  AUDIT_TARGET_LABELS,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  EMPTY_FILTERS,
  MAX_PAGE_SIZE,
  queryFromSearchParams,
  searchParamsFromQuery,
  TARGET_OPTIONS,
  targetDeepLink,
} from '../model/auditStore';

const baseQuery: AuditQuery = {
  ...EMPTY_FILTERS,
  page: DEFAULT_PAGE,
  size: DEFAULT_SIZE,
};

describe('queryFromSearchParams', () => {
  it('returns defaults for an empty URL', () => {
    expect(queryFromSearchParams(new URLSearchParams())).toEqual(baseQuery);
  });

  it('parses every filter axis', () => {
    const params = new URLSearchParams({
      action: 'user_block',
      actor_id: 'admin-1',
      target_type: 'user',
      target_id: 'u-42',
      from: '2026-04-01',
      to: '2026-04-30',
      page: '3',
      size: '25',
    });
    expect(queryFromSearchParams(params)).toEqual({
      action: 'user_block',
      actorId: 'admin-1',
      targetType: 'user',
      targetId: 'u-42',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      page: 3,
      size: 25,
    });
  });

  it('collapses unknown action to null (junk-edited URL)', () => {
    const params = new URLSearchParams({ action: 'nuke_database' });
    expect(queryFromSearchParams(params).action).toBeNull();
  });

  it('collapses unknown target_type to null', () => {
    const params = new URLSearchParams({ target_type: 'spaceship' });
    expect(queryFromSearchParams(params).targetType).toBeNull();
  });

  it('rejects malformed dates', () => {
    const params = new URLSearchParams({ from: 'yesterday', to: '2026/04/30' });
    const q = queryFromSearchParams(params);
    expect(q.dateFrom).toBeNull();
    expect(q.dateTo).toBeNull();
  });

  it('accepts ISO date that starts with YYYY-MM-DD', () => {
    const params = new URLSearchParams({ from: '2026-04-01T00:00:00Z' });
    expect(queryFromSearchParams(params).dateFrom).toBe('2026-04-01T00:00:00Z');
  });

  it('clamps oversized page size to MAX_PAGE_SIZE', () => {
    const params = new URLSearchParams({ size: '999999' });
    expect(queryFromSearchParams(params).size).toBe(MAX_PAGE_SIZE);
  });

  it('falls back to default page on non-positive', () => {
    const params = new URLSearchParams({ page: '-3' });
    expect(queryFromSearchParams(params).page).toBe(DEFAULT_PAGE);
  });

  it('trims and nulls empty actor_id / target_id', () => {
    const params = new URLSearchParams({ actor_id: '   ', target_id: '' });
    const q = queryFromSearchParams(params);
    expect(q.actorId).toBeNull();
    expect(q.targetId).toBeNull();
  });
});

describe('searchParamsFromQuery', () => {
  it('omits defaults for a clean URL', () => {
    expect(searchParamsFromQuery(baseQuery).toString()).toBe('');
  });

  it('serialises filter values back', () => {
    const q: AuditQuery = {
      action: 'role_grant',
      actorId: 'admin-1',
      targetType: 'user',
      targetId: 'u-1',
      dateFrom: '2026-04-01',
      dateTo: null,
      page: 2,
      size: 25,
    };
    const params = searchParamsFromQuery(q);
    expect(params.get('action')).toBe('role_grant');
    expect(params.get('actor_id')).toBe('admin-1');
    expect(params.get('target_type')).toBe('user');
    expect(params.get('target_id')).toBe('u-1');
    expect(params.get('from')).toBe('2026-04-01');
    expect(params.get('to')).toBeNull();
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('25');
  });

  it('round-trips through queryFromSearchParams', () => {
    const q: AuditQuery = {
      action: 'order_status_change',
      actorId: 'admin-2',
      targetType: 'order',
      targetId: 'o-9',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      page: 4,
      size: 100,
    };
    expect(queryFromSearchParams(searchParamsFromQuery(q))).toEqual(q);
  });
});

describe('applyFilterPatch', () => {
  it('resets page to 1 when filters change', () => {
    const current: AuditQuery = { ...baseQuery, page: 5 };
    const next = applyFilterPatch(current, { action: 'user_block' });
    expect(next.page).toBe(DEFAULT_PAGE);
    expect(next.action).toBe('user_block');
  });

  it('clears a filter when patched with null', () => {
    const current: AuditQuery = { ...baseQuery, action: 'user_block', page: 3 };
    const next = applyFilterPatch(current, { action: null });
    expect(next.action).toBeNull();
    expect(next.page).toBe(DEFAULT_PAGE);
  });
});

describe('label maps', () => {
  it('covers every option key', () => {
    for (const opt of ACTION_OPTIONS) {
      expect(AUDIT_ACTION_LABELS[opt.value]).toBeTruthy();
      expect(opt.label).toBe(AUDIT_ACTION_LABELS[opt.value]);
    }
    for (const opt of TARGET_OPTIONS) {
      expect(AUDIT_TARGET_LABELS[opt.value]).toBeTruthy();
      expect(opt.label).toBe(AUDIT_TARGET_LABELS[opt.value]);
    }
  });
});

describe('targetDeepLink', () => {
  it('links to user / order detail pages', () => {
    expect(targetDeepLink('user', 'u-1')).toBe('/admin/users/u-1');
    expect(targetDeepLink('order', 'o-9')).toBe('/admin/orders/o-9');
  });

  it('returns null for target types without a detail page', () => {
    expect(targetDeepLink('settings', 'singleton')).toBeNull();
    expect(targetDeepLink('design', 'd-1')).toBeNull();
    expect(targetDeepLink('panel', 'p-1')).toBeNull();
    expect(targetDeepLink('media', 'm-1')).toBeNull();
  });

  it('returns null when type or id is missing', () => {
    expect(targetDeepLink(null, 'u-1')).toBeNull();
    expect(targetDeepLink('user', null)).toBeNull();
  });
});
