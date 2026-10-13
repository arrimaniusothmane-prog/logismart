import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { formatDate, formatDistanceFromNow } from '../../lib/format';
import { orderStatusMeta } from '../../lib/status';
import { PageHeader, StatTile, Loader, StatusPill, EmptyPanel, Avatar, timeShort } from '../shared/primitives';
import { useClientAuth, type PortalOrderCard } from './ClientAuthContext';

interface PortalStats {
  total: number;
  preparing: number;
  inTransit: number;
  delivered: number;
  failed: number;
  cancelled: number;
  recentOrders: PortalOrderCard[];
  latestUpdates: Array<{
    id: string;
    orderId: string;
    trackingNumber: string;
    deliveryAddress: string;
    status: string;
    label: string;
    note: string | null;
    at: string;
    read: boolean;
  }>;
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

export function ClientDashboardPage() {
  const { customer, reload } = useClientAuth();
  const navigate = useNavigate();
  const [trackQuery, setTrackQuery] = useState('');
  const [trackError, setTrackError] = useState<string | null>(null);

  const stats = useApi<PortalStats>('/api/portal/stats', [], {
    refreshMs: 20_000,
  });

  // Auto-actualisation du contexte client toutes les 30s
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 30_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const active = customer?.activeOrder ?? null;
  const recent = stats.data?.recentOrders ?? [];
  const updates = stats.data?.latestUpdates ?? [];

  const firstName = (customer?.name ?? '').split(' ')[0] ?? '';

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = trackQuery.trim().toUpperCase();
    if (!query) {
      setTrackError('Veuillez renseigner un numéro de suivi');
      return;
    }
    setTrackError(null);

    // Cherche parmi les commandes du client
    const found = recent.find((o) => o.trackingNumber.toUpperCase() === query);
    if (found) {
      navigate(`/client/orders/${found.id}`);
      return;
    }

    // Si pas trouvé immédiatement dans le top 5, redirige vers la liste des commandes avec filtre
    navigate(`/client/orders?search=${encodeURIComponent(query)}`);
  };

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow={`Espace client · ${customer?.company.name ?? ''}`}
          title={`Bonjour ${firstName}.`}
          lead={
            active
              ? `Vous avez une expédition active : colis ${active.trackingNumber} (${orderStatusMeta(active.status).label}).`
              : 'Bienvenue sur votre portail de livraison LogiSmart.'
          }
          actions={
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/client/orders" className="p-btn p-btn-primary">
                + Nouvelle commande
              </Link>
              <Link to="/client/orders" className="p-btn p-btn-ghost">
                Toutes mes commandes
              </Link>
            </div>
          }
        />

        {/* 5 métriques réelles calculées depuis les commandes du client */}
        <div className="p-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 34 }}>
          <StatTile
            label="Total commandes"
            value={stats.data?.total ?? customer?.totalOrders ?? 0}
            hint="toutes commandes confondues"
          />
          <StatTile
            label="En préparation"
            value={stats.data?.preparing ?? 0}
            hint="préparées & affectées"
            accent={Boolean(stats.data?.preparing)}
          />
          <StatTile
            label="En transit"
            value={stats.data?.inTransit ?? 0}
            hint="colis sur la route"
            accent={Boolean(stats.data?.inTransit)}
          />
          <StatTile
            label="Livrées"
            value={stats.data?.delivered ?? 0}
            hint="livraisons réussies"
          />
          <StatTile
            label="Échecs"
            value={stats.data?.failed ?? 0}
            hint="tentatives infructueuses"
          />
        </div>

        {/* Actions rapides & Suivi express */}
        <div className="p-card p-card-pad p-fade-up" style={{ marginTop: 20 }}>
          <div className="p-spread" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div className="p-stack" style={{ gap: 4 }}>
              <span className="p-eyebrow">Accès rapide</span>
              <h2 className="p-h3">Suivre un colis en direct</h2>
            </div>
            <form onSubmit={handleTrackSubmit} style={{ display: 'flex', gap: 10, flex: '1 1 320px', maxWidth: 480 }}>
              <input
                type="text"
                className="p-input"
                placeholder="Ex : LS-ABCD-1234-EF"
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="p-btn p-btn-primary">
                Suivre
              </button>
            </form>
          </div>
          {trackError && <p className="p-small" style={{ color: 'var(--p-danger)', marginTop: 8 }}>{trackError}</p>}
        </div>

