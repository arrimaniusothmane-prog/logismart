import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Permission, Role } from '@logismart/shared';
import { useAuth } from './AuthContext';
import { EmptyState, Button, Card } from '../components/ui';
import { homeRouteFor } from '../components/layout/nav';

function FullPageLoader({ label = 'Chargement de votre session…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <div
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent"
        role="status"
        aria-label={label}
      />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

/** Exige une session valide ; mémorise l'URL demandée pour y retourner après login. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children ?? <Outlet />}</>;
}

/** Refuse l'accès aux pages de connexion une fois authentifié. */
export function RequireAnonymous({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to={from ?? homeRouteFor(user?.role ?? 'COMPANY_ADMIN')} replace />;
  return <>{children}</>;
}

function Forbidden({ required }: { required: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <EmptyState
          title="Accès refusé"
          description={
            <>
              Votre rôle ne dispose pas des permissions nécessaires pour cette page.
              <br />
              <span className="text-xs text-slate-400">Permission requise : {required}</span>
            </>
          }
          action={
            <Button variant="secondary" onClick={() => window.history.back()}>
              Revenir en arrière
            </Button>
          }
        />
      </Card>
    </div>
  );
}

/** Restreint une branche de routes à une permission RBAC donnée. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { status, can } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (!can(permission)) return <Forbidden required={permission} />;
  return <>{children}</>;
}

/** Restreint une branche de routes à un ou plusieurs rôles. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { status, hasRole } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (!hasRole(...roles)) return <Forbidden required={roles.join(' ou ')} />;
  return <>{children}</>;
}
