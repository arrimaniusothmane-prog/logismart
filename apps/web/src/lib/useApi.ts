import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, qs } from './api';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export interface UseApiOptions {
  /** Rafraîchit automatiquement les données toutes les `refreshMs` millisecondes (suivi en direct). */
  refreshMs?: number;
}

/**
 * Chargement de données simple et explicite : loading / error / data.
 * `deps` relance la requête (dépendances de filtre, page…).
 * `options.refreshMs` active un polling discret pour les vues « en direct ».
 */
export function useApi<T>(
  path: string | null,
  deps: ReadonlyArray<unknown> = [],
  options: UseApiOptions = {},
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const refreshMs = options.refreshMs;

  const refetch = useCallback(() => setTick((v) => v + 1), []);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    const requestId = latest.current + 1;
    latest.current = requestId;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .get<T>(path)
      .then((result) => {
        if (!cancelled && latest.current === requestId) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled || latest.current !== requestId) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(0, { code: 'UNKNOWN', message: 'Erreur inconnue' }),
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  useEffect(() => {
    if (!refreshMs || path === null) return;
    const timer = window.setInterval(() => setTick((v) => v + 1), refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs, path]);

  return { data, loading, error, refetch };
}

export { qs };
