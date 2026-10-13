import { Link } from 'react-router-dom';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { formatDateOnly, formatNumber } from '../../lib/format';
import { candidateStatusMeta, jobStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, StatusPill, EmptyPanel } from '../shared/primitives';

interface JobRow {
  id: string;
  title: string;
  location: string | null;
  status: string;
  isDriverRole: boolean;
  createdAt: string;
  _count: { candidates: number };
}

interface CandidateRow {
  id: string;
  name: string;
  status: string;
  compatibilityScore: number | null;
  createdAt: string;
  jobOffer: { title: string; isDriverRole: boolean };
}

const PIPELINE: Array<{ status: string; label: string }> = [
  { status: 'RECEIVED', label: 'Reçus' },
  { status: 'SCREENING', label: 'Screening' },
  { status: 'SHORTLISTED', label: 'Présélection' },
  { status: 'INTERVIEW', label: 'Entretiens' },
  { status: 'HIRED', label: 'Embauchés' },
  { status: 'REJECTED', label: 'Écartés' },
];

export function CompanyRecruitmentPage() {
  const jobs = useApi<Paginated<JobRow>>('/api/jobs?limit=100');
  const candidates = useApi<Paginated<CandidateRow>>('/api/candidates?limit=100');

  if ((jobs.loading || candidates.loading) && (!jobs.data || !candidates.data)) {
    return <Loader label="Chargement du recrutement…" />;
  }
  if (jobs.error) return <ErrorPanel error={jobs.error} onRetry={jobs.refetch} />;
  if (candidates.error) return <ErrorPanel error={candidates.error} onRetry={candidates.refetch} />;

  const jobRows = jobs.data?.items ?? [];
  const candidateRows = candidates.data?.items ?? [];
  const openJobs = jobRows.filter((j) => j.status === 'PUBLISHED');
  const interviews = candidateRows.filter((c) => c.status === 'INTERVIEW').length;
  const hired = candidateRows.filter((c) => c.status === 'HIRED').length;

  const counts = PIPELINE.map((step) => ({
    ...step,
    count: candidateRows.filter((c) => c.status === step.status).length,
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  return (
    <>
      <section className="p-hero">
        <div className="p-container">
          <div className="p-hero-grid">
            <div className="p-stack p-fade-up" style={{ gap: 22 }}>
              <span className="p-eyebrow">Recruitment</span>
              <h1 className="p-display">
                Construisez votre
                <br />
                <span className="p-grad">équipe de livraison.</span>
              </h1>
              <p className="p-lead">
                Offres, candidats, scores IA et pipeline — tout le recrutement au même endroit.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/company/recruitment/jobs" className="p-btn p-btn-light">
                  Voir les offres
                </Link>
                <Link
                  to="/company/recruitment/candidates"
                  className="p-btn p-btn-ghost"
                  style={{ borderColor: '#3a3c40', color: '#fff' }}
                >
                  Candidats
                </Link>
              </div>
            </div>

            <div className="p-hero-panel p-stack p-fade-up p-d2" style={{ gap: 16 }}>
              <span className="p-eyebrow">Pipeline</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {[
                  { label: 'Offres ouvertes', value: openJobs.length },
                  { label: 'Candidats', value: candidateRows.length },
                  { label: 'Entretiens', value: interviews },
                  { label: 'Embauchés', value: hired },
                ].map((stat) => (
                  <div key={stat.label} className="p-stack" style={{ gap: 4 }}>
                    <span className="p-stat-label" style={{ fontSize: 10 }}>
                      {stat.label}
                    </span>
                    <span className="p-mono" style={{ fontSize: 30, fontWeight: 500 }}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="p-section-sm">
        <div className="p-container">
          <div className="p-grid-main">
            <div className="p-card p-card-pad p-fade-up">
              <div className="p-spread" style={{ marginBottom: 22 }}>
                <div className="p-stack" style={{ gap: 6 }}>
                  <span className="p-eyebrow">Pipeline</span>
                  <h2 className="p-h3">Candidats par étape</h2>
                </div>
                <Link to="/company/recruitment/candidates" className="p-small p-link">
                  Tout voir →
                </Link>
              </div>

              <div className="p-stack" style={{ gap: 16 }}>
                {counts.map((step) => (
                  <div key={step.status} className="p-stack" style={{ gap: 7 }}>
                    <div className="p-spread">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{step.label}</span>
                      <span className="p-mono" style={{ fontSize: 14 }}>
                        {step.count}
                      </span>
                    </div>
                    <div className={`p-progress${step.status === 'HIRED' ? ' p-progress-accent' : ''}`}>
                      <span style={{ width: `${(step.count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-stack" style={{ gap: 20 }}>
              <div className="p-card p-card-pad p-fade-up p-d2">
                <div className="p-spread" style={{ marginBottom: 16 }}>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span className="p-eyebrow">Offres</span>
                    <h2 className="p-h3">Postes publiés</h2>
                  </div>
                  <Link to="/company/recruitment/jobs" className="p-small p-link">
                    Gérer →
                  </Link>
                </div>
                {jobRows.length === 0 ? (
                  <EmptyPanel title="Aucune offre" description="Créez votre première offre." />
                ) : (
                  <div className="p-stack" style={{ gap: 10 }}>
                    {jobRows.slice(0, 4).map((job) => {
                      const meta = jobStatusMeta(job.status);
                      return (
                        <Link
                          key={job.id}
                          to={`/company/recruitment/jobs?job=${job.id}`}
                          className="p-spread"
                          style={{ border: '1px solid var(--p-line)', borderRadius: 14, padding: '13px 16px', textDecoration: 'none', color: 'inherit' }}
                        >
                          <span className="p-stack" style={{ gap: 3 }}>
                            <span style={{ fontWeight: 700 }}>{job.title}</span>
                            <span className="p-small">
                              {job.location ?? '—'} · {job._count.candidates} candidat(s)
                            </span>
                          </span>
                          <StatusPill label={meta.label} tone={meta.tone} />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-card p-card-pad p-fade-up p-d3">
                <div className="p-spread" style={{ marginBottom: 16 }}>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span className="p-eyebrow">Candidats</span>
                    <h2 className="p-h3">Dernières candidatures</h2>
                  </div>
                </div>
                {candidateRows.length === 0 ? (
                  <EmptyPanel title="Aucun candidat" />
                ) : (
                  <div className="p-stack" style={{ gap: 10 }}>
                    {candidateRows.slice(0, 5).map((candidate) => {
                      const meta = candidateStatusMeta(candidate.status);
                      return (
                        <Link
                          key={candidate.id}
                          to={`/company/recruitment/candidates/${candidate.id}`}
                          className="p-spread"
                          style={{ border: '1px solid var(--p-line)', borderRadius: 14, padding: '13px 16px', textDecoration: 'none', color: 'inherit' }}
                        >
                          <span className="p-stack" style={{ gap: 3 }}>
                            <span style={{ fontWeight: 700 }}>{candidate.name}</span>
                            <span className="p-small">
                              {candidate.jobOffer.title} · {formatDateOnly(candidate.createdAt)}
                            </span>
                          </span>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {candidate.compatibilityScore != null && (
                              <span className="p-mono" style={{ fontWeight: 600 }}>
                                {Math.round(candidate.compatibilityScore)}%
                              </span>
                            )}
                            <StatusPill label={meta.label} tone={meta.tone} />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="p-small" style={{ marginTop: 24 }}>
            {formatNumber(candidateRows.length)} candidats suivis · {formatNumber(jobRows.length)} offres au total.
          </p>
        </div>
      </section>
    </>
  );
}
