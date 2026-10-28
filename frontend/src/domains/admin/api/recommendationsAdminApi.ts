/**
 * Phase 10 — admin recommendations bindings.
 *
 * Wire types mirror `app/infrastructure/api/admin/recommendations.py`
 * field-for-field. The aggregate is keyed by the natural pair
 * `(source_type, source_id)` rather than the surrogate uuid because the
 * editor always reaches the route from a product page where that pair
 * is what's in hand — and a stable URL means a deep link survives a
 * recreate.
 *
 * Cache key shape mirrors `usersAdminKeys`:
 *   * `lists` prefix — paginated/filtered list cache, safe to invalidate
 *     without evicting a detail entry.
 *   * `detail(source_type, source_id)` under its own prefix — the editor
 *     primes this on PUT success so the next read is instant.
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../../shared/api';

// ─── Wire types ─────────────────────────────────────────────────────────

/** Mirror of `RecommendationSourceType`. */
export type RecommendationSourceTypeKey = 'design' | 'panel';
/** Mirror of `RecommendationTargetType`. Same string keys as source. */
export type RecommendationTargetTypeKey = 'design' | 'panel';

export interface ApiRecommendationTarget {
  target_type: RecommendationTargetTypeKey;
  target_id: string;
}

export interface ApiRecommendation {
  /** Empty string when the editor opened a source with no curation yet. */
  id: string;
  source_type: RecommendationSourceTypeKey;
  source_id: string;
  targets: ApiRecommendationTarget[];
  /** ISO datetime; empty string when no row exists yet. */
  updated_at: string;
  /**
   * Phase 10 LOW-7 — what the heuristic would surface if no curation
   * existed. The editor uses this for «Принять авто-предложение»
   * one-click pickers. Always present (possibly empty) on detail
   * reads; omitted on list reads.
   */
  fallback_suggestions: ApiRecommendationTarget[];
}

export interface ApiRecommendationListResponse {
  items: ApiRecommendation[];
  total: number;
  page: number;
  size: number;
}

// ─── Filters ────────────────────────────────────────────────────────────

export interface RecommendationsAdminFilters {
  sourceType: RecommendationSourceTypeKey | null;
  /** null = "all", true = "only with manual targets". */
  hasManual: boolean | null;
  /** Phase 10 LOW-6 — case-insensitive substring on `source_id`. */
  search: string | null;
}

