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

import { useAdminNavigation } from '../model/useAdminNavigation';

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
      'shop',
      'upload',
      'recommendations',
      'audit',
    ]);
  });
});
