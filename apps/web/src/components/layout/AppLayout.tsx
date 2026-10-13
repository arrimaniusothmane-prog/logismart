import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getNavigation } from './nav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const TITLES: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/orders': 'Commandes',
  '/drivers': 'Livreurs',
  '/map': 'Carte temps réel',
  '/support': 'Conversations',
  '/knowledge': 'Base de connaissances',
  '/recruitment': 'Pipeline RH',
  '/recruitment/jobs': 'Offres d\'emploi',
  '/recruitment/candidates': 'Candidats',
  '/users': 'Utilisateurs',
  '/settings': 'Entreprise',
  '/customers': 'Clients',
  '/catalog': 'Services & produits',
  '/admin': 'Pilotage plateforme',
  '/admin/companies': 'Entreprises',
  '/driver/dashboard': 'Mes livraisons',
  '/driver/deliveries': 'Historique',
  '/driver/profile': 'Mon profil',
};

export function AppLayout() {
  const { user, company } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sections = useMemo(() => (user ? getNavigation(user.role) : []), [user]);

  const title = useMemo(() => {
    if (TITLES[location.pathname]) return TITLES[location.pathname]!;
    const match = sections
      .flatMap((s) => s.items)
      .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
    return match?.label ?? 'LogiSmart';
  }, [location.pathname, sections]);

  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  // Ferme le tiroir mobile si l'on repasse en desktop.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mq.matches && setSidebarOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="min-h-screen bg-surface-sunken">
      <Sidebar sections={sections} open={sidebarOpen} onClose={() => setSidebarOpen(false)} companyName={company?.name} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
