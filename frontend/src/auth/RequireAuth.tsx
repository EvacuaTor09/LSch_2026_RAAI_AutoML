import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, skipAuth } = useAuth();
  const location = useLocation();

  if (skipAuth || isAuthenticated) {
    return <>{children}</>;
  }

  return <Navigate to="/login" replace state={{ from: location }} />;
}
