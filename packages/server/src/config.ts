/**
 * Runtime settings from the environment (.env is loaded by main.ts first).
 * Every path goes through node:path so the same setup runs on macOS,
 * Windows and Linux.
 */
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clockFromOverride, isISODate, sydneyDate, sydneyTime, type Clock } from '@ct/core';
import { dataPaths, resolveDataDir, type DataPaths } from './paths.js';

type Env = Record<string, string | undefined>;

export const DEFAULT_PORT = 8787;
export const DEFAULT_HOST = '127.0.0.1';
/** Sydney time of day the scheduler starts sending the day's reminders. */
export const DEFAULT_REMINDER_TIME = '07:00';

/** packages/web/dist, from src (tsx) or dist (built) alike. */
export const DEFAULT_WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url));

export interface ServerConfig {
  paths: DataPaths;
  port: number;
  host: string;
  /** The "today is" override (CT_TODAY, or TZ_TODAY_OVERRIDE from .env.example), or null for the real Sydney date. */
  todayOverride: string | null;
  webDist: string;
  reminderTime: string;
  /** Extra host names allowed to call /api (ALLOWED_HOSTS, comma-separated), plus HOST when it is a specific address. */
  allowedHosts: string[];
}

/** CT_TODAY wins; TZ_TODAY_OVERRIDE (the .env.example name) is the fallback. Throws on a bad date. */
export function todayOverrideFromEnv(env: Env = process.env): string | null {
  const raw = (env.CT_TODAY || env.TZ_TODAY_OVERRIDE || '').trim();
  if (!raw) return null;
  if (!isISODate(raw)) throw new Error(`CT_TODAY must be YYYY-MM-DD, got "${raw}"`);
  return raw;
}

/** The Sydney system clock, or that date at the current Sydney time when CT_TODAY is set. */
export function clockFromEnv(env: Env = process.env): Clock {
  return clockFromOverride(todayOverrideFromEnv(env));
}

/** ALLOWED_HOSTS ("mini.local, 192.168.1.20") plus HOST unless it is a wildcard bind (0.0.0.0, ::). */
export function allowedHostsFromEnv(env: Env = process.env): string[] {
  const list = (env.ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  const host = env.HOST?.trim();
  if (host && host !== '0.0.0.0' && host !== '::' && !list.includes(host)) list.push(host);
  return list;
}

export function loadConfig(env: Env = process.env, cwd = process.cwd()): ServerConfig {
  const port = env.PORT?.trim() ? Number(env.PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT must be a port number, got "${env.PORT}"`);
  const reminderTime = env.REMINDER_TIME?.trim() || DEFAULT_REMINDER_TIME;
  if (!/^\d{2}:\d{2}$/.test(reminderTime)) throw new Error(`REMINDER_TIME must be HH:mm, got "${reminderTime}"`);
  const web = env.WEB_DIST?.trim();
  return {
    paths: dataPaths(resolveDataDir(env, cwd)),
    port,
    host: env.HOST?.trim() || DEFAULT_HOST,
    todayOverride: todayOverrideFromEnv(env),
    webDist: web ? (isAbsolute(web) ? web : resolve(cwd, web)) : DEFAULT_WEB_DIST,
    reminderTime,
    allowedHosts: allowedHostsFromEnv(env),
  };
}

/**
 * Loads `.env` from `cwd` (or ENV_FILE) when it exists. Variables already set
 * in the environment win, so tests and scripts can override any line.
 */
export function loadEnvFile(env: Env = process.env, cwd = process.cwd()): string | null {
  const file = env.ENV_FILE?.trim() ? resolve(cwd, env.ENV_FILE.trim()) : resolve(cwd, '.env');
  if (!existsSync(file)) return null;
  process.loadEnvFile(file);
  return file;
}

// ---------------------------------------------------------------------------
// Logging: one plain line per event, stamped in Sydney time.
// ---------------------------------------------------------------------------

export interface Log {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

export function consoleLog(prefix = 'ct'): Log {
  const stamp = () => {
    const now = new Date();
    return `${sydneyDate(now)} ${sydneyTime(now)}`;
  };
  return {
    info: (m) => console.log(`${stamp()} [${prefix}] ${m}`),
    warn: (m) => console.warn(`${stamp()} [${prefix}] ${m}`),
    error: (m, e) => console.error(`${stamp()} [${prefix}] ${m}`, e instanceof Error ? (e.stack ?? e.message) : (e ?? '')),
  };
}

/** A logger that keeps lines in memory (tests). */
export function memoryLog(): Log & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    info: (m) => void lines.push(`info ${m}`),
    warn: (m) => void lines.push(`warn ${m}`),
    error: (m, e) => void lines.push(`error ${m}${e instanceof Error ? `: ${e.message}` : ''}`),
  };
}
