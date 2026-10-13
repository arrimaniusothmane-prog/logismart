import { useMemo, useState, type FormEvent } from 'react';
import type { OrderStatus, Paginated } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { ApiError, api, qs } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { orderStatusMeta } from '../../lib/status';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  TableSkeleton,
  type Column,
} from '../../components/ui';

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  _count: { orders: number };
}

interface CustomerDetail extends CustomerRow {
  orders: Array<{ id: string; trackingNumber: string; status: OrderStatus; createdAt: string }>;
}

const PAGE_SIZE = 10;

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
}

const EMPTY_FORM: FormState = { name: '', phone: '', email: '', address: '' };

export function CustomersPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CustomerRow | null>(null);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    sort: 'createdAt',
    order: 'desc',
  });

  const customers = useApi<Paginated<CustomerRow>>(`/api/customers${query}`, [query]);
  const rows = customers.data?.items ?? [];
  const total = customers.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Array<Column<CustomerRow>> = useMemo(() => {
    const cols: Array<Column<CustomerRow>> = [
      {
        key: 'name',
        header: 'Client',
        render: (c) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{c.name}</p>
            <p className="truncate text-xs text-slate-500">{c.email ?? c.phone ?? 'Aucun contact'}</p>
          </div>
        ),
      },
      {
        key: 'phone',
        header: 'Téléphone',
        hideBelow: 'sm',
        render: (c) => <span className="text-slate-600">{c.phone ?? '—'}</span>,
      },
      {
        key: 'orders',
        header: 'Commandes',
        hideBelow: 'md',
        render: (c) => <Badge tone="neutral">{c._count.orders}</Badge>,
      },
      {
        key: 'createdAt',
        header: 'Créé le',
        align: 'right',
        hideBelow: 'lg',
        render: (c) => <span className="tabular-nums text-slate-500">{formatDate(c.createdAt)}</span>,
      },
    ];

    if (can('customer:update')) {
      cols.push({
        key: 'actions',
        header: '',
        align: 'right',
        render: (c) => (
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" onClick={() => setEditRow(c)}>
              Modifier
            </Button>
          </div>
        ),
      });
    }
    return cols;
  }, [can]);

  if (!can('customer:read')) {
    return (
      <Card>
        <EmptyState title="Accès refusé" description="Votre rôle ne dispose pas de la permission customer:read." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {customers.loading ? 'Chargement…' : `${total} client${total > 1 ? 's' : ''} dans votre périmètre`}
        </p>
        {can('customer:create') && <Button onClick={() => setCreateOpen(true)}>Nouveau client</Button>}
      </div>

      <Card flush>
        <div className="border-b border-slate-200 p-4">
          <Input
            placeholder="Rechercher un nom…"
            value={search}
            aria-label="Rechercher un client"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {customers.loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={4} />
        ) : customers.error ? (
          <div className="p-4">
            <ErrorState
              title="Impossible de charger les clients"
              description={customers.error.message}
              action={
                <Button size="sm" variant="secondary" onClick={customers.refetch}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucun client"
              description={
                search ? 'Aucun résultat pour cette recherche.' : 'Créez votre premier client pour enregistrer ses coordonnées et ses commandes.'
              }
              action={
                search ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                  >
                    Réinitialiser la recherche
                  </Button>
                ) : can('customer:create') ? (
                  <Button onClick={() => setCreateOpen(true)}>Nouveau client</Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            onRowClick={(c) => setDetailId(c.id)}
            caption="Liste des clients"
          />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Page {page} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>

      {createOpen && (
        <CustomerFormModal
          title="Nouveau client"
          submitLabel="Créer le client"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            customers.refetch();
          }}
        />
      )}

      {editRow && (
        <CustomerFormModal
          title="Modifier le client"
          submitLabel="Enregistrer"
          initial={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            customers.refetch();
            if (detailId === editRow.id) setDetailId(null);
          }}
        />
      )}

      {detailId && (
        <CustomerDetailModal
          customerId={detailId}
          canEdit={can('customer:update')}
          onClose={() => setDetailId(null)}
          onEdit={(c) => {
            setDetailId(null);
            setEditRow(c);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Création / modification ------------------------------ */

function CustomerFormModal({
  title,
  submitLabel,
  initial,
  onClose,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initial?: CustomerRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? EMPTY_FORM.name,
    phone: initial?.phone ?? EMPTY_FORM.phone,
    email: initial?.email ?? EMPTY_FORM.email,
    address: initial?.address ?? EMPTY_FORM.address,
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
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
    };
    try {
      if (initial) await api.patch(`/api/customers/${initial.id}`, payload);
      else await api.post('/api/customers', payload);
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
          label="Nom du client"
          required
          placeholder="Ex. : Camille Bernard"
          value={form.name}
          error={errors.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Téléphone"
            type="tel"
            value={form.phone}
            error={errors.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Input
            label="Adresse e-mail"
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <Input
          label="Adresse"
          value={form.address}
          error={errors.address}
          onChange={(e) => set('address', e.target.value)}
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

/* ------------------------------ Fiche client ------------------------------ */

function CustomerDetailModal({
  customerId,
  canEdit,
  onClose,
  onEdit,
}: {
  customerId: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (customer: CustomerRow) => void;
}) {
  const detail = useApi<CustomerDetail>(`/api/customers/${customerId}`, [customerId]);

  return (
    <Modal open title="Fiche client" onClose={onClose} size="lg">
      {detail.loading ? (
        <div className="space-y-3">
          <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="h-24 animate-pulse rounded bg-slate-200" />
        </div>
      ) : detail.error ? (
        <ErrorState title="Impossible de charger ce client" description={detail.error.message} />
      ) : detail.data ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">{detail.data.name}</p>
              <p className="text-sm text-slate-500">
                Client depuis le {formatDate(detail.data.createdAt)} · {detail.data._count.orders} commande
                {detail.data._count.orders > 1 ? 's' : ''}
              </p>
            </div>
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => onEdit(detail.data!)}>
                Modifier
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Téléphone</dt>
              <dd className="mt-1 text-sm text-slate-900">{detail.data.phone ?? '—'}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">E-mail</dt>
              <dd className="mt-1 break-all text-sm text-slate-900">{detail.data.email ?? '—'}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Adresse</dt>
              <dd className="mt-1 text-sm text-slate-900">{detail.data.address ?? '—'}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-900">Dernières commandes</p>
            {detail.data.orders.length === 0 ? (
              <EmptyState compact title="Aucune commande" description="Ce client n'a pas encore de commande enregistrée." />
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {detail.data.orders.map((order) => {
                  const meta = orderStatusMeta(order.status);
                  return (
                    <li key={order.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{order.trackingNumber}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                      </div>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
