import { ModulePlaceholder } from '../../components/ModulePlaceholder';

const ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4ZM9 4v13M15 6.5v13" />
  </svg>
);

export function MapPage() {
  return (
    <ModulePlaceholder
      title="Carte temps réel"
      phase="Phase 3"
      description="Position des livreurs en direct, planification des tournées et lecture des trajets sur carte."
      icon={ICON}
      ready={[
        'Table DriverLocation pour stocker la dernière position (lat/lng/heading)',
        'Événements Socket.IO prévus : livreur:position, commande:status',
        'Variables d\'environnement MAP_TILES_URL et MAP_ATTRIBUTION configurées',
      ]}
      todo={[
        'Carte Leaflet avec marqueurs par livreur',
        'Canal WebSocket de position (batterie : mise à jour toutes les 5 s)',
        'Tracé du trajet d\'une commande',
        'Mode planification de tournée (dispatch)',
      ]}
    />
  );
}
