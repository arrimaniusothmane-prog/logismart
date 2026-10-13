import { useMemo, useState } from 'react';
import type { Paginated, OrderStatus } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { ApiError, api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { orderStatusLabel, orderStatusMeta, availabilityMeta, vehicleLabel } from '../../lib/status';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardGrid,
  EmptyState,
  ErrorState,
  Modal,
  Spinner,
  StatCard,
  TableSkeleton,
  useToast,
} from '../../components/ui';

interface CustomerBrief {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface DriverOrderRow {
  id: string;
  trackingNumber: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  note: string | null;
  createdAt: string;
  customer: CustomerBrief;
  driver: { id: string; user: { name: string; email: string } } | null;
  _count: { proofs: number };
}

interface DriverDetail extends DriverOrderRow {
  history: Array<{ id: string; status: string; note: string | null; createdAt: string }>;
  proofs: Array<{ id: string; type: string; createdAt: string }>;
}

interface DriverProfile {
  id: string;
  userId: string;
  phone: string | null;
  vehicleType: string;
  licenseNumber: string | null;
  availability: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationAt: string | null;
  totalDeliveries: number;
  successfulDeliveries: number;
  createdAt: string;
  user: { id: string; name: string; email: string; status: string };
  _count: { orders: number };
}

const ACTIVE_STATUSES: OrderStatus[] = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];

function nextTransitions(current: string): Array<{ status: OrderStatus; label: string; variant: 'primary' | 'secondary' | 'success' | 'danger' }> {
  const map: Record<string, Array<{ status: OrderStatus; label: string; variant: 'primary' | 'secondary' | 'success' | 'danger' }>> = {
    ASSIGNED: [
      { status: 'PICKED_UP', label: 'J\'ai récupéré', variant: 'primary' },
      { status: 'CANCELLED', label: 'Annuler', variant: 'danger' },
    ],
    PICKED_UP: [
      { status: 'IN_TRANSIT', label: 'En route', variant: 'primary' },
      { status: 'FAILED', label: 'Échec de récupération', variant: 'danger' },
    ],
    IN_TRANSIT: [
      { status: 'DELIVERED', label: 'Livré', variant: 'success' },
      { status: 'FAILED', label: 'Échec de livraison', variant: 'danger' },
    ],
  };
  return map[current] ?? [];
}

const ICON_TRUCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17.5" cy="18" r="1.8" />
  </svg>
);

const ICON_DELIVERED = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
  </svg>
);

const ICON_STATS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13v8h8v-8H3zm0 0V3h8v8H3zm0 0h8v8H3z" />
  </svg>
);

