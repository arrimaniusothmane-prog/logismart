import type { ReactNode } from 'react';
import { can, type Permission, type Role } from '@logismart/shared';

export interface NavItem {
  to: string;
  label: string;
  permission?: Permission;
  roles?: readonly Role[];
  /** Icône 24×24 (stroke). */
  icon: ReactNode;
  end?: boolean;
}

export interface NavSection {
  id: string;
  title?: string;
  items: NavItem[];
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Icon({ d }: { d: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" {...stroke}>
      {d}
    </svg>
  );
}

const icons = {
  dashboard: <Icon d={<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>} />,
  orders: <Icon d={<><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>} />,
  drivers: <Icon d={<><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>} />,
  map: <Icon d={<><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" /><path d="M9 4v13M15 6.5v13" /></>} />,
  support: <Icon d={<><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3.5 21l1.6-5A8.5 8.5 0 1 1 21 12Z" /></>} />,
  knowledge: <Icon d={<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" /></>} />,
  recruitment: <Icon d={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" /></>} />,
  users: <Icon d={<><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0M16.5 11.5a3 3 0 0 0 0-6M17 19a5.5 5.5 0 0 0-2-4.3" /></>} />,
  clients: <Icon d={<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 9h4M15 13h4" /></>} />,
  catalog: <Icon d={<><path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.4.6l7.5 7.5a2 2 0 0 1 0 2.8l-6.5 6.5a2 2 0 0 1-2.8 0L3.6 12.9a2 2 0 0 1-.6-1.4Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>} />,
  settings: <Icon d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>} />,
  deliveries: <Icon d={<><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></>} />,
  profile: <Icon d={<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>} />,
};

const ADMIN_SECTIONS: NavSection[] = [
  {
    id: 'pilotage',
    title: 'Pilotage',
    items: [{ to: '/dashboard', label: 'Tableau de bord', icon: icons.dashboard, end: true }],
  },
  {
    id: 'catalogue',
    title: 'Catalogue',
    items: [{ to: '/catalog', label: 'Services & produits', icon: icons.catalog, permission: 'catalog:read' }],
  },
  {
    id: 'logistique',
    title: 'Logistique',
    items: [
      { to: '/orders', label: 'Commandes', icon: icons.orders, permission: 'order:read' },
      { to: '/customers', label: 'Clients', icon: icons.clients, permission: 'customer:read' },
      { to: '/drivers', label: 'Livreurs', icon: icons.drivers, permission: 'driver:read' },
      { to: '/map', label: 'Carte temps réel', icon: icons.map, permission: 'map:read' },
    ],
  },
  {
    id: 'support',
    title: 'Support client',
    items: [
      { to: '/support', label: 'Conversations', icon: icons.support, permission: 'support:read' },
      { to: '/knowledge', label: 'Base de connaissances', icon: icons.knowledge, permission: 'knowledge:read' },
    ],
  },
  {
    id: 'recrutement',
    title: 'Recrutement',
    items: [
      { to: '/recruitment', label: 'Pipeline', icon: icons.recruitment, permission: 'candidate:read' },
      { to: '/recruitment/jobs', label: 'Offres', icon: icons.recruitment, permission: 'job:read' },
      { to: '/recruitment/candidates', label: 'Candidats', icon: icons.recruitment, permission: 'candidate:read' },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    items: [
      { to: '/users', label: 'Utilisateurs', icon: icons.users, permission: 'user:read' },
      { to: '/settings', label: 'Entreprise', icon: icons.settings, permission: 'company:read' },
    ],
  },
];

const DRIVER_SECTIONS: NavSection[] = [
  {
    id: 'livraisons',
    title: 'Mes livraisons',
    items: [
      { to: '/driver/dashboard', label: 'Aujourd\'hui', icon: icons.dashboard, end: true },
      { to: '/driver/deliveries', label: 'Toutes mes livraisons', icon: icons.deliveries },
      { to: '/driver/profile', label: 'Mon profil', icon: icons.profile },
    ],
  },
];

const PLATFORM_SECTIONS: NavSection[] = [
  {
    id: 'plateforme',
    title: 'Plateforme',
    items: [
      { to: '/admin', label: 'Tableau de bord', icon: icons.dashboard, permission: 'platform:stats', end: true },
      { to: '/admin/companies', label: 'Entreprises', icon: icons.settings, permission: 'platform:manage' },
    ],
  },
];

function allowed(item: NavItem, role: Role): boolean {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.permission && !can(role, item.permission)) return false;
  return true;
}

/** Navigation filtrée par les permissions du rôle connecté. */
export function getNavigation(role: Role): NavSection[] {
  const base = role === 'DRIVER' ? DRIVER_SECTIONS : role === 'SUPER_ADMIN' ? [...PLATFORM_SECTIONS, ...ADMIN_SECTIONS] : ADMIN_SECTIONS;
  return base
    .map((section) => ({ ...section, items: section.items.filter((item) => allowed(item, role)) }))
    .filter((section) => section.items.length > 0);
}

/** Route d'accueil propre à chaque rôle. */
export function homeRouteFor(role: Role): string {
  if (role === 'DRIVER') return '/driver/dashboard';
  if (role === 'SUPER_ADMIN') return '/admin';
  return '/dashboard';
}
