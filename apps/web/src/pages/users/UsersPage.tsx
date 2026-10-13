import { useMemo, useState, type FormEvent } from 'react';
import { ROLES, type Paginated, type Role } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { ApiError, api, qs } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { roleLabel, userStatusMeta } from '../../lib/status';
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
  type Column,
} from '../../components/ui';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 10;

const STATUSES = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'INVITED', label: 'Invité' },
  { value: 'SUSPENDED', label: 'Suspendu' },
];

function roleOptions(currentRole: Role): Array<{ value: string; label: string }> {
  return ROLES.filter((r) => r !== 'SUPER_ADMIN' || currentRole === 'SUPER_ADMIN').map((r) => ({
    value: r,
    label: roleLabel(r),
  }));
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: Role;
  status: string;
}

const EMPTY_FORM: FormState = { name: '', email: '', password: '', role: 'DISPATCHER', status: 'ACTIVE' };

export function UsersPage() {
  const { user: me, can, reload: reloadAuth } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [deactivateRow, setDeactivateRow] = useState<UserRow | null>(null);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    sort: 'createdAt',
    order: 'desc',
  });

  const users = useApi<Paginated<UserRow>>(`/api/users${query}`, [query]);
  const rows = users.data?.items ?? [];
  const total = users.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Array<Column<UserRow>> = useMemo(() => {
    const cols: Array<Column<UserRow>> = [
      {
        key: 'name',
        header: 'Utilisateur',
        render: (u) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">
              {u.name}
              {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(vous)</span>}
            </p>
            <p className="truncate text-xs text-slate-500">{u.email}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Rôle',
        hideBelow: 'sm',
        render: (u) => <Badge tone="brand">{roleLabel(u.role)}</Badge>,
      },
      {
        key: 'status',
        header: 'Statut',
        hideBelow: 'md',
        render: (u) => {
          const meta = userStatusMeta(u.status);
          return <Badge tone={meta.tone}>{meta.label}</Badge>;
        },
      },
      {
        key: 'lastLoginAt',
        header: 'Dernière connexion',
        hideBelow: 'lg',
        render: (u) => (
          <span className="tabular-nums text-slate-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Jamais'}</span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Créé le',
        align: 'right',
        hideBelow: 'lg',
        render: (u) => <span className="tabular-nums text-slate-500">{formatDate(u.createdAt)}</span>,
      },
    ];

    if (can('user:update') || can('user:delete')) {
      cols.push({
        key: 'actions',
        header: '',
        align: 'right',
        render: (u) => (
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {can('user:update') && (
              <Button size="sm" variant="ghost" onClick={() => setEditRow(u)}>
                Modifier
              </Button>
            )}
            {can('user:delete') && u.id !== me?.id && u.status !== 'SUSPENDED' && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeactivateRow(u)}
              >
                Désactiver
              </Button>
            )}
          </div>
        ),
      });
    }
    return cols;
  }, [can, me]);

  if (!can('user:read')) {
    return (
      <Card>
        <EmptyState
          title="Accès refusé"
          description="Votre rôle ne dispose pas de la permission user:read."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {users.loading ? 'Chargement…' : `${total} compte${total > 1 ? 's' : ''} dans votre périmètre`}
          </p>
        </div>
        {can('user:create') && (
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            Nouvel utilisateur
          </Button>
        )}
      </div>

      <Card flush>
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <div className="min-w-[12rem] flex-1">
            <Input
              placeholder="Rechercher un nom ou un e-mail…"
              value={search}
              aria-label="Rechercher un utilisateur"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filtrer par rôle"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: 'Tous les rôles' }, ...roleOptions(me?.role ?? 'DISPATCHER')]}
          />
          <Select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={STATUSES}
          />
        </div>

        {users.loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={5} />
        ) : users.error ? (
          <div className="p-4">
            <ErrorState
              title="Impossible de charger les utilisateurs"
              description={users.error.message}
              action={
                <Button size="sm" variant="secondary" onClick={users.refetch}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucun résultat"
              description={
                search || roleFilter || statusFilter
                  ? 'Aucun compte ne correspond à ces filtres.'
                  : 'Commencez par créer un compte pour votre équipe.'
              }
              action={
                search || roleFilter || statusFilter ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setRoleFilter('');
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
            rowKey={(u) => u.id}
            caption="Liste des utilisateurs"
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
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>

      {createOpen && me && (
        <UserFormModal
          title="Nouvel utilisateur"
          submitLabel="Créer le compte"
          meRole={me.role}
          companyId={me.companyId ?? ''}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            users.refetch();
          }}
        />
      )}

      {editRow && me && (
        <UserEditModal
          user={editRow}
          meRole={me.role}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            users.refetch();
            if (editRow.id === me.id) void reloadAuth();
          }}
        />
      )}

      {deactivateRow && (
        <DeactivateModal
          user={deactivateRow}
          onClose={() => setDeactivateRow(null)}
          onDone={() => {
            setDeactivateRow(null);
            users.refetch();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Création ------------------------------ */

function UserFormModal({
  title,
  submitLabel,
  meRole,
  companyId,
  initial,
  onClose,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  meRole: Role;
  companyId: string;
  initial?: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    setSaving(true);
    try {
      await api.post('/api/users', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        status: form.status,
        ...(meRole === 'SUPER_ADMIN' ? { companyId } : {}),
      });
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
    <Modal open title={title} description="Le compte recevra ses identifiants par e-mail (fonctionnalité à venir)." onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <Input
          label="Nom complet"
          required
          value={form.name}
          error={errors.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          label="Adresse e-mail"
          type="email"
          required
          value={form.email}
          error={errors.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Mot de passe"
          type="password"
          required
          minLength={8}
          hint="8 caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial."
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Rôle"
            value={form.role}
            options={roleOptions(meRole)}
            error={errors.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
          />
          <Select
            label="Statut"
            value={form.status}
            options={[
              { value: 'ACTIVE', label: 'Actif' },
              { value: 'INVITED', label: 'Invité' },
              { value: 'SUSPENDED', label: 'Suspendu' },
            ]}
            error={errors.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          />
        </div>

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

/* ------------------------------ Modification ------------------------------ */

function UserEditModal({
  user,
  meRole,
  onClose,
  onSaved,
}: {
  user: UserRow;
  meRole: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState(user.status);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    setSaving(true);
    try {
      await api.patch(`/api/users/${user.id}`, { name: name.trim(), role, status });
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
    <Modal
      open
      title="Modifier l'utilisateur"
      description={user.email}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="edit-user-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="info">
          Un changement de rôle ou de statut déconnecte immédiatement toutes les sessions de cet utilisateur.
        </Alert>
        <Input label="Nom complet" required value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Rôle"
            value={role}
            options={roleOptions(meRole)}
            error={errors.role}
            disabled={user.role === 'SUPER_ADMIN' && meRole !== 'SUPER_ADMIN'}
            onChange={(e) => setRole(e.target.value as Role)}
          />
          <Select
            label="Statut"
            value={status}
            options={[
              { value: 'ACTIVE', label: 'Actif' },
              { value: 'INVITED', label: 'Invité' },
              { value: 'SUSPENDED', label: 'Suspendu' },
            ]}
            error={errors.status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Désactivation ------------------------------ */

function DeactivateModal({
  user,
  onClose,
  onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/users/${user.id}`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Désactiver ce compte ?"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy}>
            Désactiver
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm text-slate-600">
        <strong>{user.name}</strong> ({user.email}) ne pourra plus se connecter. Ses sessions actives seront
        révoquées. La réactivation reste possible depuis cette page.
      </p>
    </Modal>
  );
}