export function DriverDashboardPage() {
  useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [detailId, setDetailId] = useState<string | null>(null);

  const profile = useApi<DriverProfile>('/api/drivers/me', []);
  const orders = useApi<Paginated<DriverOrderRow>>('/api/orders?limit=100&sort=createdAt&order=desc', []);

  const activeOrders = useMemo(
    () => orders.data?.items.filter((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus)) ?? [],
    [orders.data?.items],
  );

  const todaysCompleted = useMemo(
    () =>
      orders.data?.items.filter(
        (o) =>
          ['DELIVERED', 'FAILED', 'CANCELLED'].includes(o.status as OrderStatus) &&
          o.deliveredAt &&
          new Date(o.deliveredAt).toDateString() === new Date().toDateString(),
      ) ?? [],
    [orders.data?.items],
  );

  async function toggleAvailability(next: 'ONLINE' | 'OFFLINE') {
    try {
      await api.patch('/api/drivers/me/availability', { availability: next });
      profile.refetch();
      toastSuccess('Disponibilité mise à jour', next === 'ONLINE' ? 'Vous êtes maintenant en ligne.' : 'Vous êtes maintenant hors ligne.');
    } catch (err) {
      toastError('Erreur', err instanceof ApiError ? err.message : 'Impossible de mettre à jour la disponibilité.');
    }
  }

  async function transition(orderId: string, status: OrderStatus) {
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status });
      orders.refetch();
      toastSuccess('Statut mis à jour', `Commande ${status === 'DELIVERED' ? 'livrée' : status === 'FAILED' ? 'échouée' : 'mise à jour'}.`);
    } catch (err) {
      toastError('Transition refusée', err instanceof ApiError ? err.message : 'Erreur inattendue.');
    }
  }

  if (profile.loading && !profile.data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Chargement de votre profil…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mes livraisons du jour</h2>
          <p className="text-sm text-slate-500">
            {profile.data ? profile.data.user.name : '—'} · {vehicleLabel(profile.data?.vehicleType ?? '')}
          </p>
        </div>
        {profile.data && (
          <div className="flex items-center gap-2">
            <Badge tone={availabilityMeta(profile.data.availability).tone} dot>
              {availabilityMeta(profile.data.availability).label}
            </Badge>
            {profile.data.availability === 'ONLINE' ? (
              <Button size="sm" variant="secondary" onClick={() => toggleAvailability('OFFLINE')}>
                Se déconnecter
              </Button>
            ) : (
              <Button size="sm" onClick={() => toggleAvailability('ONLINE')}>
                Prendre en ligne
              </Button>
            )}
          </div>
        )}
      </div>

      <CardGrid>
        <StatCard
          label="À livrer aujourd'hui"
          value={activeOrders.length}
          hint="Commandes en cours"
          icon={ICON_TRUCK}
          tone="warning"
          loading={orders.loading}
        />
        <StatCard
          label="Livrées aujourd'hui"
          value={todaysCompleted.length}
          hint="Cette journée"
          icon={ICON_DELIVERED}
          tone="success"
          loading={orders.loading}
        />
        <StatCard
          label="Taux de réussite"
          value={
            profile.data
              ? `${Math.round((profile.data.successfulDeliveries / (profile.data.totalDeliveries || 1)) * 100)}%`
              : '—'
          }
          hint={`${profile.data?.successfulDeliveries ?? 0} / ${profile.data?.totalDeliveries ?? 0} livrées`}
          icon={ICON_STATS}
          tone="brand"
          loading={profile.loading}
        />
      </CardGrid>

      <div className="space-y-4">
        {orders.loading ? (
          <Card>
            <TableSkeleton rows={5} cols={5} />
          </Card>
        ) : orders.error ? (
          <Card>
            <ErrorState
              title="Impossible de charger vos livraisons"
              description={orders.error.message}
              action={
                <Button size="sm" variant="secondary" onClick={orders.refetch}>
                  Réessayer
                </Button>
              }
            />
          </Card>
        ) : activeOrders.length === 0 ? (
          <Card>
            <EmptyState
              title="Aucune livraison en cours"
              description="Vous n'avez pas de commande à livrer pour le moment."
              action={
                profile.data?.availability !== 'ONLINE' ? (
                  <Button onClick={() => toggleAvailability('ONLINE')}>Prendre en ligne</Button>
                ) : undefined}
            />
          </Card>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              {activeOrders.length} commande{activeOrders.length > 1 ? 's' : ''} à livrer
            </p>
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <DriverOrderCard
                  key={order.id}
                  order={order}
                  transitions={nextTransitions(order.status)}
                  onTransition={transition}
                  onDetail={() => setDetailId(order.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {detailId && (
        <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

function DriverOrderCard({
  order,
  transitions,
  onTransition,
  onDetail,
}: {
  order: DriverOrderRow;
  transitions: Array<{ status: OrderStatus; label: string; variant: 'primary' | 'secondary' | 'success' | 'danger' }>;
  onTransition: (id: string, status: OrderStatus) => void;
  onDetail: () => void;
}) {
  const meta = orderStatusMeta(order.status);
  return (
    <Card flush>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-900">{order.trackingNumber}</span>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{order.customer.name}</p>
            {order.customer.phone && (
              <a href={`tel:${order.customer.phone.replace(/\s/g, '')}`} className="text-xs text-brand-600 hover:underline">
                Appeler {order.customer.phone}
              </a>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={onDetail}>
            Détails
          </Button>
        </div>

        <div className="mb-3 space-y-1 text-sm">
          <div>
            <span className="text-xs font-medium uppercase text-slate-400">Enlèvement</span>
            <p className="truncate text-slate-800">{order.pickupAddress}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-slate-400">Livraison</span>
            <p className="truncate text-slate-800">{order.deliveryAddress}</p>
          </div>
          {order.estimatedDeliveryAt && (
            <p className="text-xs text-slate-500">Estimé : {formatDate(order.estimatedDeliveryAt)}</p>
          )}
        </div>

        {transitions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <Button
                key={t.status}
                size="sm"
                variant={t.variant}
                onClick={() => onTransition(order.id, t.status)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const detail = useApi<DriverDetail>(`/api/orders/${orderId}`, [orderId]);

  if (detail.error) {
    return (
      <Modal open title="Commande introuvable" onClose={onClose}>
        <p className="text-sm text-slate-600">{detail.error.message}</p>
      </Modal>
    );
  }

  const d = detail.data;
  if (!d) {
    return (
      <Modal open title="Chargement…" onClose={onClose}>
        <div className="py-4 text-center">
          <Spinner />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={d.trackingNumber}
      description={`Statut : ${orderStatusLabel(d.status)}`}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <div className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-400">Enlèvement</dt>
            <dd className="mt-1 text-slate-800">{d.pickupAddress}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Livraison</dt>
            <dd className="mt-1 font-medium text-slate-800">{d.deliveryAddress}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Destinataire</dt>
            <dd className="mt-1 text-slate-800">{d.customer.name}</dd>
            <dd className="text-xs text-slate-500">
              {[d.customer.phone, d.customer.email].filter(Boolean).join(' · ') || ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Livreur</dt>
            <dd className="mt-1 text-slate-800">{d.driver ? d.driver.user.name : '—'}</dd>
          </div>
        </dl>

        <div>
          <p className="text-xs uppercase text-slate-400">Historique</p>
          <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3 text-sm">
            {d.history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-3 top-0.5 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
                <span className="font-medium text-slate-700">{orderStatusLabel(h.status)}</span>
                <span className="text-xs text-slate-400"> · {formatDate(h.createdAt)}</span>
                {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
              </li>
            ))}
          </ol>
        </div>

        {d.note && (
          <Alert tone="info" title="Note interne">
            {d.note}
          </Alert>
        )}

        {d._count.proofs > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-400">Preuves de livraison</p>
            <ul className="mt-1 space-y-1 text-xs text-slate-500">
              {d.proofs.map((p) => (
                <li key={p.id}>
                  {p.type} · {formatDate(p.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