        {/* Commande active */}
        <div style={{ marginTop: 20 }}>
          {active ? (
            <article className="p-card p-card-pad p-fade-up">
              <div className="p-spread" style={{ flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
                <div className="p-stack" style={{ gap: 8 }}>
                  <span className="p-eyebrow">Expédition prioritaire</span>
                  <span className="p-mono" style={{ fontSize: 26, fontWeight: 500 }}>
                    {active.trackingNumber}
                  </span>
                </div>
                <StatusPill
                  label={orderStatusMeta(active.status).label}
                  tone={orderStatusMeta(active.status).tone}
                  live={active.status === 'IN_TRANSIT'}
                />
              </div>

              <div className="p-track">
                {STEPS.map((step, index) => {
                  const current = STEP_INDEX[active.status] ?? 0;
                  const done = index < current;
                  const isCurrent = index === current;
                  return (
                    <div
                      key={step.status}
                      className={`p-track-step${done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
                    >
                      {step.label}
                    </div>
                  );
                })}
              </div>

              <div className="p-grid-3" style={{ marginTop: 24 }}>
                <div className="p-cell">
                  <span className="p-cell-label">Livreur</span>
                  {active.driver ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={active.driver.user.name} tone="accent" />
                      <span style={{ fontWeight: 700 }}>{active.driver.user.name}</span>
                    </span>
                  ) : (
                    <span className="p-body">Affectation en cours</span>
                  )}
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">Livraison prévue</span>
                  <span className="p-mono" style={{ fontWeight: 500, fontSize: 16 }}>
                    {active.estimatedDeliveryAt ? formatDate(active.estimatedDeliveryAt) : '—'}
                  </span>
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">Destination</span>
                  <span style={{ fontWeight: 600 }}>{active.deliveryAddress}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                <Link to={`/client/orders/${active.id}`} className="p-btn p-btn-primary">
                  Voir la carte & la timeline
                </Link>
                <Link to="/client/orders" className="p-btn p-btn-ghost">
                  Mes autres commandes
                </Link>
              </div>
            </article>
          ) : (
            <article className="p-card p-card-pad p-fade-up">
              <EmptyPanel
                title="Aucune expédition en cours"
                description="Toutes vos commandes précédentes ont été traitées ou vous n'avez pas encore d'expédition active."
                action={
                  <Link to="/client/orders" className="p-btn p-btn-primary p-btn-sm">
                    Créer une commande
                  </Link>
                }
              />
            </article>
          )}
        </div>

        {/* Dernières commandes & Dernières mises à jour de livraison */}
        <div className="p-grid-main" style={{ marginTop: 20 }}>
          {/* Dernières commandes */}
          <div className="p-card p-card-pad p-fade-up p-d2">
            <div className="p-spread" style={{ marginBottom: 18 }}>
              <div className="p-stack" style={{ gap: 6 }}>
                <span className="p-eyebrow">Récentes</span>
                <h2 className="p-h3">Dernières commandes</h2>
              </div>
              <Link to="/client/orders" className="p-small p-link">
                Tout voir →
              </Link>
            </div>

            {stats.loading && !stats.data ? (
              <Loader label="Chargement des commandes…" />
            ) : recent.length === 0 ? (
              <EmptyPanel title="Aucune commande" description="Vos livraisons apparaîtront ici." />
            ) : (
              <div className="p-stack" style={{ gap: 10 }}>
                {recent.map((order) => {
                  const meta = orderStatusMeta(order.status);
                  return (
                    <Link
                      key={order.id}
                      to={`/client/orders/${order.id}`}
                      className="p-spread"
                      style={{
                        border: '1px solid var(--p-line)',
                        borderRadius: 14,
                        padding: '13px 16px',
                        textDecoration: 'none',
                        color: 'inherit',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className="p-stack" style={{ gap: 4 }}>
                        <span className="p-mono" style={{ fontWeight: 600 }}>
                          {order.trackingNumber}
                        </span>
                        <span className="p-small" style={{ color: 'var(--p-text-muted)' }}>
                          {order.deliveryAddress}
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="p-small">{timeShort(order.updatedAt)}</span>
                        <StatusPill label={meta.label} tone={meta.tone} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dernières mises à jour */}
          <div className="p-card p-card-pad p-fade-up p-d3">
            <div className="p-stack" style={{ gap: 6, marginBottom: 18 }}>
              <span className="p-eyebrow">Activité</span>
              <h2 className="p-h3">Mises à jour de livraison</h2>
            </div>

            {stats.loading && !stats.data ? (
              <Loader label="Chargement du flux d'activité…" />
            ) : updates.length === 0 ? (
              <EmptyPanel title="Aucune mise à jour" description="Les changements de statut apparaîtront ici." />
            ) : (
              <div className="p-stack" style={{ gap: 12 }}>
                {updates.map((update) => {
                  const meta = orderStatusMeta(update.status);
                  return (
                    <Link
                      key={update.id}
                      to={`/client/orders/${update.orderId}`}
                      className="p-spread"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--p-surface-subtle, rgba(255,255,255,0.02))',
                        border: '1px solid var(--p-line)',
                        textDecoration: 'none',
                        color: 'inherit',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div className="p-stack" style={{ gap: 2 }}>
                        <span className="p-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                          {update.trackingNumber}
                        </span>
                        <span className="p-small" style={{ color: 'var(--p-text-muted)' }}>
                          {update.note ?? update.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="p-small">{timeShort(update.at)}</span>
                        <StatusPill label={meta.label} tone={meta.tone} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <p className="p-small" style={{ marginTop: 26, color: 'var(--p-text-muted)' }}>
          Compte client {customer?.name} ({customer?.email ?? '—'}) ·{' '}
          {customer?.activeOrder
            ? `Dernière activité ${formatDistanceFromNow(customer.activeOrder.updatedAt)}`
            : 'Synchronisé avec la base LogiSmart'}
        </p>
      </div>
    </section>
  );
}
