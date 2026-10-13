import { ModulePlaceholder } from '../../components/ModulePlaceholder';

const ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" />
  </svg>
);

export function JobsPage() {
  return (
    <ModulePlaceholder
      title="Offres d'emploi"
      phase="Phase 7"
      description="Création et publication des offres, formulaire de candidature public et suivi des reçus."
      icon={ICON}
      ready={[
        'Modèle JobOffer en base (statuts brouillon / publiée / clôturée)',
        'Validation Zod du formulaire d\'offre côté partagé',
        'Seed de deux offres de démonstration clairement identifiées',
      ]}
      todo={[
        'Éditeur d\'offre avec aperçu de la page publique',
        'Formulaire de candidature public et dépôt de CV',
        'Publication / clôture avec contrôle de permission',
        'Statistiques par offre (candidatures, taux)',
      ]}
    />
  );
}
