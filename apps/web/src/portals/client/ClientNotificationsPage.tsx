import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { orderStatusMeta } from '../../lib/status';
import { PageHeader, Loader, ErrorPanel, StatusPill, EmptyPanel } from '../shared/primitives';
import { useClientAuth } from './ClientAuthContext';

interface Notification {
  id: string;
  orderId: string;
  trackingNumber: string | null;
  status: string;
  label: string;
  note: string | null;
  at: string;
  read: boolean;
}

function formatAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ClientNotificationsPage() {
  const { markNotificationsRead } = useClientAuth();
  const notifications = useApi<Notification[]>('/api/portal/notifications');
  const [marking, setMarking] = useState(false);

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read);

  const markAll = async () => {
    setMarking(true);
    try {
      await markNotificationsRead();
      notifications.refetch();
    } finally {
      setMarking(false);
    }
  };

  const renderList = (list: Notification[]) => (
    <div className="p-stack" style={{ gap: 12 }}>
      {list.map((notification, index) => {
        const meta = orderStatusMeta(notification.status);
        return (
          <Link
            key={notification.id}
            to={`/client/orders/${notification.orderId}`}
            className={`p-card p-card-pad p-card-hover p-fade-up p-d${Math.min(index % 6, 5) + 1}`}
            style={{
              display: 'flex',
              gap: 18,
              alignItems: 'center',
              flexWrap: 'wrap',
              textDecoration: 'none',
              color: 'inherit',
              ...(notification.read ? { opacity: 0.72 } : {}),
            }}
          >
            {!notification.read && (
              <span
                aria-label="Non lue"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: 'var(--p-accent)',
                  flex: 'none',
                }}
              />
            )}
            <StatusPill label={meta.label} tone={meta.tone} live={notification.status === 'IN_TRANSIT'} />
            <div className="p-stack" style={{ gap: 4, flex: '1 1 240px' }}>
              <span style={{ fontWeight: 700 }}>{notification.label}</span>
              {notification.note && <span className="p-small">{notification.note}</span>}
            </div>
            <div className="p-stack" style={{ gap: 4, alignItems: 'flex-end' }}>
              <span className="p-mono" style={{ fontSize: 13 }}>
                {notification.trackingNumber ?? '—'}
              </span>
              <span className="p-small">{formatAt(notification.at)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Notifications"
          title="Vos derniers événements"
          lead="Chaque changement de statut de vos commandes, du plus récent au plus ancien."
          actions={
            <>
              <button
                type="button"
                className="p-btn p-btn-ghost"
                onClick={() => void markAll()}
                disabled={marking || unread.length === 0}
              >
                {marking ? 'Enregistrement…' : 'Tout marquer comme lu'}
              </button>
              <Link to="/client/orders" className="p-btn p-btn-ghost">
                Mes commandes
              </Link>
            </>
          }
        />

        <div style={{ marginTop: 34 }}>
          {notifications.loading && !notifications.data ? (
            <Loader label="Chargement de vos notifications…" />
          ) : notifications.error ? (
            <ErrorPanel error={notifications.error} onRetry={notifications.refetch} />
          ) : items.length === 0 ? (
            <EmptyPanel
              title="Aucune notification"
              description="Les étapes de vos livraisons s'afficheront ici."
              action={
                <Link to="/client/register" className="p-btn p-btn-primary p-btn-sm">
                  Activer un numéro
                </Link>
              }
            />
          ) : (
            <div className="p-stack" style={{ gap: 26 }}>
              {unread.length > 0 && (
                <div className="p-stack" style={{ gap: 12 }}>
                  <div className="p-spread">
                    <span className="p-eyebrow">Non lues ({unread.length})</span>
                  </div>
                  {renderList(unread)}
                </div>
              )}

              {items.length > unread.length && (
                <div className="p-stack" style={{ gap: 12 }}>
                  <div className="p-spread">
                    <span className="p-eyebrow">Déjà consultées</span>
                  </div>
                  {renderList(items.filter((n) => n.read))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
