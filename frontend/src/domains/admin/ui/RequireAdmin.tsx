import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../../auth/model/authStore';

/**
 * Route-level admin gate (Phase 1).
 *
 * Redirects to `/login?redirect=<pathname>` for anonymous users, to the home
 * page for authenticated non-admins. We deliberately do NOT 404 non-admins
 * because that leaks the existence of admin routes; a soft redirect is the
 * usual UX.
 *
 * Note: this is UI-layer defense only. The authoritative gate is the backend
 * `get_current_admin_id` dependency on every `/api/admin/*` route.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuth);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const location = useLocation();

  if (!isAuth) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
