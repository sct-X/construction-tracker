import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DashboardApi, DevControls, ISODate, Side } from '@ct/core';
import type { DataLayer } from './layer';

const SIDE_KEY = 'ct-side';

function readSide(): string | null {
  try {
    return globalThis.localStorage?.getItem(SIDE_KEY) ?? null;
  } catch {
    return null;
  }
}
function writeSide(id: string): void {
  try {
    globalThis.localStorage?.setItem(SIDE_KEY, id);
  } catch {
    // per-viewer convenience only
  }
}

interface DataState {
  mode: DataLayer['mode'];
  api: DashboardApi;
  dev: DevControls | null;
  /** Bumped when the dev bar changes today or resets; queries refetch. */
  version: number;
  refresh: () => void;
  today: ISODate | null;
  sides: Side[];
  /** Sides load first; queries wait for them so a stale saved side never loads. */
  sidesLoaded: boolean;
  sideId: string | null;
  setSideId: (id: string) => void;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ layer, children }: { layer: DataLayer; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [sides, setSides] = useState<Side[]>([]);
  const [sidesLoaded, setSidesLoaded] = useState(false);
  const [today, setToday] = useState<ISODate | null>(null);
  const [sideId, setSide] = useState<string | null>(readSide);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    Promise.all([layer.api.listSides(), layer.api.getToday()])
      .then(([s, t]) => {
        if (!live) return;
        setSides(s);
        setToday(t);
        setSide((cur) => (cur && s.some((x) => x.id === cur) ? cur : (s[0]?.id ?? null)));
        setSidesLoaded(true);
      })
      .catch(() => {
        // Screens show their own load errors.
        if (live) setSidesLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [layer, version]);

  const setSideId = useCallback((id: string) => {
    setSide(id);
    writeSide(id);
  }, []);

  const value = useMemo<DataState>(
    () => ({ mode: layer.mode, api: layer.api, dev: layer.dev, version, refresh, today, sides, sidesLoaded, sideId, setSideId }),
    [layer, version, refresh, today, sides, sidesLoaded, sideId, setSideId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData outside DataProvider');
  return v;
}

export function useApi(): DashboardApi {
  return useData().api;
}

export type Query<T> = { status: 'loading' } | { status: 'error'; error: string; retry: () => void } | { status: 'ready'; data: T };

/**
 * Runs `load` against the current side; reruns when the side changes or the
 * dev bar moves today. Waits until the side is known so nothing loads twice.
 */
export function useSideQuery<T>(load: (api: DashboardApi, filter: { sideId?: string }) => Promise<T>): Query<T> {
  const { api, version, sideId, sidesLoaded } = useData();
  const [state, setState] = useState<Query<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const ready = sidesLoaded;

  useEffect(() => {
    if (!ready) return;
    let live = true;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    load(api, sideId ? { sideId } : {})
      .then((data) => live && setState({ status: 'ready', data }))
      .catch((e: unknown) => {
        if (!live) return;
        const error = e instanceof Error ? e.message : String(e);
        setState({ status: 'error', error, retry: () => setAttempt((a) => a + 1) });
      });
    return () => {
      live = false;
    };
    // load is expected to be a stable module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, version, sideId, ready, attempt]);

  return state;
}
