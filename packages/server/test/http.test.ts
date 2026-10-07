import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BEATTY, DEFAULT_TODAY, fixedClock, PARK_RD, PARK_RD_WINDOWS, SEAVIEW, type MondayView, type WhyItMoved } from '@ct/core';
import { applyOperation, buildServer, dataPaths, ensureDataDirs, RPC_METHODS, seedDatabase, SqliteStore, type DataPaths } from '../src/index.js';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

let dir: string;
let paths: DataPaths;
let store: SqliteStore;
let app: FastifyInstance;
const clock = fixedClock(DEFAULT_TODAY, '10:00');

async function rpc<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  const res = await app.inject({ method: 'POST', url: `/api/rpc/${method}`, payload: { args } });
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{ result: T }>().result;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ct-http-'));
  paths = ensureDataDirs(dataPaths(dir));
  store = new SqliteStore(paths.dbFile, { clock });
  seedDatabase(store);
  app = await buildServer({ store, clock, paths, webDist: join(dir, 'web') });
});

afterEach(async () => {
  await app.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const row = (m: MondayView, id: string) => m.builds.find((b) => b.jobId === id)!;

describe('RPC', () => {
  it('getMonday returns the seeded Park Rd, Seaview and Beatty numbers', async () => {
    const m = await rpc<MondayView>('getMonday');
    expect(m.today).toBe('2026-09-17');
    expect(row(m, PARK_RD)).toMatchObject({ forecastFinish: '2027-02-26', snapshotFinish: '2027-02-26', slipDays: 0, slipCost: 0 });
    expect(row(m, SEAVIEW)).toMatchObject({ forecastFinish: '2027-10-29', slipDays: 0, amber: false, daysUnconfirmed: 1 });
    expect(row(m, SEAVIEW).actByDue.map((r) => [r.title, r.actBy])).toContainEqual(['Book concrete pump', '2026-09-18']);
    expect(row(m, BEATTY)).toMatchObject({ forecastFinish: '2026-12-04', slipDays: 5, slipCost: 1430, amber: true, daysUnconfirmed: 9 });
    expect(m.design.map((d) => [d.name, d.outstanding, d.oldestDays])).toEqual([
      ['West St', 2, 23],
      ['Tollbar Ave', 1, 8],
      ['John St', 1, 4],
      ['Lower Beach St', 0, null],
    ]);
  });

  it('passes args through (getWhyItMoved, getToday, listJobs with a side filter)', async () => {
    expect(await rpc('getToday')).toBe('2026-09-17');
    const why = await rpc<WhyItMoved>('getWhyItMoved', BEATTY);
    expect(why.slipDays).toBe(5);
    expect(why.lines.join(' ')).toContain('2 days earlier for reasons not in the change log');
    const jobs = await rpc<{ builds: unknown[] }>('listJobs', { sideId: 'no-such-side' });
    expect(jobs.builds).toEqual([]);
  });

  it('accepts a missing or empty body as no args', async () => {
    const a = await app.inject({ method: 'POST', url: '/api/rpc/getToday' });
    expect(a.json()).toEqual({ result: '2026-09-17' });
    const b = await app.inject({ method: 'POST', url: '/api/rpc/getToday', headers: { 'content-type': 'application/json' }, payload: '' });
    expect(b.json()).toEqual({ result: '2026-09-17' });
  });

  it('refuses unknown methods with 404, and bad bodies with 400, as {"error"}', async () => {
    for (const m of ['nope', 'constructor', 'toString', 'runSetup', '__proto__']) {
      const res = await app.inject({ method: 'POST', url: `/api/rpc/${m}`, payload: { args: [] } });
      expect(res.statusCode, m).toBe(404);
      expect(res.json().error).toEqual(expect.any(String));
    }
    const bad = await app.inject({ method: 'POST', url: '/api/rpc/getMonday', payload: { args: 'x' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: 'args must be an array.' });
    const notJson = await app.inject({ method: 'POST', url: '/api/rpc/getMonday', headers: { 'content-type': 'application/json' }, payload: '{' });
    expect(notJson.statusCode).toBe(400);
  });

  it('an unknown job is a 404 with a plain message', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/rpc/getJobOverview', payload: { args: ['no-such-job'] } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Unknown job no-such-job' });
  });

  it('the web is read-only: undo is not on HTTP (404) and nothing is changed; applySetup stays for Setup', async () => {
    expect(RPC_METHODS).toContain('getMonday');
    expect(RPC_METHODS).toContain('applySetup');
    expect(RPC_METHODS).not.toContain('undo');
    expect(RPC_METHODS.length).toBe(20);
    const cs = store.load().changeSets.find((c) => c.status === 'confirmed')!;
    const res = await app.inject({ method: 'POST', url: '/api/rpc/undo', payload: { args: [cs.id] } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'No such method: undo' });
    expect(store.load().changeSets.find((c) => c.id === cs.id)!.status).toBe('confirmed');
  });

  it('after the windows ETA moves to 16 Nov: finish Fri 12 Mar 2027, +14, $9,000, why it moved names the ETA; undo restores 26 Feb', async () => {
    const r = applyOperation(store, clock, 'set_shipment_eta', { shipment: 'windows', job: 'Park Rd', eta: '16 Nov' }, { message: 'Park Rd windows now arriving 16 Nov' });
    if (!r.ok) throw new Error(r.reason);
    const m = await rpc<MondayView>('getMonday');
    expect(row(m, PARK_RD)).toMatchObject({ forecastFinish: '2027-03-12', slipDays: 14, slipCost: 9000 });
    const why = await rpc<WhyItMoved>('getWhyItMoved', PARK_RD);
    expect(why.causes).toHaveLength(1);
    expect(why.causes[0]).toMatchObject({ summary: 'Park Rd windows ETA Mon 26 Oct to Mon 16 Nov', deltaDays: 14, cost: 9000, sourceText: 'Park Rd windows now arriving 16 Nov' });
    expect(why.causes[0]!.movedSteps[0]).toMatchObject({ name: 'Install windows', to: '2026-11-16' });

    // Undo is the bot's (/undo); the API shows the result on the next request.
    expect(store.undo(r.changeSet.id).ok).toBe(true);
    expect(row(await rpc<MondayView>('getMonday'), PARK_RD)).toMatchObject({ forecastFinish: '2027-02-26', slipDays: 0 });
  });

  it('applySetup runs setup ops and refuses daily ones', async () => {
    const refused = await rpc<{ ok: boolean; reason: string }>('applySetup', 'set_shipment_eta', { shipment: PARK_RD_WINDOWS, eta: '16 Nov' });
    expect(refused).toMatchObject({ ok: false, reason: 'set_shipment_eta is not a Setup operation.' });
    const ok = await rpc<{ ok: boolean }>('applySetup', 'add_trade', { name: 'Sam the sparky', type: 'Electrician', phone: '0491 570 006' });
    expect(ok.ok).toBe(true);
  });
});

