/**
 * Phase 1 — role-aware authStore behaviour.
 *
 *  - login/register default to CUSTOMER
 *  - setAuth preserves the role returned by the API (ADMIN or CUSTOMER)
 *  - `useIsAdmin` selector reacts to role transitions
 *  - persist `migrate` backfills `role` on pre-Phase-1 blobs (R10)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useAuthStore, useIsAdmin } from './authStore';

const reset = () => useAuthStore.setState({ user: null, token: null, isAuth: false });

describe('authStore — role handling', () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
  });

  it('login defaults new user.role to CUSTOMER', async () => {
    await useAuthStore.getState().login({ email: 'c@mail.ru', password: 'x' });
    expect(useAuthStore.getState().user!.role).toBe('CUSTOMER');
  });

  it('register defaults new user.role to CUSTOMER', async () => {
    await useAuthStore.getState().register({
      name: 'N', email: 'n@mail.ru', phone: '+7', password: 'x',
    });
    expect(useAuthStore.getState().user!.role).toBe('CUSTOMER');
  });

  it('setAuth respects ADMIN role from API', () => {
    useAuthStore.getState().setAuth(
      {
        id: 'u-admin',
        name: 'Root',
        email: 'root@mail.ru',
        phone: '+7',
        role: 'ADMIN',
        created_at: new Date().toISOString(),
      },
      'jwt-admin',
    );
    const s = useAuthStore.getState();
    expect(s.isAuth).toBe(true);
    expect(s.user!.role).toBe('ADMIN');
  });

  it('setAuth falls back to CUSTOMER when API omits role (defensive default)', () => {
    useAuthStore.getState().setAuth(
      {
        id: 'u-1',
        name: 'X',
        email: 'x@mail.ru',
        phone: '+7',
        // role intentionally omitted
      },
      'jwt-x',
    );
    expect(useAuthStore.getState().user!.role).toBe('CUSTOMER');
  });
});

describe('useIsAdmin selector', () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
  });

  it('false when unauthenticated', () => {
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it('false for authenticated customer', async () => {
    await useAuthStore.getState().login({ email: 'c@mail.ru', password: 'x' });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it('true for authenticated admin', () => {
    useAuthStore.getState().setAuth(
      { id: 'u', name: 'A', email: 'a@m.ru', phone: '+7', role: 'ADMIN' },
      'jwt-a',
    );
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);
  });

  it('flips to false after logout', () => {
    useAuthStore.getState().setAuth(
      { id: 'u', name: 'A', email: 'a@m.ru', phone: '+7', role: 'ADMIN' },
      'jwt-a',
    );
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);

    act(() => {
      useAuthStore.getState().logout();
    });
    expect(result.current).toBe(false);
  });
});

describe('persist migrate — R10 legacy session backfill', () => {
  /**
   * Simulate a pre-Phase-1 persisted blob in localStorage. Zustand's persist
   * middleware stores JSON under the `name` key as `{state, version}`.
   * Writing `version: 0` triggers `migrate`; our migrate function backfills
   * `role: 'CUSTOMER'` rather than wiping the session.
   */
  beforeEach(() => {
    reset();
    localStorage.clear();
  });

  it('backfills role=CUSTOMER when reading an old persisted blob', async () => {
    const legacyBlob = {
      state: {
        user: {
          id: 'u-legacy',
          name: 'Legacy',
          email: 'legacy@mail.ru',
          phone: '+7',
          addresses: [],
          createdAt: new Date().toISOString(),
          // role intentionally absent — simulating v0 shape
        },
        token: 'legacy-jwt',
        isAuth: true,
      },
      version: 0,
    };
    localStorage.setItem('wow-wall-auth', JSON.stringify(legacyBlob));

    // Trigger a rehydrate from storage. Zustand exposes this on the persist API.
    await useAuthStore.persist.rehydrate();

    const s = useAuthStore.getState();
    expect(s.user).not.toBeNull();
    expect(s.user!.role).toBe('CUSTOMER');
    // Sanity: other fields survived the migration
    expect(s.user!.email).toBe('legacy@mail.ru');
    expect(s.isAuth).toBe(true);
  });
});
