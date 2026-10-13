import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { formatDateOnly } from '../../lib/format';
import { jobStatusMeta } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, EmptyPanel } from '../shared/primitives';
import { PModal } from '../shared/PModal';

interface JobRow {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  location: string | null;
  isDriverRole: boolean;
  status: string;
  createdAt: string;
  _count: { candidates: number };
}

export function CompanyJobsPage() {
  const [params] = useSearchParams();
  const onlyJob = params.get('job');
  const jobs = useApi<Paginated<JobRow>>('/api/jobs?limit=100');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', isDriverRole: false, status: 'DRAFT' });
  const [formError, setFormError] = useState<string | null>(null);

  const rows = (jobs.data?.items ?? []).filter((job) => (onlyJob ? job.id === onlyJob : true));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/api/jobs', {
        title: form.title,
        description: form.description,
        location: form.location || undefined,
        isDriverRole: form.isDriverRole,
        status: form.status,
      });
      setOpen(false);
      setForm({ title: '', description: '', location: '', isDriverRole: false, status: 'DRAFT' });
      jobs.refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Recruitment · jobs"
          title="Offres d'emploi"
          lead="Publiez vos postes, suivez le nombre de candidats et ouvrez les pipelines associés."
          actions={
            <button type="button" className="p-btn p-btn-primary" onClick={() => setOpen(true)}>
              Nouvelle offre
            </button>
          }
        />

        {onlyJob && (
          <p style={{ marginTop: 20 }}>
            <Link to="/company/recruitment/jobs" className="p-small p-link">
              ← Voir toutes les offres
            </Link>
          </p>
        )}

        <div style={{ marginTop: 34 }}>
          {jobs.loading && !jobs.data ? (
            <Loader label="Chargement des offres…" />
          ) : jobs.error ? (
            <ErrorPanel error={jobs.error} onRetry={jobs.refetch} />
          ) : rows.length === 0 ? (
            <EmptyPanel
              title="Aucune offre"
              description="Publiez votre premier poste pour commencer à recevoir des candidatures."
              action={
                <button type="button" className="p-btn p-btn-primary p-btn-sm" onClick={() => setOpen(true)}>
                  Créer une offre
                </button>
              }
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
              {rows.map((job, index) => {
                const meta = jobStatusMeta(job.status);
                return (
                  <article
                    key={job.id}
                    className={`p-card p-card-pad p-card-hover p-fade-up p-d${Math.min(index % 6, 5) + 1}`}
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                  >
                    <div className="p-spread">
                      <span className={`p-pill ${job.isDriverRole ? 'p-pill-accent' : ''}`}>
                        {job.isDriverRole ? 'Delivery' : 'Poste'}
                      </span>
                      <StatusPill label={meta.label} tone={meta.tone} />
                    </div>

                    <div className="p-stack" style={{ gap: 8 }}>
                      <h2 className="p-h3">
                        {job.title}
                        {job.location ? ` — ${job.location}` : ''}
                      </h2>
                      <p className="p-body" style={{ fontSize: 14.5 }}>
                        {job.description.length > 150 ? `${job.description.slice(0, 150)}…` : job.description}
                      </p>
                    </div>

                    <div className="p-spread" style={{ marginTop: 'auto' }}>
                      <span className="p-small">
                        {job._count.candidates} candidat(s) · publié le {formatDateOnly(job.createdAt)}
                      </span>
                      <Link to={`/company/recruitment/candidates?job=${job.id}`} className="p-btn p-btn-ghost p-btn-sm">
                        Voir les candidats
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Recruitment"
        title="Nouvelle offre"
        footer={
          <>
            <button type="button" className="p-btn p-btn-ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="submit" form="job-form" className="p-btn p-btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Publier l’offre'}
            </button>
          </>
        }
      >
        <form id="job-form" onSubmit={submit} className="p-stack" style={{ gap: 18 }}>
          <label className="p-field">
            <span className="p-label">Titre</span>
            <input
              className="p-input"
              required
              minLength={2}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Driver — Casablanca"
            />
          </label>

          <label className="p-field">
            <span className="p-label">Description</span>
            <textarea
              className="p-textarea"
              required
              minLength={10}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Missions, horaires, contexte…"
            />
          </label>

          <label className="p-field">
            <span className="p-label">Localisation</span>
            <input
              className="p-input"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Paris, France"
            />
          </label>

          <div className="p-spread">
            <label className="p-field" style={{ flex: 1 }}>
              <span className="p-label">Statut</span>
              <select
                className="p-select"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="DRAFT">Brouillon</option>
                <option value="PUBLISHED">Publiée</option>
                <option value="CLOSED">Clôturée</option>
              </select>
            </label>

            <label className="p-field" style={{ gap: 8 }}>
              <span className="p-label">Poste livreur</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={form.isDriverRole}
                  onChange={(e) => setForm((f) => ({ ...f, isDriverRole: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--p-accent)' }}
                />
                <span className="p-small">Crée un compte DRIVER à l'embauche</span>
              </span>
            </label>
          </div>

          {formError && <p className="p-small" style={{ color: 'var(--p-danger)' }}>{formError}</p>}
        </form>
      </PModal>
    </section>
  );
}
