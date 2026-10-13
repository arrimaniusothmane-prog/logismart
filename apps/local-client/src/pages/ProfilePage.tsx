import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/useApi';
import { ApiError, api } from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';
import { availabilityLabel, vehicleLabel, roleLabel } from '../lib/status';
import {
  Badge,
  Button,
  Card,
  CardGrid,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  StatCard,
  useToast,
} from '../components/ui';
import { DRIVER_AVAILABILITIES, VEHICLE_TYPES, type DriverAvailability, type VehicleType } from '@logismart/shared';

interface DriverProfile {
  id: string;
  userId: string;
  phone: string | null;
  vehicleType: string;
  licenseNumber: string | null;
  availability: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  createdAt: string;
  user: { id: string; name: string; email: string; status: string };
  _count: { orders: number };
}

const AVAILABILITY_OPTIONS: Array<{ value: string; label: string }> = DRIVER_AVAILABILITIES.map((a) => ({
  value: a,
  label: availabilityLabel(a),
}));

const VEHICLE_OPTIONS: Array<{ value: string; label: string }> = VEHICLE_TYPES.map((v) => ({
  value: v,
  label: vehicleLabel(v),
}));

export function ProfilePage() {
  useAuth();
  const { error: toastError } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const profile = useApi<DriverProfile>('/api/drivers/me', []);

  const successRate = profile.data
    ? profile.data.totalDeliveries > 0
      ? Math.round((profile.data.successfulDeliveries / profile.data.totalDeliveries) * 100)
      : 0
    : 0;

  if (profile.loading && !profile.data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Chargement de votre profil…" />
      </div>
    );
  }

  if (profile.error && !profile.data) {
    return (
      <div className="p-6">
        <EmptyState
          title="Profil introuvable"
          description={profile.error.message}
          action={
            <Button onClick={profile.refetch}>Réessayer</Button>
          }
        />
      </div>
    );
  }

  if (!profile.data) return null;
  const d = profile.data;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Mon profil</h2>
        <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
          Modifier
        </Button>
      </div>

      <CardGrid>
        <StatCard
          label="Livraisons totales"
          value={formatNumber(d.totalDeliveries)}
          hint="Effectuées"
          icon={ICON_DELIVERED}
          tone="brand"
        />
        <StatCard
          label="Taux de réussite"
          value={`${successRate}%`}
          hint={`${d.successfulDeliveries}/${d.totalDeliveries}`}
          icon={ICON_STATS}
          tone={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'danger'}
        />
        <StatCard
          label="En cours"
          value={formatNumber(d._count.orders)}
          hint="Assignées à vous"
          icon={ICON_TRUCK}
          tone="neutral"
        />
        <StatCard
          label="Disponibilité"
          value={availabilityLabel(d.availability)}
          hint="Statut actuel"
          icon={ICON_STATUS}
          tone="brand"
        />
      </CardGrid>

      <div className="mt-6 space-y-4">
        <Card title="Informations personnelles" flush>
          <div className="p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-slate-400">Nom</dt>
                <dd className="mt-1 font-medium text-slate-900">{d.user.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">E-mail</dt>
                <dd className="mt-1 text-slate-800">{d.user.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Téléphone</dt>
                <dd className="mt-1 text-slate-800">{d.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Rôle</dt>
                <dd className="mt-1 text-slate-800">{roleLabel('DRIVER')}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Compte créé le</dt>
                <dd className="mt-1 text-slate-800">{formatDate(d.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Statut du compte</dt>
                <dd className="mt-1">
                  <Badge tone={d.user.status === 'ACTIVE' ? 'success' : d.user.status === 'INVITED' ? 'info' : 'danger'}>
                    {d.user.status === 'ACTIVE' ? 'Actif' : d.user.status === 'INVITED' ? 'Invité' : 'Suspendu'}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card title="Véhicule" flush>
          <div className="p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-slate-400">Type</dt>
                <dd className="mt-1 font-medium text-slate-900">{vehicleLabel(d.vehicleType)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">N° de licence / plaque</dt>
                <dd className="mt-1 text-slate-800">{d.licenseNumber ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card title="Sécurité" flush>
          <div className="p-5">
            <Link to="/driver/settings">
              <Button variant="ghost">Changer mon mot de passe</Button>
            </Link>
          </div>
        </Card>
      </div>

      {editOpen && (
        <EditProfileModal
          profile={d}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            profile.refetch();
          }}
          onToast={toastError}
        />
      )}
    </div>
  );
}

const ICON_TRUCK = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

const ICON_DELIVERED = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9ZM3 7.5 12 12l9-4.5M12 12v9" />
  </svg>
);

const ICON_STATS = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13v8h8v-8H3Zm0 0V3h8v8H3Zm0 0h8v8H3Z" />
  </svg>
);

const ICON_STATUS = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M15 9h.01M15 15h.01M9 15h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
  </svg>
);

function EditProfileModal({
  profile,
  onClose,
  onSaved,
  onToast,
}: {
  profile: DriverProfile;
  onClose: () => void;
  onSaved: () => void;
  onToast: (title: string, description?: string) => void;
}) {
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [vehicleType, setVehicleType] = useState(profile.vehicleType);
  const [licenseNumber, setLicenseNumber] = useState(profile.licenseNumber ?? '');
  const [availability, setAvailability] = useState(profile.availability);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await api.patch(`/api/drivers/${profile.id}`, {
        phone: phone.trim() || undefined,
        vehicleType,
        licenseNumber: licenseNumber.trim() || undefined,
        availability,
      });
      onSaved();
      onToast('Succès', 'Profil mis à jour.');
    } catch (err) {
      if (err instanceof ApiError) {
        const issues = err.validationIssues;
        if (issues.length > 0) setErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        else onToast('Erreur', err.message);
      } else {
        onToast('Erreur', 'Une erreur inattendue est survenue.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Modifier mon profil"
      description="Mettez à jour vos coordonnées, véhicule et disponibilité."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" form="edit-driver-form" loading={saving}>Enregistrer</Button>
        </>
      }
    >
      <form id="edit-driver-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="Téléphone"
          placeholder="06 12 34 56 78"
          value={phone}
          error={errors.phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Select
          label="Type de véhicule"
          value={vehicleType}
          options={VEHICLE_OPTIONS}
          error={errors.vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
        />
        <Input
          label="N° de licence"
          placeholder="AB-123-CD"
          value={licenseNumber}
          error={errors.licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
        />
        <Select
          label="Disponibilité"
          value={availability}
          options={AVAILABILITY_OPTIONS}
          error={errors.availability}
          onChange={(e) => setAvailability(e.target.value as DriverAvailability)}
        />
      </form>
    </Modal>
  );
}
