import { ModulePlaceholder } from '../../components/ModulePlaceholder';

const ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
  </svg>
);

export function KnowledgePage() {
  return (
    <ModulePlaceholder
      title="Base de connaissances"
      phase="Phase 6"
      description="Documents, FAQ et procédures indexés pour alimenter les réponses du support IA."
      icon={ICON}
      ready={[
        'Modèles KnowledgeDocument et KnowledgeChunk en base',
        'Upload de fichiers prévu (STORAGE_DIR, limits 25 Mo)',
        'Colonnes de métadonnées et de statut de traitement (PENDING → PROCESSING → READY)',
      ]}
      todo={[
        'Import de documents (PDF, DOCX, Markdown)',
        'Découpage en fragments et indexation vectorielle',
        'Recherche hybride (mot-clé + similarité cosinus)',
        'Écran d\'indexation avec état par document',
      ]}
    />
  );
}
