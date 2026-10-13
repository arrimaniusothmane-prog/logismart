import { ModulePlaceholder } from '../../components/ModulePlaceholder';

const ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3.5 21l1.6-5A8.5 8.5 0 1 1 21 12Z" />
  </svg>
);

export function SupportPage() {
  return (
    <ModulePlaceholder
      title="Conversations support"
      phase="Phase 5"
      description="Toutes les conversations clients, réponses du chatbot IA et escalade vers un agent humain."
      icon={ICON}
      ready={[
        'Modèles ChatSession, ChatMessage et SupportEscalation en base',
        'Endpoints conversationnels prévus dans la spécification API',
        'Widget de chat non intrusif planifié (config WIDGET_POSITION)',
      ]}
      todo={[
        'Boîte de réception unifiée avec filtres (ouvertes, escaladées, résolues)',
        'Fenêtre de conversation avec historique',
        'Reprise par un humain et changement de statut',
        'Statistiques de résolution',
      ]}
    />
  );
}
