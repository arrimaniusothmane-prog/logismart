import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PortalShell } from '../shared/PortalShell';
import { useClientAuth } from './ClientAuthContext';

export function ClientLoginPage() {
  const { login } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/client/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalShell
      home="/client"
      links={[
        { to: '/client', label: 'Accueil', end: true },
        { to: '/client/register', label: 'Activer mon suivi' },
      ]}
      actions={
        <Link to="/company" className="p-btn p-btn-ghost p-btn-sm">
          Espace entreprise
        </Link>
      }
    >
      <section className="p-section">
        <div className="p-container">
          <div className="p-hero-grid" style={{ alignItems: 'center', gap: 44 }}>
            <div className="p-stack p-fade-up" style={{ gap: 20 }}>
              <span className="p-eyebrow">Client portal</span>
              <h1 className="p-display">
                Votre colis,
                <br />
                <span className="p-grad">en un coup d'œil.</span>
              </h1>
              <p className="p-lead">
                Connectez-vous pour suivre vos livraisons en direct, recevoir les notifications et échanger avec
                l'assistant LogiSmart.
              </p>
              <p className="p-small">
                Pas encore de compte ?{' '}
                <Link to="/client/register" className="p-link">
                  Activez votre suivi avec un numéro de commande →
                </Link>
              </p>
            </div>

            <div className="p-card p-card-pad p-fade-up p-d2" style={{ maxWidth: 460, width: '100%', justifySelf: 'end' }}>
              <span className="p-eyebrow">Connexion</span>
              <h2 className="p-h2" style={{ fontSize: 28, margin: '6px 0 22px' }}>
                Bon retour parmi nous
              </h2>

              <form onSubmit={submit} className="p-stack" style={{ gap: 18 }}>
                <label className="p-field">
                  <span className="p-label">E-mail</span>
                  <input
                    className="p-input"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="camille@example.test"
                  />
                </label>

                <label className="p-field">
                  <span className="p-label">Mot de passe</span>
                  <input
                    className="p-input"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </label>

                {error && (
                  <p className="p-small" style={{ color: 'var(--p-danger)' }} role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" className="p-btn p-btn-primary p-btn-block" disabled={busy}>
                  {busy ? 'Connexion…' : 'Se connecter'}
                </button>
              </form>

              <div className="p-card p-card-pad" style={{ marginTop: 22, background: 'var(--p-bg)' }}>
                <span className="p-eyebrow">Compte de démonstration</span>
                <p className="p-small" style={{ marginTop: 8 }}>
                  <span className="p-mono">camille@example.test</span> · mot de passe{' '}
                  <span className="p-mono">Demo!Pass123</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PortalShell>
  );
}
