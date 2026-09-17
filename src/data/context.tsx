/**
 * React wiring for the API: one provider, three hooks.
 *
 *   const api = useApi();                       // the TrackerApi
 *   const { person, role, today } = useSession();
 *   const jobs = useQuery((api) => api.listJobs(), []);   // re-runs on every api change
 *
 * The provider also reads `?as=&today=&offline=&side=` from the hash on load
 * and on every hash change, and flushes the photo queue when offline turns off.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TrackerApi } from './api';
import type { Session } from './session';
import { sessionFromHash } from './session';
import type { Person, Role, Side } from '../domain/types';

interface ApiContextValue {
  api: TrackerApi;
  /** Bumps on every api change; useQuery keys on it. */
  version: number;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ api, children }: { api: TrackerApi; children: ReactNode }) {
  const [version, setVersion] = useState(0);

  useEffect(() => api.subscribe(() => setVersion((v) => v + 1)), [api]);

  // URL params drive the session: #/monday?as=alec&today=2026-09-17&offline=1
  useEffect(() => {
    const apply = () => {
      if (typeof window === 'undefined') return;
      const patch = sessionFromHash(window.location.hash);
      if (Object.keys(patch).length) api.setSession(patch);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [api]);

  // When signal returns, send what is queued. Keyed on the offline flag only,
  // so a flush that changes nothing cannot loop through version bumps.
  const offline = api.getSession().offline;
  useEffect(() => {
    if (!offline) void api.flushPhotoQueue();
  }, [api, offline]);

  const value = useMemo(() => ({ api, version }), [api, version]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

function useApiContext(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used inside <ApiProvider>');
  return ctx;
}

export function useApi(): TrackerApi {
  return useApiContext().api;
}

export interface SessionView extends Session {
  person: Person;
  role: Role;
  side: Side;
  sides: Side[];
  setSession: (patch: Partial<Session>) => void;
}

export function useSession(): SessionView {
  const { api, version } = useApiContext();
  return useMemo(() => {
    const s = api.getSession();
    const who = api.whoami();
    return { ...s, person: who.person, role: who.role, side: who.side, sides: who.sides, setSession: (p) => api.setSession(p) };
  }, [api, version]);
}

/**
 * Runs a read against the api and re-runs it whenever the api reports a
 * change or `deps` change. Synchronous: the result is there on first render.
 */
export function useQuery<T>(fn: (api: TrackerApi) => T, deps: unknown[] = []): T {
  const { api, version } = useApiContext();
  return useMemo(() => fn(api), [api, version, ...deps]);
}
