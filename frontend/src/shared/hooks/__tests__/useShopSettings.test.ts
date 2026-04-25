/**
 * Phase 8D — `useShopSettings` regression tests.
 *
 * The hook is the single seam between `/api/shop/settings` and every
 * pricing-display surface (account constructor, pricing page,
 * subscription modal, etc.). Pin the contract:
 *   * loading / undefined → returns the constants fallback with
 *     `fromApi: false` so the catalog still prices accurately even
 *     before the request resolves.
 *   * non-empty API → returns the live values with `fromApi: true`.
 *   * camelCase keys mirror the snake_case wire keys (callers don't
 *     have to learn two vocabularies).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { DESIGN_OVERLAY_PRICE } from '../../config/constants';

const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockUseQuery(),
}));

import { useShopSettings } from '../useShopSettings';

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
  });

  it('returns the live API values when the request resolves', () => {
    mockUseQuery.mockReturnValue({
      data: {
        design_overlay_price: 1500,
        installation_price: 500,
        min_order_amount: 3000,
        recommendations_limit_per_source: 8,
        updated_at: '2026-04-25T10:00:00Z',
      },
    });
    const { result } = renderHook(() => useShopSettings());
    expect(result.current.fromApi).toBe(true);
    expect(result.current.designOverlayPrice).toBe(1500);
    expect(result.current.installationPrice).toBe(500);
    expect(result.current.minOrderAmount).toBe(3000);
    expect(result.current.recommendationsLimitPerSource).toBe(8);
  });

  it('translates snake_case wire keys to camelCase view keys', () => {
    mockUseQuery.mockReturnValue({
      data: {
        design_overlay_price: 999,
        installation_price: 100,
        min_order_amount: 500,
        recommendations_limit_per_source: 4,
        updated_at: '2026-04-25T10:00:00Z',
      },
    });
    const { result } = renderHook(() => useShopSettings());
    // View keys exposed are camelCase only — callers should not see the
    // wire keys leak through.
    expect('design_overlay_price' in result.current).toBe(false);
    expect('designOverlayPrice' in result.current).toBe(true);
  });

  it('overlay-price 0 from the API is honoured (not silently replaced by fallback)', () => {
    mockUseQuery.mockReturnValue({
      data: {
        design_overlay_price: 0,
        installation_price: 0,
        min_order_amount: 0,
        recommendations_limit_per_source: 12,
        updated_at: '2026-04-25T10:00:00Z',
      },
    });
    const { result } = renderHook(() => useShopSettings());
    expect(result.current.fromApi).toBe(true);
    expect(result.current.designOverlayPrice).toBe(0);
  });
});
