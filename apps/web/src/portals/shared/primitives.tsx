import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/format';
import type { ApiError } from '../../lib/api';

/** Primitives visuelles des portails (Company + Client).
 *  Tout est stylé via le design system `portals.css` (classes .p-*). */

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({
  name,
  large = false,
  tone = 'ink',
}: {
  name: string | null | undefined;
  large?: boolean;
  tone?: 'ink' | 'accent';
}) {
  return (
    <span
      className={`p-avatar${large ? ' p-avatar-lg' : ''}`}
      style={tone === 'accent' ? { background: 'var(--p-accent)' } : undefined}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

const TONE_CLASS: Record<string, string> = {
  success: 'p-pill-ok',
  warning: 'p-pill-warn',
  danger: 'p-pill-danger',
  brand: 'p-pill-accent',
  info: 'p-pill-accent',
  accent: 'p-pill-accent',
};

export function StatusPill({
  label,
  tone = 'neutral',
  live = false,
  dark = false,
}: {
  label: string;
  tone?: string;
  live?: boolean;
  dark?: boolean;
}) {
  const cls = dark ? 'p-pill-dark' : (TONE_CLASS[tone] ?? '');
  return (
    <span className={`p-pill ${cls}`}>
      {live && <span className={`p-dot${live ? ' p-dot-live' : ''}`} />}
      {label}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="p-spread p-fade-up" style={{ alignItems: 'flex-end' }}>
      <div className="p-stack" style={{ gap: 14 }}>
        {eyebrow && <span className="p-eyebrow">{eyebrow}</span>}
        <h1 className="p-h1">{title}</h1>
        {lead && <p className="p-lead">{lead}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="p-card p-card-pad" style={accent ? { background: 'var(--p-ink)', color: '#fff', borderColor: 'var(--p-ink)' } : undefined}>
      <div className="p-stack" style={{ gap: 10 }}>
        <span className="p-stat-label" style={accent ? { color: '#9b9ea3' } : undefined}>
          {label}
        </span>
        <span className="p-stat-value">{value}</span>
        {hint && (
          <span className="p-small" style={accent ? { color: '#9b9ea3' } : undefined}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

export function Loader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="p-stack" style={{ alignItems: 'center', gap: 14, padding: '64px 0' }}>
      <span className="p-loader" role="status" aria-label={label} />
      <span className="p-small">{label}</span>
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="p-empty">
      <p className="p-h3" style={{ marginBottom: 6 }}>
        Impossible de charger ces données
      </p>
      <p className="p-body" style={{ marginBottom: 18 }}>
        {error.message}
      </p>
      {onRetry && (
        <button type="button" className="p-btn p-btn-ghost p-btn-sm" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="p-empty">
      <p className="p-h3" style={{ marginBottom: 6 }}>
        {title}
      </p>
      {description && <p className="p-body">{description}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="p-spread" style={{ marginBottom: 22, alignItems: 'flex-end' }}>
      <div className="p-stack" style={{ gap: 8 }}>
        {eyebrow && <span className="p-eyebrow">{eyebrow}</span>}
        <h2 className="p-h2">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Lien bouton standard des portails. */
export function PLink({
  to,
  children,
  variant = 'primary',
  small = false,
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'light' | 'accent';
  small?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`p-btn p-btn-${variant}${small ? ' p-btn-sm' : ''}`}
    >
      {children}
    </Link>
  );
}

/** Date courte (jour + heure) pour les cartes d'activité. */
export function timeShort(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export { formatDate };
