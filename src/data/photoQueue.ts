/**
 * The phone's own upload queue, in IndexedDB so it survives the offline
 * toggle, a reload, and the app being closed. Hand-rolled: one object store,
 * a handful of operations. Falls back to memory where IndexedDB is missing
 * (tests).
 *
 * iPhones don't upload in the background, so `flush` runs while the app is
 * open and only when the session is not offline. Each photo is removed from
 * the queue only after the upload succeeds, so nothing lands twice or is
 * lost; a flush already under way is shared, not doubled.
 *
 * In the browser there is one queue (`sharedPhotoQueue()`): the api sends
 * through it and the badge and the queue screen `subscribe` to it, so a
 * photo changing from queued to sending shows everywhere at once.
 */
export type QueuedPhotoState = 'queued' | 'sending' | 'failed';

export interface QueuedPhoto {
  id: string;
  /** The side the photo is filed on, fixed at queue time so a later side switch cannot move it. */
  sideId?: string;
  jobId: string;
  stageId: string | null;
  categoryId: string;
  /** What gets uploaded by the mock: the photo downscaled on the phone. */
  dataUrl: string;
  /** A small thumbnail for lists and badges. Falls back to dataUrl when absent. */
  thumbDataUrl?: string;
  /** The original file, kept for the real server; the mock uploads dataUrl. */
  blob?: Blob;
  takenOn: string;
  caption?: string;
  uploadedById: string;
  queuedAt: string;
  state: QueuedPhotoState;
  error?: string;
  /** Failed sends so far, for the retry back-off. */
  attempts?: number;
}

export type QueueListener = () => void;

export interface PhotoQueue {
  enqueue(photo: Omit<QueuedPhoto, 'id' | 'state' | 'queuedAt'> & { queuedAt?: string }): Promise<QueuedPhoto>;
  list(): Promise<QueuedPhoto[]>;
  get(id: string): Promise<QueuedPhoto | undefined>;
  update(id: string, patch: Partial<QueuedPhoto>): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  /** Called after every change (enqueue, state change, remove, clear). Returns the unsubscribe. */
  subscribe(listener: QueueListener): () => void;
  /**
   * Sends every queued or failed photo through `upload`, one at a time, in
   * order. A failure marks the photo failed (kept, attempts + 1); the loop
   * stops if `canSend()` has turned false, otherwise it carries on with the
   * next photo. An entry removed while an earlier one was sending is skipped.
   * Does nothing when `canSend()` is false. A flush already running is
   * returned rather than started again. Returns how many were sent.
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

/** Oldest first; a failed photo keeps its place so nothing lands out of order. */
export function sortQueued(list: QueuedPhoto[]): QueuedPhoto[] {
  return [...list].sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : a.queuedAt > b.queuedAt ? 1 : a.id < b.id ? -1 : 1));
}

async function flushWith(
  queue: PhotoQueue,
  upload: (photo: QueuedPhoto) => Promise<void> | void,
  canSend: () => boolean,
): Promise<number> {
  if (!canSend()) return 0;
  // A photo left "sending" by a closed app is sent again: nothing was removed, so nothing landed.
  const all = sortQueued(await queue.list());
  let sent = 0;
  for (const listed of all) {
    if (!canSend()) break;
    // Re-read: a Remove tapped while an earlier photo was sending must win.
    const photo = await queue.get(listed.id);
    if (!photo) continue;
    await queue.update(photo.id, { state: 'sending', error: undefined });
    try {
      await upload({ ...photo, state: 'sending' });
      await queue.remove(photo.id);
      sent++;
    } catch (err) {
      await queue.update(photo.id, {
        state: 'failed',
        error: err instanceof Error ? err.message : String(err),
        attempts: (photo.attempts ?? 0) + 1,
      });
      // Signal gone: stop, the rest wait. Anything else is this photo's own
      // problem (a missing job, a bad file): carry on with the next one.
      if (!canSend()) break;
    }
  }
  return sent;
}

/** Listeners and the single-flight flush, shared by both implementations. */
abstract class BaseQueue implements PhotoQueue {
  private listeners = new Set<QueueListener>();
  private inFlight: Promise<number> | null = null;

  abstract enqueue(photo: Omit<QueuedPhoto, 'id' | 'state' | 'queuedAt'> & { queuedAt?: string }): Promise<QueuedPhoto>;
  abstract list(): Promise<QueuedPhoto[]>;
  abstract get(id: string): Promise<QueuedPhoto | undefined>;
  abstract update(id: string, patch: Partial<QueuedPhoto>): Promise<void>;
  abstract remove(id: string): Promise<void>;
  abstract clear(): Promise<void>;

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  protected changed(): void {
    for (const l of [...this.listeners]) l();
  }
  flush(upload: (photo: QueuedPhoto) => Promise<void> | void, canSend: () => boolean): Promise<number> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = flushWith(this, upload, canSend).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
}

class MemoryPhotoQueue extends BaseQueue {
  private map = new Map<string, QueuedPhoto>();
  async enqueue(photo: Omit<QueuedPhoto, 'id' | 'state' | 'queuedAt'> & { queuedAt?: string }): Promise<QueuedPhoto> {
    const q: QueuedPhoto = { ...photo, id: newId(), state: 'queued', queuedAt: photo.queuedAt ?? nowStamp() };
    this.map.set(q.id, q);
    this.changed();
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
    if (cur) {
      this.map.set(id, { ...cur, ...patch });
      this.changed();
    }
  }
  async remove(id: string): Promise<void> {
    if (this.map.delete(id)) this.changed();
  }
  async clear(): Promise<void> {
    this.map.clear();
    this.changed();
  }
}

class IndexedDbPhotoQueue extends BaseQueue {
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
    const q: QueuedPhoto = { ...photo, id: newId(), state: 'queued', queuedAt: photo.queuedAt ?? nowStamp() };
    await this.tx('readwrite', (s) => s.put(q));
    this.changed();
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
    if (cur) {
      await this.tx('readwrite', (s) => s.put({ ...cur, ...patch }));
      this.changed();
    }
  }
  async remove(id: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(id));
    this.changed();
  }
  async clear(): Promise<void> {
    await this.tx('readwrite', (s) => s.clear());
    this.changed();
  }
}

let shared: PhotoQueue | null = null;

/**
 * The browser's one queue. The api sends through it (`createPhotoQueue`
 * returns it when IndexedDB exists) and the UI subscribes to it. Where
 * IndexedDB is missing (tests, SSR) the api gets a fresh memory queue per
 * call so tests stay independent, and the shared one is a memory queue too.
 */
export function sharedPhotoQueue(): PhotoQueue {
  if (!shared) shared = typeof indexedDB !== 'undefined' ? new IndexedDbPhotoQueue() : new MemoryPhotoQueue();
  return shared;
}

export function createPhotoQueue(): PhotoQueue {
  if (typeof indexedDB !== 'undefined') return sharedPhotoQueue();
  return new MemoryPhotoQueue();
}

export function createMemoryPhotoQueue(): PhotoQueue {
  return new MemoryPhotoQueue();
}
