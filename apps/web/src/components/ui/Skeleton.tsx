export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Chargement">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-hidden="true" />
      {label && <span className="text-sm text-slate-600">{label}</span>}
      {!label && <span className="sr-only">Chargement</span>}
    </span>
  );
}
