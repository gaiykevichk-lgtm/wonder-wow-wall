/**
 * Phase 7A — catalog-admin URL ↔ filter state.
 *
 * Same pattern as `panelsAdminStore` (Phase 7B): URL is the source of truth
 * so filters and pagination survive F5. Two domains share this store —
 * categories (no filters, no pagination) and designs (categoryId, search,
 * sort, page, size). Active tab is also URL-synced via `?tab=` so a
 * deep-link stays on the right tab.
 *
 * `MAX_PAGE_SIZE` mirrors the backend `Query(le=200)` in
 * `admin/catalog.py`. Pinned by the store test so a backend bump surfaces
 * here as a failing assertion rather than a silent 422.
 */

import type { DesignsAdminFilters, DesignsAdminQuery } from '../api/catalogAdminApi';

export const DEFAULT_PAGE = 1;
export const DEFAULT_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_SORT = 'name';

export const EMPTY_FILTERS: DesignsAdminFilters = {
  categoryId: null,
  search: null,
};

export type CatalogTab = 'categories' | 'designs';
export const DEFAULT_TAB: CatalogTab = 'categories';

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'name', label: 'По имени' },
  { value: 'price', label: 'По цене' },
  { value: 'popular', label: 'По популярности' },
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

function parseString(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseTab(raw: string | null): CatalogTab {
  return raw === 'designs' ? 'designs' : DEFAULT_TAB;
}

export function queryFromSearchParams(params: URLSearchParams): DesignsAdminQuery {
  return {
    categoryId: parseString(params.get('category_id')),
    search: parseString(params.get('search')),
    page: parsePositiveInt(params.get('page'), DEFAULT_PAGE),
    size: parseClampedInt(params.get('size'), DEFAULT_SIZE, MAX_PAGE_SIZE),
    sort: parseString(params.get('sort')) ?? DEFAULT_SORT,
  };
}

export function searchParamsFromQuery(
  q: DesignsAdminQuery,
  tab: CatalogTab,
): URLSearchParams {
  const params = new URLSearchParams();
  if (tab !== DEFAULT_TAB) params.set('tab', tab);
  if (q.categoryId) params.set('category_id', q.categoryId);
  if (q.search) params.set('search', q.search);
  if (q.sort && q.sort !== DEFAULT_SORT) params.set('sort', q.sort);
  if (q.page !== DEFAULT_PAGE) params.set('page', String(q.page));
  if (q.size !== DEFAULT_SIZE) params.set('size', String(q.size));
  return params;
}

export function applyFilterPatch(
  current: DesignsAdminQuery,
  patch: Partial<DesignsAdminFilters & { sort: string }>,
): DesignsAdminQuery {
  return {
    ...current,
    ...patch,
    page: DEFAULT_PAGE,
  };
}

// Same Cyrillic→ASCII transliteration as `panelsAdminStore.slugify` —
// duplicated here so the catalog form does not import a sibling store
// just for the helper. If a third caller needs it, lift to `shared/`.
const CYR_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

export function slugify(input: string): string {
  const lowered = input.toLowerCase();
  let out = '';
  for (const ch of lowered) {
    if (CYR_MAP[ch] !== undefined) {
      out += CYR_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else if (/\s|-|_/.test(ch)) {
      out += '-';
    }
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '');
}
