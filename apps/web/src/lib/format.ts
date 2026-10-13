/** Formatage des valeurs affichées (fr-FR, UTC local). */

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateOnlyFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

const numberFormatter = new Intl.NumberFormat('fr-FR');

const priceFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

/** Alias sémantique : date + heure courte. */
export const formatDateTime = formatDate;

export function formatDateOnly(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return dateOnlyFormatter.format(date);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return numberFormatter.format(value);
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return priceFormatter.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${numberFormatter.format(Math.round(value))} %`;
}

export function formatDistanceFromNow(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return rtf.format(Math.sign(diffMs) * minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(Math.sign(diffMs) * hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(Math.sign(diffMs) * days, 'day');
}

export function truncate(value: string, max = 80): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
