import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import type { Paginated } from '@logismart/shared';
import { roleLabel, userStatusMeta } from '../../lib/status';
import { formatDate } from '../../lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardGrid,
  DataTable,
  EmptyState,
  StatCard,
  TableSkeleton,
  ErrorState,
  type Column,
} from '../../components/ui';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface DriverDashboardRow {
  id: string;
  trackingNumber: string;
  status: string;
  deliveryAddress: string;
  customer: { name: string };
  estimatedDeliveryAt: string | null;
}

interface DriverProfileBrief {
  id: string;
  availability: string;
  vehicleType: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  user: { name: string; email: string };
}

const ROADMAP: Array<{ phase: string; label: string; done: boolean; current?: boolean }> = [
  { phase: 'Phase 1', label: 'Fondations — auth, RBAC, multi-tenant', done: true },
  { phase: 'Phase 2', label: 'Module logistique (commandes, livreurs, suivi)', done: true, current: true },
  { phase: 'Phase 3', label: 'Carte temps réel (Socket.io + Leaflet)', done: false },
  { phase: 'Phase 4', label: 'Preuve de livraison (photo / signature)', done: false },
  { phase: 'Phase 5', label: 'Chatbot support IA + widget', done: false },
  { phase: 'Phase 6', label: 'RAG — documents et embeddings', done: false },
  { phase: 'Phase 7', label: 'Recrutement — offres, candidatures, pipeline', done: false },
  { phase: 'Phase 8', label: 'Analyse de CV et scoring IA', done: false },
  { phase: 'Phase 9', label: 'Embauche → compte livreur', done: false },
];

const icons = {
  users: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19a6 6 0 0 0-12 0M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M17 11a3 3 0 1 0 0-6M21 19a5 5 0 0 0-3-4.6" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9ZM3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  ),
};

