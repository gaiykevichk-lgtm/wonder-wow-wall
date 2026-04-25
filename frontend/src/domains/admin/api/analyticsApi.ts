/**
 * Phase 3 — admin analytics API bindings.
 *
 * The dashboard snapshot lives behind `GET /api/admin/analytics/dashboard`
 * and is cached server-side for 60s, so we don't need aggressive client
 * caching. `staleTime: 30s` just prevents back-to-back refetches when the
 * user clicks tabs in quick succession; `refetchOnWindowFocus` stays on
 * (React Query default) so returning from another tab gets fresh numbers.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api';

// ─── Wire types (mirror the backend pydantic response) ──────────────────

export type DashboardDaysWindow = 7 | 30 | 90;

export interface ApiMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
  delta_pct?: number | null;
}

export interface ApiSeriesPoint {
  day: string; // ISO date
  value: number;
}

export interface ApiMetricSeries {
  key: string;
  label: string;
  points: ApiSeriesPoint[];
}

export interface ApiStatusBucket {
  status: string;
  count: number;
}

export interface ApiTopDesign {
  design_id: string;
  design_name: string;
  orders_count: number;
}

export interface ApiDashboardSnapshot {
  range_start: string;
  range_end: string;
  metrics: ApiMetric[];
  revenue_series: ApiMetricSeries;
  new_users_series: ApiMetricSeries;
  orders_by_status: ApiStatusBucket[];
  top_designs: ApiTopDesign[];
}

// ─── Query Keys ─────────────────────────────────────────────────────────

export const analyticsKeys = {
  dashboard: (days: DashboardDaysWindow) =>
    ['admin', 'analytics', 'dashboard', days] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────

/**
 * Fetch a dashboard snapshot for the given rolling window.
 * `days` is part of the cache key so the selector re-renders instantly
 * when switching between 7/30/90.
 */
export function useDashboardSnapshot(days: DashboardDaysWindow) {
  return useQuery({
    queryKey: analyticsKeys.dashboard(days),
    queryFn: () =>
      api.get<ApiDashboardSnapshot>(`/admin/analytics/dashboard?days=${days}`),
    staleTime: 30_000,
    retry: false,
  });
}
