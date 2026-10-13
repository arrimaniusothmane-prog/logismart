import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useClientAuth } from './ClientAuthContext';

function ClientLoader() {
  return (
    <div className="p-root">
      <div className="p-stack" style={{ alignItems: 'center', gap: 14, padding: '20vh 0' }}>
        <span className="p-loader" role="status" aria-label="Chargement de votre session" />
        <span className="p-small">Chargement de votre session…</span>
      </div>
    </div>
  );
}

/** Accès à l'espace client : session portail (cookies dédiés, jamais la session Admin). */
export function RequireClient({ children }: { children?: ReactNode } = {}) {
  const { status } = useClientAuth();
  const location = useLocation();

  if (status === 'loading') return <ClientLoader />;
  if (status !== 'authenticated') {
    return <Navigate to="/client/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children ? <>{children}</> : <Outlet />;
}
