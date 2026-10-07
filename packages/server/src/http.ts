/**
 * The HTTP API (Fastify). Contract (the web app's HTTP client is built to it):
 *
 *   POST /api/rpc/:method   body {"args": [...]}  -> 200 {"result": value} | 4xx/5xx {"error": "plain message"}
 *                           :method = a DashboardApi method (whitelist); anything else 404.
 *   GET  /api/photos/:id/file -> the stored image (seed placeholders: a generated SVG)
 *   GET  /api/health        -> {"ok": true, "today": "YYYY-MM-DD"}
 *   GET  everything else    -> packages/web/dist (static + index.html; the app uses hash routing)
 *
 * Every request reads the current database (LocalDashboardApi loads the store
 * per call), so writes from another process on the same SQLite file show up.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { ChangeConflictError, LocalDashboardApi, RuleRefusalError, placeholderPhotoUrl, type Clock, type DashboardApi } from '@ct/core';
import type { Log } from './config.js';
import { photoFile, type DataPaths } from './paths.js';
import type { SqliteStore } from './sqliteStore.js';

/**
 * The DashboardApi methods the RPC route will call. The web is read-only:
 * day-to-day changes and undo come only through the bot. `applySetup` stays
 * for the desktop Setup area (Stage 5); `previewSetup` is a dry run.
 */
export const RPC_METHODS = [
  'getToday',
  'listSides',
  'getMonday',
  'getWhyItMoved',
  'listJobs',
  'getJobOverview',
  'getProgram',
  'getStep',
  'getDesignChecklist',
  'getWaitingOn',
  'getToChase',
  'getShipments',
  'getPhotos',
  'getDailyNotes',
  'getChangeHistory',
  'listTrades',
  'listTemplates',
  'previewSetup',
  'applySetup',
  'photoUrl',
] as const satisfies readonly (keyof DashboardApi)[];

/** DashboardApi methods deliberately NOT on HTTP (404): undo is the bot's (/undo), never the web's. */
export const RPC_EXCLUDED = ['undo'] as const satisfies readonly (keyof DashboardApi)[];

type Listed = (typeof RPC_METHODS)[number] | (typeof RPC_EXCLUDED)[number];
// Compile-time: every DashboardApi method is either whitelisted or deliberately excluded.
const _everyMethod: Exclude<keyof DashboardApi, Listed> extends never ? true : never = true;
void _everyMethod;

const RPC_SET = new Set<string>(RPC_METHODS);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export interface ServerOptions {
  store: SqliteStore;
  clock: Clock;
  paths: DataPaths;
  /** Folder of the built web app (packages/web/dist). Served only if it exists (checked per request). */
  webDist?: string | null;
  log?: Log | null;
  /** Host names allowed to call /api besides localhost, 127.0.0.1, [::1] and *.localhost (ALLOWED_HOSTS). */
  allowedHosts?: string[];
}

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** "Localhost:8787" -> "localhost", "[::1]:80" -> "[::1]"; null when unparseable. */
export function hostnameOf(hostHeader: string): string | null {
  try {
    const h = new URL(`http://${hostHeader.trim()}`).hostname.toLowerCase();
    return h || null;
  } catch {
    return null;
  }
}

/** Normalises an allow-list entry ("Mini.local", "192.168.1.20:8787", "::1") to a bare host name. */
export function normaliseAllowedHost(entry: string): string | null {
  const e = entry.trim();
  if (!e) return null;
  if (e.includes(':') && !e.startsWith('[') && e.split(':').length > 2) return `[${e.toLowerCase()}]`; // bare IPv6
  return hostnameOf(e);
}

/**
 * DNS-rebinding guard: a page on evil.example that resolves to 127.0.0.1 still
 * sends Host: evil.example, so only loopback names (plus the allow list) may
 * call /api. A browser Origin header, when sent, must name an allowed host too.
 */
