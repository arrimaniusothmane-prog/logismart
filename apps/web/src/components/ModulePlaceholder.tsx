import type { ReactNode } from 'react';
import { Card, Badge, Button, EmptyState } from './ui';

export interface ModulePlaceholderProps {
  title: string;
  phase: string;
  description: string;
  /** Ce qui existe déjà côté API (affiché honnêtement). */
  ready?: string[];
  /** Ce qui reste à construire. */
  todo?: string[];
  icon?: ReactNode;
}

/**
 * Page déclarative : aucun faux contenu, aucun faux chiffre.
 * Elle affiche exactement où en est le module et ce qui est réellement disponible.
 */
export function ModulePlaceholder({
  title,
  phase,
  description,
  ready = [],
  todo = [],
  icon,
}: ModulePlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </div>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <Badge tone="warning">{phase}</Badge>
            <Badge tone="outline">Module en construction</Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Déjà en place">
          {ready.length === 0 ? (
            <p className="text-sm text-slate-500">Rien de livré sur ce module pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {ready.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Reste à construire">
          {todo.length === 0 ? (
            <p className="text-sm text-slate-500">Planifié plus tard dans la feuille de route.</p>
          ) : (
            <ul className="space-y-2">
              {todo.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <EmptyState
          compact
          title="Aucune donnée affichée ici"
          description="Cette page n'invente aucune information : elle se remplira automatiquement quand l'API correspondante sera implémentée."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open('https://github.com/anomalyco/opencode/issues', '_blank', 'noopener')}
          >
            Reporter un problème
          </Button>
        </div>
      </Card>
    </div>
  );
}
