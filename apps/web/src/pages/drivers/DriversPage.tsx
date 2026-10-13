import { useMemo, useState } from 'react';
import type { Paginated } from '@logismart/shared';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../lib/useApi';
import { qs } from '../../lib/api';
import { formatDate, formatNumber } from '../../lib/format';
import { availabilityMeta, vehicleLabel } from '../../lib/status';
import {
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

interface DriverRow {
  id: string;
  userId: string;
  phone: string | null;
  vehicleType: string;
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

interface DriverDetail extends DriverRow {
  lastLocation: { latitude: number; longitude: number; timestamp: string } | null;
}

const PAGE_SIZE = 10;

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Toutes les disponibilités' },
  { value: 'ONLINE', label: 'En ligne' },
  { value: 'OFFLINE', label: 'Hors ligne' },
  { value: 'BUSY', label: 'Occupé' },
  { value: 'ON_LEAVE', label: 'Congé' },
];

export function DriversPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<DriverRow | null>(null);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    availability: availability || undefined,
    sort: 'createdAt',
    order: 'desc',
  });

  const drivers = useApi<Paginated<DriverRow>>(`/api/drivers${query}`, [query]);
  const rows = drivers.data?.items ?? [];
  const total = drivers.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Array<Column<DriverRow>> = useMemo(
    () => [
      {
        key: 'name',
        header: 'Livreur',
        render: (d) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{d.user.name}</p>
            <p className="truncate text-xs text-slate-500">{d.user.email}</p>
          </div>
        ),
      },
      {
        key: 'availability',
        header: 'Disponibilité',
        render: (d) => {
          const meta = availabilityMeta(d.availability);
          return <Badge tone={meta.tone}>{meta.label}</Badge>;
        },
      },
      {
        key: 'vehicleType',
        header: 'Véhicule',
        hideBelow: 'sm',
        render: (d) => <span className="capitalize text-slate-700">{vehicleLabel(d.vehicleType)}</span>,
      },
      {
        key: 'deliveries',
        header: 'Livraisons',
        hideBelow: 'md',
        render: (d) => (
          <span className="tabular-nums text-slate-700">
            {formatNumber(d.successfulDeliveries)} / {formatNumber(d.totalDeliveries)}
          </span>
        ),
      },
      {
        key: 'lastLocationAt',
        header: 'Dernière position',
        hideBelow: 'lg',
        render: (d) => (
          <span className="tabular-nums text-slate-500">{d.lastLocationAt ? formatDate(d.lastLocationAt) : 'Jamais'}</span>
        ),
      },
      {
        key: 'orders',
        header: 'Commandes',
        align: 'right',
        hideBelow: 'lg',
        render: (d) => <span className="tabular-nums text-slate-500">{d._count.orders}</span>,
      },
    ],
    [],
  );

  if (!can('driver:read')) {
    return (
      <Card>
        <EmptyState title="Accès refusé" description="Votre rôle ne dispose pas de la permission driver:read." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {drivers.loading ? 'Chargement…' : `${total} livreur${total > 1 ? 's' : ''} dans votre périmètre`}
      </p>

      <Card flush>
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <div className="min-w-[12rem] flex-1">
            <Input
              placeholder="Rechercher un livreur…"
              value={search}
              aria-label="Rechercher un livreur"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filtrer par disponibilité"
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setPage(1);
            }}
            options={AVAILABILITY_OPTIONS}
          />
        </div>

        {drivers.loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={6} />
        ) : drivers.error ? (
          <div className="p-4">
            <ErrorState
              title="Impossible de charger les livreurs"
              description={drivers.error.message}
              action={
                <Button size="sm" variant="secondary" onClick={drivers.refetch}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucun livreur"
              description={
                search || availability
                  ? 'Aucun livreur ne correspond à ces filtres.'
                  : 'L\'annuaire des livreurs apparaîtra ici une fois des livreurs créés.'
              }
              action={
                search || availability ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setAvailability('');
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
            onRowClick={(d) => setDetail(d)}
            rowKey={(d) => d.id}
            caption="Liste des livreurs"
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
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>

      {detail && <DriverDetailModal driverId={detail.id} driver={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DriverDetailModal({
  driverId,
  driver,
  onClose,
}: {
  driverId: string;
  driver: DriverRow;
  onClose: () => void;
}) {
  const detail = useApi<DriverDetail>(`/api/drivers/${driverId}`, [driverId]);
  const data = detail.data;
  const availability = availabilityMeta(driver.availability);

  return (
    <Modal
      open
      title={driver.user.name}
      description={driver.user.email}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={availability.tone}>{availability.label}</Badge>
          <Badge tone="brand">{vehicleLabel(driver.vehicleType)}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Téléphone</dt>
            <dd className="mt-1 text-slate-800">{data?.phone ?? driver.phone ?? '—'}</dd>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Commandes en cours</dt>
            <dd className="mt-1 tabular-nums text-slate-800">{driver._count.orders}</dd>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Livraisons réussies</dt>
            <dd className="mt-1 tabular-nums text-slate-800">
              {formatNumber(driver.successfulDeliveries)} / {formatNumber(driver.totalDeliveries)}
            </dd>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Dernière position</dt>
            <dd className="mt-1 text-slate-800">
              {data?.lastLocation
                ? `${data.lastLocation.latitude.toFixed(4)}, ${data.lastLocation.longitude.toFixed(4)}`
                : '—'}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-slate-500">
          Profil actif depuis le {formatDate(driver.createdAt)}. L'édition du profil (véhicule, licence, zones) arrive
          avec l'application mobile livreur.
        </p>
      </div>
    </Modal>
  );
}