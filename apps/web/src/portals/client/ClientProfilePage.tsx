import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Avatar, StatTile } from '../shared/primitives';
import { PModal } from '../shared/PModal';
import { useClientAuth } from './ClientAuthContext';

export function ClientProfilePage() {
  const { customer, patchCustomer, logout } = useClientAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await patchCustomer({ name: name.trim(), phone: phone.trim(), address: address.trim() });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await api.post('/api/portal/password', {
        currentPassword,
        password: newPassword,
      });
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Le mot de passe n’a pas pu être modifié.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const doLogout = async () => {
    await logout();
    navigate('/client', { replace: true });
  };

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader eyebrow="Mon compte" title="Profil" lead="Vos coordonnées et votre session client." />

        <div className="p-grid-main" style={{ marginTop: 34 }}>
          <div className="p-stack" style={{ gap: 20 }}>
            <div className="p-card p-card-pad p-fade-up">
              <span className="p-eyebrow">Coordonnées</span>
              <h2 className="p-h3" style={{ margin: '6px 0 22px' }}>
                Modifier mes informations
              </h2>

              <form onSubmit={submit} className="p-stack" style={{ gap: 18 }}>
                <label className="p-field">
                  <span className="p-label">Nom</span>
                  <input
                    className="p-input"
                    required
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                <label className="p-field">
                  <span className="p-label">Téléphone</span>
                  <input
                    className="p-input"
                    type="tel"
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+33 6 00 00 00 00"
                  />
                </label>

                <label className="p-field">
                  <span className="p-label">Adresse</span>
                  <textarea
                    className="p-textarea"
                    rows={3}
                    maxLength={240}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="10 av. des Champs, 75008 Paris"
                  />
                </label>

                {error && (
                  <p className="p-small" style={{ color: 'var(--p-danger)' }} role="alert">
                    {error}
                  </p>
                )}
                {saved && (
                  <p className="p-small" style={{ color: 'var(--p-success, #16a34a)' }} role="status">
                    Modifications enregistrées.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button type="submit" className="p-btn p-btn-primary" disabled={busy}>
                    {busy ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button type="button" className="p-btn p-btn-ghost" onClick={() => setConfirmLogout(true)}>
                    Se déconnecter
                  </button>
                </div>
              </form>
            </div>

            <div className="p-card p-card-pad p-fade-up p-d2">
              <span className="p-eyebrow">Sécurité</span>
              <h2 className="p-h3" style={{ margin: '6px 0 22px' }}>
                Changer mon mot de passe
              </h2>

              <form onSubmit={submitPassword} className="p-stack" style={{ gap: 18 }}>
                <label className="p-field">
                  <span className="p-label">Mot de passe actuel</span>
                  <input
                    className="p-input"
                    type="password"
                    required
                    autoComplete="current-password"
                    maxLength={128}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </label>

                <label className="p-field">
                  <span className="p-label">Nouveau mot de passe</span>
                  <input
                    className="p-input"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8 caractères minimum"
                  />
                </label>

                <label className="p-field">
                  <span className="p-label">Confirmer le nouveau mot de passe</span>
                  <input
                    className="p-input"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </label>

                {passwordError && (
                  <p className="p-small" style={{ color: 'var(--p-danger)' }} role="alert">
                    {passwordError}
                  </p>
                )}
                {passwordSaved && (
                  <p className="p-small" style={{ color: 'var(--p-success, #16a34a)' }} role="status">
                    Mot de passe modifié. Utilisez-le dès votre prochaine connexion.
                  </p>
                )}

                <div>
                  <button type="submit" className="p-btn p-btn-primary" disabled={passwordBusy}>
                    {passwordBusy ? 'Modification…' : 'Modifier le mot de passe'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="p-stack" style={{ gap: 20 }}>
            <div className="p-card p-card-pad p-fade-up p-d2">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <Avatar name={customer?.name} large tone="accent" />
                <div className="p-stack" style={{ gap: 4 }}>
                  <span className="p-h3">{customer?.name ?? '—'}</span>
                  <span className="p-small">{customer?.email ?? '—'}</span>
                </div>
              </div>

              <div className="p-stack" style={{ gap: 14, marginTop: 20 }}>
                <div className="p-cell">
                  <span className="p-cell-label">Transporteur</span>
                  <span style={{ fontWeight: 600 }}>{customer?.company.name ?? '—'}</span>
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">Compte créé le</span>
                  <span style={{ fontWeight: 600 }}>{customer ? formatDate(customer.createdAt) : '—'}</span>
                </div>
                <div className="p-cell">
                  <span className="p-cell-label">E-mail</span>
                  <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{customer?.email ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="p-grid-2 p-fade-up p-d3">
              <StatTile label="Commandes" value={customer?.totalOrders ?? 0} />
              <StatTile
                label="En cours"
                value={customer?.activeOrder ? '1' : '0'}
                accent
                hint={customer?.activeOrder?.trackingNumber}
              />
            </div>
          </div>
        </div>
      </div>

      <PModal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        eyebrow="Session"
        title="Se déconnecter ?"
        footer={
          <>
            <button type="button" className="p-btn p-btn-ghost" onClick={() => setConfirmLogout(false)}>
              Annuler
            </button>
            <button type="button" className="p-btn p-btn-primary" onClick={() => void doLogout()}>
              Se déconnecter
            </button>
          </>
        }
      >
        <p className="p-body">
          Vous devrez vous reconnecter avec votre e-mail et votre mot de passe pour retrouver vos livraisons.
        </p>
      </PModal>
    </section>
  );
}
