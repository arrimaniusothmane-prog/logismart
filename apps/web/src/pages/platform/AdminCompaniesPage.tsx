import { useState, type FormEvent } from 'react';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { ApiError, api, qs } from '../../lib/api';
import { formatDate } from '../../lib/format';
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

interface CompanyRow {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  _count: { users: number; orders: number };
}

const PAGE_SIZE = 10;

export function AdminCompaniesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = qs({ page, limit: PAGE_SIZE, search: search.trim() || undefined, sort: 'createdAt', order: 'desc' });
  const companies = useApi<Paginated<CompanyRow>>(`/api/companies${query}`, [query]);
  const rows = companies.data?.items ?? [];
  const total = companies.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Array<Column<CompanyRow>> = [
    {
      key: 'name',
      header: 'Entreprise',
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{c.name}</p>
          <p className="truncate text-xs text-slate-500">{c.slug}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact',
      hideBelow: 'sm',
      render: (c) => <span className="text-slate-600">{c.email ?? '—'}</span>,
    },
    {
      key: 'users',
      header: 'Comptes',
      hideBelow: 'md',
      render: (c) => <Badge tone="neutral">{c._count.users} utilisateur{c._count.users > 1 ? 's' : ''}</Badge>,
    },
    {
      key: 'orders',
      header: 'Commandes',
      hideBelow: 'md',
      render: (c) => <span className="tabular-nums text-slate-600">{c._count.orders}</span>,
    },
    {
      key: 'createdAt',
      header: 'Créée le',
      align: 'right',
      hideBelow: 'lg',
      render: (c) => <span className="tabular-nums text-slate-500">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {companies.loading ? 'Chargement…' : `${total} entreprise${total > 1 ? 's' : ''} sur la plateforme`}
        </p>
        <Button onClick={() => setCreateOpen(true)}>Créer une entreprise</Button>
      </div>

      <Card flush>
        <div className="border-b border-slate-200 p-4">
          <Input
            placeholder="Rechercher par nom ou slug…"
            value={search}
            aria-label="Rechercher une entreprise"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {companies.loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={4} />
        ) : companies.error ? (
          <div className="p-4">
            <ErrorState title="Impossible de charger les entreprises" description={companies.error.message} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucune entreprise"
              description={
                search ? 'Aucun résultat pour ce filtre.' : 'Créez la première entreprise abonnée à LogiSmart.'
              }
            />
          </div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} caption="Entreprises de la plateforme" />
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
        <CreateCompanyModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            companies.refetch();
          }}
        />
      )}
    </div>
  );
}

interface CreateForm {
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

function CreateCompanyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateForm>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await api.post('/api/companies', {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        admin:
          form.adminEmail.trim()
            ? {
                name: form.adminName.trim() || 'Administrateur',
                email: form.adminEmail.trim(),
                password: form.adminPassword,
              }
            : undefined,
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        const issues = err.validationIssues;
        if (issues.length > 0) setFieldErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
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
      title="Créer une entreprise"
      description="Le slug est l'identifiant public utilisé dans les liens de suivi."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="create-company-form" loading={saving}>
            Créer
          </Button>
        </>
      }
    >
      <form id="create-company-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nom de l'entreprise"
            required
            placeholder="Ex. : Transports Dupont"
            value={form.name}
            error={fieldErrors.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Slug"
            required
            placeholder="transports-dupont"
            value={form.slug}
            error={fieldErrors.slug}
            onChange={(e) => set('slug', e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="E-mail de contact"
            type="email"
            value={form.email}
            error={fieldErrors.email}
            onChange={(e) => set('email', e.target.value)}
          />
          <Input label="Téléphone" value={form.phone} error={fieldErrors.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>

        <hr className="border-slate-200" />
        <p className="text-sm font-medium text-slate-900">Premier administrateur (optionnel)</p>
        <p className="-mt-2 text-xs text-slate-500">
          Un compte COMPANY_ADMIN actif, rattaché à cette entreprise. Son mot de passe n'est pas récupérable en clair.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nom de l'administrateur"
            value={form.adminName}
            error={fieldErrors['admin.name']}
            onChange={(e) => set('adminName', e.target.value)}
          />
          <Input
            label="E-mail de l'administrateur"
            type="email"
            value={form.adminEmail}
            error={fieldErrors['admin.email']}
            onChange={(e) => set('adminEmail', e.target.value)}
          />
        </div>
        <Input
          label="Mot de passe provisionné"
          type="password"
          hint="À transmettre à l'administrateur par un canal sécurisé. 8 caractères minimum."
          value={form.adminPassword}
          error={fieldErrors['admin.password']}
          onChange={(e) => set('adminPassword', e.target.value)}
        />
      </form>
    </Modal>
  );
}