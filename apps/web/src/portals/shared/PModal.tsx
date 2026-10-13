import { useEffect, type ReactNode } from 'react';

/** Modale des portails — style du design system (indépendante des modales Admin). */
export function PModal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgb(17 18 19 / 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'p-fade-up 0.2s ease both',
      }}
    >
      <div
        className="p-card p-fade-up"
        onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)`, maxHeight: '88dvh', overflowY: 'auto', padding: 0 }}
      >
        <div style={{ padding: '24px 26px 0' }}>
          <div className="p-spread" style={{ alignItems: 'flex-start' }}>
            <div className="p-stack" style={{ gap: 6 }}>
              {eyebrow && <span className="p-eyebrow">{eyebrow}</span>}
              <h2 className="p-h2" style={{ fontSize: 26 }}>
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-btn p-btn-ghost p-btn-sm"
              style={{ borderRadius: 999, padding: '7px 13px' }}
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{ padding: '20px 26px 26px' }}>
          <div className="p-stack" style={{ gap: 18 }}>
            {children}
          </div>
          {footer && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, flexWrap: 'wrap' }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
