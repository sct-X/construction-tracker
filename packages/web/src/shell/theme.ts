/**
 * Light by default, dark and "match the device" as the alternates (v1 V3; v1 put
 * the choice in My settings, here it is the "Look" menu at the foot of the
 * desktop sidebar). The choice is a per-viewer convenience in localStorage
 * (`ct-theme`, every access in try/catch); `?theme=light|dark|system` in the hash
 * sets it too (tests, links). The tokens switch on `<html data-theme>`.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'ct-theme';
const DARK = '(prefers-color-scheme: dark)';

export function readTheme(): ThemeChoice {
  const fromHash = /[?&]theme=(light|dark|system)\b/.exec(globalThis.location?.hash ?? '')?.[1] as ThemeChoice | undefined;
  if (fromHash) {
    saveTheme(fromHash);
    return fromHash;
  }
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // per-viewer convenience only
  }
  return 'light';
}

export function saveTheme(t: ThemeChoice): void {
  try {
    globalThis.localStorage?.setItem(KEY, t);
  } catch {
    // per-viewer convenience only
  }
}

/** Sets data-theme on <html> now, and follows the device while the choice is "system". Returns a cleanup. */
export function applyTheme(t: ThemeChoice): () => void {
  const root = globalThis.document?.documentElement;
  if (!root) return () => {};
  const mq = t === 'system' ? globalThis.matchMedia?.(DARK) : undefined;
  const set = () => {
    root.dataset.theme = t === 'system' ? (mq?.matches ? 'dark' : 'light') : t;
  };
  set();
  mq?.addEventListener?.('change', set);
  return () => mq?.removeEventListener?.('change', set);
}
