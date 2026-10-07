/**
 * Where data lives on disk. Everything under DATA_DIR (default ./data from
 * the folder `npm start` runs in): the SQLite file, photos, voice notes.
 * node:path only, so the same setup works on macOS, Windows and Linux.
 */
import { mkdirSync } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

export interface DataPaths {
  dataDir: string;
  dbFile: string;
  photosDir: string;
  audioDir: string;
}

/** Resolves DATA_DIR (absolute, or relative to `cwd`). */
export function resolveDataDir(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): string {
  const raw = env.DATA_DIR?.trim() || 'data';
  return isAbsolute(raw) ? normalize(raw) : resolve(cwd, raw);
}

export function dataPaths(dataDir: string): DataPaths {
  return {
    dataDir,
    dbFile: join(dataDir, 'tracker.db'),
    photosDir: join(dataDir, 'photos'),
    audioDir: join(dataDir, 'audio'),
  };
}

/** Creates the data, photos and audio folders. */
export function ensureDataDirs(paths: DataPaths): DataPaths {
  for (const d of [paths.dataDir, paths.photosDir, paths.audioDir]) mkdirSync(d, { recursive: true });
  return paths;
}

function inside(base: string, stored: string, what: string): string {
  const parts = stored.split(/[\\/]+/).filter(Boolean);
  const full = resolve(base, ...parts);
  const rel = relative(base, full);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`${what} path escapes its folder: ${stored}`);
  return full;
}

/** Absolute file for a stored photo path ("park-rd/2026-09-16-abc.jpg"). Refuses paths outside the photos folder. */
export function photoFile(paths: DataPaths, filePath: string): string {
  return inside(paths.photosDir, filePath, 'Photo');
}

/** Absolute file for a stored audio path, relative to DATA_DIR ("audio/2026-09-15-x.ogg"). */
export function dataFile(paths: DataPaths, stored: string): string {
  return inside(paths.dataDir, stored, 'Data');
}

/** The stored (forward-slash) form of a path under the photos folder: always "/" so the DB is portable. */
export function storedPhotoPath(paths: DataPaths, absoluteFile: string): string {
  const rel = relative(paths.photosDir, absoluteFile);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Not inside the photos folder: ${absoluteFile}`);
  return rel.split(sep).join('/');
}

/** A new photo's stored path: "<jobId>/<YYYY-MM-DD>-<id>.<ext>". */
export function newPhotoPath(jobId: string, date: string, id: string, ext = 'jpg'): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe(jobId)}/${safe(date)}-${safe(id)}.${safe(ext.replace(/^\./, ''))}`;
}
