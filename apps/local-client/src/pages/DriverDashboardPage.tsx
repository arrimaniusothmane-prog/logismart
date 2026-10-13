import { useMemo, useState } from 'react';
import type { Paginated, OrderStatus } from '@logismart/shared';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/useApi';
import { ApiError, api } from '../lib/api';
import { formatDate } from '../lib/format';
import { orderStatusLabel, orderStatusTone, availabilityLabel, availabilityTone, vehicleLabel } from '../lib/status';
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
} from '../components/ui';

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
  totalDeliveries: number;
  successfulDeliveries: number;
  user: { id: string; name: string; email: string; status: string };
  _count: { orders: number };
}

const ACTIVE_STATUSES: OrderStatus[] = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];

const driverTransitions: Record<string, Array<{ status: OrderStatus; label: string; variant: 'primary' | 'secondary' | 'success' | 'danger' }>> = {
  ASSIGNED: [{ status: 'PICKED_UP', label: 'Récupéré', variant: 'primary' }],
  PICKED_UP: [{ status: 'IN_TRANSIT', label: 'En route', variant: 'primary' }],
  IN_TRANSIT: [
    { status: 'DELIVERED', label: 'Livré', variant: 'success' },
    { status: 'FAILED', label: 'Échec', variant: 'danger' },
  ],
};

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

  const completedToday = useMemo(() => {
    if (!orders.data?.items) return 0;
    const today = new Date().toDateString();
    return orders.data.items.filter(
      (o) => ['DELIVERED', 'FAILED', 'CANCELLED'].includes(o.status as OrderStatus) &&
        o.deliveredAt &&
        new Date(o.deliveredAt).toDateString() === today,
    ).length;
  }, [orders.data?.items]);

  async function toggleAvailability(next: 'ONLINE' | 'OFFLINE') {
    try {
      await api.patch('/api/drivers/me/availability', { availability: next });
      profile.refetch();
      orders.refetch();
      toastSuccess('Disponibilité mise à jour', next === 'ONLINE' ? 'Vous êtes en ligne.' : 'Vous êtes hors ligne.');
    } catch (err) {
      toastError('Erreur', err instanceof ApiError ? err.message : 'Impossible de mettre à jour la disponibilité.');
    }
  }

  async function transition(orderId: string, status: OrderStatus) {
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status });
      orders.refetch();
      toastSuccess('Statut mis à jour', 'La commande a été actualisée.');
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

  if (profile.error && !profile.data) {
    return (
      <div className="p-6">
        <ErrorState
          title="Profil introuvable"
          description={profile.error.message}
          action={
            <Button size="sm" variant="secondary" onClick={profile.refetch}>
              Réessayer
            </Button>
          }
        />
      </div>
    );
  }

  const d = profile.data!;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Tournnée du jour</h2>
          <p className="text-sm text-slate-500">
            {vehicleLabel(d.vehicleType)} · {d.phone ?? 'Téléphone non renseigné'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={availabilityTone(d.availability) as 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'outline'} dot>
            {availabilityLabel(d.availability)}
          </Badge>
          {d.availability === 'ONLINE' ? (
            <Button size="sm" variant="secondary" onClick={() => toggleAvailability('OFFLINE')}>
              Hors ligne
            </Button>
          ) : (
            <Button size="sm" onClick={() => toggleAvailability('ONLINE')}>
              Prendre en ligne
            </Button>
          )}
        </div>
      </div>

      <CardGrid>
        <StatCard
          label="À livrer"
          value={activeOrders.length}
          hint="Commandes en cours"
          icon={ICON_TRUCK}
          tone="warning"
          loading={orders.loading}
        />
        <StatCard
          label="Livrées aujourd'hui"
          value={completedToday}
          hint="Terminées"
          icon={ICON_DELIVERED}
          tone="success"
        />
        <StatCard
          label="Taux de réussite"
          value={d.totalDeliveries > 0 ? `${Math.round((d.successfulDeliveries / d.totalDeliveries) * 100)}%` : '—'}
          hint={`${d.successfulDeliveries}/${d.totalDeliveries} livrées`}
          icon={ICON_STATS}
          tone="brand"
        />
      </CardGrid>

      <Card
        title="Mes prochaines livraisons"
        description={`${activeOrders.length} commande${activeOrders.length > 1 ? 's' : ''} à traiter`}
        className="mt-6"
      >
        {orders.loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : orders.error ? (
          <div className="p-4">
            <ErrorState
              title="Impossible de charger vos livraisons"
              description={orders.error.message}
              action={
                <Button size="sm" variant="secondary" onClick={orders.refetch}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Aucune livraison en cours"
              description="Toutes vos commandes sont terminées pour le moment."
              action={
                d.availability !== 'ONLINE' ? (
                  <Button onClick={() => toggleAvailability('ONLINE')}>Prendre en ligne</Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {activeOrders.map((order) => (
              <DriverOrderCard
                key={order.id}
                order={order}
                transitions={driverTransitions[order.status] ?? []}
                onTransition={transition}
                onDetail={() => setDetailId(order.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {detailId && (
        <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

const ICON_TRUCK = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

const ICON_DELIVERED = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
  </svg>
);

const ICON_STATS = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13v8h8v-8H3Zm0 0V3h8v8H3Zm0 0h8v8H3Z" />
  </svg>
);

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
  const meta = orderStatusTone(order.status);
  return (
    <div className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-900">{order.trackingNumber}</span>
            <Badge tone={meta} dot>{orderStatusLabel(order.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{order.customer.name}</p>
          {order.customer.phone && (
            <a href={`tel:${order.customer.phone.replace(/\s/g, '')}`} className="text-xs text-brand-600 hover:underline">
              Appeler {order.customer.phone}
            </a>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onDetail}>Détails</Button>
      </div>

      <div className="mb-3 space-y-1 text-sm">
        <div>
          <span className="text-xs uppercase text-slate-400">Enlèvement</span>
          <p className="truncate text-slate-800">{order.pickupAddress}</p>
        </div>
        <div>
          <span className="text-xs uppercase text-slate-400">Livraison</span>
          <p className="truncate text-slate-800">{order.deliveryAddress}</p>
        </div>
        {order.estimatedDeliveryAt && (
          <p className="text-xs text-slate-500">
            Estimé : {formatDate(order.estimatedDeliveryAt)}
          </p>
        )}
      </div>

      {transitions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {transitions.map((t) => (
            <Button key={t.status} size="sm" variant={t.variant} onClick={() => onTransition(order.id, t.status)}>
              {t.label}
            </Button>
          ))}
        </div>
      )}
    </div>
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

  if (!detail.data) {
    return (
      <Modal open title="Chargement…" onClose={onClose}>
        <div className="py-4 text-center"><Spinner /></div>
      </Modal>
    );
  }

  const d = detail.data;

  return (
    <Modal
      open
      title={d.trackingNumber}
      description={`Statut : ${orderStatusLabel(d.status)}`}
      onClose={onClose}
      size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Fermer</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone={orderStatusTone(d.status)} dot>{orderStatusLabel(d.status)}</Badge>
          {d._count.proofs > 0 && <Badge tone="success">{d._count.proofs} preuve(s)</Badge>}
        </div>

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
          <Alert tone="info" title="Note interne">{d.note}</Alert>
        )}
      </div>
    </Modal>
  );
}
