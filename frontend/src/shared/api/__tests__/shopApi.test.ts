/**
 * Phase 8D — `useShopSettings` regression tests.
 *
 * The hook is the seam between `/api/shop/settings` (admin source of
 * truth) and every customer-facing UI that previously read the constant
 * `DESIGN_OVERLAY_PRICE` from the JS bundle. Pin the contract:
 *   * data undefined / loading → constants fallback, fromApi=false
 *   * data present → API values pass through verbatim, fromApi=true
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { DESIGN_OVERLAY_PRICE } from '../../config/constants';

const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return { ...actual, useQuery: () => mockUseQuery() };
});

import { useShopSettings } from '../shopApi';

beforeEach(() => {
  mockUseQuery.mockReset();
});

describe('useShopSettings', () => {
  it('falls back to constants when the API has not yet resolved', () => {
    mockUseQuery.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useShopSettings());
    expect(result.current.fromApi).toBe(false);
    expect(result.current.designOverlayPrice).toBe(DESIGN_OVERLAY_PRICE);
    expect(result.current.installationPrice).toBe(0);
    expect(result.current.minOrderAmount).toBe(0);
    expect(result.current.recommendationsLimitPerSource).toBe(12);
  });

  it('returns API values when settings have loaded', () => {
    mockUseQuery.mockReturnValue({
      data: {
        id: 'singleton',
        design_overlay_price: 1500,  // ← admin-edited
        installation_price: 500,
        min_order_amount: 5000,
        recommendations_limit_per_source: 8,
        updated_at: '2026-04-25T10:00:00Z',
      },
    });
    const { result } = renderHook(() => useShopSettings());
    expect(result.current.fromApi).toBe(true);
    expect(result.current.designOverlayPrice).toBe(1500);
    expect(result.current.installationPrice).toBe(500);
    expect(result.current.minOrderAmount).toBe(5000);
    expect(result.current.recommendationsLimitPerSource).toBe(8);
  });

  it('overrides constant fallback with API value (DoD: catalog reflects admin PATCH)', () => {
    mockUseQuery.mockReturnValue({
      data: {
        id: 'singleton',
        design_overlay_price: 9999,
        installation_price: 0,
        min_order_amount: 0,
        recommendations_limit_per_source: 12,
        updated_at: '2026-04-25T10:00:00Z',
      },
    });
    const { result } = renderHook(() => useShopSettings());
    // The exact regression: API=9999 must override the bundled
    // constant=1200 — otherwise admin's PATCH never reaches the
    // customer.
    expect(result.current.designOverlayPrice).toBe(9999);
    expect(result.current.designOverlayPrice).not.toBe(DESIGN_OVERLAY_PRICE);
  });
});
