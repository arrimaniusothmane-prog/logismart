import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Paginated } from '@logismart/shared';
import { useApi } from '../../lib/useApi';
import { formatDate } from '../../lib/format';
import { orderStatusMeta } from '../../lib/status';
import { PageHeader, Loader, ErrorPanel, StatusPill, EmptyPanel, Avatar } from '../shared/primitives';
import { PModal } from '../shared/PModal';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../components/ui';
import { useClientAuth, type PortalOrderCard } from './ClientAuthContext';

interface DeliveryService {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
}

const TABS = [
  { key: 'all', label: 'Toutes', match: () => true },
  { key: 'active', label: 'En cours', match: (s: string) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(s) },
  { key: 'delivered', label: 'Livrées', match: (s: string) => s === 'DELIVERED' },
  { key: 'closed', label: 'Échec / annulation', match: (s: string) => s === 'FAILED' || s === 'CANCELLED' },
] as const;

export function ClientOrdersPage() {
  const { customer } = useClientAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Formulaire de création
  const [senderName, setSenderName] = useState(customer?.name ?? '');
  const [senderPhone, setSenderPhone] = useState(customer?.phone ?? '');
  const [pickup, setPickup] = useState(customer?.address ?? '');

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [delivery, setDelivery] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cod, setCod] = useState('');
  const [serviceId, setServiceId] = useState<string>('');
  const [note, setNote] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();

  const orders = useApi<Paginated<PortalOrderCard>>('/api/portal/orders?page=1&limit=100');
  const services = useApi<DeliveryService[]>('/api/portal/services');

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  const filteredOrders = useMemo(() => {
    let items = orders.data?.items ?? [];
    items = items.filter((order) => activeTab.match(order.status));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (order) =>
          order.trackingNumber.toLowerCase().includes(q) ||
          order.deliveryAddress.toLowerCase().includes(q) ||
          (order.pickupAddress && order.pickupAddress.toLowerCase().includes(q)),
      );
    }
    return items;
  }, [orders.data, activeTab, search]);

  const selectedService = useMemo(
    () => services.data?.find((s) => s.id === serviceId) ?? null,
    [services.data, serviceId],
  );

  const resetForm = () => {
    setSenderName(customer?.name ?? '');
    setSenderPhone(customer?.phone ?? '');
    setPickup(customer?.address ?? '');
    setRecipientName('');
    setRecipientPhone('');
    setDelivery('');
    setRecipientCity('');
    setDeliveryInstructions('');
    setDescription('');
    setQuantity('1');
    setCod('');
    setServiceId('');
    setNote('');
    setError(null);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup.trim()) {
      setError('Veuillez renseigner une adresse de départ');
      return;
    }
    if (!delivery.trim()) {
      setError('Veuillez renseigner une adresse de livraison');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        pickupAddress: pickup.trim(),
        deliveryAddress: delivery.trim(),
      };
      if (senderName.trim()) payload.senderName = senderName.trim();
      if (senderPhone.trim()) payload.senderPhone = senderPhone.trim();
      if (recipientName.trim()) payload.recipientName = recipientName.trim();
      if (recipientPhone.trim()) payload.recipientPhone = recipientPhone.trim();
      if (recipientCity.trim()) payload.recipientCity = recipientCity.trim();
      if (deliveryInstructions.trim()) payload.deliveryInstructions = deliveryInstructions.trim();
      if (description.trim()) payload.description = description.trim();

      const q = Number(quantity);
      if (!Number.isNaN(q) && q >= 1) payload.quantity = q;

      const c = Number(cod);
      if (cod.trim() && !Number.isNaN(c) && c >= 0) payload.codAmount = c;

      if (serviceId) payload.serviceId = serviceId;
      if (note.trim()) payload.note = note.trim();

      await api.post('/api/portal/orders', payload);
      toastSuccess('Commande créée avec succès');
      setCreateOpen(false);
      resetForm();
      orders.refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Création impossible';
      setError(msg);
      toastError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="p-section">
      <div className="p-container">
        <PageHeader
          eyebrow="Mes commandes"
          title="Toutes mes livraisons"
          lead="Créez, gérez et suivez l'acheminement de l'ensemble de vos colis en temps réel."
          actions={
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="p-btn p-btn-primary"
                onClick={() => {
                  resetForm();
                  setCreateOpen(true);
                }}
              >
                + Créer une commande
              </button>
              <Link to="/client/register" className="p-btn p-btn-ghost">
                Activer un numéro
              </Link>
            </div>
          }
        />

        {/* Barre de recherche et onglets */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, margin: '34px 0 24px' }}>
          <div className="p-tabs" role="tablist" aria-label="Filtrer mes commandes" style={{ margin: 0 }}>
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={`p-tab${tab === item.key ? ' is-active' : ''}`}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ minWidth: 260, flex: '1 1 280px', maxWidth: 360 }}>
            <input
              type="search"
              className="p-input"
              placeholder="Rechercher par référence, adresse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {orders.loading && !orders.data ? (
          <Loader label="Chargement de vos commandes…" />
        ) : orders.error ? (
          <ErrorPanel error={orders.error} onRetry={orders.refetch} />
        ) : filteredOrders.length === 0 ? (
          <EmptyPanel
            title={search ? 'Aucune commande correspondante' : 'Aucune commande ici'}
            description={
              search
                ? `Aucun résultat pour « ${search} ». Vérifiez les termes de recherche.`
                : 'Créez votre première commande ou activez un numéro pour démarrer le suivi.'
            }
            action={
              <button
                type="button"
                className="p-btn p-btn-primary p-btn-sm"
                onClick={() => {
                  resetForm();
                  setCreateOpen(true);
                }}
              >
                Créer une commande
              </button>
            }
          />
        ) : (
          <div className="p-stack" style={{ gap: 14 }}>
            {filteredOrders.map((order, index) => {
              const meta = orderStatusMeta(order.status);
              const active = !['DELIVERED', 'CANCELLED', 'FAILED'].includes(order.status);
              return (
                <Link
                  key={order.id}
                  to={`/client/orders/${order.id}`}
                  className={`p-card p-card-pad p-card-hover p-fade-up p-d${Math.min(index % 6, 5) + 1}`}
                  style={{
                    display: 'flex',
                    gap: 20,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div className="p-stack" style={{ gap: 6, flex: '1 1 260px' }}>
                    <span className="p-mono" style={{ fontSize: 18, fontWeight: 600 }}>
                      {order.trackingNumber}
                    </span>
                    <span className="p-small" style={{ color: 'var(--p-text-muted)' }}>
                      Destination : {order.deliveryAddress}
                    </span>
                  </div>

                  <div className="p-stack" style={{ gap: 4, flex: '0 1 auto' }}>
                    <span className="p-stat-label">Créée le</span>
                    <span className="p-small">{formatDate(order.createdAt)}</span>
                  </div>

                  <div className="p-stack" style={{ gap: 4, flex: '0 1 auto' }}>
                    <span className="p-stat-label">{active ? 'Prévue' : 'Statut final'}</span>
                    <span className="p-small">
                      {active
                        ? order.estimatedDeliveryAt
                          ? formatDate(order.estimatedDeliveryAt)
                          : '—'
                        : order.deliveredAt
                          ? formatDate(order.deliveredAt)
                          : 'Terminée'}
                    </span>
                  </div>

                  {order.driver && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={order.driver.user.name} tone="accent" />
                      <span className="p-small">{order.driver.user.name}</span>
                    </span>
                  )}

                  <StatusPill label={meta.label} tone={meta.tone} live={order.status === 'IN_TRANSIT'} />
                </Link>
              );
            })}
          </div>
        )}

        {/* Modale de création complète de commande */}
        <PModal open={createOpen} onClose={() => setCreateOpen(false)} title="Créer une nouvelle livraison" width={760}>
          <form onSubmit={submitCreate} className="p-stack" style={{ gap: 22 }}>
            {/* Section 1 : Expéditeur */}
            <div className="p-stack" style={{ gap: 10 }}>
              <span className="p-eyebrow">1. Informations expéditeur</span>
              <div className="p-grid-2" style={{ gap: 14 }}>
                <label className="p-field">
                  <span className="p-label">Nom de l'expéditeur</span>
                  <input
                    className="p-input"
                    maxLength={120}
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Votre nom ou société"
                  />
                </label>
                <label className="p-field">
                  <span className="p-label">Téléphone expéditeur</span>
                  <input
                    className="p-input"
                    type="tel"
                    maxLength={40}
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="+33 6 00 00 00 00"
                  />
                </label>
              </div>
              <label className="p-field">
                <span className="p-label">Adresse de départ (ramassage) *</span>
                <input
                  className="p-input"
                  required
                  minLength={3}
                  maxLength={240}
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Ex : 12 rue de la Paix, 75002 Paris"
                />
              </label>
            </div>

            {/* Section 2 : Destinataire */}
            <div className="p-stack" style={{ gap: 10 }}>
              <span className="p-eyebrow">2. Informations destinataire</span>
              <div className="p-grid-2" style={{ gap: 14 }}>
                <label className="p-field">
                  <span className="p-label">Nom du destinataire</span>
                  <input
                    className="p-input"
                    maxLength={120}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Nom complet du client récepteur"
                  />
                </label>
                <label className="p-field">
                  <span className="p-label">Téléphone destinataire</span>
                  <input
                    className="p-input"
                    type="tel"
                    maxLength={40}
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                  />
                </label>
              </div>
              <div className="p-grid-2" style={{ gap: 14 }}>
                <label className="p-field">
                  <span className="p-label">Adresse de livraison *</span>
                  <input
                    className="p-input"
                    required
                    minLength={3}
                    maxLength={240}
                    value={delivery}
                    onChange={(e) => setDelivery(e.target.value)}
                    placeholder="Numéro et nom de voie"
                  />
                </label>
                <label className="p-field">
                  <span className="p-label">Ville / Code postal</span>
                  <input
                    className="p-input"
                    maxLength={120}
                    value={recipientCity}
                    onChange={(e) => setRecipientCity(e.target.value)}
                    placeholder="Ex : 69001 Lyon"
                  />
                </label>
              </div>
              <label className="p-field">
                <span className="p-label">Instructions de livraison (interphone, étage…)</span>
                <input
                  className="p-input"
                  maxLength={1000}
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder="Code porte B, 3ème étage gauche"
                />
              </label>
            </div>

            {/* Section 3 : Colis & Service */}
            <div className="p-stack" style={{ gap: 10 }}>
              <span className="p-eyebrow">3. Colis et service de livraison</span>
              <div className="p-grid-3" style={{ gap: 14 }}>
                <label className="p-field">
                  <span className="p-label">Description du contenu</span>
                  <input
                    className="p-input"
                    maxLength={1000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Documents, pièces, textile…"
                  />
                </label>
                <label className="p-field">
                  <span className="p-label">Nombre de colis</span>
                  <input
                    className="p-input"
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label className="p-field">
                  <span className="p-label">Contre-remboursement (€)</span>
                  <input
                    className="p-input"
                    type="number"
                    min={0}
                    max={1000000}
                    step="0.01"
                    value={cod}
                    onChange={(e) => setCod(e.target.value)}
                    placeholder="0.00 si sans COD"
                  />
                </label>
              </div>

              {/* Sélection du service */}
              <label className="p-field">
                <span className="p-label">Formule de livraison</span>
                <select
                  className="p-input"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  <option value="">Sélectionnez un service catalogue (optionnel)</option>
                  {(services.data ?? []).map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} — {srv.price !== null ? `${srv.price.toFixed(2)} €` : 'Sur devis'}
                      {srv.description ? ` (${srv.description})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedService && (
                <div
                  style={{
                    background: 'var(--p-surface-subtle, rgba(255,255,255,0.03))',
                    border: '1px solid var(--p-line)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div className="p-stack" style={{ gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>{selectedService.name}</span>
                    {selectedService.description && (
                      <span className="p-small" style={{ color: 'var(--p-text-muted)' }}>
                        {selectedService.description}
                      </span>
                    )}
                  </div>
                  <span className="p-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--p-accent)' }}>
                    {selectedService.price !== null ? `${selectedService.price.toFixed(2)} €` : 'Sur devis'}
                  </span>
                </div>
              )}

              <label className="p-field">
                <span className="p-label">Remarques complémentaires</span>
                <textarea
                  className="p-textarea"
                  rows={2}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Notes de manutention spécifiques…"
                />
              </label>
            </div>

            {error && (
              <p className="p-small" style={{ color: 'var(--p-danger)' }} role="alert">
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 10 }}>
              <button
                type="button"
                className="p-btn p-btn-ghost"
                onClick={() => setCreateOpen(false)}
                disabled={busy}
              >
                Annuler
              </button>
              <button type="submit" className="p-btn p-btn-primary" disabled={busy}>
                {busy ? 'Enregistrement en cours…' : 'Confirmer et créer la livraison'}
              </button>
            </div>
          </form>
        </PModal>
      </div>
    </section>
  );
}
