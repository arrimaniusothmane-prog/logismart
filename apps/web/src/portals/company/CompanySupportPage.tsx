import { useState, type FormEvent } from 'react';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { Loader, ErrorPanel, PageHeader, StatusPill, EmptyPanel, timeShort } from '../shared/primitives';
import { PModal } from '../shared/PModal';

type EscalationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

interface EscalationRow {
  id: string;
  status: EscalationStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
  session: {
    id: string;
    trackingNumber: string | null;
    customerIdentifier: string | null;
    customerName: string | null;
    _count: { messages: number };
    messages: Array<{ content: string; role: string; createdAt: string }>;
  };
  assignedUser: { id: string; name: string; email: string } | null;
}

interface EscalationDetail {
  id: string;
  status: EscalationStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
  assignedUser: { id: string; name: string; email: string } | null;
  session: {
    id: string;
    trackingNumber: string | null;
    customerIdentifier: string | null;
    customerName: string | null;
    createdAt: string;
    updatedAt: string;
    _count: { messages: number };
    messages: Array<{ id: string; content: string; role: string; createdAt: string }>;
  };
}

const STATUS_META: Record<EscalationStatus, { label: string; tone: string }> = {
  OPEN: { label: 'Ouvert', tone: 'p-pill-warn' },
  IN_PROGRESS: { label: 'En cours', tone: 'p-pill-accent' },
  RESOLVED: { label: 'Résolu', tone: 'p-pill-ok' },
};

const TABS: Array<{ value: '' | EscalationStatus; label: string }> = [
  { value: '', label: 'Toutes' },
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'RESOLVED', label: 'Résolues' },
];

const PAGE_SIZE = 20;

