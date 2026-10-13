import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { timeShort } from '../shared/primitives';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

const SUGGESTIONS = ['Où est mon colis ?', 'Quand sera-t-il livré ?', 'Qui est le livreur ?'];

let counter = 0;
const nextId = () => `m-${Date.now()}-${counter++}`;

/** Assistant LogiSmart du portail client (positionné en bas à droite). */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: nextId(),
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant LogiSmart. Posez-moi une question sur vos livraisons.',
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content, at: new Date().toISOString() }]);
    setBusy(true);
    try {
      const result = await api.post<{ reply: string; trackingNumber?: string }>(
        '/api/portal/chat',
        { message: content },
        { skipRefresh: false },
      );
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: result.reply, at: new Date().toISOString() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: 'Le service est momentanément indisponible. Réessayez dans un instant.',
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 90, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
      {open && (
        <section
          className="p-card p-fade-up"
          aria-label="Assistant LogiSmart"
          style={{ width: 'min(360px, calc(100vw - 32px))', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'min(520px, 70dvh)' }}
        >
          <header className="p-spread" style={{ padding: '16px 18px', background: 'var(--p-ink)', color: '#fff' }}>
            <div className="p-stack" style={{ gap: 3 }}>
              <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                Assistant
              </span>
              <span style={{ fontWeight: 700 }}>Besoin d’aide ?</span>
            </div>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link
                to="/client/support"
                className="p-btn p-btn-sm"
                style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none' }}
              >
                Aide
              </Link>
              <button
                type="button"
                className="p-btn p-btn-sm"
                onClick={() => setOpen(false)}
                aria-label="Fermer l'assistant"
                style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none' }}
              >
                ✕
              </button>
            </span>
          </header>

          <div ref={listRef} className="p-stack" style={{ gap: 12, padding: 18, overflowY: 'auto', flex: 1 }}>
            {messages.map((message) => (
              <div key={message.id} className={`p-chat-msg${message.role === 'assistant' ? ' p-chat-msg-agent' : ''}`}>
                <span className="p-eyebrow" style={{ marginBottom: 4 }}>
                  {message.role === 'assistant' ? 'LogiSmart' : 'Vous'} · {timeShort(message.at)}
                </span>
                <p className="p-body" style={{ fontSize: 14 }}>
                  {message.content}
                </p>
              </div>
            ))}
            {busy && (
              <span className="p-small" style={{ color: 'var(--p-ink-3)' }}>
                L'assistant rédige…
              </span>
            )}
          </div>

          {messages.length <= 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 18px 12px' }}>
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className="p-btn p-btn-ghost p-btn-sm" onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid var(--p-line)' }}>
            <input
              className="p-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre message…"
              aria-label="Votre message"
              maxLength={500}
            />
            <button type="submit" className="p-btn p-btn-primary p-btn-sm" disabled={busy || !input.trim()}>
              Envoyer
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="p-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
      >
        {open ? '✕' : 'Chat'}
      </button>
    </div>
  );
}
