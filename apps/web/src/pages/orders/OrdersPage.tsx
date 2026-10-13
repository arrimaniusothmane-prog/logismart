import { useMemo, useState, type FormEvent } from 'react';
import { ORDER_STATUS_TRANSITIONS, type OrderStatus, type Paginated } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { ApiError, api, qs } from '../../lib/api';
import { formatDate, formatDateOnly } from '../../lib/format';
import { orderStatusLabel, orderStatusMeta, availabilityMeta } from '../../lib/status';
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
  Select,
  TableSkeleton,
  Textarea,
  useToast,
  type Column,
} from '../../components/ui';

interface CustomerBrief {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface OrderRow {
  id: string;
  trackingNumber: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  note: string | null;
  createdAt: string;
  customer: CustomerBrief;
  driver: { id: string; user: { name: string; email: string } } | null;
  _count: { proofs: number };
}

interface OrderHistory {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface OrderDetail extends OrderRow {
  history: OrderHistory[];
  proofs: Array<{ id: string; type: string; createdAt: string }>;
}

interface DriverOption {
  id: string;
  availability: string;
  user: { name: string; email: string };
}

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  ...Object.entries({
    PREPARED: 'Préparée',
    ASSIGNED: 'Affectée',
    PICKED_UP: 'Récupérée',
    IN_TRANSIT: 'En transit',
    DELIVERED: 'Livrée',
    FAILED: 'Échec',
    CANCELLED: 'Annulée',
  }).map(([value, label]) => ({ value, label })),
];

export function OrdersPage() {
  const { user, can } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<OrderRow | null>(null);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    sort: 'createdAt',
    order: 'desc',
  });

  const orders = useApi<Paginated<OrderRow>>(`/api/orders${query}`, [query]);
  const rows = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const isDriver = user?.role === 'DRIVER';

  const columns: Array<Column<OrderRow>> = useMemo(
    () => [
      {
        key: 'trackingNumber',
        header: 'N° suivi',
        render: (o) => <span className="font-mono text-xs font-semibold text-slate-900">{o.trackingNumber}</span>,
      },
      {
        key: 'status',
        header: 'Statut',
        render: (o) => {
          const meta = orderStatusMeta(o.status);
          return <Badge tone={meta.tone}>{meta.label}</Badge>;
        },
      },
      {
        key: 'deliveryAddress',
        header: 'Livraison',
        hideBelow: 'sm',
        render: (o) => (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate text-slate-900">{o.deliveryAddress}</p>
            <p className="truncate text-xs text-slate-500">{o.customer.name}</p>
          </div>
        ),
      },
      {
        key: 'driver',
        header: 'Livreur',
        hideBelow: 'md',
        render: (o) => (o.driver ? o.driver.user.name : <span className="text-slate-400">—</span>),
      },
      {
        key: 'eta',
        header: 'Livraison estimée',
        hideBelow: 'lg',
        render: (o) => (
          <span className="tabular-nums text-slate-500">
            {o.deliveredAt ? formatDate(o.deliveredAt) : o.estimatedDeliveryAt ? formatDate(o.estimatedDeliveryAt) : '—'}
          </span>
        ),
      },
      {
        key: 'created',
        header: 'Créée le',
        align: 'right',
        hideBelow: 'lg',
        render: (o) => <span className="tabular-nums text-slate-500">{formatDateOnly(o.createdAt)}</span>,
      },
    ],
    [],
  );

  if (!can('order:read')) {
    return (
      <Card>
        <EmptyState title="Accès refusé" description="Votre rôle ne dispose pas de la permission order:read." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {orders.loading ? 'Chargement…' : `${total} commande${total > 1 ? 's' : ''}${isDriver ? ` assignée${total > 1 ? 's' : ''} à vous` : ''}`}
        </p>
        {can('order:create') && (
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            Nouvelle commande
          </Button>
        )}
      </div>

      <Card flush>
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <div className="min-w-[12rem] flex-1">
            <Input
              placeholder="Rechercher un n° de suivi, une adresse, un client…"
              value={search}
              aria-label="Rechercher une commande"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>

        {orders.loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={6} />
        ) : orders.error ? (
          <div className="p-4">
            <ErrorState
              title="Impossible de charger les commandes"
              description={orders.error.message}
              action={
                <Button size="sm" variant="secondary" onClick={orders.refetch}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucune commande"
              description={
                search || statusFilter
                  ? 'Aucune commande ne correspond à ces filtres.'
                  : isDriver
                    ? 'Aucune commande ne vous est affectée pour le moment.'
                    : 'Créez la première commande de livraison.'
              }
              action={
                search || statusFilter ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('');
                      setPage(1);
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={(o) => setDetail(o)}
            rowKey={(o) => o.id}
            caption="Liste des commandes"
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
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            orders.refetch();
            toastSuccess('Commande créée', 'La commande a été enregistrée et son lien de suivi généré.');
          }}
        />
      )}

      {detail && (
        <OrderDetailModal
          orderId={detail.id}
          onClose={() => setDetail(null)}
          onMutation={() => orders.refetch()}
          onToast={toastError}
        />
      )}
    </div>
  );
}