export function CompanySupportPage() {
  const [status, setStatus] = useState<'' | EscalationStatus>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = `?page=${page}&limit=${PAGE_SIZE}${status ? `&status=${status}` : ''}`;
  const list = useApi<Paginated<EscalationRow> & { summary: Record<EscalationStatus, number> }>(
    `/api/support/escalations${query}`,
    [query],
  );

  const rows = list.data?.items ?? [];
  const summary = list.data?.summary;
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Support"
          title="Escalations"
          lead="Les conversations clientes remontées à votre équipe : répondez et suivez leur résolution."
        />

        <div className="p-grid-3" style={{ margin: '34px 0 26px' }}>
          {(['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((key, index) => (
            <div key={key} className={`p-card p-card-pad p-fade-up p-d${index + 1}`}>
              <span className="p-stat-label">{STATUS_META[key].label}</span>
              <div style={{ marginTop: 8 }}>
                <span className="p-stat-value-sm">{summary?.[key] ?? 0}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-tabs" role="tablist" aria-label="Filtrer les escalations">
          {TABS.map((tab) => (
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

        <div style={{ marginTop: 24 }}>
          {list.loading && !list.data ? (
            <Loader label="Chargement des escalations…" />
          ) : list.error ? (
            <ErrorPanel error={list.error} onRetry={list.refetch} />
          ) : rows.length === 0 ? (
            <EmptyPanel title="Aucune escalation" description="Aucune conversation pour ce filtre." />
          ) : (
            <div className="p-stack" style={{ gap: 14 }}>
              {rows.map((row, index) => {
                const meta = STATUS_META[row.status];
                const last = row.session.messages[0];
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`p-card p-card-pad p-card-hover p-fade-up p-d${Math.min(index % 6, 5) + 1}`}
                    onClick={() => setOpenId(row.id)}
                    style={{ textAlign: 'left', width: '100%', cursor: 'pointer', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <div className="p-stack" style={{ gap: 6, flex: '1 1 320px' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <StatusPill label={meta.label} tone={meta.tone} live={row.status === 'OPEN'} />
                        <span className="p-eyebrow">{row.reason}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 15.5 }}>
                        {row.session.customerName ?? row.session.customerIdentifier ?? 'Client'}
                      </span>
                      <span className="p-body" style={{ fontSize: 14, color: 'var(--p-ink-2)' }}>
                        {last ? `${last.role === 'assistant' ? 'Équipe · ' : ''}${last.content.slice(0, 110)}${last.content.length > 110 ? '…' : ''}` : 'Aucun message'}
                      </span>
                    </div>
                    <div className="p-stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                      <span className="p-small">{row.session._count.messages} message(s)</span>
                      <span className="p-mono" style={{ fontSize: 12.5 }}>
                        {row.session.trackingNumber ?? '—'}
                      </span>
                      <span className="p-small">{timeShort(row.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="p-spread" style={{ marginTop: 24 }}>
            <span className="p-small">
              {total} escalations · page {page} / {totalPages}
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

      <EscalationDialog
        id={openId}
        onClose={() => {
          setOpenId(null);
          list.refetch();
        }}
      />
    </section>
  );
}

function EscalationDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useApi<EscalationDetail>(id ? `/api/support/escalations/${id}` : null, [id]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = detail.data;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/support/escalations/${id}/reply`, { content: reply.trim() });
      setReply('');
      detail.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (next: EscalationStatus) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/support/escalations/${id}`, { status: next });
      detail.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PModal
      open={id !== null}
      onClose={onClose}
      eyebrow={data ? `${data.reason} · ${formatDateTime(data.createdAt)}` : 'Support'}
      title={
        data
          ? (data.session.customerName ?? data.session.customerIdentifier ?? 'Conversation')
          : 'Chargement…'
      }
      width={640}
      footer={
        data ? (
          <>
            <span className="p-small" style={{ marginRight: 'auto' }}>
              Dernière activité le {formatDate(data.updatedAt)}
            </span>
            {data.status !== 'RESOLVED' ? (
              <button type="button" className="p-btn p-btn-ghost" disabled={busy} onClick={() => setStatus('RESOLVED')}>
                Marquer résolue
              </button>
            ) : (
              <button type="button" className="p-btn p-btn-ghost" disabled={busy} onClick={() => setStatus('IN_PROGRESS')}>
                Rouvrir
              </button>
            )}
            <button type="submit" form="support-reply" className="p-btn p-btn-primary" disabled={busy || !reply.trim()}>
              {busy ? 'Envoi…' : 'Répondre'}
            </button>
          </>
        ) : undefined
      }
    >
      {detail.loading && !data ? (
        <Loader label="Chargement de la conversation…" />
      ) : detail.error ? (
        <ErrorPanel error={detail.error} onRetry={detail.refetch} />
      ) : data ? (
        <>
          <div className="p-spread">
            <div className="p-stack" style={{ gap: 4 }}>
              <span className="p-stat-label">Commande</span>
              <span className="p-mono" style={{ fontSize: 14 }}>
                {data.session.trackingNumber ?? '—'}
              </span>
            </div>
            <div className="p-stack" style={{ gap: 4, textAlign: 'right' }}>
              <span className="p-stat-label">Assignée à</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{data.assignedUser?.name ?? 'Non assignée'}</span>
            </div>
          </div>

          <div className="p-stack" style={{ gap: 12, maxHeight: 320, overflowY: 'auto' }}>
            {data.session.messages.length === 0 ? (
              <EmptyPanel title="Aucun message" />
            ) : (
              data.session.messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-chat-msg${message.role === 'assistant' ? ' p-chat-msg-agent' : ''}`}
                >
                  <span className="p-eyebrow" style={{ marginBottom: 4 }}>
                    {message.role === 'assistant' ? 'Équipe' : 'Client'} · {timeShort(message.createdAt)}
                  </span>
                  <p className="p-body" style={{ fontSize: 14 }}>
                    {message.content}
                  </p>
                </div>
              ))
            )}
          </div>

          <form id="support-reply" onSubmit={send} className="p-stack" style={{ gap: 10 }}>
            <label className="p-field">
              <span className="p-label">Votre réponse</span>
              <textarea
                className="p-textarea"
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Bonjour, votre livreur arrive d'ici quelques minutes…"
              />
            </label>
            {error && (
              <p className="p-small" style={{ color: 'var(--p-danger)' }}>
                {error}
              </p>
            )}
          </form>
        </>
      ) : null}
    </PModal>
  );
}
