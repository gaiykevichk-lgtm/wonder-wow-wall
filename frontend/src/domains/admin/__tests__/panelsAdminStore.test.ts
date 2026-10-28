/**
 * Phase 7B — panels-admin URL <-> state round-trip tests.
 *
 * Mirrors the shape of `usersAdminStore.test.ts` and
 * `ordersAdminStore.test.ts`: pin the round-trip identity, the
 * defaults-omitted serialiser, the junk-collapse parser and the small
 * ergonomics rules (page reset on filter patch). Plus a small block for
 * `slugify` so the auto-fill heuristic in the create modal stays
 * predictable.
 */
import { describe, it, expect } from 'vitest';

import {
  ACTIVE_OPTIONS,
  applyFilterPatch,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  EMPTY_FILTERS,
  MAX_PAGE_SIZE,
  queryFromSearchParams,
  searchParamsFromQuery,
  slugify,
} from '../model/panelsAdminStore';
import type { PanelsAdminQuery } from '../api/panelsAdminApi';

const baseQuery: PanelsAdminQuery = {
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
      is_active: 'true',
      search: 'panel-30',
      page: '3',
      size: '25',
    });
    expect(queryFromSearchParams(params)).toEqual({
      isActive: true,
      search: 'panel-30',
      page: 3,
      size: 25,
    });
  });

  it('accepts both true/false and 1/0 for is_active', () => {
    expect(queryFromSearchParams(new URLSearchParams({ is_active: '1' })).isActive).toBe(true);
    expect(queryFromSearchParams(new URLSearchParams({ is_active: '0' })).isActive).toBe(false);
    expect(queryFromSearchParams(new URLSearchParams({ is_active: 'true' })).isActive).toBe(true);
    expect(queryFromSearchParams(new URLSearchParams({ is_active: 'false' })).isActive).toBe(false);
  });

  it('collapses junk is_active to null (treat as "all")', () => {
    expect(
      queryFromSearchParams(new URLSearchParams({ is_active: 'maybe' })).isActive,
    ).toBeNull();
  });

  it('falls back to default page/size for non-numeric inputs', () => {
    const params = new URLSearchParams({ page: 'abc', size: '-1' });
    const result = queryFromSearchParams(params);
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.size).toBe(DEFAULT_SIZE);
  });

  it('clamps oversized `size` to MAX_PAGE_SIZE (avoids guaranteed 422)', () => {
    const params = new URLSearchParams({ size: '99999' });
    expect(queryFromSearchParams(params).size).toBe(MAX_PAGE_SIZE);
  });

  it('exposes MAX_PAGE_SIZE = 500 (must mirror backend Pydantic le=500)', () => {
    // Pin the constant — if backend changes its limit, this test fails
    // and forces a synchronised update on the frontend.
    expect(MAX_PAGE_SIZE).toBe(500);
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
    const q: PanelsAdminQuery = {
      isActive: false,
      search: 'panel-30',
      page: 2,
      size: 100,
    };
    const params = searchParamsFromQuery(q);
    expect(params.get('is_active')).toBe('false');
    expect(params.get('search')).toBe('panel-30');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('100');
  });

  it('emits is_active=false (NOT omitted) — distinct from "all"', () => {
    // Regression guard: `false` is a real selection ("inactive only") and
    // must round-trip. Truthy-check serialisers would drop it.
    const q: PanelsAdminQuery = { ...baseQuery, isActive: false };
    expect(searchParamsFromQuery(q).get('is_active')).toBe('false');
  });
});

describe('round-trip identity (URL ↔ state)', () => {
  it('preserves a non-default DTO through one full cycle', () => {
    const original: PanelsAdminQuery = {
      isActive: true,
      search: 'test',
      page: 5,
      size: 100,
    };
    const restored = queryFromSearchParams(searchParamsFromQuery(original));
    expect(restored).toEqual(original);
  });

  it('preserves isActive=false through round-trip', () => {
    const original: PanelsAdminQuery = { ...baseQuery, isActive: false };
    const restored = queryFromSearchParams(searchParamsFromQuery(original));
    expect(restored.isActive).toBe(false);
  });
});

describe('applyFilterPatch', () => {
  it('applies the patch and resets page to 1', () => {
    const onPage5: PanelsAdminQuery = { ...baseQuery, page: 5, size: 50 };
    const result = applyFilterPatch(onPage5, { isActive: true });
    expect(result.isActive).toBe(true);
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.size).toBe(50);
  });

  it('does not mutate the input', () => {
    const original: PanelsAdminQuery = { ...baseQuery, page: 3 };
    applyFilterPatch(original, { search: 'x' });
    expect(original.search).toBeNull();
    expect(original.page).toBe(3);
  });
});

describe('ACTIVE_OPTIONS', () => {
  it('uses string values (boolean would break AntD <Select>)', () => {
    expect(ACTIVE_OPTIONS.map((o) => o.value)).toEqual(['true', 'false']);
  });
});

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('Panel 30x30')).toBe('panel-30x30');
  });

  it('transliterates Cyrillic to ASCII so the slug stays browser-friendly', () => {
    expect(slugify('Панель Стандарт')).toBe('panel-standart');
  });

  it('drops punctuation silently', () => {
    expect(slugify('Panel "30x30"!')).toBe('panel-30x30');
  });

  it('collapses runs of dashes and trims leading/trailing', () => {
    expect(slugify('  --hello---world--  ')).toBe('hello-world');
  });

  it('returns an empty string for an all-punctuation input', () => {
    expect(slugify('!@#$%^&*()')).toBe('');
  });

  it('keeps existing dashes and digits', () => {
    expect(slugify('panel-30x60-v2')).toBe('panel-30x60-v2');
  });
});
