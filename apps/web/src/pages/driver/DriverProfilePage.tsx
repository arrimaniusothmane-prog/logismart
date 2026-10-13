import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { ApiError, api } from '../../lib/api';
import { formatDate, formatNumber } from '../../lib/format';
import { availabilityMeta, vehicleLabel, roleLabel } from '../../lib/status';
import {
  Badge,
  Button,
  Card,
  CardGrid,
  EmptyState,
  Input,
  Modal,
  Select,
  StatCard,
  Spinner,
  useToast,
} from '../../components/ui';
import { DRIVER_AVAILABILITIES, VEHICLE_TYPES, type DriverAvailability, type VehicleType } from '@logismart/shared';

interface DriverProfile {
  id: string;
  userId: string;
  phone: string | null;
  vehicleType: string;
  licenseNumber: string | null;
  availability: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationAt: string | null;
  totalDeliveries: number;
  successfulDeliveries: number;
  createdAt: string;
  user: { id: string; name: string; email: string; status: string };
  _count: { orders: number };
}

const AVAILABILITY_OPTIONS: Array<{ value: string; label: string }> = DRIVER_AVAILABILITIES.map((a) => ({
  value: a,
  label: availabilityMeta(a).label,
}));

const VEHICLE_OPTIONS: Array<{ value: string; label: string }> = VEHICLE_TYPES.map((v) => ({
  value: v,
  label: vehicleLabel(v),
}));

export function DriverProfilePage() {
  const { can } = useAuth();
  const { error: toastError } = useToast();

  const profile = useApi<DriverProfile>('/api/drivers/me', []);
  const [editOpen, setEditOpen] = useState(false);

  const successRate = useMemo(() => {
    if (!profile.data) return 0;
    return profile.data.totalDeliveries > 0
      ? Math.round((profile.data.successfulDeliveries / profile.data.totalDeliveries) * 100)
      : 0;
  }, [profile.data]);

  if (profile.loading && !profile.data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Chargement de votre profil…" />
      </div>
    );
  }

  if (profile.error) {
    return (
      <Card>
        <EmptyState
          title="Profil introuvable"
          description={profile.error.message}
          action={
            <Button onClick={profile.refetch}>Réessayer</Button>
          }
        />
      </Card>
    );
  }

  if (!profile.data) return null;

  const d = profile.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Mon profil</h2>
        {can('company:update') && (
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            Modifier
          </Button>
        )}
      </div>

      <CardGrid>
        <StatCard
          label="Livraisons totales"
          value={formatNumber(d.totalDeliveries)}
          hint={`${d.successfulDeliveries} réussies`}
          icon={ICON_TRUCK}
          tone="brand"
        />
        <StatCard
          label="Taux de réussite"
          value={`${successRate}%`}
          hint="Livraisons réussies / totales"
          icon={ICON_STATS}
          tone={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Commandes en cours"
          value={formatNumber(d._count.orders)}
          hint="Assignées à vous"
          icon={ICON_CLOCK}
          tone="neutral"
        />
        <StatCard
          label="Disponibilité"
          value={availabilityMeta(d.availability).label}
          hint="Statut actuel"
          icon={ICON_STATUS}
          tone="brand"
        />
      </CardGrid>

      <Card title="Informations personnelles" description="Compte rattaché à votre profil livreur." flush>
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
              <dd className="mt-1 text-slate-800">{roleLabel(d.user.status === 'ACTIVE' ? 'DRIVER' : 'DRIVER')}</dd>
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

      <Card title="Véhicule & disponibilité" description="Vos informations de livraison." flush>
        <div className="p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-400">Type de véhicule</dt>
              <dd className="mt-1 font-medium text-slate-900">{vehicleLabel(d.vehicleType)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Plaque / n° de licence</dt>
              <dd className="mt-1 text-slate-800">{d.licenseNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Disponibilité</dt>
              <dd className="mt-1">
                <Badge tone={availabilityMeta(d.availability).tone} dot>
                  {availabilityMeta(d.availability).label}
                </Badge>
              </dd>
            </div>
            {d.lastLocationAt && (
              <div>
                <dt className="text-xs uppercase text-slate-400">Dernière position</dt>
                <dd className="mt-1 text-xs text-slate-500">{formatDate(d.lastLocationAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      </Card>

      <Card title="Sécurité" description="Gestion de votre mot de passe et sessions." flush>
        <div className="p-5">
          <Link to="/settings">
            <Button variant="ghost">Changer mon mot de passe</Button>
          </Link>
        </div>
      </Card>

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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

const ICON_STATS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13v8h8v-8H3zm0 0V3h8v8H3zm0 0h8v8H3z" />
  </svg>
);

const ICON_CLOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
  </svg>
);

const ICON_STATUS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M15 9h.01M15 15h.01M9 15h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
  </svg>
);

interface EditProfileModalProps {
  profile: DriverProfile;
  onClose: () => void;
  onSaved: () => void;
  onToast: (title: string, description?: string) => void;
}

function EditProfileModal({ profile, onClose, onSaved, onToast }: EditProfileModalProps) {
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
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" form="edit-driver-form" loading={saving}>
            Enregistrer
          </Button>
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
          label="Plaque / n° de licence"
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
