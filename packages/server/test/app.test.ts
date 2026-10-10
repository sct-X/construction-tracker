// The live entry point's wiring: config defaults, startApp listening on
// loopback, seeding a new file, and the scheduler's first pass.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock } from '@ct/core';
import { allowedHostsFromEnv, connectAttemptMsFromEnv, DEFAULT_NET_CONNECT_ATTEMPT_MS, DEFAULT_WEB_DIST, loadConfig, memoryLog, memoryNotifier, startApp, type RunningApp } from '../src/index.js';

let dir: string | null = null;
let app: RunningApp | null = null;
afterEach(async () => {
  await app?.stop();
  app = null;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('config', () => {
  it('NET_CONNECT_ATTEMPT_MS: blank = 2500 ms, whole milliseconds from 10, refuses anything else', () => {
    expect(DEFAULT_NET_CONNECT_ATTEMPT_MS).toBe(2500);
    expect(connectAttemptMsFromEnv({})).toBe(2500);
    expect(connectAttemptMsFromEnv({ NET_CONNECT_ATTEMPT_MS: '  ' })).toBe(2500);
    expect(connectAttemptMsFromEnv({ NET_CONNECT_ATTEMPT_MS: ' 1000 ' })).toBe(1000);
    for (const bad of ['5', '-1', '1.5', '2s', 'abc']) {
      expect(() => connectAttemptMsFromEnv({ NET_CONNECT_ATTEMPT_MS: bad })).toThrow(/NET_CONNECT_ATTEMPT_MS/);
    }
  });

  it('defaults: 127.0.0.1, port 8787, ./data, 07:00 reminders, packages/web/dist, real clock', () => {
    const c = loadConfig({}, '/srv/ct');
    expect(c).toMatchObject({ host: '127.0.0.1', port: 8787, todayOverride: null, reminderTime: '07:00', webDist: DEFAULT_WEB_DIST });
    expect(c.paths.dataDir).toBe(resolve('/srv/ct', 'data'));
    expect(c.paths.dbFile).toBe(join(resolve('/srv/ct', 'data'), 'tracker.db'));
    expect(c.allowedHosts).toEqual([]); // loopback names are always allowed
  });

  it('reads the env and refuses bad values', () => {
    expect(loadConfig({ CT_TODAY: '2026-09-17', PORT: '4310' }).todayOverride).toBe('2026-09-17');
    expect(loadConfig({ TZ_TODAY_OVERRIDE: '2026-09-18' }).todayOverride).toBe('2026-09-18');
    expect(() => loadConfig({ CT_TODAY: '17/9/2026' })).toThrow('CT_TODAY');
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow('PORT');
    expect(() => loadConfig({ REMINDER_TIME: '7am' })).toThrow('REMINDER_TIME');
    expect(allowedHostsFromEnv({ ALLOWED_HOSTS: 'mini.local, 192.168.1.20', HOST: '0.0.0.0' })).toEqual(['mini.local', '192.168.1.20']);
  });
});

describe('startApp', () => {
  it('seeds a new file, listens on 127.0.0.1, and the first scheduler pass catches up the Monday snapshot and reminders', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ct-app-'));
    const config = loadConfig({ DATA_DIR: dir, PORT: '0' });
    const notifier = memoryNotifier();
    const log = memoryLog();
    app = await startApp(config, { log, notifier, clock: fixedClock('2026-09-21', '08:00'), bot: false });
    expect(app.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const addr = app.server.server.address();
    expect(typeof addr === 'object' && addr?.address).toBe('127.0.0.1');
    expect(app.store.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(log.lines.some((l) => l.includes('loaded the seed'))).toBe(true);

    const first = await app.firstTick!;
    expect(first.snapshots.map((s) => s.date)).toEqual(['2026-09-21', '2026-09-21', '2026-09-21']);
    expect(notifier.sent).toHaveLength(1);

    const res = await fetch(`${app.url}/api/health`);
    expect(await res.json()).toEqual({ ok: true, today: '2026-09-21' });
  });
});
