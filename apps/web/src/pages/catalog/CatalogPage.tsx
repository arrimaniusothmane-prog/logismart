import { useMemo, useState, type FormEvent } from 'react';
import type { CatalogStatus, CatalogType, Paginated } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { ApiError, api, qs } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { catalogStatusMeta, catalogTypeMeta } from '../../lib/status';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from '../../components/ui';

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  type: CatalogType;
  price: number | null;
  status: CatalogStatus;
  createdAt: string;
}

const FETCH_LIMIT = 100;

const TABS: Array<{ value: '' | CatalogType; label: string }> = [
  { value: '', label: 'Tout' },
  { value: 'SERVICE', label: 'Services' },
  { value: 'PRODUCT', label: 'Produits' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'En ligne' },
  { value: 'INACTIVE', label: 'Masqué' },
];

interface FormState {
  name: string;
  description: string;
  type: CatalogType;
  price: string;
  status: CatalogStatus;
}

const EMPTY_FORM: FormState = { name: '', description: '', type: 'SERVICE', price: '', status: 'ACTIVE' };

export function CatalogPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'' | CatalogType>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CatalogItem | null>(null);
  const [deleteRow, setDeleteRow] = useState<CatalogItem | null>(null);

  const query = qs({
    limit: FETCH_LIMIT,
    type: tab || undefined,
    status: statusFilter || undefined,
    search: search.trim() || undefined,
    sort: 'createdAt',
    order: 'desc',
  });

  const catalog = useApi<Paginated<CatalogItem>>(`/api/catalog${query}`, [query]);
  const items = useMemo(() => catalog.data?.items ?? [], [catalog.data]);
  const total = catalog.data?.total ?? items.length;

  const stats = useMemo(() => {
    const services = items.filter((i) => i.type === 'SERVICE').length;
    const products = items.filter((i) => i.type === 'PRODUCT').length;
    const online = items.filter((i) => i.status === 'ACTIVE').length;
    return { services, products, online };
  }, [items]);

  async function patchStatus(item: CatalogItem, status: CatalogStatus) {
    try {
      await api.patch(`/api/catalog/${item.id}`, { status });
      catalog.refetch();
    } catch {
      /* l'état reste inchangé en cas d'échec */
    }
  }

  if (!can('catalog:read')) {
    return (
      <div className="card">
        <EmptyState title="Accès refusé" description="Votre rôle ne dispose pas de la permission catalog:read." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------- Hero sombre */}
      <section className="relative overflow-hidden rounded-2xl bg-[#111213] text-white">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl"
        />

        <div className="relative px-6 py-10 sm:px-10 sm:py-14">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/45">Catalogue</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Les services et produits{' '}
            <span className="bg-gradient-to-r from-sky-400 via-brand-400 to-emerald-400 bg-clip-text text-transparent">
              proposés à vos clients
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            Une seule source de vérité pour vos prestations : ce que vous vendez, à quel prix, et ce qui est visible
            côté client.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {can('catalog:create') && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#111213] transition hover:bg-white/90"
              >
                Nouvel élément
              </button>
            )}
            <span className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/70">
              {catalog.loading ? 'Chargement…' : `${total} élément${total > 1 ? 's' : ''} au total`}
            </span>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
            {[
              { label: 'Services', value: stats.services },
              { label: 'Produits', value: stats.products },
              { label: 'En ligne', value: stats.online },
              { label: 'Masqués', value: items.length - stats.online },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] font-medium uppercase tracking-widest text-white/40">{stat.label}</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums sm:text-4xl">
                  {catalog.loading ? '—' : stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------- Filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.value || 'all'}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap justify-end gap-3">
          <div className="min-w-[12rem] flex-1 sm:max-w-xs">
            <Input
              placeholder="Rechercher…"
              value={search}
              aria-label="Rechercher un élément du catalogue"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filtrer par statut"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          {can('catalog:create') && (
            <Button onClick={() => setCreateOpen(true)} className="hidden sm:inline-flex">
              Nouvel élément
            </Button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------- Liste */}
      {catalog.loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Chargement du catalogue…" />
        </div>
      ) : catalog.error ? (
        <div className="card">
          <ErrorState
            title="Impossible de charger le catalogue"
            description={catalog.error.message}
            action={
              <Button size="sm" variant="secondary" onClick={catalog.refetch}>
                Réessayer
              </Button>
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Aucun élément"
            description={
              search || tab || statusFilter
                ? 'Aucun résultat pour ces filtres.'
                : 'Commencez par ajouter vos services et produits.'
            }
            action={
              search || tab || statusFilter ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setTab('');
                    setStatusFilter('');
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              ) : can('catalog:create') ? (
                <Button onClick={() => setCreateOpen(true)}>Nouvel élément</Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const typeMeta = catalogTypeMeta(item.type);
            const statusMeta = catalogStatusMeta(item.status);
            return (
              <article
                key={item.id}
                className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-3">
                  <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                  <Badge tone={statusMeta.tone} dot>
                    {statusMeta.label}
                  </Badge>
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.name}</h3>
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500">
                  {item.description ?? 'Aucune description.'}
                </p>

                <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-900">
                  {item.price === null ? (
                    <span className="text-base font-medium text-slate-500">Sur devis</span>
                  ) : (
                    formatPrice(item.price)
                  )}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {can('catalog:update') && (
                    <Button size="sm" variant="ghost" onClick={() => setEditRow(item)}>
                      Modifier
                    </Button>
                  )}
                  {can('catalog:update') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => patchStatus(item, item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                    >
                      {item.status === 'ACTIVE' ? 'Masquer' : 'Mettre en ligne'}
                    </Button>
                  )}
                  {can('catalog:delete') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setDeleteRow(item)}
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CatalogFormModal
          title="Nouvel élément"
          submitLabel="Ajouter au catalogue"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            catalog.refetch();
          }}
        />
      )}

      {editRow && (
        <CatalogFormModal
          title="Modifier l'élément"
          submitLabel="Enregistrer"
          initial={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            catalog.refetch();
          }}
        />
      )}

      {deleteRow && (
        <DeleteCatalogModal
          item={deleteRow}
          onClose={() => setDeleteRow(null)}
          onDone={() => {
            setDeleteRow(null);
            catalog.refetch();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Création / modification ------------------------------ */

function CatalogFormModal({
  title,
  submitLabel,
  initial,
  onClose,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initial?: CatalogItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? EMPTY_FORM.name,
    description: initial?.description ?? EMPTY_FORM.description,
    type: initial?.type ?? EMPTY_FORM.type,
    price: initial?.price === null || initial?.price === undefined ? '' : String(initial.price),
    status: initial?.status ?? EMPTY_FORM.status,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    setSaving(true);

    const price = form.price.trim();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      price: price === '' ? null : Number(price.replace(',', '.')),
      status: form.status,
    };

    try {
      if (initial) await api.patch(`/api/catalog/${initial.id}`, payload);
      else await api.post('/api/catalog', payload);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        const issues = err.validationIssues;
        if (issues.length > 0) setErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        else setError(err.message);
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={title} onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <Input
          label="Nom"
          required
          placeholder="Ex. : Livraison express J+1"
          value={form.name}
          error={errors.name}
          onChange={(e) => set('name', e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Type"
            value={form.type}
            options={[
              { value: 'SERVICE', label: 'Service' },
              { value: 'PRODUCT', label: 'Produit' },
            ]}
            error={errors.type}
            onChange={(e) => set('type', e.target.value as CatalogType)}
          />
          <Input
            label="Prix (€)"
            type="number"
            min={0}
            step="0.01"
            hint="Laisser vide = sur devis"
            value={form.price}
            error={errors.price}
            onChange={(e) => set('price', e.target.value)}
          />
          <Select
            label="Statut"
            value={form.status}
            options={[
              { value: 'ACTIVE', label: 'En ligne' },
              { value: 'INACTIVE', label: 'Masqué' },
            ]}
            error={errors.status}
            onChange={(e) => set('status', e.target.value as CatalogStatus)}
          />
        </div>

        <Textarea
          label="Description"
          rows={4}
          placeholder="Ce que comprend cette prestation, les délais, les conditions…"
          value={form.description}
          error={errors.description}
          onChange={(e) => set('description', e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Suppression ------------------------------ */

function DeleteCatalogModal({
  item,
  onClose,
  onDone,
}: {
  item: CatalogItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/catalog/${item.id}`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Supprimer cet élément ?"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy}>
            Supprimer
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm text-slate-600">
        <strong>{item.name}</strong> sera définitivement retiré du catalogue. Cette action est irréversible.
      </p>
    </Modal>
  );
}
