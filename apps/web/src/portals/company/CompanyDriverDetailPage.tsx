import { Link, useParams } from 'react-router-dom';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { formatDate, formatDistanceFromNow, formatNumber } from '../../lib/format';
import { availabilityMeta, orderStatusMeta, vehicleLabel } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, Avatar, EmptyPanel } from '../shared/primitives';
import { LiveMap, type MapPoint } from '../shared/LiveMap';

interface DriverDetail {
  id: string;
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
  lastLocation: { latitude: number; longitude: number; timestamp: string; speed: number | null } | null;
}

interface DriverOrder {
  id: string;
  trackingNumber: string;
  status: string;
  deliveryAddress: string;
  deliveredAt: string | null;
  estimatedDeliveryAt: string | null;
  createdAt: string;
  customer: { name: string };
}

export function CompanyDriverDetailPage() {
  const { id = '' } = useParams();
  const driver = useApi<DriverDetail>(`/api/drivers/${id}`, [id]);
  const orders = useApi<Paginated<DriverOrder>>(`/api/orders?driverId=${id}&limit=6`, [id]);

  if (driver.loading && !driver.data) return <Loader label="Chargement du profil…" />;
  if (driver.error) return <ErrorPanel error={driver.error} onRetry={driver.refetch} />;
  const data = driver.data;
  if (!data) return null;

  const meta = availabilityMeta(data.availability);
  const rate =
    data.totalDeliveries > 0 ? Math.round((data.successfulDeliveries / data.totalDeliveries) * 100) : null;

  const rows = orders.data?.items ?? [];
  const deliveredDurations = rows
    .filter((o) => o.status === 'DELIVERED' && o.deliveredAt)
    .map((o) => (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 60_000)
    .filter((m) => m >= 0 && m < 24 * 60);
  const avgMinutes =
    deliveredDurations.length > 0
      ? Math.round(deliveredDurations.reduce((s, v) => s + v, 0) / deliveredDurations.length)
      : null;

  const mapPoints: MapPoint[] =
    data.lastLocation != null
      ? [
          {
            lat: data.lastLocation.latitude,
            lng: data.lastLocation.longitude,
            kind: 'driver' as const,
            label: `${data.user.name} · ${formatDistanceFromNow(data.lastLocation.timestamp)}`,
          },
        ]
      : [];

  return (
    <section className="p-section">
      <div className="p-container">
        <Link to="/company/drivers" className="p-small p-link" style={{ display: 'inline-block', marginBottom: 22 }}>
          ← Tous les livreurs
        </Link>

        <PageHeader
          eyebrow={`Livreur · depuis ${formatDate(data.createdAt).split(' ').slice(1).join(' ')}`}
          title={data.user.name}
          lead={`${vehicleLabel(data.vehicleType)}${data.phone ? ` · ${data.phone}` : ''}`}
          actions={<StatusPill label={meta.label} tone={meta.tone} live={data.availability !== 'OFFLINE' && data.availability !== 'ON_LEAVE'} />}
        />

        <div className="p-grid-main" style={{ marginTop: 30 }}>
          <div className="p-stack" style={{ gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
              {[
                { label: 'Livraisons', value: formatNumber(data.totalDeliveries) },
                { label: 'Taux de réussite', value: rate == null ? '—' : `${rate} %` },
                { label: 'Délai moyen (récent)', value: avgMinutes == null ? '—' : `${avgMinutes} min` },
                {
                  label: 'Localisation',
                  value: data.lastLocation ? formatDistanceFromNow(data.lastLocation.timestamp) : '—',
                },
              ].map((stat) => (
                <div key={stat.label} className="p-card p-card-pad">
                  <div className="p-stack" style={{ gap: 10 }}>
                    <span className="p-stat-label">{stat.label}</span>
                    <span className="p-stat-value-sm">{stat.value}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-card p-card-pad">
              <div className="p-spread" style={{ marginBottom: 16 }}>
                <div className="p-stack" style={{ gap: 6 }}>
                  <span className="p-eyebrow">Live</span>
                  <h2 className="p-h3">Position courante</h2>
                </div>
                {data.lastLocation && (
                  <span className="p-small">Mise à jour {formatDistanceFromNow(data.lastLocation.timestamp)}</span>
                )}
              </div>
              <LiveMap points={mapPoints} height={300} caption={data.user.name} />
            </div>

            <div className="p-card p-card-pad">
              <div className="p-spread" style={{ marginBottom: 16 }}>
                <div className="p-stack" style={{ gap: 6 }}>
                  <span className="p-eyebrow">Historique</span>
                  <h2 className="p-h3">Livraisons récentes</h2>
                </div>
                <Link to={`/company/orders?driver=${data.id}`} className="p-small p-link">
                  Tout voir →
                </Link>
              </div>

              {orders.loading && !orders.data ? (
                <Loader />
              ) : rows.length === 0 ? (
                <EmptyPanel title="Aucune livraison" description="Aucune commande affectée pour l'instant." />
              ) : (
                <div className="p-rowlist" style={{ borderTop: 'none' }}>
                  {rows.map((order) => {
                    const statusMeta = orderStatusMeta(order.status);
                    return (
                      <Link key={order.id} to={`/company/orders/${order.id}`} className="p-row" style={{ gridTemplateColumns: '1.2fr 1fr auto auto' }}>
                        <span className="p-cell">
                          <span className="p-cell-label">Tracking</span>
                          <span className="p-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                            {order.trackingNumber}
                          </span>
                        </span>
                        <span className="p-cell">
                          <span className="p-cell-label">Client</span>
                          <span style={{ fontWeight: 600 }}>{order.customer.name}</span>
                        </span>
                        <StatusPill label={statusMeta.label} tone={statusMeta.tone} />
                        <span className="p-small">{formatDate(order.deliveredAt ?? order.createdAt).split(' ')[0]}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-card p-card-pad p-fade-up p-d2" style={{ alignSelf: 'start' }}>
            <div className="p-stack" style={{ alignItems: 'center', gap: 14, textAlign: 'center', padding: '10px 0' }}>
              <Avatar name={data.user.name} large />
              <div className="p-stack" style={{ gap: 4 }}>
                <span className="p-h3">{data.user.name}</span>
                <span className="p-small">{data.user.email}</span>
              </div>
              <StatusPill label={meta.label} tone={meta.tone} live={data.availability !== 'OFFLINE'} />
              <hr className="p-hairline" style={{ width: '100%' }} />
              <div className="p-stack" style={{ gap: 14, width: '100%', textAlign: 'left' }}>
                <div className="p-spread">
                  <span className="p-small">Véhicule</span>
                  <span style={{ fontWeight: 600 }}>{vehicleLabel(data.vehicleType)}</span>
                </div>
                <div className="p-spread">
                  <span className="p-small">Permis</span>
                  <span className="p-mono" style={{ fontSize: 13 }}>
                    {data.licenseNumber ?? '—'}
                  </span>
                </div>
                <div className="p-spread">
                  <span className="p-small">Commandes actives</span>
                  <span className="p-mono" style={{ fontSize: 13 }}>
                    {data._count.orders}
                  </span>
                </div>
                <div className="p-spread">
                  <span className="p-small">Membre depuis</span>
                  <span style={{ fontWeight: 600 }}>{formatDate(data.createdAt).split(' ')[1] ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
