import { useState, type FormEvent } from 'react';
import type { Paginated } from '@logismart/shared';
import { ApiError, api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDateTime } from '../../lib/format';
import { PageHeader, Loader, ErrorPanel, StatusPill, EmptyPanel, timeShort } from '../shared/primitives';
import { PModal } from '../shared/PModal';
import { useClientAuth, type PortalOrderCard } from './ClientAuthContext';

interface SupportTicket {
  id: string;
  reason: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: { role: string; content: string; at: string } | null;
}

interface SupportTicketDetail {
  id: string;
  reason: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  trackingNumber: string | null;
  createdAt: string;
  messages: Array<{ id: string; role: string; content: string; at: string }>;
}

const STATUS_META: Record<SupportTicket['status'], { label: string; tone: string }> = {
  OPEN: { label: 'En attente', tone: 'accent' },
  IN_PROGRESS: { label: 'En cours', tone: 'warning' },
  RESOLVED: { label: 'Résolue', tone: 'success' },
};

const FAQ = [
  {
    q: 'Où est ma livraison ?',
    a: "Ouvrez la commande concernée : la carte en direct et la timeline indiquent l'étape exacte, mise à jour à chaque changement de statut. L'assistant (bouton Chat) répond aussi instantanément.",
  },
  {
    q: 'Comment activer mon suivi ?',
    a: 'Recevez un numéro de commande au format LS-XXXX-XXXX-XX de votre transporteur, puis cliquez sur « Activer mon suivi » : l’e-mail de la commande et un mot de passe suffisent.',
  },
  {
    q: 'La livraison est en retard, que faire ?',
    a: "Vérifiez l'heure estimée sur la commande. Si le délai est dépassé, ouvrez une demande ici : le support LogiSmart traite les retards en priorité et vous répond dans cet espace.",
  },
  {
    q: 'Puis-je modifier l’adresse de livraison ?',
    a: "Les adresses sont figées dès la préparation. Ouvrez une demande avec le numéro de suivi : l'équipe vérifie si un réacheminement est encore possible.",
  },
  {
    q: 'Comment contacter le livreur ?',
    a: "Le nom et le véhicule du livreur apparaissent sur la commande. Pour des raisons de confidentialité, les coordonnées directes ne sont pas communiquées : passez par l'assistant ou une demande.",
  },
];

