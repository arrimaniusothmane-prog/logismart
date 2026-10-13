import { Link } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { formatDate, formatNumber, formatPercent } from '../../lib/format';
import { Loader, ErrorPanel, SectionHead, StatusPill, timeShort, Avatar } from '../shared/primitives';
import { LiveMap, type MapPoint } from '../shared/LiveMap';

interface Overview {
  today: {
    total: number;
    delivered: number;
    inTransit: number;
    delayed: number;
    failed: number;
    byStatus: Record<string, number>;
  };
  totals: { orders: number; customers: number; drivers: number; driversOnline: number };
  performance: {
    successRate: number | null;
    avgDeliveryMinutes: number | null;
    deliveredTrend: Array<{ date: string; count: number }>;
  };
  activity: Array<{
    id: string;
    at: string;
    status: string;
    label: string;
    trackingNumber: string;
    orderId: string;
  }>;
  live: Array<{
    id: string;
    trackingNumber: string;
    statusLabel: string;
    deliveryAddress: string;
    customerName: string;
    estimatedDeliveryAt: string | null;
    updatedAt: string;
    driver: {
      id: string;
      name: string;
      vehicleType: string;
      latitude: number | null;
      longitude: number | null;
      locationAt: string | null;
    } | null;
  }>;
}

function trendBars(trend: Array<{ date: string; count: number }>) {
  const max = Math.max(1, ...trend.map((t) => t.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 96, marginTop: 18 }}>
      {trend.map((t) => (
        <div key={t.date} className="p-stack" style={{ flex: 1, alignItems: 'center', gap: 8 }} title={`${t.date} : ${t.count}`}>
          <div
            style={{
              width: '100%',
              height: `${Math.max(6, (t.count / max) * 76)}px`,
              borderRadius: 8,
              background: t.count > 0 ? 'var(--p-ink)' : 'var(--p-line)',
              transition: 'height 0.6s cubic-bezier(0.2,0.7,0.3,1)',
            }}
          />
          <span className="p-stat-label" style={{ fontSize: 9.5 }}>
            {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CompanyOverviewPage() {
  const { data, loading, error, refetch } = useApi<Overview>('/api/stats/overview');

  if (loading && !data) return <Loader label="Chargement de l'activité…" />;
  if (error) return <ErrorPanel error={error} onRetry={refetch} />;
  if (!data) return null;

  const mapPoints: MapPoint[] = data.live.flatMap((order) => {
    const points: MapPoint[] = [];
    if (order.driver?.latitude != null && order.driver.longitude != null) {
      points.push({
        lat: order.driver.latitude,
        lng: order.driver.longitude,
        kind: 'driver',
        label: `${order.driver.name} · ${order.trackingNumber}`,
      });
    }
    return points;
  });

  const avgLabel =
    data.performance.avgDeliveryMinutes == null
      ? '—'
      : data.performance.avgDeliveryMinutes >= 60
        ? `${(data.performance.avgDeliveryMinutes / 60).toFixed(1)} h`
        : `${Math.round(data.performance.avgDeliveryMinutes)} min`;

  return (
    <>
      {/* HERO */}
      <section className="p-hero">
        <div className="p-container">
          <div className="p-hero-grid">
            <div className="p-stack p-fade-up" style={{ gap: 22 }}>
              <span className="p-eyebrow">Company · activité en direct</span>
              <h1 className="p-display">
                Tout bouge.
                <br />
                <span className="p-grad">Une plateforme intelligente.</span>
              </h1>
              <p className="p-lead">
                Gérez vos livraisons, livreurs, clients et recrutements depuis un seul endroit.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/company/orders" className="p-btn p-btn-light">
                  Voir les commandes
                </Link>
                <Link to="/company/recruitment" className="p-btn p-btn-ghost" style={{ borderColor: '#3a3c40', color: '#fff' }}>
                  Recrutement
                </Link>
              </div>
            </div>

            <div className="p-hero-panel p-stack p-fade-up p-d2" style={{ gap: 16 }}>
              <div className="p-spread">
                <span className="p-eyebrow">Aujourd'hui</span>
                <StatusPill label={`${data.totals.driversOnline} livreurs en ligne`} tone="success" live />
              </div>
              <div className="p-stat-value" style={{ fontSize: 'clamp(56px, 8vw, 92px)' }}>
                {data.today.total}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Livrées', value: data.today.delivered },
                  { label: 'En transit', value: data.today.inTransit },
                  { label: 'En retard', value: data.today.delayed },
                ].map((item) => (
                  <div key={item.label} className="p-stack" style={{ gap: 4 }}>
                    <span className="p-stat-label" style={{ fontSize: 10 }}>
                      {item.label}
                    </span>
                    <span className="p-mono" style={{ fontSize: 26, fontWeight: 500 }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="p-section-sm">
        <div className="p-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
            {[
              { label: 'Commandes totales', value: formatNumber(data.totals.orders) },
              { label: 'Clients', value: formatNumber(data.totals.customers) },
              { label: 'Livreurs', value: formatNumber(data.totals.drivers) },
              { label: 'Taux de réussite', value: data.performance.successRate == null ? '—' : formatPercent(data.performance.successRate) },
            ].map((stat, i) => (
              <div key={stat.label} className={`p-card p-card-pad p-fade-up p-d${i + 1}`}>
                <div className="p-stack" style={{ gap: 10 }}>
                  <span className="p-stat-label">{stat.label}</span>
                  <span className="p-stat-value-sm">{stat.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE + PERFORMANCE + ACTIVITÉ */}
      <section className="p-section-sm">
        <div className="p-container">
          <div className="p-grid-main">
            <div className="p-stack" style={{ gap: 20 }}>
              <div className="p-card p-card-pad p-fade-up">
                <div className="p-spread" style={{ marginBottom: 18 }}>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span className="p-eyebrow">Live delivery</span>
                    <h2 className="p-h3">Livraisons en cours</h2>
                  </div>
                  <Link to="/company/orders" className="p-small p-link">
                    Tout voir →
                  </Link>
                </div>

                {mapPoints.length > 0 ? (
                  <LiveMap points={mapPoints} height={320} caption={`${data.live.length} livraisons en cours`} />
                ) : (
                  <div className="p-empty" style={{ padding: 44 }}>
                    <p className="p-body">Aucune livraison en cours de route.</p>
                  </div>
                )}

                <div className="p-rowlist" style={{ marginTop: 18, borderTop: 'none' }}>
                  {data.live.slice(0, 4).map((order) => (
                    <Link key={order.id} to={`/company/orders/${order.id}`} className="p-row" style={{ gridTemplateColumns: '1.2fr 1fr auto' }}>
                      <div className="p-stack" style={{ gap: 3 }}>
                        <span className="p-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                          {order.trackingNumber}
                        </span>
                        <span className="p-small">{order.customerName}</span>
                      </div>
                      <span className="p-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.deliveryAddress}
                      </span>
                      <StatusPill label={order.statusLabel} tone="accent" live />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="p-card p-card-pad p-fade-up p-d2">
                <div className="p-spread" style={{ marginBottom: 6 }}>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span className="p-eyebrow">Performance</span>
                    <h2 className="p-h3">Livraisons réussies · 30 jours</h2>
                  </div>
                  <span className="p-stat-value-sm">
                    {data.performance.successRate == null ? '—' : formatPercent(data.performance.successRate)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap', marginTop: 14 }}>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span className="p-stat-label">Durée moyenne</span>
                    <span className="p-stat-value-sm">{avgLabel}</span>
                  </div>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span className="p-stat-label">Livrées aujourd'hui</span>
                    <span className="p-stat-value-sm">{data.today.delivered}</span>
                  </div>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span className="p-stat-label">En retard</span>
                    <span className="p-stat-value-sm">{data.today.delayed}</span>
                  </div>
                </div>
                {trendBars(data.performance.deliveredTrend)}
              </div>
            </div>

            <div className="p-card p-card-pad p-fade-up p-d3" style={{ alignSelf: 'start' }}>
              <SectionHead eyebrow="Activity" title="Activité récente" />
              {data.activity.length === 0 ? (
                <p className="p-body">Aucun événement récent.</p>
              ) : (
                <div className="p-timeline">
                  {data.activity.slice(0, 8).map((event) => (
                    <div key={event.id} className="p-timeline-item is-done">
                      <div className="p-timeline-rail">
                        <span className="p-timeline-node" />
                        <span className="p-timeline-line" />
                      </div>
                      <div className="p-stack" style={{ gap: 3 }}>
                        <span className="p-mono p-small" style={{ fontSize: 12 }}>
                          {timeShort(event.at)} · {formatDate(event.at).split(' ')[0]}
                        </span>
                        <Link to={`/company/orders/${event.orderId}`} className="p-link" style={{ fontWeight: 600, fontSize: 14.5 }}>
                          #{event.trackingNumber} — {event.label}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Chiffres clés secondaires */}
      <section className="p-section-sm" style={{ paddingBottom: 'clamp(48px, 7vw, 90px)' }}>
        <div className="p-container">
          <div className="p-card p-card-dark p-card-pad p-fade-up">
            <div className="p-hero-grid" style={{ alignItems: 'center' }}>
              <div className="p-stack" style={{ gap: 12 }}>
                <span className="p-eyebrow">Réseau</span>
                <h2 className="p-h2" style={{ color: '#fff' }}>
                  {data.totals.driversOnline} livreurs actifs sur {data.totals.drivers}
                </h2>
                <p className="p-lead">
                  {data.totals.orders} commandes au total · {data.totals.customers} clients suivis.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  <Link to="/company/drivers" className="p-btn p-btn-light p-btn-sm">
                    Équipe livreurs
                  </Link>
                  <Link to="/company/customers" className="p-btn p-btn-ghost p-btn-sm" style={{ borderColor: '#3a3c40', color: '#fff' }}>
                    Clients
                  </Link>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {data.live.slice(0, 3).map((order) =>
                  order.driver ? (
                    <div key={order.id} className="p-hero-panel p-stack" style={{ gap: 10, minWidth: 180, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={order.driver.name} />
                        <div className="p-stack" style={{ gap: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{order.driver.name}</span>
                          <span className="p-small">{order.driver.vehicleType}</span>
                        </div>
                      </div>
                      <span className="p-mono" style={{ fontSize: 12, color: '#9b9ea3' }}>
                        {order.trackingNumber}
                      </span>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
