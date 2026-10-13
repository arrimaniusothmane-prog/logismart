import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { formatDate, formatDistanceFromNow } from '../../lib/format';
import { orderStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, timeShort, Avatar, EmptyPanel } from '../shared/primitives';
import { LiveMap, type MapPoint } from '../shared/LiveMap';

interface OrderDetail {
  id: string;
  trackingNumber: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  note: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null; address: string | null };
  driver:
    | {
        id: string;
        vehicleType: string;
        availability: string;
        currentLatitude: number | null;
        currentLongitude: number | null;
        lastLocationAt: string | null;
        user: { name: string; email: string };
      }
    | null;
  history: Array<{ id: string; status: string; note: string | null; latitude: number | null; longitude: number | null; createdAt: string }>;
  proofs: Array<{ id: string; type: string; fileUrl: string | null; signatureData: string | null; createdAt: string }>;
}

const STEPS: Array<{ status: string; label: string }> = [
  { status: 'PREPARED', label: 'Préparée' },
  { status: 'ASSIGNED', label: 'Affectée' },
  { status: 'PICKED_UP', label: 'Récupérée' },
  { status: 'IN_TRANSIT', label: 'En route' },
  { status: 'DELIVERED', label: 'Livrée' },
];

const STEP_INDEX: Record<string, number> = {
  PREPARED: 0,
  ASSIGNED: 1,
  PICKED_UP: 2,
  IN_TRANSIT: 3,
  DELIVERED: 4,
};

