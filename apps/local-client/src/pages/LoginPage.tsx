import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';
import { Button, Input, Alert, Spinner } from '../components/ui';

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('livreur1@demo.test');
  const [password, setPassword] = useState('Demo!Pass123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Vérification de votre session…" />
      </div>
    );
  }

  const from = (location.state as { from?: string } | null)?.from;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(from ?? (user.role === 'DRIVER' ? '/driver/dashboard' : '/login'), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            LS
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-slate-900">LogiSmart Desktop</h1>
            <p className="text-sm text-slate-500">Espace livreur</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="vous@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" fullWidth loading={loading}>
            Se connecter
          </Button>
        </form>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Connexion rapide (démo)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li><code className="rounded bg-white px-1.5 py-0.5">livreur1@demo.test</code></li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">Mot de passe : <code className="rounded bg-white px-1.5 py-0.5">Demo!Pass123</code></p>
        </div>
      </div>
    </div>
  );
}
