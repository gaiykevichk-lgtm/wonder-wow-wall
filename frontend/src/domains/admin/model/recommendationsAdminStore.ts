/**
 * Phase 10 — admin recommendations URL ↔ DTO round-trip helpers.
 *
 * Same shape as `usersAdminStore.ts` / `auditStore.ts`: pure functions
 * that translate between `URLSearchParams` and the typed query DTO. The
 * page treats the URL as the source of truth so F5 preserves filters
 * and pagination (DoD § "переживают F5").
 */

import type {
  RecommendationsAdminFilters,
  RecommendationsAdminQuery,
  RecommendationSourceTypeKey,
} from '../api/recommendationsAdminApi';

export const DEFAULT_PAGE = 1;
export const DEFAULT_SIZE = 50;

export const SOURCE_TYPE_OPTIONS: Array<{
  value: RecommendationSourceTypeKey;
  label: string;
}> = [
  { value: 'design', label: 'Дизайн' },
  { value: 'panel', label: 'Панель' },
];

export const HAS_MANUAL_OPTIONS: Array<{
  value: 'true' | 'false';
  label: string;
}> = [
  { value: 'true', label: 'С подборкой' },
  { value: 'false', label: 'Без подборки' },
];

export function queryFromSearchParams(
  searchParams: URLSearchParams,
): RecommendationsAdminQuery {
  const sourceTypeRaw = searchParams.get('source_type');
  const hasManualRaw = searchParams.get('has_manual');
  const searchRaw = (searchParams.get('search') ?? '').trim();
  const page = Number(searchParams.get('page')) || DEFAULT_PAGE;
  const size = Number(searchParams.get('size')) || DEFAULT_SIZE;
  return {
    sourceType:
      sourceTypeRaw === 'design' || sourceTypeRaw === 'panel'
        ? sourceTypeRaw
        : null,
    hasManual:
      hasManualRaw === 'true' ? true : hasManualRaw === 'false' ? false : null,
    search: searchRaw.length > 0 ? searchRaw : null,
    page,
    size,
  };
}

export function searchParamsFromQuery(
  q: RecommendationsAdminQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  if (q.sourceType) params.set('source_type', q.sourceType);
  if (q.hasManual !== null) params.set('has_manual', String(q.hasManual));
  if (q.search) params.set('search', q.search);
  if (q.page !== DEFAULT_PAGE) params.set('page', String(q.page));
  if (q.size !== DEFAULT_SIZE) params.set('size', String(q.size));
  return params;
}

/** Apply a partial filter patch and reset pagination to page 1.
 *
 * Filter changes invalidate the current page index — the new filtered
 * set may have fewer pages than the old one, so staying on page N would
 * render an empty table. Same rule used by `usersAdminStore`.
 */
export function applyFilterPatch(
  q: RecommendationsAdminQuery,
  patch: Partial<RecommendationsAdminFilters>,
): RecommendationsAdminQuery {
  return { ...q, ...patch, page: DEFAULT_PAGE };
}
