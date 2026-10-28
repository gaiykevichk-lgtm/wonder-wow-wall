import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Address, LoginPayload, RegisterPayload, UserRole } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuth: boolean;

  login: (payload: LoginPayload) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => void;
  setAuth: (
    user: { id: string; name: string; email: string; phone: string; role?: UserRole; created_at?: string },
    token: string,
  ) => void;
  updateProfile: (data: Partial<Pick<User, 'name' | 'email' | 'phone'>>) => void;
  addAddress: (address: Omit<Address, 'id'>) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
}

let nextAddressId = 1;

// Persist version bump for R10: pre-Phase-1 persisted blobs have no `role`
// field on the User. `migrate` upgrades them to `{...user, role: 'CUSTOMER'}`
// rather than wiping the session — re-logins across the whole user base
// would be user-hostile and unnecessary.
const PERSIST_VERSION = 1;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuth: false,

      login: async (payload) => {
        // Mock: accept any email/password, simulate API delay
        await new Promise((r) => setTimeout(r, 600));
        const user: User = {
          id: 'user-1',
          name: payload.email.split('@')[0],
          email: payload.email,
          phone: '+7 (900) 000-00-00',
          addresses: [],
          createdAt: new Date().toISOString(),
          role: 'CUSTOMER',
        };
        set({ user, token: 'mock-jwt-token', isAuth: true });
        return true;
      },

      register: async (payload) => {
        await new Promise((r) => setTimeout(r, 800));
        const user: User = {
          id: 'user-1',
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          addresses: [],
          createdAt: new Date().toISOString(),
          role: 'CUSTOMER',
        };
        set({ user, token: 'mock-jwt-token', isAuth: true });
        return true;
      },

      logout: () => {
        set({ user: null, token: null, isAuth: false });
      },

      setAuth: (apiUser, token) => {
        const user: User = {
          id: apiUser.id,
          name: apiUser.name,
          email: apiUser.email,
          phone: apiUser.phone,
          addresses: [],
          createdAt: apiUser.created_at || new Date().toISOString(),
          role: apiUser.role ?? 'CUSTOMER',
        };
        set({ user, token, isAuth: true });
      },

      updateProfile: (data) => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, ...data } });
      },

      addAddress: (address) => {
        const { user } = get();
        if (!user) return;
        const newAddr: Address = { ...address, id: `addr-${nextAddressId++}` };
        if (newAddr.isDefault) {
          user.addresses.forEach((a) => (a.isDefault = false));
        }
        set({ user: { ...user, addresses: [...user.addresses, newAddr] } });
      },

      removeAddress: (id) => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, addresses: user.addresses.filter((a) => a.id !== id) } });
      },

      setDefaultAddress: (id) => {
        const { user } = get();
        if (!user) return;
        set({
          user: {
            ...user,
            addresses: user.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
          },
        });
      },
    }),
    {
      name: 'wow-wall-auth',
      version: PERSIST_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        // Pre-versioned blobs (version === 0 or anything < current) may lack
        // `user.role`; backfill it so selectors like `useIsAdmin` don't
        // throw on legacy sessions.
        const state = persistedState as Partial<AuthState> | null | undefined;
        if (version < PERSIST_VERSION && state?.user && !(state.user as User).role) {
          return {
            ...state,
            user: { ...(state.user as User), role: 'CUSTOMER' as UserRole },
          } as AuthState;
        }
        return state as AuthState;
      },
    },
  ),
);

// ─── Selectors ────────────────────────────────────────────────────────

/**
 * Reactive selector for admin-gating in the UI (e.g. `<RequireAdmin>`,
 * conditional menu items). Separate from the raw store slice so components
 * subscribe only to role changes and not to unrelated state (addresses
 * edits, etc.) — one re-render per relevant change.
 */
export const useIsAdmin = (): boolean =>
  useAuthStore((s) => s.isAuth && s.user?.role === 'ADMIN');
