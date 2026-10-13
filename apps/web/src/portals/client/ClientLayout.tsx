import { Outlet, useNavigate } from 'react-router-dom';
import { PortalShell } from '../shared/PortalShell';
import { Avatar } from '../shared/primitives';
import { useClientAuth } from './ClientAuthContext';
import { ChatWidget } from './ChatWidget';

/** Layout de l'espace client connecté (Tableau de bord → Commandes → …). */
export function ClientLayout() {
  const { customer, logout } = useClientAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/client', { replace: true });
  };

  return (
    <PortalShell
      home="/client/dashboard"
      links={[
        { to: '/client/dashboard', label: 'Tableau de bord', end: true },
        { to: '/client/orders', label: 'Commandes' },
        {
          to: '/client/notifications',
          label: 'Notifications',
          badge: customer?.notificationsUnread ?? 0,
        },
        { to: '/client/support', label: 'Aide' },
        { to: '/client/profile', label: 'Profil' },
      ]}
      actions={
        <>
          <span className="p-spread" style={{ gap: 10 }}>
            <Avatar name={customer?.name} tone="accent" />
            <span style={{ fontWeight: 700, fontSize: 14 }} className="p-nav-name">
              {customer?.name ?? ''}
            </span>
          </span>
          <button
            type="button"
            className="p-btn p-btn-ghost p-btn-sm"
            onClick={() => void handleLogout()}
          >
            Déconnexion
          </button>
        </>
      }
      footer={
        <div className="p-spread" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="p-small">LogiSmart · {customer?.company.name ?? 'Votre transporteur'}</span>
          <span className="p-small">Support 7j/7 depuis l'assistant</span>
        </div>
      }
    >
      <Outlet />
      <ChatWidget />
    </PortalShell>
  );
}