export interface RecommendationsAdminQuery extends RecommendationsAdminFilters {
  page: number;
  size: number;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const recommendationsAdminKeys = {
  // Narrower than `['admin','recommendations']` to keep list invalidation
  // from evicting a primed detail (same fix Phase 4B applied to users).
  lists: ['admin', 'recommendations', 'list'] as const,
  list: (q: RecommendationsAdminQuery) =>
    ['admin', 'recommendations', 'list', q] as const,
  detail: (
    sourceType: RecommendationSourceTypeKey,
    sourceId: string,
  ) => ['admin', 'recommendations', 'detail', sourceType, sourceId] as const,
};

function buildQueryString(q: RecommendationsAdminQuery): string {
  const params = new URLSearchParams();
  if (q.sourceType) params.set('source_type', q.sourceType);
  if (q.hasManual !== null) params.set('has_manual', String(q.hasManual));
  if (q.search) params.set('search', q.search);
  params.set('page', String(q.page));
  params.set('size', String(q.size));
  return params.toString();
}

// ─── Hooks ──────────────────────────────────────────────────────────────

export function useRecommendationsAdminList(q: RecommendationsAdminQuery) {
  return useQuery({
    queryKey: recommendationsAdminKeys.list(q),
    queryFn: () =>
      api.get<ApiRecommendationListResponse>(
        `/admin/recommendations?${buildQueryString(q)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}

export function useRecommendationDetail(
  sourceType: RecommendationSourceTypeKey | undefined,
  sourceId: string | undefined,
) {
  const enabled = !!sourceType && !!sourceId;
  return useQuery({
    queryKey: enabled
      ? recommendationsAdminKeys.detail(sourceType!, sourceId!)
      : ['admin', 'recommendations', 'detail', 'noop'],
    queryFn: () =>
      api.get<ApiRecommendation>(
        `/admin/recommendations/${sourceType}/${sourceId}`,
      ),
    enabled,
    staleTime: 15_000,
    retry: false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────

export interface UpsertRecommendationVars {
  sourceType: RecommendationSourceTypeKey;
  sourceId: string;
  targets: ApiRecommendationTarget[];
}

/**
 * PUT-style upsert — replaces the entire target list for a source.
 *
 * On success: write the response into the detail cache (instant
 * re-render with the server-side surrogate id and updated_at) and
 * invalidate the `lists` prefix so the table refreshes its
 * has_manual / count signals on the next render.
 */
export function useUpsertRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: UpsertRecommendationVars) =>
      api.put<ApiRecommendation>(
        `/admin/recommendations/${vars.sourceType}/${vars.sourceId}`,
        { targets: vars.targets },
      ),
    onSuccess: (data) => {
      qc.setQueryData(
        recommendationsAdminKeys.detail(data.source_type, data.source_id),
        data,
      );
      qc.invalidateQueries({ queryKey: recommendationsAdminKeys.lists });
    },
  });
}

export interface DeleteRecommendationVars {
  sourceType: RecommendationSourceTypeKey;
  sourceId: string;
}

/**
 * DELETE — drop the manual curation; public reads fall back to the
 * heuristic on the next call. Returns 204 on a real delete and 404 on
 * a miss; the editor uses the 404 to distinguish "I just deleted it"
 * from "someone else already did".
 */
export function useDeleteRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: DeleteRecommendationVars) =>
      api.delete<void>(
        `/admin/recommendations/${vars.sourceType}/${vars.sourceId}`,
      ),
    onSuccess: (_data, vars) => {
      // Replace the detail cache with the empty-aggregate sentinel that
      // matches what the next GET would return — keeps the editor view
      // in the "no curation" state without a refetch round-trip.
      qc.setQueryData<ApiRecommendation>(
        recommendationsAdminKeys.detail(vars.sourceType, vars.sourceId),
        {
          id: '',
          source_type: vars.sourceType,
          source_id: vars.sourceId,
          targets: [],
          updated_at: '',
          fallback_suggestions: [],
        },
      );
      qc.invalidateQueries({ queryKey: recommendationsAdminKeys.lists });
    },
  });
}

// ─── Phase 10 follow-up: bulk copy from another source ─────────────────

export interface CopyRecommendationsVars {
  /** Destination — the row the admin is editing. */
  sourceType: RecommendationSourceTypeKey;
  sourceId: string;
  /** Where to copy from. */
  fromSourceType: RecommendationSourceTypeKey;
  fromSourceId: string;
  /** `replace` overwrites; `append` keeps existing + dedups by key. */
  mode: 'replace' | 'append';
}

/**
 * POST `/admin/recommendations/{type}/{id}/copy-from` — seed a
 * destination from another source. Server enforces the live cap on
 * `recommendations_limit_per_source`. Returns the saved aggregate so
 * the editor can swap its detail cache without a refetch.
 */
export function useCopyRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: CopyRecommendationsVars) =>
      api.post<ApiRecommendation>(
        `/admin/recommendations/${vars.sourceType}/${vars.sourceId}/copy-from`,
        {
          from_source_type: vars.fromSourceType,
          from_source_id: vars.fromSourceId,
          mode: vars.mode,
        },
      ),
    onSuccess: (data) => {
      qc.setQueryData(
        recommendationsAdminKeys.detail(data.source_type, data.source_id),
        data,
      );
      qc.invalidateQueries({ queryKey: recommendationsAdminKeys.lists });
    },
  });
}
