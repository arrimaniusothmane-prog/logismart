import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../lib/api';
import { Button, Input, Alert, Spinner } from '../../components/ui';
import { homeRouteFor } from '../../components/layout/nav';

/** Jeton de suivi public de démonstration — doit correspondre au seed (`DEMO_TRACKING_TOKEN`). */
const DEMO_TRACKING_TOKEN = 'demo-suivi-ls-cmll-01';

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    setFieldErrors({});
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(from ?? homeRouteFor(user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const issues = err.validationIssues;
        if (issues.length > 0) {
          setFieldErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        } else {
          setError(err.message);
        }
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panneau marque */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-sidebar p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold">LS</span>
          <span className="text-lg font-semibold">LogiSmart</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Pilotez vos livraisons, votre support et vos recrutements au même endroit.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Logisticiens, livreurs, recruteurs et clients travaillent sur une seule source de vérité —
            avec un support client IA branché sur vos vraies données de livraison.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Suivi temps réel et preuve de livraison</li>
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Chatbot IA connecté à vos commandes</li>
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Pipeline RH avec analyse de CV</li>
        </ul>
      </div>

      {/* Formulaire */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">LS</span>
            <span className="text-lg font-semibold text-slate-900">LogiSmart</span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">Connexion</h2>
          <p className="mt-1.5 text-sm text-slate-500">Accédez à votre espace LogiSmart.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {error && <Alert tone="danger">{error}</Alert>}

            <Input
              label="Adresse e-mail"
              type="email"
              name="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="vous@entreprise.fr"
              value={email}
              error={fieldErrors.email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Mot de passe"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              error={fieldErrors.password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" fullWidth loading={loading}>
              Se connecter
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comptes de démonstration
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li><code className="rounded bg-white px-1.5 py-0.5">admin@demo.test</code> — administrateur entreprise</li>
              <li><code className="rounded bg-white px-1.5 py-0.5">dispatch@demo.test</code> — dispatcheur</li>
              <li><code className="rounded bg-white px-1.5 py-0.5">recruteur@demo.test</code> — recruteur</li>
              <li><code className="rounded bg-white px-1.5 py-0.5">livreur1@demo.test</code> — livreur</li>
              <li><code className="rounded bg-white px-1.5 py-0.5">super@demo.test</code> — super admin plateforme</li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">Mot de passe commun : <code className="rounded bg-white px-1.5 py-0.5">Demo!Pass123</code></p>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Autres espaces
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link to="/company" className="rounded-md border border-brand-200 bg-white px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">
                Espace entreprise (/company)
              </Link>
              <Link to="/client" className="rounded-md border border-brand-200 bg-white px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">
                Portail client (/client)
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Cette démonstration est une preuve de concept — n'utilisez pas de mot de passe réel.{' '}
            <Link to={`/track/${DEMO_TRACKING_TOKEN}`} className="text-brand-600 hover:underline">
              Voir le suivi public
            </Link>
            {' · '}
            <Link to="/client" className="text-brand-600 hover:underline">
              Portail client
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
