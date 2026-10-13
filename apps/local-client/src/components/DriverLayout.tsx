import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { roleLabel } from '../lib/status';

const NAV_ITEMS = [
  { to: '/driver/dashboard', label: 'Aujourd\'hui', icon: '📦' },
  { to: '/driver/deliveries', label: 'Historique', icon: '📋' },
  { to: '/driver/profile', label: 'Profil', icon: '👤' },
  { to: '/driver/settings', label: 'Paramètres', icon: '⚙️' },
];

export function DriverLayout() {
  const { user, company, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-surface-sunken">
      <nav className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            LS
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">LogiSmart</p>
            {company && <p className="truncate text-xs text-slate-500">{company.name}</p>}
          </div>
        </div>

        <ul className="flex-1 space-y-0.5 py-4">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={`${
                    active
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  } flex items-center gap-3 rounded-md mx-3 px-3 py-2 text-sm font-medium transition-colors`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{roleLabel(user?.role ?? '')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Se déconnecter
          </button>
        </div>
      </nav>

      <main className="flex-1 pb-16 lg:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