export function ClientSupportPage() {
  const { customer } = useClientAuth();
  const orders = useApi<Paginated<PortalOrderCard>>('/api/portal/orders?page=1&limit=100');
  const tickets = useApi<SupportTicket[]>('/api/portal/support');

  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useApi<SupportTicketDetail>(openId ? `/api/portal/support/${openId}` : null, [openId]);

  const [reason, setReason] = useState('');
  const [tracking, setTracking] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [reply, setReply] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setSent(false);
    try {
      await api.post('/api/portal/support', {
        reason: reason.trim(),
        message: message.trim(),
        ...(tracking ? { trackingNumber: tracking } : {}),
      });
      setReason('');
      setTracking('');
      setMessage('');
      setSent(true);
      tickets.refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'La demande n’a pas pu être envoyée.');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!openId || !reply.trim()) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      await api.post(`/api/portal/support/${openId}/messages`, { content: reply.trim() });
      setReply('');
      detail.refetch();
      tickets.refetch();
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : 'Votre réponse n’a pas pu être envoyée.');
    } finally {
      setReplyBusy(false);
    }
  };

  const selected = detail.data;

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Aide"
          title="Comment pouvons-nous vous aider ?"
          lead="Consultez la FAQ, ouvrez une demande — l'équipe support vous répond directement dans cet espace."
          actions={
            <a href="#demande" className="p-btn p-btn-primary">
              Ouvrir une demande
            </a>
          }
        />

        {/* FAQ */}
        <div style={{ marginTop: 34 }}>
          <span className="p-eyebrow">Questions fréquentes</span>
          <div className="p-faq p-fade-up" style={{ marginTop: 14 }}>
            {FAQ.map((item) => (
              <details key={item.q} className="p-faq-item">
                <summary>{item.q}</summary>
                <p className="p-body">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="p-grid-main" style={{ marginTop: 22 }}>
          {/* Formulaire */}
          <div className="p-card p-card-pad p-fade-up" id="demande">
            <span className="p-eyebrow">Support</span>
            <h2 className="p-h3" style={{ margin: '6px 0 22px' }}>
              Ouvrir une demande
            </h2>

            <form onSubmit={submit} className="p-stack" style={{ gap: 18 }}>
              <label className="p-field">
                <span className="p-label">Sujet</span>
                <input
                  className="p-input"
                  required
                  minLength={2}
                  maxLength={120}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Retard de livraison…"
                />
              </label>

              <label className="p-field">
                <span className="p-label">Commande concernée (optionnel)</span>
                <select className="p-input" value={tracking} onChange={(e) => setTracking(e.target.value)}>
                  <option value="">Aucune commande en particulier</option>
                  {(orders.data?.items ?? []).map((order) => (
                    <option key={order.id} value={order.trackingNumber}>
                      {order.trackingNumber} — {order.deliveryAddress}
                    </option>
                  ))}
                </select>
              </label>

              <label className="p-field">
                <span className="p-label">Message</span>
                <textarea
                  className="p-textarea"
                  required
                  rows={5}
                  maxLength={4000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Décrivez votre problème…"
                />
              </label>

              {formError && (
                <p className="p-small" style={{ color: 'var(--p-danger)' }} role="alert">
                  {formError}
                </p>
              )}
              {sent && (
                <p className="p-small" style={{ color: 'var(--p-success)' }} role="status">
                  Votre demande a bien été envoyée — retrouvez-la dans « Mes demandes ».
                </p>
              )}

              <div>
                <button type="submit" className="p-btn p-btn-primary" disabled={busy}>
                  {busy ? 'Envoi…' : 'Envoyer ma demande'}
                </button>
              </div>
            </form>
          </div>

          {/* Colonnes droites */}
          <div className="p-stack" style={{ gap: 20 }}>
            <div className="p-card p-card-dark p-card-pad p-fade-up p-d2">
              <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                Réponse rapide
              </span>
              <p className="p-body" style={{ color: '#fff', margin: '10px 0 14px' }}>
                L'assistant répond en direct sur le statut, les délais et le livreur — sans attendre.
              </p>
              <span className="p-small" style={{ color: '#9b9ea3' }}>
                Bouton « Chat » en bas à droite de l'écran.
              </span>
            </div>

            <div className="p-card p-card-pad p-fade-up p-d3">
              <span className="p-eyebrow">Votre transporteur</span>
              <div className="p-stack" style={{ gap: 14, marginTop: 14 }}>
                <div className="p-cell">
                  <span className="p-cell-label">Société</span>
                  <span style={{ fontWeight: 600 }}>{customer?.company.name ?? '—'}</span>
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">E-mail</span>
                  <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {customer?.company.email ?? '—'}
                  </span>
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">Téléphone</span>
                  <span style={{ fontWeight: 600 }}>{customer?.company.phone ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mes demandes */}
        <div style={{ marginTop: 22 }}>
          <div className="p-card p-card-pad p-fade-up">
            <div className="p-spread" style={{ marginBottom: 18 }}>
              <div className="p-stack" style={{ gap: 6 }}>
                <span className="p-eyebrow">Suivi</span>
                <h2 className="p-h3">Mes demandes</h2>
              </div>
              {tickets.data && tickets.data.length > 0 && (
                <span className="p-small">{tickets.data.length} demande(s)</span>
              )}
            </div>

            {tickets.loading && !tickets.data ? (
              <Loader label="Chargement de vos demandes…" />
            ) : tickets.error ? (
              <ErrorPanel error={tickets.error} onRetry={tickets.refetch} />
            ) : !tickets.data || tickets.data.length === 0 ? (
              <EmptyPanel
                title="Aucune demande"
                description="Vos demandes au support apparaîtront ici, avec les réponses de l'équipe."
              />
            ) : (
              <div className="p-stack" style={{ gap: 12 }}>
                {tickets.data.map((ticket) => {
                  const meta = STATUS_META[ticket.status];
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setOpenId(ticket.id)}
                      className="p-spread"
                      style={{
                        border: '1px solid var(--p-line)',
                        borderRadius: 14,
                        padding: '14px 16px',
                        background: 'var(--p-paper)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: 14,
                        flexWrap: 'wrap',
                        width: '100%',
                      }}
                    >
                      <span className="p-stack" style={{ gap: 5, flex: '1 1 260px' }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{ticket.reason}</span>
                        <span className="p-small">
                          {ticket.lastMessage ? ticket.lastMessage.content : 'Demande envoyée'}
                        </span>
                      </span>
                      <span className="p-stack" style={{ gap: 5, alignItems: 'flex-end' }}>
                        <StatusPill
                          label={meta.label}
                          tone={meta.tone}
                          live={ticket.status === 'OPEN'}
                        />
                        <span className="p-small">
                          {timeShort(ticket.updatedAt)} · {ticket.messageCount} message(s)
                          {ticket.trackingNumber ? ` · ${ticket.trackingNumber}` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation */}
      <PModal
        open={openId !== null}
        onClose={() => {
          setOpenId(null);
          setReply('');
          setReplyError(null);
        }}
        eyebrow={selected ? `Demande · ${formatDateTime(selected.createdAt)}` : 'Demande'}
        title={selected ? selected.reason : 'Chargement…'}
        footer={
          <button type="button" className="p-btn p-btn-ghost" onClick={() => setOpenId(null)}>
            Fermer
          </button>
        }
      >
        {!selected ? (
          <Loader label="Chargement de la conversation…" />
        ) : detail.error ? (
          <ErrorPanel error={detail.error} onRetry={detail.refetch} />
        ) : (
          <div className="p-stack" style={{ gap: 16 }}>
            <div className="p-spread" style={{ gap: 10, flexWrap: 'wrap' }}>
              <StatusPill
                label={STATUS_META[selected.status].label}
                tone={STATUS_META[selected.status].tone}
                live={selected.status === 'OPEN'}
              />
              {selected.trackingNumber && (
                <span className="p-mono" style={{ fontSize: 13 }}>
                  {selected.trackingNumber}
                </span>
              )}
            </div>

            <div className="p-stack" style={{ gap: 10, maxHeight: 'min(360px, 50dvh)', overflowY: 'auto' }}>
              {selected.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-support-msg ${msg.role === 'user' ? 'is-client' : 'is-agent'}`}
                >
                  <span className="p-eyebrow" style={{ marginBottom: 4, display: 'block' }}>
                    {msg.role === 'user' ? 'Vous' : 'Support LogiSmart'} · {timeShort(msg.at)}
                  </span>
                  <p className="p-body" style={{ fontSize: 14, margin: 0 }}>
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={sendReply} className="p-stack" style={{ gap: 10 }}>
              <label className="p-field">
                <span className="p-label">Votre réponse</span>
                <textarea
                  className="p-textarea"
                  rows={3}
                  maxLength={4000}
                  required
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Ajoutez des précisions…"
                />
              </label>
              {replyError && (
                <p className="p-small" style={{ color: 'var(--p-danger)' }} role="alert">
                  {replyError}
                </p>
              )}
              <div>
                <button
                  type="submit"
                  className="p-btn p-btn-primary p-btn-sm"
                  disabled={replyBusy || !reply.trim()}
                >
                  {replyBusy ? 'Envoi…' : 'Répondre'}
                </button>
              </div>
            </form>
          </div>
        )}
      </PModal>
    </section>
  );
}
