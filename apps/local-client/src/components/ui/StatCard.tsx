import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
} as const;

export function StatCard({ label, value, hint, icon, tone = 'neutral', loading }: StatCardProps) {
  return (
    <div className="card flex items-start gap-4 p-5">
      {icon && (
        <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${TONES[tone]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {loading ? (
          <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        )}
        {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}

const ALERT_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-900',
} as const;

export function Alert({ tone = 'info', title, children, action }: AlertProps) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${ALERT_TONES[tone]}`} role="status">
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
