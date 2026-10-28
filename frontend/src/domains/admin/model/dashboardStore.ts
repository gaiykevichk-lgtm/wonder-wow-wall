/**
 * Phase 3 — dashboard UI state (zustand).
 *
 * Only UI-local state lives here: the selected rolling window (7/30/90).
 * Snapshot data itself is owned by TanStack Query so it can participate
 * in the shared request/cache pipeline with every other admin query.
 *
 * Kept in zustand (not useState) so the selection survives route changes
 * inside /admin — e.g. the user drills into /admin/orders and comes back
 * to /admin with the same window active. Not persisted because the
 * default (30) is the sensible "just-opened-the-panel" view.
 */

import { create } from 'zustand';
import type { DashboardDaysWindow } from '../api/analyticsApi';

interface DashboardState {
  range: DashboardDaysWindow;
  setRange: (range: DashboardDaysWindow) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  range: 30,
  setRange: (range) => set({ range }),
}));

export const DASHBOARD_RANGE_OPTIONS: {
  value: DashboardDaysWindow;
  label: string;
}[] = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
];
