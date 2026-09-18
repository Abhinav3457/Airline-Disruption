/**
 * Generic data-fetching hook.
 * Wraps a service call with loading/error state and a manual reload.
 */

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/services/apiClient';

export interface UseApiResult<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new ApiError(error.message, 'UNKNOWN');
  return new ApiError('An unexpected error occurred.', 'UNKNOWN');
}

/**
 * Fetches once on mount (and whenever the caller changes `key` or reload()
 * is invoked). The fetcher must be stable or memoized by the caller.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  key: string | null
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(key !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (key === null) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(toApiError(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return { data, error, loading, reload };
}
