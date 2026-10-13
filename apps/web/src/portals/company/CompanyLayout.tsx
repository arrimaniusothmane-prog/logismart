import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PortalShell, type PortalLink } from '../shared/PortalShell';
import { Avatar } from '../shared/primitives';

const LINKS: PortalLink[] = [
  { to: '/company', label: 'Overview', end: true },
  { to: '/company/orders', label: 'Orders' },
  { to: '/company/drivers', label: 'Drivers' },
  { to: '/company/customers', label: 'Customers' },
  { to: '/company/recruitment', label: 'Recruitment' },
  { to: '/company/support', label: 'Support' },
];

export function CompanyLayout() {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <PortalShell
      home="/company"
      links={LINKS}
      actions={
        <div className="p-nav-actions" style={{ gap: 12 }}>
          <span
            className="p-small"
            style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={company?.name ?? ''}
          >
            {company?.name}
          </span>
          <Avatar name={user?.name} />
          <button type="button" className="p-btn p-btn-ghost p-btn-sm" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      }
      footer={
        <div className="p-spread" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="p-small">© LogiSmart — Espace entreprise</span>
          <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/client" className="p-small p-link">
              Portail client
            </Link>
            <span className="p-small p-mono">{user?.email}</span>
          </span>
        </div>
      }
    >
      <div className="p-page-enter">
        <Outlet />
      </div>
    </PortalShell>
  );
}
