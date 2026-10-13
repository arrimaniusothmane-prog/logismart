import type { ApiError as ApiErrorShape } from '@logismart/shared';

let BASE_URL = 'http://localhost:4000';

/** Initialise l'URL de l'API depuis la configuration native ou la variable d'environnement. */
export async function initApiConfig(): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI) {
    try {
      const config = await window.electronAPI.getApiConfig();
      BASE_URL = config.apiUrl.replace(/\/$/, '');
    } catch {
      /* garde la valeur par défaut */
    }
  }
}

export const API_BASE = BASE_URL;

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
  skipRefresh?: boolean;
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

export function onUnauthorized(fn: Listener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'fetch' },
        });
        return res.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    });
  }
  return refreshPromise;
}

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

  if (res.status === 401 && !skipRefresh && !path.startsWith('/api/auth/refresh')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
    for (const fn of unauthorizedListeners) fn();
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
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
