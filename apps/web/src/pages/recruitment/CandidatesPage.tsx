import { ModulePlaceholder } from '../../components/ModulePlaceholder';

const ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="9" cy="8" r="3.2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 19a6 6 0 0 1 12 0M16.5 11.5a3 3 0 0 0 0-6M17 19a5.5 5.5 0 0 0-2-4.3" />
  </svg>
);

export function CandidatesPage() {
  return (
    <ModulePlaceholder
      title="Candidats"
      phase="Phase 8"
      description="Dépôt des CV, analyse automatique, scoring sur 100 et comparaison des profils."
      icon={ICON}
      ready={[
        'Modèle Candidate avec score, résumé IA et note humaine',
        'Stockage du fichier CV (STORAGE_DIR, 10 Mo max par fichier)',
        'Compétences structurées dans CandidateSkill',
      ]}
      todo={[
        'Inbox des nouvelles candidatures',
        'Analyse IA du CV : score, points forts, risques, questions suggérées',
        'Comparaison côte à côte de deux candidats',
        'Décision motivée (shortlist / rejet) tracée',
      ]}
    />
  );
}
