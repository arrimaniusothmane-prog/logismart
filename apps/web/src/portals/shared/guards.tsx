import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const COMPANY_ROLES = ['COMPANY_ADMIN', 'DISPATCHER', 'RECRUITER'] as const;

function PortalLoader() {
  return (
    <div className="p-root">
      <div className="p-stack" style={{ alignItems: 'center', gap: 14, padding: '20vh 0' }}>
        <span className="p-loader" role="status" aria-label="Chargement de votre session" />
        <span className="p-small">Chargement de votre session…</span>
      </div>
    </div>
  );
}

/** Accès à l'espace entreprise : session + rôle métier (jamais SUPER_ADMIN/DRIVER). */
export function RequireCompany({ children }: { children: ReactNode }) {
  const { status, hasRole } = useAuth();
  if (status === 'loading') return <PortalLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (!hasRole(...COMPANY_ROLES)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
