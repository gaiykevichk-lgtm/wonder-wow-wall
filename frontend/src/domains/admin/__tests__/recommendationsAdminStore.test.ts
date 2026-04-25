/**
 * Phase 10 — recommendations-admin URL ↔ state round-trip tests.
 *
 * Same shape as `usersAdminStore.test.ts`: pin the parser tolerance,
 * the defaults-omitted serialiser, and the ergonomics rule that a
 * filter patch resets pagination to page 1 (so a narrowed result set
 * doesn't render an empty page N).
 */
import { describe, it, expect } from 'vitest';

import {
  applyFilterPatch,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  HAS_MANUAL_OPTIONS,
  queryFromSearchParams,
  searchParamsFromQuery,
  SOURCE_TYPE_OPTIONS,
} from '../model/recommendationsAdminStore';
import type { RecommendationsAdminQuery } from '../api/recommendationsAdminApi';

const baseQuery: RecommendationsAdminQuery = {
  sourceType: null,
  hasManual: null,
  page: DEFAULT_PAGE,
  size: DEFAULT_SIZE,
};

describe('queryFromSearchParams', () => {
  it('returns defaults for an empty URL', () => {
    expect(queryFromSearchParams(new URLSearchParams())).toEqual(baseQuery);
  });

  it('parses every filter axis', () => {
    const params = new URLSearchParams({
      source_type: 'panel',
      has_manual: 'true',
      page: '3',
      size: '25',
    });
    expect(queryFromSearchParams(params)).toEqual({
      sourceType: 'panel',
      hasManual: true,
      page: 3,
      size: 25,
    });
  });

  it('rejects unknown source_type silently (returns null)', () => {
    const params = new URLSearchParams({ source_type: 'bogus' });
    expect(queryFromSearchParams(params).sourceType).toBeNull();
  });

  it('collapses junk has_manual to null (treat as "all")', () => {
    expect(
      queryFromSearchParams(new URLSearchParams({ has_manual: 'maybe' }))
        .hasManual,
    ).toBeNull();
  });

  it('falls back to default page/size for non-numeric inputs', () => {
    const params = new URLSearchParams({ page: 'abc', size: 'xyz' });
    const result = queryFromSearchParams(params);
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.size).toBe(DEFAULT_SIZE);
  });
});

describe('searchParamsFromQuery', () => {
  it('omits defaults so the URL stays clean', () => {
    expect(searchParamsFromQuery(baseQuery).toString()).toBe('');
  });

  it('serialises every set filter', () => {
    const q: RecommendationsAdminQuery = {
      sourceType: 'design',
      hasManual: false,
      page: 2,
      size: 100,
    };
    const params = searchParamsFromQuery(q);
    expect(params.get('source_type')).toBe('design');
    expect(params.get('has_manual')).toBe('false');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('100');
  });

  it('emits has_manual=false (NOT omitted) — distinct from "all"', () => {
    // Regression guard: `false` is a real selection ("без подборки") and
    // must round-trip. A truthy-check serialiser would silently drop it
    // and the URL would no longer reflect what the table is showing.
    const q: RecommendationsAdminQuery = { ...baseQuery, hasManual: false };
    expect(searchParamsFromQuery(q).get('has_manual')).toBe('false');
  });
});

describe('round-trip identity (URL ↔ state)', () => {
  it('preserves a non-default DTO through one full cycle', () => {
    const original: RecommendationsAdminQuery = {
      sourceType: 'design',
      hasManual: true,
      page: 5,
      size: 100,
    };
    const restored = queryFromSearchParams(searchParamsFromQuery(original));
    expect(restored).toEqual(original);
  });

  it('preserves hasManual=false through round-trip', () => {
    const original: RecommendationsAdminQuery = { ...baseQuery, hasManual: false };
    const restored = queryFromSearchParams(searchParamsFromQuery(original));
    expect(restored.hasManual).toBe(false);
  });
});

describe('applyFilterPatch', () => {
  it('applies the patch and resets page to 1', () => {
    const onPage5: RecommendationsAdminQuery = { ...baseQuery, page: 5, size: 50 };
    const result = applyFilterPatch(onPage5, { sourceType: 'panel' });
    expect(result.sourceType).toBe('panel');
    expect(result.page).toBe(DEFAULT_PAGE);
    // Page size is preserved — only the page index resets.
    expect(result.size).toBe(50);
  });

  it('does not mutate the input', () => {
    const original: RecommendationsAdminQuery = { ...baseQuery, page: 3 };
    applyFilterPatch(original, { hasManual: true });
    expect(original.hasManual).toBeNull();
    expect(original.page).toBe(3);
  });
});

describe('SOURCE_TYPE_OPTIONS / HAS_MANUAL_OPTIONS', () => {
  it('lists every backend RecommendationSourceType value', () => {
    expect(SOURCE_TYPE_OPTIONS.map((o) => o.value)).toEqual(['design', 'panel']);
  });

  it('uses string values for has_manual dropdown (boolean would break AntD)', () => {
    expect(HAS_MANUAL_OPTIONS.map((o) => o.value)).toEqual(['true', 'false']);
  });
});
