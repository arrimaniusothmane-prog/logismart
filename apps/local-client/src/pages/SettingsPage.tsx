import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, api } from '../lib/api';
import { Card, Input, Button, Alert } from '../components/ui';

export function SettingsPage() {
  const { user } = useAuth();
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
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
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
    <div className="p-6">
      <h2 className="mb-6 text-xl font-semibold text-slate-900">Paramètres</h2>

      <Card title="Mot de passe" description="Mettez à jour votre mot de passe. Vos autres sessions seront révoquées." flush>
        <div className="p-5">
          <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
            {error && <Alert tone="danger">{error}</Alert>}
            {done && (
              <Alert tone="success" title="Mot de passe mis à jour">
                Votre mot de passe a été modifié. Vos autres sessions ont été révoquées.
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
              minLength={8}
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
        </div>
      </Card>

      <Card title="Compte" description={`Connecté en tant que ${user?.email ?? '—'}`} className="mt-4" flush>
        <div className="p-5 text-sm text-slate-600">
          <p>
            Cette application Desktop se connecte à l'API LogiSmart pour gérer vos livraisons. Les
            données sont synchronisées en temps réel avec le serveur.
          </p>
        </div>
      </Card>
    </div>
  );
}
