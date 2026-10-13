import { ModulePlaceholder } from '../../components/ModulePlaceholder';

const ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" />
  </svg>
);

export function RecruitmentPage() {
  return (
    <ModulePlaceholder
      title="Pipeline de recrutement"
      phase="Phase 7"
      description="Vue d'ensemble des candidatures : dépôt, tri, score IA, entretiens et décisions."
      icon={ICON}
      ready={[
        'Modèles JobOffer, Candidate, CandidateSkill et InterviewQuestion en base',
        'Statuts de candidature partagés (reçu → screening → shortlist → entretien → embauché)',
        'Questions d\'entretien générées en brouillon par le seed (marquées démo)',
      ]}
      todo={[
        'Pipeline kanban par statut',
        'Vue détail d\'un candidat (CV, score, notes)',
        'Planification d\'entretien',
        'Actions groupées et rejet motivé',
      ]}
    />
  );
}
