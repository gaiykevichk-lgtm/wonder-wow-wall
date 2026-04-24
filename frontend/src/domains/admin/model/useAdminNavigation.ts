import { useLocation } from 'react-router-dom';
import {
  ADMIN_SECTIONS,
  type AdminSection,
  type AdminSectionKey,
  adminPath,
} from './navigation';

/**
 * Derives the currently active admin section from the URL.
 *
 * Kept as a pure selector hook (no side effects, no data fetching) per the
 * Phase 2 plan — business logic belongs in later phases' domain stores.
 *
 * Resolution is longest-prefix-wins so `/admin/orders/42` still highlights
 * `orders`, not `dashboard` (whose path is the empty string and would match
 * everything under `/admin`).
 */
export function useAdminNavigation(): {
  activeKey: AdminSectionKey;
  activeSection: AdminSection;
  sections: readonly AdminSection[];
} {
  const { pathname } = useLocation();

  // Dashboard is the index — only matches exactly `/admin` (optionally
  // with a trailing slash). Every other section matches its prefix.
  const active =
    ADMIN_SECTIONS
      .filter((s) => s.path !== '')
      .find((s) => pathname.startsWith(`/admin/${s.path}`)) ?? ADMIN_SECTIONS[0];

  return {
    activeKey: active.key,
    activeSection: active,
    sections: ADMIN_SECTIONS,
  };
}

export { adminPath };
