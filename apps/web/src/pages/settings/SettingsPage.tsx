import { useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { ApiError, api } from '../../lib/api';
import { formatDateOnly } from '../../lib/format';
import { Alert, Button, Card, CardGrid, EmptyState, ErrorState, Input, Skeleton, StatCard, Textarea } from '../../components/ui';

const ICONS = {
  company: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M10 9h4M10 13h4M10 5.5V7h4V5.5" />
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    </svg>
  ),
};

interface CompanyShape {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
}

export function SettingsPage() {
  const { user, can } = useAuth();
  const company = useApi<CompanyShape | null>('/api/companies/mine');

  if (!can('company:read')) {
    return (
      <Card>
        <EmptyState title="Accès refusé" description="Permission company:read requise." />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CardGrid>
        <StatCard
          label="Entreprise"
          value={company.loading ? '…' : company.data?.name ?? '—'}
          hint={company.data ? `Créée le ${formatDateOnly(company.data.createdAt)}` : 'Contexte plateforme'}
          icon={ICONS.company}
          tone="brand"
        />
        <StatCard label="Compte" value={user?.name ?? '—'} hint={user?.email} icon={ICONS.security} tone="neutral" />
      </CardGrid>

      {company.loading ? (
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : company.error ? (
        <Card>
          <ErrorState title="Impossible de charger les informations" description={company.error.message} />
        </Card>
      ) : company.data ? (
        <>
          <CompanyForm company={company.data} onRenamed={company.refetch} />
          <ChangePasswordCard />
        </>
      ) : (
        <CompanyAccessNote />
      )}
    </div>
  );
}

/* ------------------------------ Info entreprise ------------------------------ */

function CompanyForm({ company, onRenamed }: { company: CompanyShape; onRenamed: () => void }) {
  const { can } = useAuth();
  const [name, setName] = useState(company.name);
  const [email, setEmail] = useState(company.email ?? '');
  const [phone, setPhone] = useState(company.phone ?? '');
  const [address, setAddress] = useState(company.address ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const editable = can('company:update');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);
    setSaving(true);
    try {
      await api.patch(`/api/companies/${company.id}`, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      setSaved(true);
      onRenamed();
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
    <Card title="Informations de l'entreprise" description="Visibles par votre équipe et dans l'espace de suivi client.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        {saved && <Alert tone="success">Entreprise mise à jour.</Alert>}

        <Input
          label="Nom"
          required
          disabled={!editable}
          value={name}
          error={fieldErrors.name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="E-mail de contact"
            type="email"
            disabled={!editable}
            value={email}
            error={fieldErrors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Téléphone"
            disabled={!editable}
            value={phone}
            error={fieldErrors.phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Textarea
          label="Adresse"
          rows={3}
          disabled={!editable}
          value={address}
          error={fieldErrors.address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Identifiant public : <code className="rounded bg-slate-100 px-1.5 py-0.5">{company.slug}</code>
          </p>
          {editable && (
            <Button type="submit" loading={saving} disabled={!name.trim()}>
              Enregistrer
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------ Mot de passe ------------------------------ */

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setDone(false);
    setSaving(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setDone(true);
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
    <Card title="Sécurité" description="Mettez à jour votre mot de passe. Vos autres sessions seront révoquées.">
      <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        {done && (
          <Alert tone="success" title="Mot de passe mis à jour">
            Votre mot de passe a été modifié avec succès.
          </Alert>
        )}
        <Input
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          error={fieldErrors.currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          hint="8 caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial."
          value={newPassword}
          error={fieldErrors.newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!currentPassword || !newPassword}>
            Mettre à jour
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------ Note hors entreprise ------------------------------ */

function CompanyAccessNote() {
  const { logout } = useAuth();
  return (
    <Card title="Aucune entreprise associée">
      <p className="text-sm text-slate-600">
        Votre compte (SUPER_ADMIN) n'est rattaché à aucune entreprise : les réglages d'entreprise ne s'appliquent
        pas ici. Vous administrez la plateforme depuis la page « Entreprises ».
      </p>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={() => void logout().then(() => window.location.assign('/login'))}>
          Se déconnecter
        </Button>
      </div>
    </Card>
  );
}