/* ------------------------------ Création ------------------------------ */

function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [eta, setEta] = useState('');
  const [note, setNote] = useState('');
  const [driverId, setDriverId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const customers = useApi<Paginated<CustomerBrief>>('/api/customers?limit=100', []);
  const drivers = useApi<Paginated<DriverOption>>('/api/drivers?limit=100', []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    setSaving(true);
    try {
      await api.post('/api/orders', {
        ...(mode === 'existing'
          ? { customerId: customerId || undefined }
          : {
              customer: {
                name: newCustomer.name.trim(),
                email: newCustomer.email.trim() || undefined,
                phone: newCustomer.phone.trim() || undefined,
                address: newCustomer.address.trim() || undefined,
              },
            }),
        pickupAddress: pickup.trim(),
        deliveryAddress: delivery.trim(),
        ...(eta ? { estimatedDeliveryAt: new Date(eta).toISOString() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(driverId ? { driverId } : {}),
      });
      onCreated();
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
    <Modal
      open
      title="Nouvelle commande"
      description="La commande démarre au statut « Préparée » et reçoit un n° de suivi unique."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="create-order-form" loading={saving}>
            Créer la commande
          </Button>
        </>
      }
    >
      <form id="create-order-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Destinataire</p>
            <div className="flex gap-1" role="tablist" aria-label="Type de destinataire">
              <Button size="sm" variant={mode === 'existing' ? 'primary' : 'ghost'} onClick={() => setMode('existing')}>
                Client existant
              </Button>
              <Button size="sm" variant={mode === 'new' ? 'primary' : 'ghost'} onClick={() => setMode('new')}>
                Nouveau client
              </Button>
            </div>
          </div>

          {mode === 'existing' ? (
            <Select
              label="Client"
              value={customerId}
              error={errors.customerId}
              placeholder="Choisir un client…"
              options={(customers.data?.items ?? []).map((c) => ({
                value: c.id,
                label: `${c.name}${c.phone ? ` — ${c.phone}` : ''}`,
              }))}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Nom complet"
                required
                value={newCustomer.name}
                error={errors['customer.name']}
                onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
              />
              <Input
                label="Téléphone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
              />
              <Input
                label="E-mail"
                type="email"
                value={newCustomer.email}
                error={errors['customer.email']}
                onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
              />
              <Input
                label="Adresse (optionnelle)"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer((c) => ({ ...c, address: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Adresse d'enlèvement"
            required
            value={pickup}
            error={errors.pickupAddress}
            onChange={(e) => setPickup(e.target.value)}
          />
          <Input
            label="Adresse de livraison"
            required
            value={delivery}
            error={errors.deliveryAddress}
            onChange={(e) => setDelivery(e.target.value)}
          />
          <Input
            label="Livraison estimée"
            type="datetime-local"
            value={eta}
            error={errors.estimatedDeliveryAt}
            onChange={(e) => setEta(e.target.value)}
          />
          <Select
            label="Affecter un livreur (optionnel)"
            value={driverId}
            placeholder="Pas d'affectation immédiate"
            options={(drivers.data?.items ?? []).map((d) => ({
              value: d.id,
              label: `${d.user.name} — ${availabilityMeta(d.availability).label}`,
            }))}
            onChange={(e) => setDriverId(e.target.value)}
          />
        </div>
        <Textarea label="Note interne" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />

        {mode === 'new' && !newCustomer.name.trim() && (
          <p className="text-xs text-slate-500">Le client sera automatiquement créé dans votre répertoire.</p>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------ Détail ------------------------------ */

function OrderDetailModal({
  orderId,
  onClose,
  onMutation,
  onToast,
}: {
  orderId: string;
  onClose: () => void;
  onMutation: () => void;
  onToast: (title: string, description?: string) => void;
}) {
  const { user, can } = useAuth();
  const [openDelete, setOpenDelete] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [busyStatus, setBusyStatus] = useState<OrderStatus | null>(null);
  const [selectedDriver, setSelectedDriver] = useState('');

  const order = useApi<OrderDetail>(`/api/orders/${orderId}`, [orderId]);
  const drivers = useApi<Paginated<DriverOption>>('/api/drivers?limit=100', []);

  const detail = order.data;
  const isDriver = user?.role === 'DRIVER';

  const nextStatuses = useMemo<OrderStatus[]>(() => {
    if (!detail) return [];
    const allowed = ORDER_STATUS_TRANSITIONS[detail.status as OrderStatus] as readonly OrderStatus[];
    if (!isDriver) return [...allowed];
    const handling: OrderStatus[] = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'];
    return allowed.filter((s) => handling.includes(s));
  }, [detail, isDriver]);

  async function transition(status: OrderStatus) {
    setBusyStatus(status);
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status });
      order.refetch();
      onMutation();
    } catch (err) {
      onToast('Transition refusée', err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setBusyStatus(null);
    }
  }

  async function assign() {
    if (!selectedDriver) return;
    setAssigning(true);
    try {
      await api.patch(`/api/orders/${orderId}/assign`, { driverId: selectedDriver });
      order.refetch();
      onMutation();
    } catch (err) {
      onToast('Affectation refusée', err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setAssigning(false);
      setSelectedDriver('');
    }
  }

  if (order.error) {
    return (
      <Modal open title="Commande introuvable" onClose={onClose}>
        <p className="text-sm text-slate-600">{order.error.message}</p>
      </Modal>
    );
  }

  if (!detail) return null;

  const canAssign = can('order:assign') && (detail.status === 'PREPARED' || detail.status === 'ASSIGNED');
  const canTransition = (isDriver || can('order:update')) && nextStatuses.length > 0;
  const canDelete = can('order:delete') && detail.status === 'PREPARED';

  return (
    <Modal
      open
      title={detail.trackingNumber}
      description={`Créée le ${formatDate(detail.createdAt)} — statut ${orderStatusLabel(detail.status)}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={orderStatusMeta(detail.status).tone}>{orderStatusLabel(detail.status)}</Badge>
          {detail._count.proofs > 0 && <Badge tone="success">{detail._count.proofs} preuve(s)</Badge>}
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Enlèvement</dt>
            <dd className="mt-1 text-slate-800">{detail.pickupAddress}</dd>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Livraison</dt>
            <dd className="mt-1 text-slate-800">{detail.deliveryAddress}</dd>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Destinataire</dt>
            <dd className="mt-1 font-medium text-slate-800">{detail.customer.name}</dd>
            <dd className="text-xs text-slate-500">
              {[detail.customer.phone, detail.customer.email].filter(Boolean).join(' · ') || '—'}
            </dd>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Livreur</dt>
            <dd className="mt-1 text-slate-800">
              {detail.driver ? detail.driver.user.name : <span className="text-slate-400">Non affecté</span>}
            </dd>
            <dd className="text-xs text-slate-500">{detail.driver?.user.email}</dd>
          </div>
        </dl>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Livraison estimée : {detail.estimatedDeliveryAt ? formatDate(detail.estimatedDeliveryAt) : 'non renseignée'}
          </p>
          {detail.note && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Note : {detail.note}</p>
          )}
        </div>

        {canAssign && (
          <div className="flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3">
            <div className="min-w-[14rem] flex-1">
              <Select
                label="Affecter / réaffecter"
                value={selectedDriver}
                placeholder="Choisir un livreur…"
                options={(drivers.data?.items ?? []).map((d) => ({
                  value: d.id,
                  label: `${d.user.name} — ${availabilityMeta(d.availability).label}`,
                }))}
                onChange={(e) => setSelectedDriver(e.target.value)}
              />
            </div>
            <Button size="sm" variant="secondary" disabled={!selectedDriver} loading={assigning} onClick={assign}>
              Affecter
            </Button>
            {detail.status === 'ASSIGNED' && (
              <ConfirmButton
                label="Désaffecter"
                onConfirm={async () => {
                  await api.patch(`/api/orders/${orderId}/assign`, { driverId: null });
                  order.refetch();
                  onMutation();
                }}
                onError={(m) => onToast('Action refusée', m)}
              />
            )}
          </div>
        )}

        {canTransition && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <p className="w-full text-xs font-medium uppercase tracking-wide text-slate-400">Faire avancer la commande</p>
            {nextStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="secondary"
                loading={busyStatus === s}
                onClick={() => void transition(s)}
              >
                {orderStatusLabel(s)}
              </Button>
            ))}
          </div>
        )}

        <section aria-label="Historique">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Historique</p>
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {detail.history.map((h) => (
              <li key={h.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 shadow"
                />
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-800">{orderStatusLabel(h.status)}</span>
                  <span className="tabular-nums text-xs text-slate-400">{formatDate(h.createdAt)}</span>
                </p>
                {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
              </li>
            ))}
          </ol>
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          {canDelete && (
            <Button variant="danger" onClick={() => setOpenDelete(true)}>
              Supprimer
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>

      {openDelete && (
        <ConfirmModal
          title="Supprimer cette commande ?"
          description="Commande jamais prise en charge : sa suppression est définitive (n° de suivi et lien invalidés)."
          confirmLabel="Supprimer"
          onClose={() => setOpenDelete(false)}
          onConfirm={async () => {
            await api.delete(`/api/orders/${orderId}`);
            onMutation();
            onClose();
          }}
          onError={(m) => onToast('Suppression refusée', m)}
        />
      )}
    </Modal>
  );
}

/* ------------------------------ Confirmations réutilisables ------------------------------ */

function ConfirmButton({
  label,
  onConfirm,
  onError,
}: {
  label: string;
  onConfirm: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onConfirm();
        } catch (err) {
          onError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  onError,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } catch (err) {
                onError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
    </Modal>
  );
}