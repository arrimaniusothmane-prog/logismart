import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

export interface PortalLink {
  to: string;
  label: string;
  end?: boolean;
  /** Compteur de badge (ex. notifications non lues). */
  badge?: number;
}

/**
 * Top navigation des portails (Company / Client).
 * Indépendante de la sidebar Admin : jamais partagée avec `/admin`.
 */
export function PortalShell({
  home,
  links,
  actions,
  children,
  footer,
}: {
  home: string;
  links: PortalLink[];
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="p-root">
      <nav className={`p-nav${scrolled ? ' is-scrolled' : ''}`} aria-label="Navigation principale">
        <div className="p-container">
          <div className="p-nav-inner">
            <Link to={home} className="p-brand" aria-label="LogiSmart — accueil">
              <span className="p-brand-mark" aria-hidden>
                <svg viewBox="0 0 32 32" fill="none">
                  <path d="M6 21h11l4-9h5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="25" r="2.6" fill="#fff" />
                  <circle cx="24" cy="25" r="2.6" fill="#fff" />
                </svg>
              </span>
              LogiSmart
            </Link>

            <div className="p-nav-links">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `p-nav-link${isActive ? ' is-active' : ''}`}
                >
                  {link.label}
                  {link.badge ? (
                    <span className="p-nav-badge" aria-label={`${link.badge} non lues`}>
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>

            <div className="p-nav-actions">
              {actions}
              <button
                type="button"
                className={`p-burger${open ? ' is-open' : ''}`}
                aria-expanded={open}
                aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
                onClick={() => setOpen((v) => !v)}
              >
                <span />
              </button>
            </div>
          </div>

          <div className={`p-mobile-menu${open ? ' is-open' : ''}`}>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `p-nav-link${isActive ? ' is-active' : ''}`}
              >
                {link.label}
                {link.badge ? (
                  <span className="p-nav-badge" aria-label={`${link.badge} non lues`}>
                    {link.badge > 99 ? '99+' : link.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main>{children}</main>

      {footer && (
        <footer style={{ borderTop: '1px solid var(--p-line)', paddingBlock: 26, marginTop: 'auto' }}>
          <div className="p-container">{footer}</div>
        </footer>
      )}
    </div>
  );
}
