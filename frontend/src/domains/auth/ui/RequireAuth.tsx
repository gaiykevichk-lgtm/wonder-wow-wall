import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../model/authStore';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuth);
  const location = useLocation();

  if (!isAuth) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}
