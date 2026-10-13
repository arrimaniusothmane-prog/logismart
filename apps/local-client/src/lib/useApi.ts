import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from './api';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export function useApi<T>(path: string, deps: ReadonlyArray<unknown> = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  const refetch = useCallback(() => setTick((v) => v + 1), []);

  useEffect(() => {
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

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, loading, error, refetch };
}
