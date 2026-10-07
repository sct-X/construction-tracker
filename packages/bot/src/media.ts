/**
 * Files Dominic sends: downloading them from Telegram and keeping them under
 * DATA_DIR (voice notes in audio/, photos in photos/). node:path only, so the
 * same code runs on macOS, Windows and Linux. Stored paths always use "/" so
 * the database is portable between them.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

/** Gets a file's bytes given Telegram's `file_path` (from getFile). */
export interface FileDownloader {
  download(file: { fileId: string; filePath: string }): Promise<Uint8Array>;
}

/** Telegram's bots file endpoint. The token is in the URL (Telegram's design), so the URL is never logged. */
export function telegramDownloader(token: string, o: { fetch?: typeof fetch; apiRoot?: string; timeoutMs?: number } = {}): FileDownloader {
  const doFetch = o.fetch ?? fetch;
  const root = (o.apiRoot ?? 'https://api.telegram.org').replace(/\/+$/, '');
  return {
    async download({ filePath }) {
      const res = await doFetch(`${root}/file/bot${token}/${filePath}`, { signal: AbortSignal.timeout(o.timeoutMs ?? 60_000) });
      if (!res.ok) throw new Error(`Telegram file download answered ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/** Where the bot keeps what Dominic sends. */
export interface MediaStore {
  /** Saves a voice note. `storedPath` is relative to DATA_DIR ("audio/2026-09-17-ab12cd.oga"), `file` absolute. */
  saveAudio(data: Uint8Array, o: { date: string; ext: string }): Promise<{ storedPath: string; file: string }>;
  removeAudio(storedPath: string): Promise<void>;
  /** Saves a photo. `filePath` is relative to the photos folder ("telegram/2026-09-17-ab12cd.jpg"), `file` absolute. */
  savePhoto(data: Uint8Array, o: { date: string; ext: string }): Promise<{ filePath: string; file: string }>;
  removePhoto(filePath: string): Promise<void>;
  /** Small persistent yes/no notes (e.g. "told Dominic about sending photos as files"). */
  flag(name: string): boolean;
  setFlag(name: string): void;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-');

/** A unique, safe file name: "2026-09-17-<12 hex>.jpg". */
export function mediaFileName(date: string, ext: string): string {
  const e = safe(ext.replace(/^\./, '').toLowerCase()) || 'bin';
  return `${safe(date)}-${randomBytes(6).toString('hex')}.${e}`;
}

function inside(base: string, stored: string): string {
  const parts = stored.split(/[\\/]+/).filter(Boolean);
  const full = resolve(base, ...parts);
  const rel = relative(base, full);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Path escapes its folder: ${stored}`);
  return full;
}

/** Photos from Telegram go in photos/telegram/ (the job isn't known when the file arrives). */
export const TELEGRAM_PHOTO_FOLDER = 'telegram';

/** MediaStore on disk under DATA_DIR: audio/, photos/telegram/, and bot-state.json for flags. */
export function diskMediaStore(dataDir: string): MediaStore {
  const audioDir = join(dataDir, 'audio');
  const photosDir = join(dataDir, 'photos');
  const stateFile = join(dataDir, 'bot-state.json');
  const readState = (): Record<string, boolean> => {
    try {
      return JSON.parse(readFileSync(stateFile, 'utf8')) as Record<string, boolean>;
    } catch {
      return {};
    }
  };
  return {
    async saveAudio(data, o) {
      await mkdir(audioDir, { recursive: true });
      const name = mediaFileName(o.date, o.ext);
      const file = join(audioDir, name);
      await writeFile(file, data, { flag: 'wx' });
      return { storedPath: `audio/${name}`, file };
    },
    async removeAudio(storedPath) {
      await rm(inside(dataDir, storedPath), { force: true });
    },
    async savePhoto(data, o) {
      const dir = join(photosDir, TELEGRAM_PHOTO_FOLDER);
      await mkdir(dir, { recursive: true });
      const name = mediaFileName(o.date, o.ext);
      const file = join(dir, name);
      await writeFile(file, data, { flag: 'wx' });
      return { filePath: `${TELEGRAM_PHOTO_FOLDER}/${name}`, file };
    },
    async removePhoto(filePath) {
      await rm(inside(photosDir, filePath), { force: true });
    },
    flag(name) {
      return readState()[name] === true;
    },
    setFlag(name) {
      const s = readState();
      s[name] = true;
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(stateFile, JSON.stringify(s, null, 2));
    },
  };
}

/** File extension for a Telegram file: from its path, else its mime type, else the fallback. */
export function extensionFor(filePath: string | undefined, mime: string | undefined, fallback: string): string {
  const fromPath = filePath ? /\.([A-Za-z0-9]{1,5})$/.exec(filePath)?.[1] : undefined;
  if (fromPath) return fromPath.toLowerCase();
  const m = (mime ?? '').toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/gif': 'gif',
    'image/tiff': 'tif',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
  };
  return map[m] ?? fallback;
}
