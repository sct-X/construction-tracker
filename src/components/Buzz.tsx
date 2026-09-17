/**
 * The in-app stand-in for the phone buzz (UI_PLAN section 6: push needs a
 * server, so the prototype shows the notification arriving in the app).
 *
 * Mounted once by the shell. It watches the current person's unread
 * notifications; when one arrives that this session has not seen, a calm
 * one-line banner appears at the foot of the screen (above the phone tab
 * bar) with the words of the notification and a link to the thing. It hides
 * after 8 seconds, on Dismiss, or when the link is followed. Never a modal,
 * never colour alone; announced through aria-live; the slide respects
 * reduced motion.
 *
 * Seeded notifications and a person switch never buzz: the seen set starts
 * as whatever is already there for that person.
 */
import { useEffect, useRef, useState } from 'react';
import { useApi, useQuery, useSession } from '../data/context';
import type { TrackerApi } from '../data/api';
import type { Notification } from '../domain/types';
import './buzz.css';

export const BUZZ_MS = 8000;

/** Where a notification points: the item, step or shipment it is about, else the job, else the list. */
export function notificationHref(n: Notification, api: TrackerApi): string {
  if (n.itemId && api.canSee('item')) return `/items/${n.itemId}`;
  if (n.stepId) return `/steps/${n.stepId}`;
  if (n.shipmentId && api.canSee('shipment')) return `/shipments/${n.shipmentId}`;
  if (n.jobId) return `/jobs/${n.jobId}`;
  return '/notifications';
}

/** The word for what the link opens: "Open item", "Open step", "Open job". */
export function notificationLinkWords(n: Notification, api: TrackerApi): string {
  if (n.itemId && api.canSee('item')) return 'Open item';
  if (n.stepId) return 'Open step';
  if (n.shipmentId && api.canSee('shipment')) return 'Open shipment';
  if (n.jobId) return 'Open job';
  return 'Open notifications';
}

interface Shown {
  notification: Notification;
  /** How many more arrived in the same moment. */
  more: number;
}

/** `layout` comes from the shell: the phone version sits above the tab bar, the desktop one beside the sidebar. */
export function Buzz({ layout = 'phone' }: { layout?: 'phone' | 'desktop' }) {
  const api = useApi();
  const { personId, sideId } = useSession();
  const unread = useQuery((api) => api.listNotifications({ unreadOnly: true }), []);
  const seen = useRef<{ key: string; ids: Set<string> } | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const key = `${personId}|${sideId}`;
    if (!seen.current || seen.current.key !== key) {
      // A new person (or side): start from what is already there, buzz for nothing.
      seen.current = { key, ids: new Set(unread.map((n) => n.id)) };
      return;
    }
    const fresh = unread.filter((n) => !seen.current!.ids.has(n.id));
    if (!fresh.length) return;
    for (const n of fresh) seen.current.ids.add(n.id);
    // `unread` is newest first; stamps are to the minute, so among ties the last raised (last in a stable sort) is the newest.
    const newest = fresh.filter((n) => n.at === fresh[0].at).pop()!;
    setShown({ notification: newest, more: fresh.length - 1 });
  }, [unread, personId, sideId]);

  useEffect(() => {
    if (!shown) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(null), BUZZ_MS);
    return () => window.clearTimeout(timer.current);
  }, [shown]);

  const dismiss = () => setShown(null);

  return (
    <div className={layout === 'desktop' ? 'buzz-slot buzz-slot--desktop' : 'buzz-slot'} role="status" aria-live="polite" aria-atomic="true">
      {shown && (
        <div className="buzz" data-testid="buzz" data-kind={shown.notification.kind}>
          <p className="buzz__words">
            <span className="buzz__text">{shown.notification.text}</span>
            {shown.more > 0 && (
              <a className="buzz__more" href="#/notifications" onClick={dismiss} data-testid="buzz-more">
                and {shown.more} more
              </a>
            )}
          </p>
          <a
            className="buzz__link"
            href={`#${notificationHref(shown.notification, api)}`}
            data-testid="buzz-link"
            onClick={() => {
              api.markNotificationRead(shown.notification.id);
              dismiss();
            }}
          >
            {notificationLinkWords(shown.notification, api)}
          </a>
          <button type="button" className="buzz__dismiss" onClick={dismiss} data-testid="buzz-dismiss">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
