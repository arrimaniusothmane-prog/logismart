import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { roleLabel } from '../../lib/status';

export interface TopbarProps {
  onMenuClick: () => void;
  title: string;
}

export function Topbar({ onMenuClick, title }: TopbarProps) {
  const { user, company, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Ouvrir la navigation"
        aria-controls="app-sidebar"
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{title}</h1>
        {company && <p className="truncate text-xs text-slate-500">{company.name}</p>}
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-full p-1 transition hover:bg-slate-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials || '?'}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[10rem] truncate text-xs font-medium text-slate-900">{user?.name}</span>
            <span className="block text-[11px] text-slate-500">{user ? roleLabel(user.role) : ''}</span>
          </span>
          <svg viewBox="0 0 24 24" className="hidden h-4 w-4 text-slate-400 sm:block" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-pop"
          >
            <div className="border-b border-slate-100 px-4 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate(user?.role === 'DRIVER' ? '/driver/profile' : '/settings');
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {user?.role === 'DRIVER' ? 'Mon profil' : 'Paramètres'}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void logout().then(() => navigate('/login', { replace: true }));
              }}
              className="w-full border-t border-slate-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
