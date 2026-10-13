import { useMemo, useState } from 'react';
import type { Paginated, OrderStatus } from '@logismart/shared';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/useApi';
import { formatDate, formatDateOnly } from '../lib/format';
import { orderStatusLabel, orderStatusTone } from '../lib/status';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Modal,
  Spinner,
  TableSkeleton,
  type Column,
} from '../components/ui';

interface CustomerBrief {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface DeliveryRow {
  id: string;
  trackingNumber: string;
  status: string;
  deliveryAddress: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  customer: CustomerBrief;
  _count: { proofs: number };
}

interface DeliveryDetail extends DeliveryRow {
  history: Array<{ id: string; status: string; note: string | null; createdAt: string }>;
  proofs: Array<{ id: string; type: string; fileUrl: string | null; createdAt: string }>;
}

const COMPLETED_STATUSES: OrderStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED'];

export function DeliveriesPage() {
  useAuth();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const orders = useApi<Paginated<DeliveryRow>>('/api/orders?limit=100&sort=createdAt&order=desc', []);

  const completed = useMemo(
    () => orders.data?.items.filter((o) => COMPLETED_STATUSES.includes(o.status as OrderStatus)) ?? [],
    [orders.data?.items],
  );

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return completed;
    return completed.filter((o) => o.status === activeFilter);
  }, [completed, activeFilter]);

  const columns: Array<Column<DeliveryRow>> = [
    {
      key: 'trackingNumber',
      header: 'N° suivi',
      render: (o) => <span className="font-mono text-xs font-semibold text-slate-900">{o.trackingNumber}</span>,
    },
    {
      key: 'customer',
      header: 'Client',
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{o.customer.name}</p>
          <p className="truncate text-xs text-slate-500">{o.customer.email ?? o.customer.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (o) => <Badge tone={orderStatusTone(o.status)} dot>{orderStatusLabel(o.status)}</Badge>,
    },
    {
      key: 'deliveredAt',
      header: 'Date',
      render: (o) => (
        <span className="tabular-nums text-sm text-slate-500">
          {o.deliveredAt ? formatDateOnly(o.deliveredAt) : formatDateOnly(o.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Historique des livraisons</h2>
        <Button size="sm" variant="secondary" onClick={orders.refetch} disabled={orders.loading}>
          Actualiser
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeFilter === 'all' ? 'primary' : 'ghost'}
          onClick={() => setActiveFilter('all')}
        >
          Tous
        </Button>
        {COMPLETED_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={activeFilter === s ? 'primary' : 'ghost'}
            onClick={() => setActiveFilter(s)}
          >
            {orderStatusLabel(s)}
          </Button>
        ))}
      </div>

      <Card flush>
        {orders.loading ? (
          <TableSkeleton rows={10} cols={4} />
        ) : orders.error ? (
          <div className="p-4">
            <ErrorState
              title="Impossible de charger l'historique"
              description={orders.error.message}
              action={
                <Button size="sm" variant="secondary" onClick={orders.refetch}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucune livraison"
              description="Vos livraisons passées apparaîtront ici."
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            onRowClick={(o) => setDetailId(o.id)}
            rowKey={(o) => o.id}
            caption="Historique des livraisons"
          />
        )}
      </Card>

      {detailId && <DeliveryDetailModal orderId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function DeliveryDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const detail = useApi<DeliveryDetail>(`/api/orders/${orderId}`, [orderId]);

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
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-400">Enlèvement</dt>
            <dd className="mt-1 text-slate-800">{d.deliveryAddress}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Livraison</dt>
            <dd className="mt-1 font-medium text-slate-800">{d.deliveryAddress}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Destinataire</dt>
            <dd className="mt-1 text-slate-800">{d.customer.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Date de livraison</dt>
            <dd className="mt-1 text-slate-800">
              {d.deliveredAt ? formatDate(d.deliveredAt) : '—'}
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

        {d.proofs.length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-400">Preuves de livraison</p>
            <div className="mt-2 space-y-2">
              {d.proofs.map((p) => (
                <div key={p.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700 capitalize">{p.type.toLowerCase()}</span>
                  <span className="ml-2 text-xs text-slate-400">{formatDate(p.createdAt)}</span>
                  {p.fileUrl && (
                    <a
                      href={p.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-brand-600 hover:underline"
                    >
                      Ouvrir
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {d.proofs.length === 0 && (
          <EmptyState compact title="Aucune preuve" description="Aucune preuve de livraison n'a été enregistrée pour cette commande." />
        )}
      </div>
    </Modal>
  );
}
