import { useEffect, useState } from 'react';
import type { DashboardApi } from '@ct/core';
import { useData, type Query } from './DataContext';

/**
 * Like useSideQuery, for one job, step or other id: reruns when the key
 * changes or the dev bar moves today. Keeps showing the last result while a
 * refetch for the same key runs; a new key shows loading.
 */
export function useJobQuery<T>(load: (api: DashboardApi, key: string) => Promise<T>, key: string): Query<T> {
  const { api, version } = useData();
  const [state, setState] = useState<{ key: string; q: Query<T> }>({ key, q: { status: 'loading' } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState((s) => (s.key === key && s.q.status === 'ready' ? s : { key, q: { status: 'loading' } }));
    load(api, key)
      .then((data) => live && setState({ key, q: { status: 'ready', data } }))
      .catch((e: unknown) => {
        if (!live) return;
        const error = e instanceof Error ? e.message : String(e);
        setState({ key, q: { status: 'error', error, retry: () => setAttempt((a) => a + 1) } });
      });
    return () => {
      live = false;
    };
    // load is a stable module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, version, key, attempt]);

  return state.key === key ? state.q : { status: 'loading' };
}
