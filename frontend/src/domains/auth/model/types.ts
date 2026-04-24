export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  addresses: Address[];
  createdAt: string;
  /**
   * Phase 1 (admin panel). Defaults to `'CUSTOMER'` when missing so a
   * persisted session from before the Phase 1 rollout is still usable —
   * see `authStore` `persist.migrate` (R10).
   */
  role: UserRole;
}

export interface Address {
  id: string;
  label: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode: string;
  isDefault: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
}
