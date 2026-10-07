/**
 * The browser mock for the Pages demo: core's createMockDashboard (seed data,
 * InMemoryStore, settable clock), with "today is" and any Setup change kept in
 * localStorage so a reload doesn't lose them. Storage can be missing or throw
 * (private windows, blocked site data): then the demo simply starts fresh.
 */
import { buildSeed, createMockDashboard, DEFAULT_TODAY, SEED_VERSION, type DashboardApi, type Dataset, type DevControls, type ISODate } from '@ct/core';

const KEY = `ct-demo:${SEED_VERSION}`;

interface Saved {
  today?: ISODate;
  dataset?: Dataset;
}

function read(): Saved {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

function write(saved: Saved): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage full or blocked: the demo keeps working for this visit.
  }
}

function clear(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** DashboardApi methods that change data; after them the dataset is saved. */
const WRITES = new Set<keyof DashboardApi>(['applySetup', 'undo']);

export function createBrowserMock(opts: { persist?: boolean } = {}): { api: DashboardApi; dev: DevControls } {
  const persist = opts.persist ?? true;
  const saved = persist ? read() : {};
  const mock = createMockDashboard(saved.dataset ?? buildSeed(), saved.today ?? DEFAULT_TODAY);

  const save = (withData: boolean) => {
    if (!persist) return;
    const prev = read();
    write({ today: mock.clock.today(), dataset: withData ? mock.store.load() : prev.dataset });
  };

  const api = new Proxy(mock.api, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== 'function') return value;
      const fn = (value as (...a: unknown[]) => unknown).bind(target);
      if (!WRITES.has(prop as keyof DashboardApi)) return fn;
      return async (...args: unknown[]) => {
        const result = await fn(...args);
        save(true);
        return result;
      };
    },
  });

  const dev: DevControls = {
    getToday: async () => mock.clock.today(),
    setToday: async (iso) => {
      await mock.dev.setToday(iso);
      save(false);
    },
    reset: async (ds) => {
      await mock.dev.reset(ds);
      await mock.dev.setToday(DEFAULT_TODAY);
      if (persist) clear();
    },
  };
  return { api, dev };
}
