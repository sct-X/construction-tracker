/**
 * The upload queue's presence in the shell: one thin strip under the offline
 * bar, "3 photos waiting to send", linking to #/queue. Hidden at zero and on
 * the queue screen itself. UI_PLAN section 2 puts Alec's queue on a badge,
 * not a tab; this strip is that badge for every role, and Alec's Today can
 * put the same count on its Upload button through `useQueuedPhotos`.
 *
 * The strip is also where the automatic sends live, because it is mounted
 * on every screen while the app is open: a flush when the browser fires
 * `online`, and a retry with a growing wait after a failed send.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi, useSession } from '../data/context';
import { sharedPhotoQueue, sortQueued, type QueuedPhoto } from '../data/photoQueue';
import './queueBadge.css';

/** How many failed sends are retried by themselves before the queue waits for a Retry tap. */
export const MAX_AUTO_ATTEMPTS = 5;

/**
 * The phone's queue, oldest first, refreshed on every queue or api change.
 * Pass a job id to get that job's photos only. The one hook for every
 * screen that reads the queue (gallery, Today, upload, queue, badge).
 */
export function useQueuedPhotos(jobId?: string): QueuedPhoto[] {
  const api = useApi();
  const [list, setList] = useState<QueuedPhoto[]>([]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      api
        .listQueuedPhotos()
        .then((q) => {
          if (live) setList(sortQueued(jobId ? q.filter((p) => p.jobId === jobId) : q));
        })
        .catch(() => {
          if (live) setList([]);
        });
    };
    refresh();
    const offQueue = sharedPhotoQueue().subscribe(refresh);
    const offApi = api.subscribe(refresh);
    return () => {
      live = false;
      offQueue();
      offApi();
    };
  }, [api, jobId]);
  return list;
}

/** True when the phone has no signal: the dev bar's toggle, or the browser saying so. */
export function noSignal(offline: boolean): boolean {
  return offline || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

/** A small clock: the queued mark, always beside words. */
export function ClockGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useQueueFlusher(queued: QueuedPhoto[]) {
  const api = useApi();
  const { offline } = useSession();

  // Signal back: the browser says so before anyone touches the dev bar.
  useEffect(() => {
    const go = () => {
      if (!api.getSession().offline) void api.flushPhotoQueue();
    };
    window.addEventListener('online', go);
    return () => window.removeEventListener('online', go);
  }, [api]);

  // A failed send is tried again after a wait that grows with each failure,
  // up to MAX_AUTO_ATTEMPTS; after that the queue screen's Retry re-arms it.
  const failed = queued.find((p) => p.state === 'failed' && (p.attempts ?? 0) < MAX_AUTO_ATTEMPTS);
  const failedId = failed?.id;
  const attempts = failed?.attempts ?? 0;
  useEffect(() => {
    if (!failedId || noSignal(offline)) return;
    const wait = Math.min(60_000, 5_000 * Math.max(1, attempts));
    const t = window.setTimeout(() => void api.flushPhotoQueue(), wait);
    return () => window.clearTimeout(t);
  }, [api, offline, failedId, attempts]);
}

export function badgeWords(queued: QueuedPhoto[]): string {
  const n = queued.length;
  const sending = queued.filter((p) => p.state === 'sending').length;
  const failed = queued.filter((p) => p.state === 'failed').length;
  if (sending > 0) return `Sending ${n} photo${n === 1 ? '' : 's'}`;
  if (failed > 0) return `${n} photo${n === 1 ? '' : 's'} waiting to send, ${failed} didn't go`;
  return `${n} photo${n === 1 ? '' : 's'} waiting to send`;
}

export function QueueBadge() {
  const queued = useQueuedPhotos();
  const { pathname } = useLocation();
  useQueueFlusher(queued);
  if (queued.length === 0 || pathname === '/queue') return null;
  return (
    <Link to="/queue" className="queue-badge" data-testid="queue-badge">
      <ClockGlyph className="queue-badge__glyph" />
      <span>{badgeWords(queued)}</span>
      <span className="queue-badge__go">Upload queue</span>
    </Link>
  );
}
