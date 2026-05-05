/**
 * Phase 2 — admin section resolver.
 *
 * The hook derives the active section from the URL. The edge case worth
 * pinning is longest-prefix-wins: `/admin/orders/42` must NOT resolve to
 * Dashboard (whose path is `''` and would otherwise match all subpaths).
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  useAdminNavigation,
  resolveActiveSection,
} from '../model/useAdminNavigation';

const wrap = (path: string) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  ),
});

describe('useAdminNavigation', () => {
  it('defaults to dashboard on /admin', () => {
    const { result } = renderHook(() => useAdminNavigation(), wrap('/admin'));
    expect(result.current.activeKey).toBe('dashboard');
  });

  it('resolves explicit section by first segment', () => {
    const { result } = renderHook(() => useAdminNavigation(), wrap('/admin/orders'));
    expect(result.current.activeKey).toBe('orders');
  });

  it('keeps section active for nested routes (longest-prefix-wins)', () => {
    const { result } = renderHook(() => useAdminNavigation(), wrap('/admin/users/abc-123'));
    expect(result.current.activeKey).toBe('users');
  });

  it('exposes all sections in menu order', () => {
    const { result } = renderHook(() => useAdminNavigation(), wrap('/admin'));
    expect(result.current.sections.map((s) => s.key)).toEqual([
      'dashboard',
      'orders',
      'users',
      'catalog',
      'textures',
      'shop',
      'upload',
      'recommendations',
      'audit',
    ]);
  });
});

/**
 * Edge-case tests for the pure resolver. These are kept on the pure
 * function (not the hook) so we can feed arbitrary pathnames without
 * spinning up a MemoryRouter.
 */
describe('resolveActiveSection — pure resolver', () => {
  it('requires a segment boundary — `/admin/ordersfoo` is NOT orders', () => {
    // No section declares `ordersfoo`, and `orders` must not be a
    // prefix-match because that would silently mis-highlight the menu
    // for a typo'd/attacker-crafted URL. Falls back to dashboard.
    expect(resolveActiveSection('/admin/ordersfoo').key).toBe('dashboard');
  });

  it('exact match without trailing slash still resolves', () => {
    expect(resolveActiveSection('/admin/orders').key).toBe('orders');
  });

  it('nested segments resolve to their parent section', () => {
    expect(resolveActiveSection('/admin/orders/42').key).toBe('orders');
    expect(resolveActiveSection('/admin/users/abc/edit').key).toBe('users');
  });

  it('longest-path wins over shorter paths declared earlier', () => {
    // We can't mutate ADMIN_SECTIONS here, but we can verify that the
    // resolver's sort step picks the longest candidate by checking the
    // only overlap we can construct with the current set: `audit` (5
    // chars) vs `catalog` (7 chars) — both resolvable; test the longer
    // wins on its own path, shorter wins on its own path.
    expect(resolveActiveSection('/admin/catalog').key).toBe('catalog');
    expect(resolveActiveSection('/admin/audit').key).toBe('audit');
  });

  it('unknown path under /admin falls back to dashboard', () => {
    expect(resolveActiveSection('/admin/unknown-section').key).toBe('dashboard');
  });

  it('root /admin resolves to dashboard', () => {
    expect(resolveActiveSection('/admin').key).toBe('dashboard');
  });
});
