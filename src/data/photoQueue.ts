/**
 * The phone's own upload queue, in IndexedDB so it survives the offline
 * toggle, a reload, and the app being closed. Hand-rolled: one object store,
 * four operations. Falls back to memory where IndexedDB is missing (tests).
 *
 * iPhones don't upload in the background, so `flush` runs while the app is
 * open and only when the session is not offline. Each photo is removed from
 * the queue only after the upload succeeds, so nothing lands twice or is lost.
 */
export interface QueuedPhoto {
  id: string;
  jobId: string;
  stageId: string | null;
  categoryId: string;
  dataUrl: string;
  takenOn: string;
  caption?: string;
  uploadedById: string;
  queuedAt: string;
  state: 'waiting' | 'sending' | 'failed';
  error?: string;
}

export interface PhotoQueue {
  enqueue(photo: Omit<QueuedPhoto, 'id' | 'state' | 'queuedAt'> & { queuedAt?: string }): Promise<QueuedPhoto>;
  list(): Promise<QueuedPhoto[]>;
  get(id: string): Promise<QueuedPhoto | undefined>;
  update(id: string, patch: Partial<QueuedPhoto>): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  /**
   * Sends every waiting or failed photo through `upload`, one at a time, in
   * order. Stops at the first failure (marked failed, kept). Does nothing when
   * `canSend()` is false. Returns how many were sent.
   */
  flush(upload: (photo: QueuedPhoto) => Promise<void> | void, canSend: () => boolean): Promise<number>;
}

const DB_NAME = 'construction-tracker';
const DB_VERSION = 1;
const STORE = 'photoQueue';

function newId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function flushWith(
  queue: PhotoQueue,
  upload: (photo: QueuedPhoto) => Promise<void> | void,
  canSend: () => boolean,
): Promise<number> {
  if (!canSend()) return 0;
  const all = (await queue.list()).filter((p) => p.state !== 'sending').sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : 1));
  let sent = 0;
  for (const photo of all) {
    if (!canSend()) break;
    await queue.update(photo.id, { state: 'sending', error: undefined });
    try {
      await upload({ ...photo, state: 'sending' });
      await queue.remove(photo.id);
      sent++;
    } catch (err) {
      await queue.update(photo.id, { state: 'failed', error: err instanceof Error ? err.message : String(err) });
      break;
    }
  }
  return sent;
}

class MemoryPhotoQueue implements PhotoQueue {
  private map = new Map<string, QueuedPhoto>();
  async enqueue(photo: Omit<QueuedPhoto, 'id' | 'state' | 'queuedAt'> & { queuedAt?: string }): Promise<QueuedPhoto> {
    const q: QueuedPhoto = { ...photo, id: newId(), state: 'waiting', queuedAt: photo.queuedAt ?? nowStamp() };
    this.map.set(q.id, q);
    return q;
  }
  async list(): Promise<QueuedPhoto[]> {
    return [...this.map.values()];
  }
  async get(id: string): Promise<QueuedPhoto | undefined> {
    return this.map.get(id);
  }
  async update(id: string, patch: Partial<QueuedPhoto>): Promise<void> {
    const cur = this.map.get(id);
    if (cur) this.map.set(id, { ...cur, ...patch });
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
  flush(upload: (photo: QueuedPhoto) => Promise<void> | void, canSend: () => boolean): Promise<number> {
    return flushWith(this, upload, canSend);
  }
}

class IndexedDbPhotoQueue implements PhotoQueue {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private async tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async enqueue(photo: Omit<QueuedPhoto, 'id' | 'state' | 'queuedAt'> & { queuedAt?: string }): Promise<QueuedPhoto> {
    const q: QueuedPhoto = { ...photo, id: newId(), state: 'waiting', queuedAt: photo.queuedAt ?? nowStamp() };
    await this.tx('readwrite', (s) => s.put(q));
    return q;
  }
  async list(): Promise<QueuedPhoto[]> {
    return (await this.tx('readonly', (s) => s.getAll())) as QueuedPhoto[];
  }
  async get(id: string): Promise<QueuedPhoto | undefined> {
    return (await this.tx('readonly', (s) => s.get(id))) as QueuedPhoto | undefined;
  }
  async update(id: string, patch: Partial<QueuedPhoto>): Promise<void> {
    const cur = await this.get(id);
    if (cur) await this.tx('readwrite', (s) => s.put({ ...cur, ...patch }));
  }
  async remove(id: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(id));
  }
  async clear(): Promise<void> {
    await this.tx('readwrite', (s) => s.clear());
  }
  flush(upload: (photo: QueuedPhoto) => Promise<void> | void, canSend: () => boolean): Promise<number> {
    return flushWith(this, upload, canSend);
  }
}

export function createPhotoQueue(): PhotoQueue {
  if (typeof indexedDB !== 'undefined') return new IndexedDbPhotoQueue();
  return new MemoryPhotoQueue();
}

export function createMemoryPhotoQueue(): PhotoQueue {
  return new MemoryPhotoQueue();
}