const userColumns: Array<Column<UserRow>> = [
  { key: 'name', header: 'Nom', render: (u) => <span className="font-medium text-slate-900">{u.name}</span> },
  { key: 'email', header: 'E-mail', render: (u) => <span className="text-slate-600">{u.email}</span>, hideBelow: 'sm' },
  {
    key: 'role',
    header: 'Rôle',
    hideBelow: 'md',
    render: (u) => <Badge tone="brand">{roleLabel(u.role)}</Badge>,
  },
  {
    key: 'status',
    header: 'Statut',
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

export function DashboardPage() {
  const { user, company, can } = useAuth();
  const isDriver = user?.role === 'DRIVER';

  const users = useApi<Paginated<UserRow>>(can('user:read') ? '/api/users?limit=5&sort=createdAt' : '/api/health', [
    can('user:read'),
  ]);

  const driverProfile = useApi<DriverProfileBrief>(isDriver ? '/api/drivers/me' : '/api/health', [isDriver]);
  const driverOrders = useApi<Paginated<DriverDashboardRow>>(
    isDriver ? '/api/orders?limit=50&sort=createdAt&order=desc' : '/api/health',
    [isDriver],
  );

  const activeDriverOrders = (driverOrders.data?.items ?? []).filter((o) =>
    ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Bonjour, {user?.name?.split(' ')[0] ?? '—'}
          </h2>
          <p className="text-sm text-slate-500">
            {company ? company.name : 'Contexte plateforme'} · {user ? roleLabel(user.role) : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={() => window.location.reload()} disabled={users.loading || driverOrders.loading}>
          Actualiser
        </Button>
      </div>

      {isDriver ? (
        <>
          <CardGrid>
            <StatCard
              label="Livraisons en cours"
              value={activeDriverOrders?.length ?? '—'}
              hint="Commandes assignées"
              icon={icons.truck}
              tone="warning"
              loading={driverOrders.loading}
            />
            <StatCard
              label="Livraisons réussies"
              value={driverProfile.data?.successfulDeliveries ?? '—'}
              hint={`Taux ${driverProfile.data ? Math.round((driverProfile.data.successfulDeliveries / (driverProfile.data.totalDeliveries || 1)) * 100) : 0}%`}
              icon={icons.clock}
              tone="success"
              loading={driverProfile.loading}
            />
            <StatCard
              label="Disponibilité"
              value={driverProfile.data ? driverProfile.data.availability : '—'}
              hint={driverProfile.data ? `${driverProfile.data.vehicleType} · ${driverProfile.data.totalDeliveries} livraisons` : ''}
              icon={icons.users}
              tone="brand"
              loading={driverProfile.loading}
            />
          </CardGrid>

          <Card
            title="Mes prochaines livraisons"
            description="Commandes actuellement affectées à vous"
            actions={
              <Link to="/driver/deliveries">
                <Button size="sm" variant="secondary">
                  Voir l'historique
                </Button>
              </Link>
            }
            flush
          >
            {driverOrders.loading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : driverOrders.error ? (
              <div className="p-4">
                <ErrorState
                  title="Impossible de charger vos livraisons"
                  description={driverOrders.error.message}
                  action={
                    <Button size="sm" variant="secondary" onClick={driverOrders.refetch}>
                      Réessayer
                    </Button>
                  }
                />
              </div>
            ) : activeDriverOrders && activeDriverOrders.length > 0 ? (
              <div className="space-y-3 p-4">
                {activeDriverOrders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-semibold text-slate-900">{o.trackingNumber}</span>
                      <p className="truncate text-slate-800">{o.deliveryAddress}</p>
                      <p className="text-xs text-slate-500">{o.customer.name}</p>
                    </div>
                    {o.estimatedDeliveryAt && (
                      <Badge tone="warning" dot>
                        {new Date(o.estimatedDeliveryAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState
                  compact
                  title="Aucune livraison en cours"
                  description="Toutes vos commandes sont terminées pour aujourd'hui."
                />
              </div>
            )}
          </Card>
        </>
      ) : (
        <CardGrid>
          <StatCard
            label="Utilisateurs"
            value={can('user:read') ? (users.data?.total ?? '—') : '—'}
            hint={can('user:read') ? `${(users.data?.items ?? []).filter((u) => u.status === 'ACTIVE').length} actifs` : 'Permission requise'}
            icon={icons.users}
            tone="brand"
            loading={users.loading}
          />
          <StatCard label="Livraisons en cours" value="—" hint="Module logistique — Phase 2" icon={icons.clock} tone="warning" />
          <StatCard label="Livrées" value="—" hint="Module logistique — Phase 2" icon={icons.clock} tone="success" />
          <StatCard label="Livreurs actifs" value="—" hint="Module logistique — Phase 2" icon={icons.users} tone="neutral" />
        </CardGrid>
      )}

      <Alert tone="info" title="Données de démonstration">
        Cette instance tourne avec un jeu de données fictif créé par le seed. Aucune statistique n'est simulée :
        les cartes sans donnée réelle affichent « — ».
      </Alert>

      {!isDriver && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Card
              title="Derniers comptes créés"
              description="Source : /api/users (périmètre de votre entreprise)"
              actions={
                can('user:create') ? (
                  <Link to="/users">
                    <Button size="sm" variant="secondary">
                      Gérer
                    </Button>
                  </Link>
                ) : undefined
              }
              flush
            >
              {users.loading ? (
                <TableSkeleton rows={4} cols={4} />
              ) : users.error ? (
                <ErrorState
                  title="Impossible de charger les utilisateurs"
                  description={users.error.message}
                  action={
                    <Button size="sm" variant="secondary" onClick={users.refetch}>
                      Réessayer
                    </Button>
                  }
                />
              ) : users.data && users.data.items.length > 0 ? (
                <DataTable columns={userColumns} rows={users.data.items} rowKey={(u) => u.id} caption="Derniers utilisateurs" />
              ) : (
                <EmptyState compact title="Aucun utilisateur" description="Créez votre premier compte depuis la page Utilisateurs." />
              )}
            </Card>
          </div>

          <Card title="Avancement du projet" description="Transparence sur les modules livrés">
            <ol className="space-y-3">
              {ROADMAP.map((item) => (
                <li key={item.phase} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      item.done
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.current
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                    aria-hidden="true"
                  >
                    {item.done ? '✓' : item.current ? '•' : ''}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm ${item.done ? 'text-slate-900' : item.current ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.phase}
                      {item.done ? ' · livré' : item.current ? ' · en cours' : ' · à venir'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
}