export function isAllowedRequest(headers: { host?: string; origin?: string }, allowed: ReadonlySet<string>): { ok: true } | { ok: false; reason: string } {
  const ok = (h: string | null) => !!h && (allowed.has(h) || h.endsWith('.localhost'));
  const host = headers.host ? hostnameOf(headers.host) : null;
  if (!ok(host)) {
    return { ok: false, reason: `Host not allowed: ${headers.host ?? '(none)'}. Use localhost or 127.0.0.1, or add the name to ALLOWED_HOSTS.` };
  }
  if (headers.origin !== undefined) {
    let originHost: string | null = null;
    try {
      const u = new URL(headers.origin);
      if (u.protocol === 'http:' || u.protocol === 'https:') originHost = u.hostname.toLowerCase();
    } catch {
      originHost = null;
    }
    if (!ok(originHost)) return { ok: false, reason: `Origin not allowed: ${headers.origin}.` };
  }
  return { ok: true };
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function statusFor(e: unknown): number {
  if (e instanceof HttpError) return e.statusCode;
  if (e instanceof ChangeConflictError || e instanceof RuleRefusalError) return 409;
  if (e instanceof Error && /^Unknown (job|step|stage|photo|shipment|item)\b/.test(e.message)) return 404;
  const code = (e as { statusCode?: unknown })?.statusCode;
  if (typeof code === 'number' && code >= 400 && code < 600) return code;
  return 500;
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** A file inside `root` for a URL path, or null (refuses anything that escapes the folder). */
function fileUnder(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const parts = decoded.split(/[\\/]+/).filter(Boolean);
  const full = resolve(root, ...parts);
  const rel = relative(root, full);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return isFile(full) ? full : null;
}

/** The only types a photo file is ever served as; anything else (an old .html or .svg) is a download. */
export const PHOTO_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

/** Photo responses can't run anything on the dashboard's origin, whatever the bytes are. */
export const PHOTO_SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
} as const;

function sendPhotoFile(reply: FastifyReply, file: string): FastifyReply {
  const type = PHOTO_TYPES[extname(file).toLowerCase()];
  reply.headers({ ...PHOTO_SECURITY_HEADERS, 'cache-control': 'private, max-age=3600' });
  if (!type) reply.header('content-disposition', 'attachment');
  return reply.type(type ?? 'application/octet-stream').send(createReadStream(file));
}

function sendFile(reply: FastifyReply, file: string, cache: string): FastifyReply {
  return reply
    .header('cache-control', cache)
    .type(MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
    .send(createReadStream(file));
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const { store, clock, paths } = opts;
  const api = new LocalDashboardApi(store, clock);
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });
  // Lenient JSON: an empty body counts as no body (so a bare POST with the JSON content type works).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (!text.trim()) return done(null, undefined);
    try {
      done(null, JSON.parse(text));
    } catch {
      done(new HttpError(400, 'The body is not valid JSON.'), undefined);
    }
  });

  app.setErrorHandler((err, req, reply) => {
    const status = statusFor(err);
    if (status >= 500) opts.log?.error(`${req.method} ${req.url} failed`, err);
    void reply.status(status).send({ error: err instanceof Error ? err.message : String(err) });
  });
  app.setNotFoundHandler((req, reply) => reply.status(404).send({ error: `Not found: ${req.method} ${req.url.split('?')[0]}` }));

  const allowed = new Set<string>(LOOPBACK_HOSTS);
  for (const h of opts.allowedHosts ?? []) {
    const n = normaliseAllowedHost(h);
    if (n) allowed.add(n);
  }
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api')) return;
    const verdict = isAllowedRequest({ host: req.headers.host, origin: req.headers.origin }, allowed);
    if (!verdict.ok) {
      opts.log?.warn(`Refused ${req.method} ${req.url.split('?')[0]}: ${verdict.reason}`);
      return reply.status(403).send({ error: verdict.reason });
    }
  });

  app.get('/api/health', async () => ({ ok: true, today: clock.today() }));

  app.post<{ Params: { method: string }; Body: unknown }>('/api/rpc/:method', async (req, reply) => {
    const method = req.params.method;
    if (!RPC_SET.has(method)) return reply.status(404).send({ error: `No such method: ${method}` });
    const body = req.body;
    if (body != null && (typeof body !== 'object' || Array.isArray(body))) throw new HttpError(400, 'The body must be {"args": [...]}.');
    const args = body == null ? [] : ((body as { args?: unknown }).args ?? []);
    if (!Array.isArray(args)) throw new HttpError(400, 'args must be an array.');
    const fn = (api as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
    const result = await fn.apply(api, args);
    return { result: result === undefined ? null : result };
  });

  app.get<{ Params: { id: string } }>('/api/photos/:id/file', async (req, reply) => {
    const photo = store.load().photos.find((p) => p.id === req.params.id);
    if (!photo) throw new HttpError(404, `No photo ${req.params.id}`);
    let file: string | null = null;
    try {
      file = photoFile(paths, photo.filePath);
    } catch {
      throw new HttpError(404, `Photo ${photo.id} has a bad file path.`);
    }
    if (file && isFile(file)) return sendPhotoFile(reply, file);
    if (photo.isPlaceholder) {
      // Seed photos have no file: the same flat SVG the browser mock shows (ours, and sandboxed anyway).
      const url = placeholderPhotoUrl(photo);
      const svg = decodeURIComponent(url.slice(url.indexOf(',') + 1));
      return reply.headers({ ...PHOTO_SECURITY_HEADERS, 'cache-control': 'private, max-age=3600' }).type('image/svg+xml').send(svg);
    }
    throw new HttpError(404, `The file for photo ${photo.id} is missing.`);
  });

  app.all('/api/*', async (req, reply) => reply.status(404).send({ error: `Not found: ${req.method} ${req.url.split('?')[0]}` }));

  // The built web app. Hash routing, so any other GET falls back to index.html.
  app.get('/*', async (req, reply) => {
    const root = opts.webDist;
    const index = root ? join(root, 'index.html') : null;
    if (!root || !index || !existsSync(index)) {
      return reply
        .status(404)
        .type('text/plain; charset=utf-8')
        .send('The web app is not built. Build packages/web (API mode), then reload. The API is under /api.');
    }
    const urlPath = req.url.split('?')[0]!.split('#')[0]!;
    // Also accept a Pages-style base path prefix ("/construction-tracker/assets/x.js").
    const file = fileUnder(root, urlPath) ?? fileUnder(root, urlPath.replace(/^\/[^/]+/, ''));
    if (file && file !== index) {
      const immutable = /[\\/]assets[\\/]/.test(file);
      return sendFile(reply, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
    return sendFile(reply, index, 'no-cache');
  });

  return app;
}
