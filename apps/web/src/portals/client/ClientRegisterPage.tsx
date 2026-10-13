import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PortalShell } from '../shared/PortalShell';
import { ApiError } from '../../lib/api';
import { useClientAuth } from './ClientAuthContext';

const STEPS = [
  { n: '01', title: 'Recevez votre numéro', text: 'Votre transporteur vous transmet un numéro de commande au format LS-XXXX-XXXX-XX.' },
  { n: '02', title: 'Activez votre suivi', text: 'Associez l’e-mail de la commande et choisissez un mot de passe.' },
  { n: '03', title: 'Suivez en direct', text: 'Carte GPS, notifications et assistant : tout est dans votre tableau de bord.' },
];

export function ClientRegisterPage() {
  const { register } = useClientAuth();
  const navigate = useNavigate();

  const [trackingNumber, setTrackingNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      await register(trackingNumber.trim().toUpperCase(), email.trim(), password);
      navigate('/client/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setIssues(err.validationIssues);
      } else {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalShell
      home="/client"
      links={[
        { to: '/client', label: 'Accueil', end: true },
        { to: '/client/login', label: 'Connexion' },
      ]}
      actions={
        <Link to="/company" className="p-btn p-btn-ghost p-btn-sm">
          Espace entreprise
        </Link>
      }
    >
      <section className="p-section">
        <div className="p-container">
          <div className="p-stack p-fade-up" style={{ gap: 14, maxWidth: 720 }}>
            <span className="p-eyebrow">Activation</span>
            <h1 className="p-display">
              Suivez votre livraison.
              <br />
              <span className="p-grad">Dès maintenant.</span>
            </h1>
            <p className="p-lead">
              Créez votre accès client en associant votre numéro de commande — aucune donnée à saisir côté
              transporteur.
            </p>
          </div>

          <div className="p-grid-main" style={{ marginTop: 40 }}>
            <div className="p-card p-card-pad p-fade-up p-d2">
              <span className="p-eyebrow">Créer mon accès</span>
              <h2 className="p-h2" style={{ fontSize: 26, margin: '6px 0 22px' }}>
                Activation du suivi
              </h2>

              <form onSubmit={submit} className="p-stack" style={{ gap: 18 }}>
                <label className="p-field">
                  <span className="p-label">Numéro de commande</span>
                  <input
                    className="p-input p-mono"
                    required
                    minLength={6}
                    maxLength={64}
                    pattern="[A-Za-z0-9\-]+"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="LS-JULI-DEMO-01"
                    style={{ textTransform: 'uppercase' }}
                  />
                </label>

                <label className="p-field">
                  <span className="p-label">E-mail de la commande</span>
                  <input
                    className="p-input"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="julien@example.test"
                  />
                </label>

                <div className="p-grid-2">
                  <label className="p-field">
                    <span className="p-label">Mot de passe</span>
                    <input
                      className="p-input"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 caractères minimum"
                    />
                  </label>

                  <label className="p-field">
                    <span className="p-label">Confirmation</span>
                    <input
                      className="p-input"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Retapez le mot de passe"
                    />
                  </label>
                </div>

                {error && (
                  <div role="alert" style={{ color: 'var(--p-danger)' }}>
                    <p className="p-small">{error}</p>
                    {issues.length > 0 && (
                      <ul className="p-small" style={{ marginTop: 6, paddingLeft: 18 }}>
                        {issues.map((issue) => (
                          <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <button type="submit" className="p-btn p-btn-primary p-btn-block" disabled={busy}>
                  {busy ? 'Activation…' : 'Activer mon suivi'}
                </button>

                <p className="p-small">
                  Déjà activé ?{' '}
                  <Link to="/client/login" className="p-link">
                    Se connecter →
                  </Link>
                </p>
              </form>
            </div>

            <div className="p-stack" style={{ gap: 16 }}>
              {STEPS.map((step, index) => (
                <div key={step.n} className={`p-card p-card-pad p-fade-up p-d${index + 3}`}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span className="p-mono" style={{ fontSize: 26, color: 'var(--p-accent)', fontWeight: 500 }}>
                      {step.n}
                    </span>
                    <div className="p-stack" style={{ gap: 6 }}>
                      <span style={{ fontWeight: 700 }}>{step.title}</span>
                      <span className="p-body" style={{ fontSize: 14.5 }}>
                        {step.text}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="p-card p-card-dark p-card-pad p-fade-up p-d5">
                <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                  Démo
                </span>
                <p className="p-body" style={{ color: '#fff', marginTop: 8 }}>
                  Essayez avec la commande <span className="p-mono">LS-JULI-DEMO-01</span> et l'e-mail{' '}
                  <span className="p-mono">julien@example.test</span> — puis connectez-vous avec{' '}
                  <span className="p-mono">julien@example.test</span> / <span className="p-mono">Demo!Pass123</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PortalShell>
  );
}
