import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ApiError, api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { orderStatusLabel, orderStatusMeta } from '../../lib/status';
import { Badge, Card, Spinner } from '../../components/ui';

interface TimelineStep {
  status: string;
  note: string | null;
  createdAt: string;
}

interface PublicTracking {
  trackingNumber: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  note: string | null;
  customer: { name: string };
  driver: { name: string; phone: string | null } | null;
  timeline: TimelineStep[];
}

const STEPS = [
  { key: 'PREPARED', label: 'Préparée' },
  { key: 'ASSIGNED', label: 'Affectée' },
  { key: 'PICKED_UP', label: 'Récupérée' },
  { key: 'IN_TRANSIT', label: 'En transit' },
  { key: 'DELIVERED', label: 'Livrée' },
];

function stepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx;
}

export function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    api
      .get<PublicTracking>(`/api/public/track/${encodeURIComponent(token)}`)
      .then((result) => setData(result))
      .catch((err: unknown) => {
        setData(null);
        setError(
          err instanceof ApiError ? err.message : 'Le lien de suivi n\'a pas pu être chargé.',
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  const currentIdx = data ? Math.max(stepIndex(data.status), 0) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              L
            </span>
            <span className="text-sm font-semibold">LogiSmart</span>
          </Link>
          <span className="text-xs text-slate-500">Suivi de livraison</span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Chargement du suivi">
            <Spinner />
          </div>
        ) : error || !data ? (
          <Card>
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900">Lien de suivi invalide</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {error ?? 'Ce lien est inconnu, expiré ou a été révoqué.'}
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Contactez le livreur ou votre entreprise de livraison pour obtenir un nouveau lien.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Commande</p>
                  <h1 className="font-mono text-lg font-bold text-slate-900">{data.trackingNumber}</h1>
                  <p className="text-sm text-slate-500">Pour {data.customer.name}</p>
                </div>
                <Badge tone={orderStatusMeta(data.status).tone}>{orderStatusLabel(data.status)}</Badge>
              </div>

              {data.status === 'CANCELLED' && (
                <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Cette commande a été annulée.
                </div>
              )}
              {data.status === 'FAILED' && (
                <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  La livraison a échoué. Le livreur va reprendre contact avec vous.
                </div>
              )}
            </Card>

            <Card>
              <div className="space-y-0">
                {STEPS.map((step, i) => {
                  const done = i <= currentIdx;
                  const current = i === currentIdx && !['DELIVERED', 'FAILED', 'CANCELLED'].includes(data.status);
                  return (
                    <div key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
                      {i < STEPS.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[0.85rem] top-6 h-[calc(100%-1rem)] w-0.5 ${
                            done && i < currentIdx ? 'bg-brand-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`z-10 flex h-[1.7rem] w-[1.7rem] shrink-0 items-center justify-center rounded-full border-2 ${
                          done
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-slate-300 bg-white text-slate-400'
                        } ${current ? 'ring-4 ring-brand-500/20' : ''}`}
                      >
                        {done ? (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <span className="text-xs font-semibold">{i + 1}</span>
                        )}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className={`text-sm font-medium ${done ? 'text-slate-900' : 'text-slate-400'}`}>
                          {step.label}
                        </p>
                        {current && (
                          <p className="text-xs font-semibold text-brand-600">En cours…</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Détails de la livraison</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Enlèvement</dt>
                  <dd className="mt-0.5 text-slate-800">{data.pickupAddress}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Livraison</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{data.deliveryAddress}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    {data.deliveredAt ? 'Livrée le' : 'Livraison estimée'}
                  </dt>
                  <dd className="mt-0.5 tabular-nums text-slate-800">
                    {data.deliveredAt ? formatDate(data.deliveredAt) : data.estimatedDeliveryAt ? formatDate(data.estimatedDeliveryAt) : 'Non communiquée'}
                  </dd>
                </div>
              </dl>
            </Card>

            {data.driver && (
              <Card>
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Votre livreur</h2>
                <p className="flex items-center gap-2 text-sm text-slate-800">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">
                    {data.driver.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{data.driver.name}</span>
                </p>
                {data.driver.phone && (
                  <a
                    href={`tel:${data.driver.phone.replace(/\s/g, '')}`}
                    className="mt-2 inline-block text-sm font-medium text-brand-600"
                  >
                    Appeler le livreur
                  </a>
                )}
              </Card>
            )}

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Étapes</h2>
              <ol className="space-y-3">
                {data.timeline.length === 0 ? (
                  <li className="text-sm text-slate-500">Aucune étape enregistrée pour l'instant.</li>
                ) : (
                  data.timeline.map((t) => (
                    <li key={`${t.status}-${t.createdAt}`} className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-slate-700">{orderStatusLabel(t.status)}</span>
                      <span className="flex items-baseline gap-2">
                        {t.note && <span className="hidden text-xs text-slate-400 sm:inline">{t.note}</span>}
                        <span className="tabular-nums text-xs text-slate-400">{formatDate(t.createdAt)}</span>
                      </span>
                    </li>
                  ))
                )}
              </ol>
            </Card>

            <p className="text-center text-xs text-slate-400">
              Suivi mis à jour en temps réel par votre livreur.
            </p>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-md px-4 pb-8 pt-2">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <Link to="/client/register" className="font-medium text-brand-600 hover:underline">
            Créer mon espace client
          </Link>
          <Link to="/client/login" className="font-medium text-brand-600 hover:underline">
            J'ai déjà un compte
          </Link>
        </div>
      </footer>
    </div>
  );
}