import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { qs } from '../../lib/api';
import { formatDateOnly } from '../../lib/format';
import { candidateStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, EmptyPanel, Avatar } from '../shared/primitives';

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  status: string;
  compatibilityScore: number | null;
  createdAt: string;
  jobOffer: { id: string; title: string; isDriverRole: boolean; location: string | null };
  _count: { skills: number; questions: number };
}

const STATUS_TABS = [
  { value: '', label: 'Tous' },
  { value: 'RECEIVED', label: 'Reçus' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'SHORTLISTED', label: 'Présélection' },
  { value: 'INTERVIEW', label: 'Entretiens' },
  { value: 'HIRED', label: 'Embauchés' },
  { value: 'REJECTED', label: 'Écartés' },
];

function matchLabel(score: number | null): { label: string; tone: string } {
  if (score == null) return { label: 'Non évalué', tone: '' };
  if (score >= 85) return { label: 'Strong match', tone: 'p-pill-ok' };
  if (score >= 70) return { label: 'Bon match', tone: 'p-pill-accent' };
  if (score >= 50) return { label: 'Match moyen', tone: 'p-pill-warn' };
  return { label: 'Match faible', tone: 'p-pill-danger' };
}

const PAGE_SIZE = 12;

export function CompanyCandidatesPage() {
  const [params] = useSearchParams();
  const jobFilter = params.get('job') ?? '';
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    jobOfferId: jobFilter || undefined,
    search: search.trim() || undefined,
  });

  const candidates = useApi<Paginated<CandidateRow>>(`/api/candidates${query}`, [query, jobFilter]);
  const rows = candidates.data?.items ?? [];
  const total = candidates.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Recruitment · candidates"
          title="Candidats"
          lead="Chaque candidature avec son score IA, son statut de pipeline et ses compétences."
          actions={
            jobFilter ? (
              <Link to="/company/recruitment/candidates" className="p-btn p-btn-ghost p-btn-sm">
                Toutes les offres
              </Link>
            ) : undefined
          }
        />

        <div className="p-spread" style={{ margin: '34px 0 22px' }}>
          <div className="p-tabs" role="tablist" aria-label="Filtrer par statut">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                className={`p-tab${status === tab.value ? ' is-active' : ''}`}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-field" style={{ minWidth: 'min(280px, 100%)' }}>
            <input
              className="p-input"
              type="search"
              placeholder="Rechercher un candidat…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Rechercher un candidat"
            />
          </div>
        </div>

        {candidates.loading && !candidates.data ? (
          <Loader label="Chargement des candidats…" />
        ) : candidates.error ? (
          <ErrorPanel error={candidates.error} onRetry={candidates.refetch} />
        ) : rows.length === 0 ? (
          <EmptyPanel title="Aucun candidat" description="Aucune candidature pour ces filtres." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 18 }}>
            {rows.map((candidate, index) => {
              const meta = candidateStatusMeta(candidate.status);
              const match = matchLabel(candidate.compatibilityScore);
              return (
                <Link
                  key={candidate.id}
                  to={`/company/recruitment/candidates/${candidate.id}`}
                  className={`p-card p-card-pad p-card-hover p-fade-up p-d${Math.min(index % 6, 5) + 1}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div className="p-spread">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                      <Avatar name={candidate.name} large />
                      <div className="p-stack" style={{ gap: 4 }}>
                        <span className="p-h3">{candidate.name}</span>
                        <span className="p-small">{candidate.jobOffer.title}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-spread" style={{ alignItems: 'flex-end' }}>
                    <div className="p-stack" style={{ gap: 4 }}>
                      <span className="p-stat-label">AI match</span>
                      <span className="p-stat-value-sm" style={{ fontSize: 34 }}>
                        {candidate.compatibilityScore == null ? '—' : `${Math.round(candidate.compatibilityScore)}%`}
                      </span>
                    </div>
                    <span className={`p-pill ${match.tone}`}>{match.label}</span>
                  </div>

                  <div className="p-progress p-progress-accent">
                    <span style={{ width: `${candidate.compatibilityScore ?? 0}%` }} />
                  </div>

                  <div className="p-spread" style={{ marginTop: 'auto' }}>
                    <StatusPill label={meta.label} tone={meta.tone} />
                    <span className="p-small">{formatDateOnly(candidate.createdAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="p-spread" style={{ marginTop: 24 }}>
            <span className="p-small">
              {total} candidats · page {page} / {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="p-btn p-btn-ghost p-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </button>
              <button type="button" className="p-btn p-btn-ghost p-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
