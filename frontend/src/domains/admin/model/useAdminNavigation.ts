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
 * Resolution rules:
 *   1. Longest `path` wins — so a future pair like `users` / `users/roles`
 *      would route `/admin/users/roles/...` to the more specific section
 *      regardless of declaration order in `ADMIN_SECTIONS`.
 *   2. Match respects segment boundaries, i.e. `/admin/orders` and
 *      `/admin/orders/42` resolve to `orders`, but `/admin/ordersfoo` does
 *      NOT — otherwise a future typo'd route could silently highlight the
 *      wrong menu item.
 *   3. Dashboard (`path === ''`) is the fallback — it's the index route
 *      and matches when nothing more specific does.
 */
export function useAdminNavigation(): {
  activeKey: AdminSectionKey;
  activeSection: AdminSection;
  sections: readonly AdminSection[];
} {
  const { pathname } = useLocation();
  const active = resolveActiveSection(pathname);

  return {
    activeKey: active.key,
    activeSection: active,
    sections: ADMIN_SECTIONS,
  };
}

/**
 * Exported for the unit test and future breadcrumb/title code that needs
 * URL→section resolution outside React.
 */
export function resolveActiveSection(pathname: string): AdminSection {
  const candidates = ADMIN_SECTIONS
    .filter((s) => s.path !== '')
    // Longest path first so `users/roles` wins over `users` when both are
    // defined. Stable for equal-length paths (TimSort in V8/JSC).
    .slice()
    .sort((a, b) => b.path.length - a.path.length);

  for (const s of candidates) {
    const base = `/admin/${s.path}`;
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      return s;
    }
  }
  return ADMIN_SECTIONS[0];
}

export { adminPath };
