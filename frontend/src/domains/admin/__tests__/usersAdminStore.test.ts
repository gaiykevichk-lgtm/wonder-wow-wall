/**
 * Phase 5 — users-admin URL <-> state round-trip tests.
 *
 * Same shape as `ordersAdminStore.test.ts` (Phase 4A): pin the round-trip
 * identity, the defaults-omitted serialiser, the junk-collapse parser and
 * the small ergonomics rules (page reset on filter patch).
 */
import { describe, it, expect } from 'vitest';

import {
  applyFilterPatch,
  BLOCKED_OPTIONS,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  EMPTY_FILTERS,
  MAX_PAGE_SIZE,
  queryFromSearchParams,
  ROLE_OPTIONS,
  searchParamsFromQuery,
} from '../model/usersAdminStore';
import type { UsersAdminQuery } from '../api/usersAdminApi';

const baseQuery: UsersAdminQuery = {
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
      role: 'ADMIN',
      is_blocked: 'true',
      search: 'ivan',
      page: '3',
      size: '25',
    });
    expect(queryFromSearchParams(params)).toEqual({
      role: 'ADMIN',
      isBlocked: true,
      search: 'ivan',
      page: 3,
      size: 25,
    });
  });

  it('rejects unknown role values silently (returns null)', () => {
    const params = new URLSearchParams({ role: 'BOGUS' });
    expect(queryFromSearchParams(params).role).toBeNull();
  });

  it('accepts both true/false and 1/0 for is_blocked', () => {
    expect(queryFromSearchParams(new URLSearchParams({ is_blocked: '1' })).isBlocked).toBe(true);
    expect(queryFromSearchParams(new URLSearchParams({ is_blocked: '0' })).isBlocked).toBe(false);
    expect(queryFromSearchParams(new URLSearchParams({ is_blocked: 'true' })).isBlocked).toBe(true);
    expect(queryFromSearchParams(new URLSearchParams({ is_blocked: 'false' })).isBlocked).toBe(false);
  });

  it('collapses junk is_blocked to null (treat as "all")', () => {
    expect(queryFromSearchParams(new URLSearchParams({ is_blocked: 'maybe' })).isBlocked).toBeNull();
  });

  it('falls back to default page/size for non-numeric inputs', () => {
    const params = new URLSearchParams({ page: 'abc', size: '-1' });
    const result = queryFromSearchParams(params);
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.size).toBe(DEFAULT_SIZE);
  });

  it('clamps oversized `size` to MAX_PAGE_SIZE (avoids guaranteed 422)', () => {
    const params = new URLSearchParams({ size: '9999' });
    expect(queryFromSearchParams(params).size).toBe(MAX_PAGE_SIZE);
  });

  it('exposes MAX_PAGE_SIZE = 200 (must mirror backend Pydantic le=200)', () => {
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
    const q: UsersAdminQuery = {
      role: 'ADMIN',
      isBlocked: false,
      search: 'ivan',
      page: 2,
      size: 100,
    };
    const params = searchParamsFromQuery(q);
    expect(params.get('role')).toBe('ADMIN');
    expect(params.get('is_blocked')).toBe('false');
    expect(params.get('search')).toBe('ivan');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('100');
  });

  it('emits is_blocked=false (NOT omitted) — distinct from "all"', () => {
    // Regression guard: `false` is a real selection ("active only") and
    // must round-trip. Truthy-check serialisers would drop it.
    const q: UsersAdminQuery = { ...baseQuery, isBlocked: false };
    expect(searchParamsFromQuery(q).get('is_blocked')).toBe('false');
  });
});

describe('round-trip identity (URL ↔ state)', () => {
  it('preserves a non-default DTO through one full cycle', () => {
    const original: UsersAdminQuery = {
      role: 'CUSTOMER',
      isBlocked: true,
      search: 'test',
      page: 5,
      size: 100,
    };
    const restored = queryFromSearchParams(searchParamsFromQuery(original));
    expect(restored).toEqual(original);
  });

  it('preserves isBlocked=false through round-trip', () => {
    const original: UsersAdminQuery = { ...baseQuery, isBlocked: false };
    const restored = queryFromSearchParams(searchParamsFromQuery(original));
    expect(restored.isBlocked).toBe(false);
  });
});

describe('applyFilterPatch', () => {
  it('applies the patch and resets page to 1', () => {
    const onPage5: UsersAdminQuery = { ...baseQuery, page: 5, size: 50 };
    const result = applyFilterPatch(onPage5, { role: 'ADMIN' });
    expect(result.role).toBe('ADMIN');
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.size).toBe(50);
  });

  it('does not mutate the input', () => {
    const original: UsersAdminQuery = { ...baseQuery, page: 3 };
    applyFilterPatch(original, { search: 'x' });
    expect(original.search).toBeNull();
    expect(original.page).toBe(3);
  });
});

describe('ROLE_OPTIONS / BLOCKED_OPTIONS', () => {
  it('lists every backend UserRole value', () => {
    expect(ROLE_OPTIONS.map((o) => o.value)).toEqual(['CUSTOMER', 'ADMIN']);
  });

  it('uses string values for is_blocked dropdown (boolean would break AntD)', () => {
    expect(BLOCKED_OPTIONS.map((o) => o.value)).toEqual(['false', 'true']);
  });
});
