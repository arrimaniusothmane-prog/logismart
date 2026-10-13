import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { formatDateOnly } from '../../lib/format';
import { candidateStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, Avatar, EmptyPanel } from '../shared/primitives';
import { PModal } from '../shared/PModal';

interface CandidateDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cvUrl: string | null;
  note: string | null;
  status: string;
  compatibilityScore: number | null;
  scoreBreakdown: Record<string, unknown> | null;
  aiSummary: string | null;
  sourceFileName: string | null;
  createdAt: string;
  jobOffer: { id: string; title: string; isDriverRole: boolean; location: string | null; status: string };
  skills: Array<{ id: string; skill: string; level: string; score: number | null }>;
  questions: Array<{ id: string; question: string; category: string }>;
  hiredUser: { id: string; name: string; email: string; role: string; status: string } | null;
}

const ACTIONS = [
  { status: 'SHORTLISTED', label: 'Présélectionner' },
  { status: 'INTERVIEW', label: 'Passer à l’entretien' },
  { status: 'REJECTED', label: 'Écarter' },
] as const;

export function CompanyCandidateDetailPage() {
  const { id = '' } = useParams();
  const candidate = useApi<CandidateDetail>(`/api/candidates/${id}`, [id]);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hired, setHired] = useState<{ password: string; name: string } | null>(null);

  const data = candidate.data;

  const patchStatus = async (status: string) => {
    setBusy(status);
    setActionError(null);
    try {
      await api.patch(`/api/candidates/${id}`, { status });
      candidate.refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(null);
    }
  };

  const hire = async () => {
    setBusy('HIRED');
    setActionError(null);
    try {
      const result = await api.post<{ candidate: CandidateDetail; temporaryPassword: string }>(
        `/api/candidates/${id}/hire`,
      );
      setHired({ password: result.temporaryPassword, name: result.candidate.name });
      candidate.refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(null);
    }
  };

  if (candidate.loading && !data) return <Loader label="Chargement du candidat…" />;
  if (candidate.error) return <ErrorPanel error={candidate.error} onRetry={candidate.refetch} />;
  if (!data) return null;

  const meta = candidateStatusMeta(data.status);
  const score = data.compatibilityScore;
  const breakdown =
    data.scoreBreakdown && typeof data.scoreBreakdown === 'object'
      ? Object.entries(data.scoreBreakdown as Record<string, unknown>).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number',
        )
      : [];

  return (
    <section className="p-section">
      <div className="p-container">
        <Link to="/company/recruitment/candidates" className="p-small p-link" style={{ display: 'inline-block', marginBottom: 22 }}>
          ← Tous les candidats
        </Link>

        <PageHeader
          eyebrow={`${data.jobOffer.title} · postulé le ${formatDateOnly(data.createdAt)}`}
          title={data.name}
          lead={data.email}
          actions={<StatusPill label={meta.label} tone={meta.tone} live={data.status === 'INTERVIEW'} />}
        />

        {actionError && (
          <div className="p-card p-card-pad" style={{ marginTop: 20, borderColor: 'var(--p-danger)' }}>
            <p className="p-body" style={{ color: 'var(--p-danger)' }}>
              {actionError}
            </p>
          </div>
        )}

        <div className="p-grid-main" style={{ marginTop: 30 }}>
          <div className="p-stack" style={{ gap: 20 }}>
            <div className="p-card p-card-pad p-fade-up">
              <div className="p-spread" style={{ marginBottom: 16 }}>
                <div className="p-stack" style={{ gap: 6 }}>
                  <span className="p-eyebrow">Profil</span>
                  <h2 className="p-h3">Candidate profile</h2>
                </div>
                <Avatar name={data.name} large />
              </div>

              <div className="p-stack" style={{ gap: 16 }}>
                <div className="p-spread">
                  <span className="p-small">E-mail</span>
                  <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{data.email}</span>
                </div>
                <div className="p-spread">
                  <span className="p-small">Téléphone</span>
                  <span style={{ fontWeight: 600 }}>{data.phone ?? '—'}</span>
                </div>
                <div className="p-spread">
                  <span className="p-small">Localisation du poste</span>
                  <span style={{ fontWeight: 600 }}>{data.jobOffer.location ?? '—'}</span>
                </div>
                <div className="p-spread">
                  <span className="p-small">CV</span>
                  {data.cvUrl ? (
                    <a className="p-btn p-btn-ghost p-btn-sm" href={data.cvUrl} target="_blank" rel="noreferrer">
                      Ouvrir le CV
                    </a>
                  ) : (
                    <span className="p-small">{data.sourceFileName ?? 'Aucun fichier'}</span>
                  )}
                </div>
                {data.note && (
                  <div className="p-cell">
                    <span className="p-cell-label">Note</span>
                    <p className="p-body">{data.note}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-card p-card-pad p-fade-up p-d2">
              <span className="p-eyebrow">AI summary</span>
              <h2 className="p-h3" style={{ margin: '6px 0 14px' }}>
                Synthèse IA
              </h2>
              {data.aiSummary ? (
                <p className="p-body">{data.aiSummary}</p>
              ) : (
                <EmptyPanel title="Pas encore de synthèse" description="Elle sera générée lors de l'analyse du CV." />
              )}
            </div>

            <div className="p-card p-card-pad p-fade-up p-d3">
              <span className="p-eyebrow">Skills</span>
              <h2 className="p-h3" style={{ margin: '6px 0 16px' }}>
                Compétences
              </h2>
              {data.skills.length === 0 ? (
                <p className="p-body">Aucune compétence extraite.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {data.skills.map((skill) => (
                    <span key={skill.id} className="p-pill">
                      {skill.skill}
                      {skill.level ? ` · ${skill.level}` : ''}
                      {skill.score != null ? ` · ${skill.score}%` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-card p-card-pad p-fade-up p-d4">
              <span className="p-eyebrow">Interview</span>
              <h2 className="p-h3" style={{ margin: '6px 0 16px' }}>
                Questions d'entretien
              </h2>
              {data.questions.length === 0 ? (
                <p className="p-body">Aucune question générée.</p>
              ) : (
                <ol className="p-stack" style={{ gap: 14, paddingLeft: 18 }}>
                  {data.questions.map((question) => (
                    <li key={question.id} className="p-stack" style={{ gap: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 14.5 }}>{question.question}</span>
                      <span className="p-eyebrow">{question.category}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="p-stack" style={{ gap: 20 }}>
            <div className="p-card p-card-dark p-card-pad p-fade-up p-d2">
              <div className="p-stack" style={{ gap: 14 }}>
                <span className="p-eyebrow">AI match score</span>
                <span className="p-stat-value" style={{ color: '#fff' }}>
                  {score == null ? '—' : `${Math.round(score)}%`}
                </span>
                <span className="p-pill p-pill-accent" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                  {score == null ? 'Non évalué' : score >= 85 ? 'Strong match' : score >= 70 ? 'Bon match' : score >= 50 ? 'Match moyen' : 'Match faible'}
                </span>

                {breakdown.length > 0 && (
                  <div className="p-stack" style={{ gap: 12, marginTop: 8 }}>
                    {breakdown.map(([key, value]) => (
                      <div key={key} className="p-stack" style={{ gap: 6 }}>
                        <div className="p-spread">
                          <span className="p-small" style={{ color: '#9b9ea3' }}>
                            {key}
                          </span>
                          <span className="p-mono" style={{ fontSize: 12.5 }}>
                            {Math.round(value)}%
                          </span>
                        </div>
                        <div className="p-progress" style={{ background: 'rgba(255,255,255,0.14)' }}>
                          <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: '#8b83ff' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-card p-card-pad p-fade-up p-d3">
              <span className="p-eyebrow">Pipeline</span>
              <h2 className="p-h3" style={{ margin: '6px 0 16px' }}>
                Actions
              </h2>

              {data.status === 'HIRED' ? (
                <div className="p-stack" style={{ gap: 10 }}>
                  <p className="p-body">Ce candidat a été embauché.</p>
                  {data.hiredUser && (
                    <div className="p-spread" style={{ border: '1px solid var(--p-line)', borderRadius: 14, padding: '12px 15px' }}>
                      <span style={{ fontWeight: 700 }}>{data.hiredUser.name}</span>
                      <span className="p-small">{data.hiredUser.email}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-stack" style={{ gap: 10 }}>
                  {ACTIONS.map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      className="p-btn p-btn-ghost p-btn-block"
                      disabled={busy !== null}
                      onClick={() => patchStatus(action.status)}
                    >
                      {busy === action.status ? 'En cours…' : action.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="p-btn p-btn-accent p-btn-block"
                    disabled={busy !== null}
                    onClick={hire}
                  >
                    {busy === 'HIRED' ? 'Création du compte…' : 'Embaucher'}
                  </button>
                  <p className="p-small">
                    L'embauche crée un compte {data.jobOffer.isDriverRole ? 'livreur (DRIVER)' : 'dispatch'} et
                    attribue le mot de passe temporaire.
                  </p>
                </div>
              )}
            </div>

            <div className="p-card p-card-pad p-fade-up p-d4">
              <span className="p-eyebrow">Offre</span>
              <div className="p-stack" style={{ gap: 8, marginTop: 10 }}>
                <span style={{ fontWeight: 700 }}>{data.jobOffer.title}</span>
                <span className="p-small">{data.jobOffer.location ?? '—'}</span>
                <Link to={`/company/recruitment/jobs?job=${data.jobOffer.id}`} className="p-small p-link">
                  Voir l'offre →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PModal
        open={hired !== null}
        onClose={() => setHired(null)}
        eyebrow="Embauche réussie"
        title={`Compte créé pour ${hired?.name ?? ''}`}
        footer={
          <button type="button" className="p-btn p-btn-primary" onClick={() => setHired(null)}>
            J'ai noté le mot de passe
          </button>
        }
      >
        <p className="p-body">
          Ce mot de passe temporaire n'est affiché qu'une seule fois. Communiquez-le au candidat, il pourra le
          modifier après sa première connexion.
        </p>
        <div className="p-card p-card-pad p-mono" style={{ fontSize: 18, textAlign: 'center', background: 'var(--p-bg)' }}>
          {hired?.password}
        </div>
      </PModal>
    </section>
  );
}
