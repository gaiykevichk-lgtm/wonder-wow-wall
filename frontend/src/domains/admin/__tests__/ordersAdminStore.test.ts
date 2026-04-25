/**
 * Phase 4A — orders-admin URL <-> state round-trip tests.
 *
 * The Definition of Done says filters and pagination must survive F5,
 * which only holds if `queryFromSearchParams ∘ searchParamsFromQuery`
 * is an identity for any non-default DTO. These tests pin that invariant
 * plus the small ergonomics rules (defaults omitted, junk inputs
 * collapse to safe values, status whitelist).
 */
import { describe, it, expect } from 'vitest';

import {
  applyFilterPatch,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  EMPTY_FILTERS,
  MAX_PAGE_SIZE,
  queryFromSearchParams,
  searchParamsFromQuery,
  STATUS_OPTIONS,
} from '../model/ordersAdminStore';
import type { OrdersAdminQuery } from '../api/ordersAdminApi';

const baseQuery: OrdersAdminQuery = {
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
      status: 'placed',
      search: 'WW-1',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-26T00:00:00.000Z',
      user_id: 'u-42',
      page: '3',
      size: '25',
    });
    expect(queryFromSearchParams(params)).toEqual({
      status: 'placed',
      search: 'WW-1',
      dateFrom: '2026-04-01T00:00:00.000Z',
      dateTo: '2026-04-26T00:00:00.000Z',
      userId: 'u-42',
      page: 3,
      size: 25,
    });
  });

  it('rejects unknown status values silently (returns null)', () => {
    // A hand-edited URL like ?status=foo should not crash the page or
    // confuse the API call — collapsing to null is the safe default.
    const params = new URLSearchParams({ status: 'bogus' });
    expect(queryFromSearchParams(params).status).toBeNull();
  });

  it('falls back to default page/size for non-numeric inputs', () => {
    const params = new URLSearchParams({ page: 'abc', size: '-1' });
    const result = queryFromSearchParams(params);
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.size).toBe(DEFAULT_SIZE);
  });

  it('clamps oversized `size` to MAX_PAGE_SIZE (avoids guaranteed 422)', () => {
    // Backend rejects size > 200 with 422; clamping client-side prevents
    // a doomed request when a user hand-edits or pastes a stale URL.
    const params = new URLSearchParams({ size: '9999' });
    expect(queryFromSearchParams(params).size).toBe(MAX_PAGE_SIZE);
  });

  it('exposes MAX_PAGE_SIZE = 200 (must mirror backend Pydantic le=200)', () => {
    // Pin the constant — if backend changes its limit, this test fails
    // and forces a synchronised update on the frontend.
    expect(MAX_PAGE_SIZE).toBe(200);
  });

  it('trims whitespace-only search to null', () => {
    const params = new URLSearchParams({ search: '   ' });
    expect(queryFromSearchParams(params).search).toBeNull();
  });
});

describe('searchParamsFromQuery', () => {
  it('omits defaults so the URL stays clean', () => {
    expect(searchParamsFromQuery(baseQuery).toString()).toBe('');
  });

  it('serialises every set filter', () => {
    const q: OrdersAdminQuery = {
      status: 'delivered',
      search: 'ivan',
      dateFrom: '2026-04-01T00:00:00.000Z',
      dateTo: '2026-04-26T00:00:00.000Z',
      userId: 'u-7',
      page: 2,
      size: 100,
    };
    const params = searchParamsFromQuery(q);
    expect(params.get('status')).toBe('delivered');
    expect(params.get('search')).toBe('ivan');
    expect(params.get('from')).toBe('2026-04-01T00:00:00.000Z');
    expect(params.get('to')).toBe('2026-04-26T00:00:00.000Z');
    expect(params.get('user_id')).toBe('u-7');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('100');
  });
});

describe('round-trip identity (URL ↔ state)', () => {
  it('preserves a non-default DTO through one full cycle', () => {
    const original: OrdersAdminQuery = {
      status: 'in_progress',
      search: 'test',
      dateFrom: '2026-04-01T00:00:00.000Z',
      dateTo: '2026-04-26T00:00:00.000Z',
      userId: 'u-1',
      page: 5,
      size: 100,
    };
    const restored = queryFromSearchParams(searchParamsFromQuery(original));
    expect(restored).toEqual(original);
  });
});

describe('applyFilterPatch', () => {
  it('applies the patch and resets page to 1', () => {
    // Filter changes always land on page 1 — staying on page 5 of a
    // narrower result set would silently show "empty" to the user.
    const onPage5: OrdersAdminQuery = { ...baseQuery, page: 5, size: 50 };
    const result = applyFilterPatch(onPage5, { status: 'placed' });
    expect(result.status).toBe('placed');
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.size).toBe(50); // size is preserved — only page resets
  });

  it('does not mutate the input', () => {
    const original: OrdersAdminQuery = { ...baseQuery, page: 3 };
    applyFilterPatch(original, { search: 'x' });
    expect(original.search).toBeNull();
    expect(original.page).toBe(3);
  });
});

describe('STATUS_OPTIONS', () => {
  it('lists every backend OrderStatus value', () => {
    // Drift-detector: if the backend enum changes, this fails fast.
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'placed',
      'confirmed',
      'in_progress',
      'delivered',
      'installed',
    ]);
  });
});