describe('apply-op script (another process writing the same SQLite file)', () => {
  it('proposes and confirms one operation; the running API sees it on the next request', async () => {
    const { stdout } = await run(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        '--tsconfig',
        join(ROOT, 'packages', 'server', 'tsconfig.json'),
        join(ROOT, 'packages', 'server', 'scripts', 'apply-op.ts'),
        'set_shipment_eta',
        JSON.stringify({ shipment: 'windows', job: 'Park Rd', eta: '16 Nov' }),
      ],
      { env: { ...process.env, DATA_DIR: dir, CT_TODAY: '2026-09-17', ENV_FILE: join(dir, 'no.env') }, cwd: ROOT },
    );
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, finishAfter: '2027-03-12', slipAfter: 14, slipCostAfter: 9000 });
    const m = await rpc<MondayView>('getMonday');
    expect(row(m, PARK_RD)).toMatchObject({ forecastFinish: '2027-03-12', slipDays: 14, slipCost: 9000 });
    const why = await rpc<WhyItMoved>('getWhyItMoved', PARK_RD);
    expect(why.causes[0]!.summary).toContain('windows ETA');
  }, 30_000);
});

describe('Host / Origin check (DNS rebinding)', () => {
  const call = (headers: Record<string, string>) => app.inject({ method: 'POST', url: '/api/rpc/getToday', headers, payload: { args: [] } });

  it('allows localhost, 127.0.0.1, [::1] and *.localhost, with or without a port', async () => {
    for (const host of ['localhost', 'localhost:8787', '127.0.0.1:4310', '[::1]:8787', 'ct.localhost:8787', 'LOCALHOST']) {
      expect((await call({ host })).statusCode, host).toBe(200);
    }
    expect((await call({ host: '127.0.0.1:8787', origin: 'http://localhost:5173' })).statusCode).toBe(200);
  });

  it('refuses any other Host or a foreign Origin with 403 {"error"}, on every /api route', async () => {
    const evil = await call({ host: 'evil.example:8787' });
    expect(evil.statusCode).toBe(403);
    expect(evil.json().error).toContain('Host not allowed: evil.example:8787');
    expect((await call({ host: '127.0.0.1:8787', origin: 'http://evil.example' })).statusCode).toBe(403);
    expect((await call({ host: '127.0.0.1:8787', origin: 'null' })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/health', headers: { host: 'evil.example' } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/photos/x/file', headers: { host: '192.168.1.20' } })).statusCode).toBe(403);
  });

  it('ALLOWED_HOSTS adds names (any case, ports ignored)', async () => {
    const other = await buildServer({ store, clock, paths, allowedHosts: ['Mini.local', '192.168.1.20:8787'] });
    const req = (host: string) => other.inject({ url: '/api/health', headers: { host } });
    expect((await req('mini.local:8787')).statusCode).toBe(200);
    expect((await req('192.168.1.20')).statusCode).toBe(200);
    expect((await req('evil.example')).statusCode).toBe(403);
    await other.close();
  });
});

