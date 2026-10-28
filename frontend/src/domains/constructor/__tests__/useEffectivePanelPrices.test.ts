/**
 * Phase 7B — `useEffectivePanelPrices` regression tests.
 *
 * The hook is the single seam between the live `/api/panels` data and
 * the constructor's pricing logic. Pin the contract:
 *   * empty / loading API → returns the constants verbatim with
 *     `fromApi: false` so the constructor still prices accurately
 *     even before the request resolves.
 *   * non-empty API → returns a merged map (constants base, API
 *     overrides on conflict) with `fromApi: true`.
 *   * sizes the admin hasn't loaded yet still resolve to the constants
 *     value (defence against partial migration).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { BASE_PANEL_PRICES } from '../../../shared/config/constants';

const mockUsePanels = vi.fn();
vi.mock('../../catalog/api/catalogApi', () => ({
  usePanels: () => mockUsePanels(),
}));

import { useEffectivePanelPrices } from '../model/useEffectivePanelPrices';

beforeEach(() => {
  mockUsePanels.mockReset();
});

describe('useEffectivePanelPrices', () => {
  it('falls back to constants when the API has not yet resolved', () => {
    mockUsePanels.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useEffectivePanelPrices());
    expect(result.current.fromApi).toBe(false);
    expect(result.current.prices).toBe(BASE_PANEL_PRICES);
  });

  it('falls back to constants on an empty API response', () => {
    mockUsePanels.mockReturnValue({ data: { items: [], total: 0 } });
    const { result } = renderHook(() => useEffectivePanelPrices());
    expect(result.current.fromApi).toBe(false);
    expect(result.current.prices).toBe(BASE_PANEL_PRICES);
  });

  it('overrides constants with API-derived prices when present', () => {
    mockUsePanels.mockReturnValue({
      data: {
        items: [
          {
            id: 'p1',
            name: 'Panel 30x30',
            slug: 'p30x30',
            width_mm: 300,
            height_mm: 300,
            size_label: '30×30 см',
            base_price: 1100, // ← admin-edited, replaces constants 890
            description: '',
            photo_path: '',
            is_active: true,
          },
        ],
        total: 1,
      },
    });
    const { result } = renderHook(() => useEffectivePanelPrices());
    expect(result.current.fromApi).toBe(true);
    expect(result.current.prices['300x300']).toBe(1100);
    // Other sizes the API didn't return must still resolve from
    // constants — partial migration safety.
    expect(result.current.prices['600x600']).toBe(BASE_PANEL_PRICES['600x600']);
  });

  it('keys API panels by `<width_mm>x<height_mm>` (matches constants vocabulary)', () => {
    mockUsePanels.mockReturnValue({
      data: {
        items: [
          {
            id: 'p2',
            name: 'Custom 450x450',
            slug: 'custom-450',
            width_mm: 450,
            height_mm: 450,
            size_label: '45×45 см',
            base_price: 1700,
            description: '',
            photo_path: '',
            is_active: true,
          },
        ],
        total: 1,
      },
    });
    const { result } = renderHook(() => useEffectivePanelPrices());
    expect(result.current.prices['450x450']).toBe(1700);
  });
});
