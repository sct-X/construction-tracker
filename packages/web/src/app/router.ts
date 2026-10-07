import { useEffect, useState } from 'react';

/** The path inside the hash: "#/jobs?x=1" -> "/jobs". Empty hash = "/". */
export function hashPath(hash: string = globalThis.location?.hash ?? ''): string {
  const raw = hash.replace(/^#/, '').split('?')[0] ?? '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function useHashPath(): string {
  const [path, setPath] = useState(() => hashPath());
  useEffect(() => {
    const on = () => setPath(hashPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

/** Matches "/jobs/:jobId" style patterns. Returns params or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const seg = a[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(b[i]!);
    else if (seg !== b[i]) return null;
  }
  return params;
}

/** href for a route path: "/jobs" -> "#/jobs". */
export function href(path: string): string {
  return `#${path}`;
}
