import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { can as hasPermission, type Permission, type Role } from '@logismart/shared';
import { ApiError, api, onUnauthorized } from '../lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  status: string;
}

export interface AuthCompany {
  id: string;
  name: string;
  slug: string;
  publicId: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  company: AuthCompany | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  can: (permission: Permission) => boolean;
  hasRole: (...roles: Role[]) => boolean;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface MeResponse {
  user: AuthUser;
  company: AuthCompany | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<AuthCompany | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setCompany(null);
    setStatus('anonymous');
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.get<MeResponse>('/api/auth/me');
      setUser(data.user);
      setCompany(data.company);
      setStatus('authenticated');
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setStatus('anonymous');
        return;
      }
      clear();
    }
  }, [clear]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => onUnauthorized(() => clear()), [clear]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await api.post<{ user: AuthUser; company: AuthCompany | null }>(
      '/api/auth/login',
      { email, password },
      { skipRefresh: true },
    );
    setUser(data.user);
    setCompany(data.company);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', undefined, { skipRefresh: true });
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      company,
      login,
      logout,
      reload: loadMe,
      can: (permission) => (user ? hasPermission(user.role, permission) : false),
      hasRole: (...roles) => (user ? roles.includes(user.role) : false),
      isOnline,
    }),
    [status, user, company, login, logout, loadMe, isOnline],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
