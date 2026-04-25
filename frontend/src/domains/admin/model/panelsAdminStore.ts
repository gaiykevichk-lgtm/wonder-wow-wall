/**
 * Phase 7B — panels-admin URL <-> filter state.
 *
 * Same pattern as `usersAdminStore.ts` (Phase 5) and `ordersAdminStore.ts`
 * (Phase 4A): URL is the single source of truth so filters and pagination
 * survive F5. No zustand here — `useSearchParams` round-trips through the
 * helpers below.
 *
 * Filter axes (Phase 7B remediation 2 — pushed to the backend, see
 * `panelsAdminApi.buildListQueryString` and `app/infrastructure/api/admin/
 * panels.py`):
 *   * isActive — true / false / null = all
 *   * search   — substring on name/slug
 *
 * `MAX_PAGE_SIZE` mirrors the backend `Pydantic Query(le=500)` in
 * `admin/panels.py`. Pinned by the store test so a backend bump surfaces
 * here as a failing assertion rather than a silent 422.
 */

import type {
  PanelsAdminFilters,
  PanelsAdminQuery,
} from '../api/panelsAdminApi';

export const DEFAULT_PAGE = 1;
export const DEFAULT_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

export const EMPTY_FILTERS: PanelsAdminFilters = {
  isActive: null,
  search: null,
};

// String-valued options so the AntD `<Select>` round-trips boolean state
// safely (boolean <Select> values clash with AntD's `undefined` clear).
export const ACTIVE_OPTIONS: { value: 'true' | 'false'; label: string }[] = [
  { value: 'true', label: 'Активные' },
  { value: 'false', label: 'Неактивные' },
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

function parseBool(raw: string | null): boolean | null {
  // Tolerant parser — accept the canonical 'true'/'false' plus '1'/'0'
  // (URL-friendlier). Anything else collapses to null = "all" so a
  // hand-edited URL never silently filters on `false`.
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return null;
}

function parseString(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build the canonical query DTO from URL search params. Unknown values
 * collapse to defaults so a hand-edited URL never crashes the page.
 */
export function queryFromSearchParams(params: URLSearchParams): PanelsAdminQuery {
  return {
    isActive: parseBool(params.get('is_active')),
    search: parseString(params.get('search')),
    page: parsePositiveInt(params.get('page'), DEFAULT_PAGE),
    size: parseClampedInt(params.get('size'), DEFAULT_SIZE, MAX_PAGE_SIZE),
  };
}

/**
 * Inverse of `queryFromSearchParams`. Defaults are *omitted* so the URL
 * stays clean (`/admin/upload` rather than `/admin/upload?page=1&size=50`).
 */
export function searchParamsFromQuery(q: PanelsAdminQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (q.isActive !== null) params.set('is_active', String(q.isActive));
  if (q.search) params.set('search', q.search);
  if (q.page !== DEFAULT_PAGE) params.set('page', String(q.page));
  if (q.size !== DEFAULT_SIZE) params.set('size', String(q.size));
  return params;
}

/**
 * Apply a partial filter patch and reset page to 1 — same rule as orders
 * and users: changing a filter while on page 5 must land on page 1, not
 * silently keep stale pagination on a narrower result set.
 */
export function applyFilterPatch(
  current: PanelsAdminQuery,
  patch: Partial<PanelsAdminFilters>,
): PanelsAdminQuery {
  return {
    ...current,
    ...patch,
    page: DEFAULT_PAGE,
  };
}

/**
 * Slugify a panel name → URL-safe slug. Used by the create modal to
 * pre-fill the slug field as the admin types the name. Cyrillic is
 * transliterated to ASCII so the slug stays browser-friendly.
 *
 * The admin can still edit the slug field; this is a UX nicety, not a
 * security boundary (server validates uniqueness + length).
 */
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
    // Drop punctuation silently — admin can still hand-edit if needed.
  }
  return out
    .replace(/-+/g, '-')   // collapse runs of dashes
    .replace(/^-|-$/g, ''); // trim leading/trailing
}
