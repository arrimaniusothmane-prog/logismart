import { useMemo, useState } from 'react';
import type { Paginated, OrderStatus } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { qs } from '../../lib/api';
import { formatDate, formatDateOnly } from '../../lib/format';
import { orderStatusLabel, orderStatusMeta } from '../../lib/status';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Spinner,
  TableSkeleton,
  type Column,
} from '../../components/ui';

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
  pickupAddress: string;
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

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DELIVERED', label: 'Livrées' },
  { value: 'FAILED', label: 'Échecs' },
  { value: 'CANCELLED', label: 'Annulées' },
];

const COMPLETED_STATUSES: OrderStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED'];

export function DriverDeliveriesPage() {
  useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    sort: 'createdAt',
    order: 'desc',
  });

  const orders = useApi<Paginated<DeliveryRow>>(`/api/orders${query}`, [query]);

  const rows = useMemo(() => {
    if (!orders.data?.items) return [];
    return orders.data.items.filter((o) => COMPLETED_STATUSES.includes(o.status as OrderStatus));
  }, [orders.data?.items]);

  const total = orders.data?.total ?? 0;
  const displayTotal = rows.length;

  const columns: Array<Column<DeliveryRow>> = [
    {
      key: 'trackingNumber',
      header: 'N° suivi',
      render: (o) => <span className="font-mono text-xs font-semibold text-slate-900">{o.trackingNumber}</span>,
    },
    {
      key: 'customer',
      header: 'Destinataire',
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{o.customer.name}</p>
          <p className="truncate text-xs text-slate-500">{o.customer.email ?? o.customer.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'deliveryAddress',
      header: 'Livraison',
      hideBelow: 'sm',
      render: (o) => <p className="truncate max-w-[12rem] text-slate-800">{o.deliveryAddress}</p>,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (o) => {
        const meta = orderStatusMeta(o.status);
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: 'deliveredAt',
      header: 'Date',
      hideBelow: 'md',
      align: 'right',
      render: (o) => (
        <span className="tabular-nums text-sm text-slate-500">
          {o.deliveredAt ? formatDateOnly(o.deliveredAt) : formatDateOnly(o.createdAt)}
        </span>
      ),
    },
    {
      key: 'proofs',
      header: 'Preuves',
      hideBelow: 'lg',
      render: (o) => (
        <span className="tabular-nums text-slate-500">
          {o._count.proofs > 0 ? `${o._count.proofs}` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Historique des livraisons</h2>
          <p className="text-sm text-slate-500">
            {orders.loading ? 'Chargement…' : `${displayTotal} livraison${displayTotal > 1 ? 's' : ''} terminée${displayTotal > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={orders.refetch} disabled={orders.loading}>
          Actualiser
        </Button>
      </div>

      <Card flush>
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <div className="min-w-[12rem] flex-1">
            <Input
              placeholder="Rechercher un n° de suivi, une adresse, un client…"
              value={search}
              aria-label="Rechercher une livraison"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>

        {orders.loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={6} />
        ) : orders.error ? (
          <div className="p-4">
            <ErrorState title="Impossible de charger l'historique" description={orders.error.message} />
          </div>
        ) : displayTotal === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucune livraison terminée"
              description="Vos livraisons passées apparaîtront ici une fois livrées ou échouées."
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              onRowClick={(o) => setDetailId(o.id)}
              rowKey={(o) => o.id}
              caption="Historique des livraisons"
            />
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">Page {page} · {total} au total</p>
            </div>
          </>
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
        <div className="py-4 text-center">
          <Spinner />
        </div>
      </Modal>
    );
  }

  const d = detail.data;
  const meta = orderStatusMeta(d.status);

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
        <div className="flex items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
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
          <div>
            <dt className="text-xs uppercase text-slate-400">
              {d.deliveredAt ? 'Livrée le' : 'Créée le'}
            </dt>
            <dd className="mt-1 tabular-nums text-slate-800">
              {d.deliveredAt ? formatDate(d.deliveredAt) : formatDate(d.createdAt)}
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
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {d.proofs.map((p) => (
                <div key={p.id} className="rounded-md border border-slate-200 p-3 text-center">
                  <span className="text-xs font-medium text-slate-700 capitalize">{p.type.toLowerCase()}</span>
                  <p className="text-xs text-slate-400">{formatDate(p.createdAt)}</p>
                  {p.fileUrl && (
                    <a
                      href={p.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-brand-600 hover:underline"
                    >
                      Voir la pièce
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
