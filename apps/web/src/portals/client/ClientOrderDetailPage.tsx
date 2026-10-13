import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { formatDate, formatDistanceFromNow } from '../../lib/format';
import { orderStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, Avatar, EmptyPanel, timeShort } from '../shared/primitives';
import { PModal } from '../shared/PModal';
import { LiveMap, type MapPoint } from '../shared/LiveMap';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../components/ui';

interface PortalOrderDetail {
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
  company: { name: string; phone: string | null; email: string | null };
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

export function ClientOrderDetailPage() {
  const { id = '' } = useParams();
  const { data: order, loading, error, refetch } = useApi<PortalOrderDetail>(`/api/portal/orders/${id}`, [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();

  const terminal = order ? ['DELIVERED', 'CANCELLED', 'FAILED'].includes(order.status) : false;
  const canCancel = order ? order.status === 'PREPARED' || order.status === 'ASSIGNED' : false;

  // Suivi en direct : la carte et la timeline se rafraîchissent tant que la livraison évolue.
  useEffect(() => {
    if (terminal || loading) return;
    const timer = window.setInterval(() => refetch(), 15_000);
    return () => window.clearInterval(timer);
  }, [terminal, loading, refetch]);

  if (loading && !order) return <Loader label="Chargement de votre commande…" />;
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

  const handleCancelOrder = async () => {
    setCancelBusy(true);
    setCancelError(null);
    try {
      await api.patch(`/api/portal/orders/${order.id}/cancel`);
      toastSuccess('Commande annulée avec succès');
      setCancelOpen(false);
      refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Impossible d'annuler la commande";
      setCancelError(msg);
      toastError(msg);
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <section className="p-section">
      <div className="p-container">
        <Link to="/client/orders" className="p-small p-link" style={{ display: 'inline-block', marginBottom: 22 }}>
          ← Toutes mes commandes
        </Link>

        <PageHeader
          eyebrow={`Commande · ${formatDate(order.createdAt)}`}
          title={
            <span className="p-mono" style={{ letterSpacing: '-0.02em' }}>
              #{order.trackingNumber}
            </span>
          }
          lead={order.deliveryAddress}
          actions={
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {canCancel && (
                <button
                  type="button"
                  className="p-btn p-btn-ghost"
                  style={{ color: 'var(--p-danger)', borderColor: 'var(--p-danger)' }}
                  onClick={() => setCancelOpen(true)}
                >
                  Annuler la commande
                </button>
              )}
              <StatusPill label={meta.label} tone={meta.tone} live={order.status === 'IN_TRANSIT'} />
            </div>
          }
        />

        {/* Parcours */}
        <div className="p-card p-card-pad p-fade-up" style={{ marginTop: 30 }}>
          <div className="p-track">
            {STEPS.map((step, index) => {
              const done = !failed && index < currentStep;
              const current = !failed && index === currentStep;
              return (
                <div key={step.status} className={`p-track-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}>
                  {step.label}
                </div>
              );
            })}
          </div>
          {!terminal && order.estimatedDeliveryAt && (
            <p className="p-small" style={{ marginTop: 14 }}>
              Livraison prévue <strong>{formatDate(order.estimatedDeliveryAt)}</strong> ·{' '}
              {formatDistanceFromNow(order.estimatedDeliveryAt)}
            </p>
          )}
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
                  <h2 className="p-h3">Votre colis en direct</h2>
                </div>
                {order.driver?.lastLocationAt && (
                  <span className="p-small">Position {formatDistanceFromNow(order.driver.lastLocationAt)}</span>
                )}
              </div>
              <LiveMap points={mapPoints} height={360} caption={`${order.trackingNumber} · ${order.deliveryAddress}`} />
            </div>

            <div className="p-card p-card-pad p-fade-up p-d2">
              <span className="p-eyebrow">Timeline</span>
              <h2 className="p-h3" style={{ margin: '6px 0 20px' }}>
                Étapes de votre livraison
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
                          {index === 0 && <span className="p-small"> · dernière mise à jour</span>}
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
                  <span className="p-cell-label">Livreur</span>
                  {order.driver ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={order.driver.user.name} tone="accent" />
                      <span className="p-stack" style={{ gap: 2 }}>
                        <span style={{ fontWeight: 700 }}>{order.driver.user.name}</span>
                        <span className="p-small">{order.driver.vehicleType}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="p-body">Affectation en cours</span>
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
                  <span className="p-cell-label">Livré à</span>
                  <span className="p-mono" style={{ fontWeight: 500, fontSize: 16 }}>
                    {order.status === 'DELIVERED'
                      ? order.deliveredAt
                        ? formatDate(order.deliveredAt)
                        : '—'
                      : order.estimatedDeliveryAt
                        ? formatDate(order.estimatedDeliveryAt)
                        : '—'}
                  </span>
                </div>

                <div className="p-cell">
                  <span className="p-cell-label">Transporteur</span>
                  <span style={{ fontWeight: 600 }}>{order.company.name}</span>
                </div>

                {order.note && (
                  <div className="p-cell">
                    <span className="p-cell-label">Informations colis & note</span>
                    <span className="p-body" style={{ whiteSpace: 'pre-line' }}>{order.note}</span>
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
                    <div
                      key={proof.id}
                      className="p-spread"
                      style={{ border: '1px solid var(--p-line)', borderRadius: 14, padding: '12px 15px' }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {proof.type === 'SIGNATURE' ? 'Signature' : proof.type === 'PHOTO' ? 'Photo' : proof.type}
                      </span>
                      <span className="p-small">{timeShort(proof.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-card p-card-dark p-card-pad p-fade-up p-d4">
              <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                Besoin d’aide ?
              </span>
              <p className="p-body" style={{ color: '#fff', margin: '10px 0 16px' }}>
                L'assistant LogiSmart répond sur le statut, les délais et le livreur de cette commande.
              </p>
              <span className="p-small" style={{ color: '#9b9ea3' }}>
                Cliquez sur le bouton « Chat » en bas à droite.
              </span>
            </div>
          </div>
        </div>

        {/* Modale d'annulation de commande */}
        <PModal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Annuler cette livraison ?" width={520}>
          <div className="p-stack" style={{ gap: 18 }}>
            <p className="p-body">
              Êtes-vous sûr de vouloir annuler la commande <strong className="p-mono">#{order.trackingNumber}</strong> ?
            </p>
            <p className="p-small" style={{ color: 'var(--p-text-muted)' }}>
              Cette action est irréversible. Le transporteur et le dispatcher seront immédiatement informés de l'annulation de la course.
            </p>

            {cancelError && (
              <p className="p-small" style={{ color: 'var(--p-danger)' }} role="alert">
                {cancelError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="p-btn p-btn-ghost"
                onClick={() => setCancelOpen(false)}
                disabled={cancelBusy}
              >
                Garder la commande
              </button>
              <button
                type="button"
                className="p-btn p-btn-primary"
                style={{ background: 'var(--p-danger)', borderColor: 'var(--p-danger)' }}
                onClick={handleCancelOrder}
                disabled={cancelBusy}
              >
                {cancelBusy ? 'Annulation…' : 'Confirmer l’annulation'}
              </button>
            </div>
          </div>
        </PModal>
      </div>
    </section>
  );
}
