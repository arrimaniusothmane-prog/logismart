import type { ApiError as ApiErrorShape } from '@logismart/shared';

const RAW_BASE = import.meta.env.VITE_API_URL ?? '';
/** En dev, un chaîne vide conserve le proxy Vite (même origine → cookies OK). */
export const API_BASE = RAW_BASE.replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, error: ApiErrorShape['error']) {
    super(error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
  }

  get validationIssues(): Array<{ path: string; message: string }> {
    const details = this.details as { issues?: Array<{ path: string; message: string }> } | undefined;
    return details?.issues ?? [];
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Désactive la relance automatique après /auth/refresh (utilisé par le flux login). */
  skipRefresh?: boolean;
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Notifie l'échec définitif d'une session (pour déconnecter l'UI proprement). */
export function onUnauthorized(fn: Listener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

const refreshPromises = new Map<string, Promise<boolean>>();

/** Relance de session unique et partagée : un seul refresh en parallèle par portée. */
async function refreshSession(path: string): Promise<boolean> {
  if (!refreshPromises.has(path)) {
    const promise = (async () => {
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'fetch' },
        });
        return res.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      // Libéré après exécution pour permettre une nouvelle tentative ultérieure.
      setTimeout(() => {
        refreshPromises.delete(path);
      }, 0);
    });
    refreshPromises.set(path, promise);
  }
  return refreshPromises.get(path)!;
}

/** Session portail (cookies dédiés) : relance propre au lieu du refresh Admin. */
const PORTAL_REFRESH_PATH = '/api/portal/refresh';
const USER_REFRESH_PATH = '/api/auth/refresh';
const isRefreshPath = (path: string) => path === PORTAL_REFRESH_PATH || path === USER_REFRESH_PATH;
const isPortalPath = (path: string) => path.startsWith('/api/portal/');

async function toApiError(res: Response): Promise<ApiError> {
  let payload: { error?: ApiErrorShape['error'] } | null;
  try {
    payload = (await res.json()) as { error?: ApiErrorShape['error'] };
  } catch {
    payload = null;
  }
  return new ApiError(res.status, {
    code: payload?.error?.code ?? `HTTP_${res.status}`,
    message: payload?.error?.message ?? `Erreur ${res.status}`,
    details: payload?.error?.details,
    requestId: payload?.error?.requestId,
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = options;

  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'fetch',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' });
  }

  if (res.status === 401 && !skipRefresh && !isRefreshPath(path)) {
    const refreshed = await refreshSession(isPortalPath(path) ? PORTAL_REFRESH_PATH : USER_REFRESH_PATH);
    if (refreshed) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
    // Une défaillance du portail client ne doit pas purger la session Admin (et inversement).
    if (!isPortalPath(path)) {
      for (const fn of unauthorizedListeners) fn();
    }
  }

  if (res.status === 204) return undefined as T;

  const payload = (await res.json().catch(() => null)) as
    | { success: boolean; data: T }
    | { error: ApiErrorShape['error'] }
    | null;

  if (!res.ok || !payload || (payload as { success?: boolean }).success === false) {
    throw await toApiError(res);
  }

  return (payload as { data: T }).data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/** Construit une query string en ignorant les valeurs vides/undefined. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
