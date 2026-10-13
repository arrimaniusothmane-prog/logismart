import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { qs } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import { availabilityMeta, vehicleLabel } from '../../lib/status';
import { Loader, ErrorPanel, PageHeader, StatusPill, EmptyPanel, Avatar } from '../shared/primitives';

interface DriverRow {
  id: string;
  vehicleType: string;
  availability: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  lastLocationAt: string | null;
  user: { id: string; name: string; email: string };
  _count: { orders: number };
}

const AVAILABILITY_TABS = [
  { value: '', label: 'Tous' },
  { value: 'ONLINE', label: 'En ligne' },
  { value: 'BUSY', label: 'En livraison' },
  { value: 'OFFLINE', label: 'Hors ligne' },
  { value: 'ON_LEAVE', label: 'Congés' },
];

const PAGE_SIZE = 12;

export function CompanyDriversPage() {
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');
  const [page, setPage] = useState(1);

  const query = qs({ page, limit: PAGE_SIZE, search: search.trim() || undefined, availability: availability || undefined });
  const drivers = useApi<Paginated<DriverRow>>(`/api/drivers${query}`, [query]);
  const rows = drivers.data?.items ?? [];
  const total = drivers.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Drivers"
          title="Livreurs"
          lead="Votre équipe sur le terrain : disponibilité, volume et taux de réussite."
        />

        <div className="p-spread" style={{ margin: '34px 0 22px' }}>
          <div className="p-tabs" role="tablist" aria-label="Filtrer par disponibilité">
            {AVAILABILITY_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={availability === tab.value}
                className={`p-tab${availability === tab.value ? ' is-active' : ''}`}
                onClick={() => {
                  setAvailability(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-field" style={{ minWidth: 'min(300px, 100%)' }}>
            <input
              className="p-input"
              type="search"
              placeholder="Rechercher un livreur…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Rechercher un livreur"
            />
          </div>
        </div>

        {drivers.loading && !drivers.data ? (
          <Loader label="Chargement des livreurs…" />
        ) : drivers.error ? (
          <ErrorPanel error={drivers.error} onRetry={drivers.refetch} />
        ) : rows.length === 0 ? (
          <EmptyPanel title="Aucun livreur" description="Aucun résultat pour ces filtres." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18 }}>
            {rows.map((driver, index) => {
              const meta = availabilityMeta(driver.availability);
              const rate =
                driver.totalDeliveries > 0
                  ? Math.round((driver.successfulDeliveries / driver.totalDeliveries) * 100)
                  : null;
              return (
                <Link
                  key={driver.id}
                  to={`/company/drivers/${driver.id}`}
                  className={`p-card p-card-pad p-card-hover p-fade-up p-d${Math.min(index % 6, 5) + 1}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
                >
                  <div className="p-spread">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Avatar name={driver.user.name} large />
                      <div className="p-stack" style={{ gap: 4 }}>
                        <span className="p-h3">{driver.user.name}</span>
                        <span className="p-small">{vehicleLabel(driver.vehicleType)}</span>
                      </div>
                    </div>
                    <StatusPill label={meta.label} tone={meta.tone} live={driver.availability === 'ONLINE' || driver.availability === 'BUSY'} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div className="p-stack" style={{ gap: 4 }}>
                      <span className="p-stat-label">Livraisons</span>
                      <span className="p-mono" style={{ fontSize: 20, fontWeight: 500 }}>
                        {formatNumber(driver.totalDeliveries || driver._count.orders)}
                      </span>
                    </div>
                    <div className="p-stack" style={{ gap: 4 }}>
                      <span className="p-stat-label">Réussite</span>
                      <span className="p-mono" style={{ fontSize: 20, fontWeight: 500 }}>
                        {rate == null ? '—' : `${rate}%`}
                      </span>
                    </div>
                    <div className="p-stack" style={{ gap: 4 }}>
                      <span className="p-stat-label">Actives</span>
                      <span className="p-mono" style={{ fontSize: 20, fontWeight: 500 }}>
                        {driver._count.orders}
                      </span>
                    </div>
                  </div>

                  <div className="p-progress">
                    <span style={{ width: `${rate ?? 0}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="p-spread" style={{ marginTop: 24 }}>
            <span className="p-small">
              {total} livreurs · page {page} / {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="p-btn p-btn-ghost p-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </button>
              <button type="button" className="p-btn p-btn-ghost p-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
