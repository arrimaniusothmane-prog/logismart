import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { qs } from '../../lib/api';
import { formatDateOnly, formatDistanceFromNow } from '../../lib/format';
import { orderStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, timeShort, EmptyPanel } from '../shared/primitives';

interface OrderRow {
  id: string;
  trackingNumber: string;
  status: string;
  deliveryAddress: string;
  pickupAddress: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string | null };
  driver: { id: string; user: { name: string } } | null;
  _count?: { proofs: number };
}

const STATUS_TABS = [
  { value: '', label: 'Tout' },
  { value: 'PREPARED', label: 'Préparées' },
  { value: 'ASSIGNED', label: 'Affectées' },
  { value: 'PICKED_UP', label: 'Récupérées' },
  { value: 'IN_TRANSIT', label: 'En transit' },
  { value: 'DELIVERED', label: 'Livrées' },
  { value: 'FAILED', label: 'Échecs' },
];

const PAGE_SIZE = 12;

export function CompanyOrdersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status || undefined,
    order: 'desc',
  });

  const orders = useApi<Paginated<OrderRow>>(`/api/orders${query}`, [query]);
  const rows = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Orders"
          title="Commandes"
          lead="Tout ce qui circule actuellement dans votre réseau — recherche, filtres et statuts en un coup d'œil."
        />

        <div className="p-spread" style={{ margin: '34px 0 20px' }}>
          <div className="p-tabs" role="tablist" aria-label="Filtrer par statut">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                className={`p-tab${status === tab.value ? ' is-active' : ''}`}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-field" style={{ minWidth: 'min(320px, 100%)' }}>
            <input
              className="p-input p-input-mono"
              type="search"
              placeholder="Rechercher n° suivi, client, adresse…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Rechercher une commande"
            />
          </div>
        </div>

        {orders.loading && !orders.data ? (
          <Loader label="Chargement des commandes…" />
        ) : orders.error ? (
          <ErrorPanel error={orders.error} onRetry={orders.refetch} />
        ) : rows.length === 0 ? (
          <EmptyPanel title="Aucune commande" description="Aucun résultat pour ces filtres." />
        ) : (
          <div className="p-card" style={{ overflow: 'hidden' }}>
            <div className="p-rowlist" style={{ borderTop: 'none' }}>
              <div className="p-row p-row-head cols-orders" aria-hidden>
                <span>Tracking</span>
                <span>Client</span>
                <span>Livreur</span>
                <span>Statut</span>
                <span>ETA</span>
                <span>Date</span>
              </div>

              {rows.map((order) => {
                const meta = orderStatusMeta(order.status);
                return (
                  <Link key={order.id} to={`/company/orders/${order.id}`} className="p-row cols-orders">
                    <span className="p-cell">
                      <span className="p-cell-label">Tracking</span>
                      <span className="p-mono" style={{ fontWeight: 500, fontSize: 13.5 }}>
                        {order.trackingNumber}
                      </span>
                    </span>
                    <span className="p-cell">
                      <span className="p-cell-label">Client</span>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.customer.name}
                      </span>
                    </span>
                    <span className="p-cell">
                      <span className="p-cell-label">Livreur</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.driver?.user.name ?? <span className="p-small">Non affecté</span>}
                      </span>
                    </span>
                    <span className="p-cell">
                      <span className="p-cell-label">Statut</span>
                      <StatusPill label={meta.label} tone={meta.tone} live={order.status === 'IN_TRANSIT'} />
                    </span>
                    <span className="p-cell">
                      <span className="p-cell-label">ETA</span>
                      <span className="p-mono" style={{ fontSize: 13 }}>
                        {order.status === 'DELIVERED'
                          ? 'Livrée'
                          : order.estimatedDeliveryAt
                            ? timeShort(order.estimatedDeliveryAt)
                            : '—'}
                      </span>
                    </span>
                    <span className="p-cell">
                      <span className="p-cell-label">Date</span>
                      <span className="p-small">{formatDateOnly(order.createdAt)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="p-spread" style={{ marginTop: 22 }}>
            <span className="p-small">
              {total} commandes · page {page} / {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="p-btn p-btn-ghost p-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </button>
              <button
                type="button"
                className="p-btn p-btn-ghost p-btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        <p className="p-small" style={{ marginTop: 18 }}>
          Dernière mise à jour {orders.data ? formatDistanceFromNow(new Date()) : '—'}
        </p>
      </div>
    </section>
  );
}
