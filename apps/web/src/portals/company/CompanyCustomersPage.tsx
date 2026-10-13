import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { qs } from '../../lib/api';
import { formatDateOnly, formatNumber } from '../../lib/format';
import { Loader, ErrorPanel, PageHeader, EmptyPanel, Avatar } from '../shared/primitives';

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  _count: { orders: number };
}

const PAGE_SIZE = 12;

export function CompanyCustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = qs({ page, limit: PAGE_SIZE, search: search.trim() || undefined });
  const customers = useApi<Paginated<CustomerRow>>(`/api/customers${query}`, [query]);
  const rows = customers.data?.items ?? [];
  const total = customers.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Customers"
          title="Clients"
          lead="Tous les destinataires de votre réseau, leur volume de commandes et leur dernière activité."
        />

        <div className="p-spread" style={{ margin: '34px 0 22px' }}>
          <span className="p-small">{formatNumber(total)} clients</span>
          <div className="p-field" style={{ minWidth: 'min(320px, 100%)' }}>
            <input
              className="p-input"
              type="search"
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Rechercher un client"
            />
          </div>
        </div>

        {customers.loading && !customers.data ? (
          <Loader label="Chargement des clients…" />
        ) : customers.error ? (
          <ErrorPanel error={customers.error} onRetry={customers.refetch} />
        ) : rows.length === 0 ? (
          <EmptyPanel title="Aucun client" description="Aucun résultat pour cette recherche." />
        ) : (
          <div className="p-card" style={{ overflow: 'hidden' }}>
            <div className="p-rowlist" style={{ borderTop: 'none' }}>
              <div className="p-row p-row-head cols-customers" aria-hidden>
                <span>Client</span>
                <span>Contact</span>
                <span>Commandes</span>
                <span>Client depuis</span>
              </div>

              {rows.map((customer) => (
                <Link key={customer.id} to={`/company/customers/${customer.id}`} className="p-row cols-customers">
                  <span className="p-cell" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={customer.name} />
                    <span className="p-stack" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 700 }}>{customer.name}</span>
                      <span className="p-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {customer.address ?? '—'}
                      </span>
                    </span>
                  </span>
                  <span className="p-cell">
                    <span className="p-cell-label">Contact</span>
                    <span className="p-small">{customer.email ?? customer.phone ?? '—'}</span>
                  </span>
                  <span className="p-cell">
                    <span className="p-cell-label">Commandes</span>
                    <span className="p-mono" style={{ fontWeight: 500 }}>
                      {customer._count.orders}
                    </span>
                  </span>
                  <span className="p-cell">
                    <span className="p-cell-label">Client depuis</span>
                    <span className="p-small">{formatDateOnly(customer.createdAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="p-spread" style={{ marginTop: 24 }}>
            <span className="p-small">
              Page {page} / {totalPages}
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
