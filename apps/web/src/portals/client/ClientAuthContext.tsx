import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';

export interface PortalCustomer {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  totalOrders: number;
  notificationsUnread: number;
  activeOrder: PortalOrderCard | null;
  lastDelivered: PortalOrderCard | null;
  company: { name: string; phone: string | null; email: string | null };
}

export interface PortalOrderCard {
  id: string;
  trackingNumber: string;
  status: string;
  deliveryAddress: string;
  pickupAddress: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  driver: { id: string; vehicleType: string; user: { name: string } } | null;
}

export type PortalStatus = 'loading' | 'authenticated' | 'anonymous';

interface ClientAuthValue {
  status: PortalStatus;
  customer: PortalCustomer | null;
  login: (email: string, password: string) => Promise<void>;
  register: (trackingNumber: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  patchCustomer: (patch: Partial<Pick<PortalCustomer, 'name' | 'phone' | 'address'>>) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthValue | null>(null);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PortalStatus>('loading');
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);

  const reload = useCallback(async () => {
    try {
      const me = await api.get<PortalCustomer>('/api/portal/me');
      setCustomer(me);
      setStatus('authenticated');
    } catch {
      setCustomer(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post('/api/portal/login', { email, password }, { skipRefresh: true });
      await reload();
    },
    [reload],
  );

  const register = useCallback(
    async (trackingNumber: string, email: string, password: string) => {
      await api.post('/api/portal/register', { trackingNumber, email, password }, { skipRefresh: true });
      await reload();
    },
    [reload],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/portal/logout', undefined, { skipRefresh: true });
    } catch {
      // On nettoie l'état local même si l'appel échoue.
    }
    setCustomer(null);
    setStatus('anonymous');
  }, []);

  const patchCustomer = useCallback(
    async (patch: Partial<Pick<PortalCustomer, 'name' | 'phone' | 'address'>>) => {
      await api.patch('/api/portal/profile', patch);
      await reload();
    },
    [reload],
  );

  const markNotificationsRead = useCallback(async () => {
    await api.post('/api/portal/notifications/read');
    await reload();
  }, [reload]);

  const value = useMemo<ClientAuthValue>(
    () => ({ status, customer, login, register, logout, reload, patchCustomer, markNotificationsRead }),
    [status, customer, login, register, logout, reload, patchCustomer, markNotificationsRead],
  );

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>;
}

export function useClientAuth(): ClientAuthValue {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth doit être utilisé dans ClientAuthProvider');
  return ctx;
}
