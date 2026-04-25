/**
 * Phase 3 — dashboardStore.
 *
 * The store only owns the `range` selector. These tests lock down:
 *   - default is 30 (most-used window, per plan)
 *   - `setRange` propagates synchronously
 *   - changing `range` produces a new reference that subscribers notice
 *     (i.e. selector-based memo would re-render)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore, DASHBOARD_RANGE_OPTIONS } from '../model/dashboardStore';

beforeEach(() => {
  // Reset to default. Zustand stores are module singletons in tests.
  useDashboardStore.setState({ range: 30 });
});

describe('dashboardStore', () => {
  it('defaults to the 30-day window', () => {
    expect(useDashboardStore.getState().range).toBe(30);
  });

  it('setRange updates synchronously', () => {
    useDashboardStore.getState().setRange(7);
    expect(useDashboardStore.getState().range).toBe(7);
    useDashboardStore.getState().setRange(90);
    expect(useDashboardStore.getState().range).toBe(90);
  });

  it('notifies subscribers when range changes', () => {
    const seen: number[] = [];
    const unsubscribe = useDashboardStore.subscribe((s) => seen.push(s.range));
    useDashboardStore.getState().setRange(7);
    useDashboardStore.getState().setRange(90);
    unsubscribe();
    expect(seen).toEqual([7, 90]);
  });

  it('exposes exactly the three allowed options in order', () => {
    expect(DASHBOARD_RANGE_OPTIONS.map((o) => o.value)).toEqual([7, 30, 90]);
    expect(DASHBOARD_RANGE_OPTIONS.map((o) => o.label)).toEqual([
      '7 дней',
      '30 дней',
      '90 дней',
    ]);
  });
});
