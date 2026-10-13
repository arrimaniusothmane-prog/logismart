import { NavLink } from 'react-router-dom';
import type { NavSection } from './nav';

export interface SidebarProps {
  sections: NavSection[];
  open: boolean;
  onClose: () => void;
  companyName?: string;
}

export function Sidebar({ sections, open, onClose, companyName }: SidebarProps) {
  return (
    <>
      {/* Fond mobile */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        aria-label="Navigation principale"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col bg-sidebar text-slate-300 transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            LS
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">LogiSmart</p>
            {companyName && <p className="truncate text-xs text-slate-400">{companyName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la navigation"
            className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.id} className="mb-5">
              {section.title && (
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                        }`
                      }
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">
          LogiSmart · v0.1.0
        </div>
      </aside>
    </>
  );
}