describe('other routes', () => {
  it('GET /api/health', async () => {
    const res = await app.inject('/api/health');
    expect(res.json()).toEqual({ ok: true, today: '2026-09-17' });
  });

  it('serves a placeholder image for seed photos, the stored file for real ones, 404 otherwise', async () => {
    const seedPhoto = store.load().photos.find((p) => p.isPlaceholder)!;
    const ph = await app.inject(`/api/photos/${seedPhoto.id}/file`);
    expect(ph.statusCode).toBe(200);
    expect(ph.headers['content-type']).toBe('image/svg+xml');
    expect(ph.body).toContain('<svg');

    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    mkdirSync(join(paths.photosDir, 'seaview'), { recursive: true });
    writeFileSync(join(paths.photosDir, 'seaview', '2026-09-17-x.jpg'), bytes);
    const r = applyOperation(store, clock, 'attach_photo', { job: 'Seaview St', category: 'General', filePath: 'seaview/2026-09-17-x.jpg', caption: 'Site' });
    if (!r.ok) throw new Error(r.reason);
    const photo = store.load().photos.find((p) => p.filePath === 'seaview/2026-09-17-x.jpg')!;
    const real = await app.inject(`/api/photos/${photo.id}/file`);
    expect(real.statusCode).toBe(200);
    expect(real.headers['content-type']).toBe('image/jpeg');
    expect(real.rawPayload.equals(bytes)).toBe(true);

    expect((await app.inject('/api/photos/nope/file')).statusCode).toBe(404);
    expect((await app.inject('/api/nothing-here')).json()).toEqual({ error: 'Not found: GET /api/nothing-here' });
  });

  it('photo files: an allowlisted image type, nosniff and a sandboxing CSP; any other stored file is a download', async () => {
    mkdirSync(join(paths.photosDir, 'telegram'), { recursive: true });
    writeFileSync(join(paths.photosDir, 'telegram', 'a.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    writeFileSync(join(paths.photosDir, 'telegram', 'b.html'), '<script>alert(1)</script>');
    const seedPhoto = store.load().photos[0]!;
    for (const [id, filePath] of [['ph-png', 'telegram/a.png'], ['ph-html', 'telegram/b.html']] as const) {
      store.applyChangeSet({ summary: 'test', changes: [{ kind: 'insert', table: 'photo', rowId: id, row: { ...seedPhoto, id, filePath, isPlaceholder: false } }] });
    }
    const png = await app.inject('/api/photos/ph-png/file');
    expect(png.headers['content-type']).toBe('image/png');
    expect(png.headers['x-content-type-options']).toBe('nosniff');
    expect(png.headers['content-security-policy']).toBe("default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    const html = await app.inject('/api/photos/ph-html/file');
    expect(html.headers['content-type']).toBe('application/octet-stream');
    expect(html.headers['content-disposition']).toBe('attachment');
    expect(html.headers['x-content-type-options']).toBe('nosniff');
    const placeholder = await app.inject(`/api/photos/${store.load().photos.find((p) => p.isPlaceholder)!.id}/file`);
    expect(placeholder.headers['content-security-policy']).toContain('sandbox');
  });

  it('a photo row whose path escapes the photos folder is a 404, never a file outside it', async () => {
    const seedPhoto = store.load().photos[0]!;
    const evil = { ...seedPhoto, id: 'ph-evil', filePath: '../tracker.db', isPlaceholder: false };
    store.applyChangeSet({ summary: 'test', changes: [{ kind: 'insert', table: 'photo', rowId: evil.id, row: evil }] });
    const res = await app.inject('/api/photos/ph-evil/file');
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toEqual(expect.any(String));
  });

  it('serves the built web app: files, index.html fallback, nothing outside dist', async () => {
    expect((await app.inject('/')).statusCode).toBe(404); // not built yet
    const web = join(dir, 'web');
    mkdirSync(join(web, 'assets'), { recursive: true });
    writeFileSync(join(web, 'index.html'), '<!doctype html><title>CT</title>');
    writeFileSync(join(web, 'assets', 'app.js'), 'console.log(1)');
    const index = await app.inject('/');
    expect(index.statusCode).toBe(200);
    expect(index.headers['content-type']).toContain('text/html');
    const js = await app.inject('/assets/app.js');
    expect(js.headers['content-type']).toContain('text/javascript');
    expect(js.body).toBe('console.log(1)');
    expect((await app.inject('/construction-tracker/assets/app.js')).body).toBe('console.log(1)');
    expect((await app.inject('/some/route')).body).toContain('<title>CT</title>');
    expect((await app.inject('/..%2f..%2ftracker.db')).body).toContain('<title>CT</title>');
  });
});
