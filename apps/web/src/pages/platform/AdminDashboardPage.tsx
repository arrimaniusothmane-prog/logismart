import { Link } from 'react-router-dom';
import type { OrderStatus, Role } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { formatDate } from '../../lib/format';
import { orderStatusMeta, roleLabel, userStatusMeta } from '../../lib/status';
import {
  Badge,
  Button,
  Card,
  CardGrid,
  DataTable,
  EmptyState,
  ErrorState,
  StatCard,
  TableSkeleton,
  type Column,
} from '../../components/ui';

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { users: number; orders: number };
}

interface PlatformUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string;
}

interface PlatformStats {
  companies: { total: number; newLast30Days: number; recent: CompanyRow[] };
  users: {
    total: number;
    byStatus: Record<string, number>;
    byRole: Record<string, number>;
    recent: PlatformUserRow[];
  };
  orders: { total: number; byStatus: Record<OrderStatus, number>; active: number; finished: number };
  drivers: { total: number; byAvailability: Record<string, number> };
  customers: { total: number };
}

const icons = {
  companies: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 21V9h2a2 2 0 0 1 2 2v10M9 7h2M9 11h2M9 15h2" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19a6 6 0 0 0-12 0M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M17 11a3 3 0 1 0 0-6M21 19a5 5 0 0 0-3-4.6" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9ZM3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  ),
  clients: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 17a3.5 3.5 0 0 1 7 0M15 9h4M15 13h4" />
    </svg>
  ),
};

const ORDER_ROWS: OrderStatus[] = ['PREPARED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED'];
const ROLE_ROWS: Role[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DISPATCHER', 'DRIVER', 'RECRUITER'];

export function AdminDashboardPage() {
  const { user } = useAuth();
  const stats = useApi<PlatformStats>('/api/platform/stats');

  const companyColumns: Array<Column<CompanyRow>> = [
    {
      key: 'name',
      header: 'Entreprise',
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{c.name}</p>
          <p className="truncate text-xs text-slate-500">{c.slug}</p>
        </div>
      ),
    },
    {
      key: 'users',
      header: 'Comptes',
      hideBelow: 'sm',
      render: (c) => <span className="tabular-nums text-slate-600">{c._count.users}</span>,
    },
    {
      key: 'orders',
      header: 'Commandes',
      hideBelow: 'md',
      render: (c) => <span className="tabular-nums text-slate-600">{c._count.orders}</span>,
    },
    {
      key: 'createdAt',
      header: 'Créée le',
      align: 'right',
      hideBelow: 'lg',
      render: (c) => <span className="tabular-nums text-slate-500">{formatDate(c.createdAt)}</span>,
    },
  ];

  const userColumns: Array<Column<PlatformUserRow>> = [
    {
      key: 'name',
      header: 'Compte',
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{u.name}</p>
          <p className="truncate text-xs text-slate-500">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      hideBelow: 'sm',
      render: (u) => <Badge tone="brand">{roleLabel(u.role)}</Badge>,
    },
    {
      key: 'status',
      header: 'Statut',
      hideBelow: 'md',
      render: (u) => {
        const meta = userStatusMeta(u.status);
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: 'createdAt',
      header: 'Créé le',
      align: 'right',
      hideBelow: 'lg',
      render: (u) => <span className="tabular-nums text-slate-500">{formatDate(u.createdAt)}</span>,
    },
  ];

  if (stats.error) {
    return (
      <Card>
        <ErrorState
          title="Impossible de charger les statistiques plateforme"
          description={stats.error.message}
          action={
            <Button size="sm" variant="secondary" onClick={stats.refetch}>
              Réessayer
            </Button>
          }
        />
      </Card>
    );
  }

  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pilotage de la plateforme</h2>
          <p className="text-sm text-slate-500">
            Bonjour {user?.name?.split(' ')[0] ?? '—'} · vue globale multi-entreprises
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={stats.refetch} disabled={stats.loading}>
            Actualiser
          </Button>
          <Link to="/admin/companies">
            <Button>Gérer les entreprises</Button>
          </Link>
        </div>
      </div>

      <CardGrid>
        <StatCard
          label="Entreprises"
          value={s?.companies.total ?? '—'}
          hint={s ? `+${s.companies.newLast30Days} sur 30 jours` : 'Chargement…'}
          icon={icons.companies}
          tone="brand"
          loading={stats.loading}
        />
        <StatCard
          label="Comptes"
          value={s?.users.total ?? '—'}
          hint={s ? `${s.users.byStatus.ACTIVE ?? 0} actifs · ${s.users.byStatus.SUSPENDED ?? 0} suspendus` : 'Chargement…'}
          icon={icons.users}
          tone="neutral"
          loading={stats.loading}
        />
        <StatCard
          label="Commandes"
          value={s?.orders.total ?? '—'}
          hint={s ? `${s.orders.active} en cours` : 'Chargement…'}
          icon={icons.orders}
          tone="warning"
          loading={stats.loading}
        />
        <StatCard
          label="Clients enregistrés"
          value={s?.customers.total ?? '—'}
          hint={s ? `${s.drivers.total} livreurs actifs` : 'Chargement…'}
          icon={icons.clients}
          tone="success"
          loading={stats.loading}
        />
      </CardGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Dernières entreprises créées"
            description="Source : /api/platform/stats"
            actions={
              <Link to="/admin/companies">
                <Button size="sm" variant="secondary">
                  Tout voir
                </Button>
              </Link>
            }
            flush
          >
            {stats.loading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : s && s.companies.recent.length > 0 ? (
              <DataTable columns={companyColumns} rows={s.companies.recent} rowKey={(c) => c.id} caption="Dernières entreprises" />
            ) : (
              <div className="p-4">
                <EmptyState compact title="Aucune entreprise" description="Créez la première entreprise depuis la page Entreprises." />
              </div>
            )}
          </Card>
        </div>

        <Card title="Commandes par statut" description="Toutes entreprises confondues">
          {stats.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-slate-200" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {ORDER_ROWS.map((status) => {
                const meta = orderStatusMeta(status);
                return (
                  <li key={status} className="flex items-center justify-between gap-3 text-sm">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="tabular-nums font-medium text-slate-900">{s?.orders.byStatus[status] ?? 0}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="Derniers comptes créés" description="Comptes de toutes les entreprises" flush>
            {stats.loading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : s && s.users.recent.length > 0 ? (
              <DataTable columns={userColumns} rows={s.users.recent} rowKey={(u) => u.id} caption="Derniers comptes créés" />
            ) : (
              <div className="p-4">
                <EmptyState compact title="Aucun compte" description="Les comptes apparaîtront ici dès leur création." />
              </div>
            )}
          </Card>
        </div>

        <Card title="Comptes par rôle" description="Répartition de l'ensemble des comptes">
          {stats.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-slate-200" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {ROLE_ROWS.map((role) => (
                <li key={role} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">{roleLabel(role)}</span>
                  <span className="tabular-nums font-medium text-slate-900">{s?.users.byRole[role] ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
