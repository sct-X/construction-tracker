/**
 * Who is using the app, on which side, on what date, and whether the signal
 * is off. There is no login: the dev bar sets this, and so do URL params in
 * the hash query, e.g. `#/monday?as=alec&today=2026-09-17&offline=1`.
 */
import type { KeyValueStorage } from './storage';

export interface Session {
  personId: string;
  sideId: string;
  /** ISO date the app treats as today. */
  today: string;
  offline: boolean;
}

export const SESSION_KEY = 'construction-tracker.session.v1';
export const DEFAULT_PERSON = 'dominic';
export const DEFAULT_SIDE = 'side-nd';
export const DEFAULT_TODAY = '2026-09-17';

export function defaultSession(): Session {
  return { personId: DEFAULT_PERSON, sideId: DEFAULT_SIDE, today: DEFAULT_TODAY, offline: false };
}

/** Accepts `as=alec`, `as=Alec`, `as=raff`; ids are lower-case short names. */
export function normalisePersonParam(value: string): string {
  return value.trim().toLowerCase();
}

/** Parses the query part of a hash route: `#/path?as=alec&today=...&offline=1`. */
export function sessionFromHash(hash: string): Partial<Session> {
  const q = hash.indexOf('?');
  if (q < 0) return {};
  const params = new URLSearchParams(hash.slice(q + 1));
  const out: Partial<Session> = {};
  const as = params.get('as');
  if (as) out.personId = normalisePersonParam(as);
  const today = params.get('today');
  if (today && /^\d{4}-\d{2}-\d{2}$/.test(today)) out.today = today;
  const side = params.get('side');
  if (side) out.sideId = side;
  const offline = params.get('offline');
  if (offline !== null) out.offline = offline === '1' || offline === 'true';
  return out;
}

export function loadSession(storage: KeyValueStorage): Session {
  const base = defaultSession();
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (raw) Object.assign(base, JSON.parse(raw) as Partial<Session>);
  } catch {
    /* corrupt or unavailable: defaults */
  }
  return base;
}

export function saveSession(storage: KeyValueStorage, session: Session): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage full or blocked: the in-memory session still works */
  }
}