export function CompanyOrderDetailPage() {
  const { id = '' } = useParams();
  const { data: order, loading, error, refetch } = useApi<OrderDetail>(`/api/orders/${id}`, [id]);

  if (loading && !order) return <Loader label="Chargement de la commande…" />;
  if (error) return <ErrorPanel error={error} onRetry={refetch} />;
  if (!order) return null;

  const meta = orderStatusMeta(order.status);
  const currentStep = STEP_INDEX[order.status] ?? 0;
  const failed = order.status === 'FAILED' || order.status === 'CANCELLED';

  const historyPoints: MapPoint[] = order.history
    .filter((h) => h.latitude != null && h.longitude != null)
    .map((h) => ({ lat: h.latitude!, lng: h.longitude!, kind: 'history' as const }));

  const mapPoints: MapPoint[] = [
    ...historyPoints,
    ...(order.driver?.currentLatitude != null && order.driver.currentLongitude != null
      ? [
          {
            lat: order.driver.currentLatitude,
            lng: order.driver.currentLongitude,
            kind: 'driver' as const,
            label: order.driver.user.name,
          },
        ]
      : []),
  ];

  return (
    <section className="p-section">
      <div className="p-container">
        <Link to="/company/orders" className="p-small p-link" style={{ display: 'inline-block', marginBottom: 22 }}>
          ← Toutes les commandes
        </Link>

        <PageHeader
          eyebrow={`Commande · ${formatDate(order.createdAt)}`}
          title={
            <span className="p-mono" style={{ letterSpacing: '-0.02em' }}>
              #{order.trackingNumber}
            </span>
          }
          lead={order.customer.name}
          actions={<StatusPill label={meta.label} tone={meta.tone} live={order.status === 'IN_TRANSIT'} />}
        />

        {/* Parcours */}
        <div className="p-card p-card-pad p-fade-up" style={{ marginTop: 30 }}>
          <div className="p-track">
            {STEPS.map((step, index) => {
              const done = !failed && index < currentStep;
              const current = !failed && index === currentStep;
              return (
                <div
                  key={step.status}
                  className={`p-track-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
          {failed && (
            <p className="p-small" style={{ marginTop: 14, color: 'var(--p-danger)' }}>
              Cette livraison s'est terminée en « {meta.label} ».
            </p>
          )}
        </div>

        <div className="p-grid-main" style={{ marginTop: 20 }}>
          <div className="p-stack" style={{ gap: 20 }}>
            <div className="p-card p-card-pad p-fade-up">
              <div className="p-spread" style={{ marginBottom: 16 }}>
                <div className="p-stack" style={{ gap: 6 }}>
                  <span className="p-eyebrow">Carte</span>
                  <h2 className="p-h3">Suivi en direct</h2>
                </div>
                {order.driver?.lastLocationAt && (
                  <span className="p-small">
                    Position {formatDistanceFromNow(order.driver.lastLocationAt)}
                  </span>
                )}
              </div>
              <LiveMap
                points={mapPoints}
                height={360}
                caption={`${order.trackingNumber} · ${order.deliveryAddress}`}
              />
            </div>

            <div className="p-card p-card-pad p-fade-up p-d2">
              <span className="p-eyebrow">Timeline</span>
              <h2 className="p-h3" style={{ margin: '6px 0 20px' }}>
                Historique de la livraison
              </h2>
              <div className="p-timeline">
                {[...order.history].reverse().map((event, index, all) => {
                  const metaStep = orderStatusMeta(event.status);
                  return (
                    <div key={event.id} className={`p-timeline-item ${index === 0 ? 'is-current' : 'is-done'}`}>
                      <div className="p-timeline-rail">
                        <span className="p-timeline-node" />
                        {index < all.length - 1 && <span className="p-timeline-line" />}
                      </div>
                      <div className="p-stack" style={{ gap: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5 }}>
                          {metaStep.label}
                          {index === 0 && <span className="p-small"> · étape actuelle</span>}
                        </span>
                        <span className="p-mono p-small" style={{ fontSize: 12 }}>
                          {formatDate(event.createdAt)}
                        </span>
                        {event.note && <span className="p-small">{event.note}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-stack" style={{ gap: 20 }}>
            <div className="p-card p-card-pad p-fade-up p-d2">
              <span className="p-eyebrow">Détails</span>
              <div className="p-stack" style={{ gap: 18, marginTop: 16 }}>
                <div className="p-cell">
                  <span className="p-cell-label">Client</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={order.customer.name} />
                    <div className="p-stack" style={{ gap: 2 }}>
                      <Link to={`/company/customers/${order.customer.id}`} className="p-link" style={{ fontWeight: 700 }}>
                        {order.customer.name}
                      </Link>
                      <span className="p-small">{order.customer.email ?? '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-cell">
                  <span className="p-cell-label">Livreur</span>
                  {order.driver ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={order.driver.user.name} tone="accent" />
                      <div className="p-stack" style={{ gap: 2 }}>
                        <Link to={`/company/drivers/${order.driver.id}`} className="p-link" style={{ fontWeight: 700 }}>
                          {order.driver.user.name}
                        </Link>
                        <span className="p-small">{order.driver.vehicleType}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="p-body">Non affecté</span>
                  )}
                </div>

                <div className="p-cell">
                  <span className="p-cell-label">Destination</span>
                  <span style={{ fontWeight: 600 }}>{order.deliveryAddress}</span>
                </div>

                <div className="p-cell">
                  <span className="p-cell-label">Départ</span>
                  <span className="p-small">{order.pickupAddress}</span>
                </div>

                <div className="p-cell">
                  <span className="p-cell-label">ETA</span>
                  <span className="p-mono" style={{ fontWeight: 500, fontSize: 18 }}>
                    {order.status === 'DELIVERED'
                      ? `Livrée ${order.deliveredAt ? timeShort(order.deliveredAt) : ''}`
                      : order.estimatedDeliveryAt
                        ? formatDate(order.estimatedDeliveryAt)
                        : '—'}
                  </span>
                </div>

                {order.note && (
                  <div className="p-cell">
                    <span className="p-cell-label">Note</span>
                    <span className="p-body">{order.note}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-card p-card-pad p-fade-up p-d3">
              <span className="p-eyebrow">Preuve de livraison</span>
              <h2 className="p-h3" style={{ margin: '6px 0 16px' }}>
                {order.proofs.length > 0 ? `${order.proofs.length} preuve(s)` : 'Aucune preuve'}
              </h2>
              {order.proofs.length === 0 ? (
                <EmptyPanel title="En attente" description="La preuve apparaîtra à la livraison." />
              ) : (
                <div className="p-stack" style={{ gap: 12 }}>
                  {order.proofs.map((proof) => (
                    <div key={proof.id} className="p-spread" style={{ border: '1px solid var(--p-line)', borderRadius: 14, padding: '12px 15px' }}>
                      <span style={{ fontWeight: 600 }}>{proof.type === 'SIGNATURE' ? 'Signature' : proof.type === 'PHOTO' ? 'Photo' : proof.type}</span>
                      <span className="p-small">{formatDate(proof.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
