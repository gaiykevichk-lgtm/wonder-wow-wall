/**
 * Phase 7A — catalog-admin URL <-> state round-trip tests.
 *
 * Mirrors `panelsAdminStore.test.ts`: pin the parser tolerance,
 * defaults-omitted serialiser, page-reset on filter patch, and the
 * slugify heuristic so the create-modal's auto-fill stays predictable.
 *
 * The store covers TWO concerns: design-list filters/pagination AND
 * the active-tab toggle (`?tab=designs`). The tab is folded into the
 * serialiser so a deep-link survives F5 on either tab.
 */
import { describe, it, expect } from 'vitest';

import {
  applyFilterPatch,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  DEFAULT_SORT,
  DEFAULT_TAB,
  EMPTY_FILTERS,
  MAX_PAGE_SIZE,
  parseTab,
  queryFromSearchParams,
  searchParamsFromQuery,
  slugify,
} from '../model/catalogAdminStore';
import type { DesignsAdminQuery } from '../api/catalogAdminApi';

const baseQuery: DesignsAdminQuery = {
  ...EMPTY_FILTERS,
  page: DEFAULT_PAGE,
  size: DEFAULT_SIZE,
  sort: DEFAULT_SORT,
};

describe('parseTab', () => {
  it('defaults to "categories" when missing or unrecognised', () => {
    expect(parseTab(null)).toBe(DEFAULT_TAB);
    expect(parseTab('')).toBe(DEFAULT_TAB);
    expect(parseTab('garbage')).toBe(DEFAULT_TAB);
  });

  it('returns "designs" only for the literal "designs" value', () => {
    expect(parseTab('designs')).toBe('designs');
  });
});

describe('queryFromSearchParams', () => {
  it('returns defaults for an empty URL', () => {
    expect(queryFromSearchParams(new URLSearchParams())).toEqual(baseQuery);
  });

  it('parses every axis', () => {
    const params = new URLSearchParams({
      category_id: 'cat-1',
      search: 'forest',
      sort: 'price',
      page: '3',
      size: '25',
    });
    expect(queryFromSearchParams(params)).toEqual({
      categoryId: 'cat-1',
      search: 'forest',
      sort: 'price',
      page: 3,
      size: 25,
    });
  });

  it('clamps oversize `size` against MAX_PAGE_SIZE (matches backend Query(le=200))', () => {
    expect(
      queryFromSearchParams(new URLSearchParams({ size: '999' })).size,
    ).toBe(MAX_PAGE_SIZE);
  });

  it('falls back to defaults on non-numeric / non-positive page+size', () => {
    expect(
      queryFromSearchParams(new URLSearchParams({ page: 'abc', size: '0' })),
    ).toEqual(baseQuery);
    expect(
      queryFromSearchParams(new URLSearchParams({ page: '-5', size: '-1' })),
    ).toEqual(baseQuery);
  });

  it('treats blank-string filters as null', () => {
    const q = queryFromSearchParams(
      new URLSearchParams({ category_id: '   ', search: '' }),
    );
    expect(q.categoryId).toBeNull();
    expect(q.search).toBeNull();
  });
});

describe('searchParamsFromQuery', () => {
  it('omits defaults — clean URLs for the empty/categories case', () => {
    const out = searchParamsFromQuery(baseQuery, DEFAULT_TAB);
    expect(out.toString()).toBe('');
  });

  it('writes only the non-default axes', () => {
    const out = searchParamsFromQuery(
      { categoryId: 'cat-1', search: 'forest', sort: 'price', page: 3, size: 25 },
      'designs',
    );
    const obj = Object.fromEntries(out.entries());
    expect(obj).toEqual({
      tab: 'designs',
      category_id: 'cat-1',
      search: 'forest',
      sort: 'price',
      page: '3',
      size: '25',
    });
  });

  it('does not emit `tab` for the default tab', () => {
    const out = searchParamsFromQuery(baseQuery, DEFAULT_TAB);
    expect(out.has('tab')).toBe(false);
  });

  it('round-trips: parse(serialise(q)) === q for a non-default state', () => {
    const original: DesignsAdminQuery = {
      categoryId: 'cat-2',
      search: 'sunset',
      sort: 'popular',
      page: 4,
      size: 100,
    };
    const params = searchParamsFromQuery(original, 'designs');
    const back = queryFromSearchParams(params);
    expect(back).toEqual(original);
    // Tab survives via parseTab (not queryFromSearchParams) — pinned
    // separately so the page logic mirrors the storage shape.
    expect(parseTab(params.get('tab'))).toBe('designs');
  });
});

describe('applyFilterPatch', () => {
  it('resets page to 1 on any filter change', () => {
    const cur: DesignsAdminQuery = { ...baseQuery, page: 5 };
    expect(applyFilterPatch(cur, { search: 'q' }).page).toBe(1);
  });

  it('preserves untouched fields', () => {
    const cur: DesignsAdminQuery = {
      categoryId: 'cat-9',
      search: 'old',
      sort: 'rating',
      page: 2,
      size: 100,
    };
    const next = applyFilterPatch(cur, { search: 'new' });
    expect(next.categoryId).toBe('cat-9');
    expect(next.sort).toBe('rating');
    expect(next.size).toBe(100);
    expect(next.search).toBe('new');
    expect(next.page).toBe(1);
  });

  it('does not mutate the input object (immutability)', () => {
    const cur: DesignsAdminQuery = { ...baseQuery, page: 3 };
    applyFilterPatch(cur, { search: 'x' });
    expect(cur.page).toBe(3);
    expect(cur.search).toBeNull();
  });
});

describe('slugify', () => {
  it('transliterates Cyrillic to ASCII and lowercases', () => {
    expect(slugify('Природа')).toBe('priroda');
    expect(slugify('Лес На Рассвете')).toBe('les-na-rassvete');
  });

  it('collapses runs of dashes / spaces / underscores', () => {
    expect(slugify('Привет___мир   и-ещё')).toBe('privet-mir-i-esche');
  });

  it('drops anything that is not [a-z0-9-] after translit', () => {
    expect(slugify('Лес!@#2026—🌲')).toBe('les2026');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('---abc---')).toBe('abc');
    expect(slugify('   abc   ')).toBe('abc');
  });

  it('handles all-empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('—!@#')).toBe('');
  });
});
