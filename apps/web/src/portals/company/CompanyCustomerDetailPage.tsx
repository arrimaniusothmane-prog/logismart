import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { formatDate, formatDateOnly, formatNumber } from '../../lib/format';
import { orderStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, Avatar, EmptyPanel } from '../shared/primitives';

interface CustomerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { orders: number };
  orders: Array<{
    id: string;
    trackingNumber: string;
    status: string;
    createdAt: string;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
  }>;
}

export function CompanyCustomerDetailPage() {
  const { id = '' } = useParams();
  const { data: customer, loading, error, refetch } = useApi<CustomerDetail>(`/api/customers/${id}`, [id]);

  if (loading && !customer) return <Loader label="Chargement du client…" />;
  if (error) return <ErrorPanel error={error} onRetry={refetch} />;
  if (!customer) return null;

  const active = customer.orders.filter(
    (o) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(o.status),
  );

  return (
    <section className="p-section">
      <div className="p-container">
        <Link to="/company/customers" className="p-small p-link" style={{ display: 'inline-block', marginBottom: 22 }}>
          ← Tous les clients
        </Link>

        <PageHeader
          eyebrow={`Client depuis ${formatDateOnly(customer.createdAt)}`}
          title={customer.name}
          lead={customer.address ?? 'Aucune adresse enregistrée'}
          actions={
            <span className="p-pill p-pill-accent">
              {formatNumber(customer._count.orders)} commande(s)
            </span>
          }
        />

        <div className="p-grid-main" style={{ marginTop: 30 }}>
          <div className="p-card p-card-pad">
            <div className="p-spread" style={{ marginBottom: 18 }}>
              <div className="p-stack" style={{ gap: 6 }}>
                <span className="p-eyebrow">Historique</span>
                <h2 className="p-h3">Dernières commandes</h2>
              </div>
              <span className="p-small">{active.length} en cours</span>
            </div>

            {customer.orders.length === 0 ? (
              <EmptyPanel title="Aucune commande" description="Ce client n'a pas encore de livraison." />
            ) : (
              <div className="p-rowlist" style={{ borderTop: 'none' }}>
                {customer.orders.map((order) => {
                  const meta = orderStatusMeta(order.status);
                  return (
                    <Link key={order.id} to={`/company/orders/${order.id}`} className="p-row" style={{ gridTemplateColumns: '1.2fr 1fr auto auto' }}>
                      <span className="p-cell">
                        <span className="p-cell-label">Tracking</span>
                        <span className="p-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                          {order.trackingNumber}
                        </span>
                      </span>
                      <span className="p-cell">
                        <span className="p-cell-label">Créée le</span>
                        <span className="p-small">{formatDate(order.createdAt)}</span>
                      </span>
                      <StatusPill label={meta.label} tone={meta.tone} live={order.status === 'IN_TRANSIT'} />
                      <span className="p-small">
                        {order.deliveredAt ? formatDateOnly(order.deliveredAt) : '—'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-card p-card-pad p-fade-up p-d2" style={{ alignSelf: 'start' }}>
            <div className="p-stack" style={{ alignItems: 'center', gap: 14, textAlign: 'center', padding: '8px 0' }}>
              <Avatar name={customer.name} large />
              <div className="p-stack" style={{ gap: 4 }}>
                <span className="p-h3">{customer.name}</span>
                <span className="p-small">Mise à jour {formatDate(customer.updatedAt)}</span>
              </div>
              <hr className="p-hairline" style={{ width: '100%' }} />
              <div className="p-stack" style={{ gap: 14, width: '100%', textAlign: 'left' }}>
                <div className="p-cell">
                  <span className="p-cell-label">E-mail</span>
                  <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{customer.email ?? '—'}</span>
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">Téléphone</span>
                  <span style={{ fontWeight: 600 }}>{customer.phone ?? '—'}</span>
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">Adresse</span>
                  <span style={{ fontWeight: 600 }}>{customer.address ?? '—'}</span>
                </div>
                <div className="p-spread">
                  <span className="p-small">Commandes totales</span>
                  <span className="p-mono" style={{ fontWeight: 500 }}>
                    {customer._count.orders}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
