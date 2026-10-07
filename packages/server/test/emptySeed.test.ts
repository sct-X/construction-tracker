// SEED=empty / `npm run seed -- --reset --empty`: the going-live start. Sides, Dominic, the duplex
// template and the trades; no jobs or job data. A job made from the template in Setup then works.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEmptySeed, buildSeed, fixedClock, LocalDashboardApi, TEMPLATE_DUPLEX } from '@ct/core';
import { dataPaths, ensureDataDirs, loadConfig, memoryLog, memoryNotifier, seedDatabase, seedDataset, seedKindFromEnv, SqliteStore, startApp, type RunningApp } from '../src/index.js';

const clock = fixedClock('2026-09-17', '10:00');
let dir: string | null = null;
let app: RunningApp | null = null;
afterEach(async () => {
  await app?.stop();
  app = null;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('the empty seed', () => {
  it('keeps sides, Dominic, the duplex template and the trades, and nothing else', () => {
    const demo = buildSeed();
    const ds = buildEmptySeed();
    expect(ds.sides).toEqual(demo.sides);
    expect(ds.users).toEqual(demo.users);
    expect(ds.trades).toEqual(demo.trades);
    expect(ds.jobs.map((j) => j.id)).toEqual([TEMPLATE_DUPLEX]);
    for (const rows of [ds.stages, ds.steps, ds.stepLinks, ds.requirements, ds.photoCategories]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.jobId === TEMPLATE_DUPLEX)).toBe(true);
    }
    expect(ds.steps).toHaveLength(demo.steps.filter((s) => s.jobId === TEMPLATE_DUPLEX).length);
    for (const key of ['items', 'shipments', 'photos', 'dailyNotes', 'snapshots', 'inboundMessages', 'changeSets', 'changes'] as const) {
      expect(ds[key], key).toEqual([]);
    }
    expect(seedDataset('empty')).toEqual(ds);
    expect(seedKindFromEnv({})).toBe('demo');
    expect(seedKindFromEnv({ SEED: ' Empty ' })).toBe('empty');
    expect(() => seedKindFromEnv({ SEED: 'blank' })).toThrow('SEED must be demo or empty');
  });

  it('loads into SQLite; the Monday screen is empty until a job is made from the template in Setup', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ct-empty-'));
    const store = new SqliteStore(ensureDataDirs(dataPaths(dir)).dbFile, { clock });
    try {
      seedDatabase(store, seedDataset('empty'));
      const api = new LocalDashboardApi(store, clock);
      expect((await api.getMonday()).builds).toEqual([]);
      const r = await api.applySetup('copy_template', { template: TEMPLATE_DUPLEX, name: 'Smith St', startDate: '2026-10-05', weeklyHoldingCost: 3000 });
      expect(r.ok).toBe(true);
      const builds = (await api.getMonday()).builds;
      expect(builds.map((b) => b.name)).toEqual(['Smith St']);
      expect(builds[0]!.forecastFinish).toMatch(/^202[67]-\d\d-\d\d$/);
    } finally {
      store.close();
    }
  });

  it('startApp with SEED=empty starts a new database with no jobs', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ct-empty-app-'));
    const log = memoryLog();
    app = await startApp(loadConfig({ DATA_DIR: dir, PORT: '0', SEED: 'empty' }), { log, notifier: memoryNotifier(), clock, scheduler: false, bot: false });
    expect(log.lines.some((l) => l.includes('New database (SEED=empty)'))).toBe(true);
    expect(app.store.load().jobs.map((j) => j.id)).toEqual([TEMPLATE_DUPLEX]);
  });
});
