/**
 * Deliveries (UI_PLAN 3.9): what is turning up on site and when, across
 * every build job Alec can see, grouped by week. Material items that are
 * ordered or confirmed, plus each job's shipments; nothing else, no owner,
 * no money (the data layer never gives the site role a price).
 *
 *   Late
 *     ! Expected Tue 15 Sep, 2 days ago, not marked delivered   <- a plate: date first
 *     Confirmed
 *     Cladding, from the supplier         Park Rd
 *     [ Mark delivered ]
 *   This week  14-20 Sep
 *   Next week  21-27 Sep
 *   Later
 *   No date yet
 *   Delivered this week
 *
 * "Mark delivered" moves the item to done (or the shipment to delivered and
 * its material items to done) through the API, which logs it as Alec. The row
 * stays on the list under "Delivered this week" so he sees the word change.
 * Late is always words: the calculator's "3 days late" (expected after the
 * step needs it) or "2 days ago, not marked delivered" (expected date passed).
 */
import { Link } from 'react-router-dom';
import type { TrackerApi } from '../data/api';
import { useApi, useQuery, useSession } from '../data/context';
import { ITEM_STATUS_LABELS, SHIPMENT_STATUS_LABELS, type Item, type ItemStatus, type ShipmentStatus } from '../domain/types';
import { addCalendarDays, calendarDaysBetween, formatShort, formatWeekRange, lastMonday } from '../domain/dates';
import { StatusText, type Tone } from '../components/StatusText';
import { PageHeader } from '../shell/PageHeader';
import './deliveries.css';

export interface Delivery {
  /** The item id or the shipment id; test ids use it. */
  id: string;
  kind: 'item' | 'shipment';
  jobId: string;
  jobName: string;
  title: string;
  /** The supplier or who it is waiting on. */
  from?: string;
  /** ISO date it is expected (the shipment ETA for shipment rows). */
  expected?: string;
  /** Status in words: "Ordered", "Confirmed", "Shipped", "Delivered". */
  status: string;
  delivered: boolean;
  /** The calculator's lateness against the step that needs it, e.g. "3 days late". */
  lateText?: string;
  /** Shipment rows: what is in the container. */
  contents: string[];
  /** Shipment rows: the material items still open, marked done on delivery. */
  openItemIds: string[];
}

const ITEM_WORDS: Record<ItemStatus, string> = {
  to_do: 'Not ordered yet',
  booked: 'Ordered',
  confirmed: ITEM_STATUS_LABELS.confirmed,
  done: 'Delivered',
};
const SHIPMENT_WORDS: Record<ShipmentStatus, string> = {
  design: 'In design',
  in_production: SHIPMENT_STATUS_LABELS.in_production,
  shipped: SHIPMENT_STATUS_LABELS.shipped,
  delivered: SHIPMENT_STATUS_LABELS.delivered,
};

/** "Order cladding" is the item; the delivery is "Cladding". */
export function deliveryTitle(title: string): string {
  const t = title.replace(/^(order|get)\s+/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Delivered rows stay on the list this long so the status word is seen to change. */
const KEEP_DELIVERED_DAYS = 7;

/**
 * Every delivery Alec can see, for one job or all his jobs. Items to do are
 * not deliveries yet (nothing has been ordered), so they are left out.
 */
export function collectDeliveries(api: TrackerApi, today: string, jobId?: string): Delivery[] {
  const jobs = api.listJobs().filter((j) => j.kind === 'build' && (!jobId || j.id === jobId));
  const keepFrom = addCalendarDays(today, -KEEP_DELIVERED_DAYS);
  const out: Delivery[] = [];
  for (const job of jobs) {
    const forecast = api.getForecast(job.id);
    const items = api.listItems({ jobId: job.id, type: 'material', includeDone: true });
    const recentlyDone = (i: Item) => i.status === 'done' && !!i.doneAt && i.doneAt >= keepFrom;

    for (const sh of api.listShipments(job.id)) {
      const linked = items.filter((i) => i.shipmentId === sh.id);
      const open = linked.filter((i) => i.status !== 'done');
      const delivered = sh.status === 'delivered';
      if (delivered && !linked.some(recentlyDone)) continue;
      const late = linked.map((i) => forecast?.items[i.id]).filter((f) => f?.isLate && f.lateText);
      late.sort((a, b) => (b!.lateDays ?? 0) - (a!.lateDays ?? 0));
      out.push({
        id: sh.id,
        kind: 'shipment',
        jobId: job.id,
        jobName: job.name,
        title: sh.name,
        from: sh.supplier,
        expected: sh.eta,
        status: SHIPMENT_WORDS[sh.status],
        delivered,
        lateText: delivered ? undefined : late[0]?.lateText,
        contents: linked.map((i) => i.title),
        openItemIds: open.map((i) => i.id),
      });
    }

    for (const it of items) {
      if (it.shipmentId) continue;
      if (it.status === 'to_do') continue;
      if (it.status === 'done' && !recentlyDone(it)) continue;
      const f = forecast?.items[it.id];
      const delivered = it.status === 'done';
      out.push({
        id: it.id,
        kind: 'item',
        jobId: job.id,
        jobName: job.name,
        title: deliveryTitle(it.title),
        from: it.waitingOn,
        expected: delivered ? it.doneAt : f?.expected ?? it.expectedDate,
        status: ITEM_WORDS[it.status],
        delivered,
        lateText: delivered ? undefined : f?.isLate ? f.lateText : undefined,
        contents: [],
        openItemIds: [],
      });
    }
  }
  return out;
}

export type GroupKey = 'late' | 'this-week' | 'next-week' | 'later' | 'no-date' | 'delivered';

export interface DeliveryGroup {
  key: GroupKey;
  title: string;
  /** "14-20 Sep" for the week groups. */
  range?: string;
  rows: Delivery[];
}

/** Late first, then this week, next week, later, no date, then what was delivered. Rows by date inside each. */
export function groupDeliveries(rows: Delivery[], today: string): DeliveryGroup[] {
  const monday = lastMonday(today);
  const nextMon = addCalendarDays(monday, 7);
  const afterNext = addCalendarDays(monday, 14);
  const keyOf = (d: Delivery): GroupKey => {
    if (d.delivered) return 'delivered';
    if (!d.expected) return 'no-date';
    if (d.lateText || d.expected < today) return 'late';
    if (d.expected < nextMon) return 'this-week';
    if (d.expected < afterNext) return 'next-week';
    return 'later';
  };
  const byDate = (a: Delivery, b: Delivery) => (a.expected ?? '').localeCompare(b.expected ?? '') || a.title.localeCompare(b.title);
  const defs: { key: GroupKey; title: string; range?: string }[] = [
    { key: 'late', title: 'Late' },
    { key: 'this-week', title: 'This week', range: formatWeekRange(monday) },
    { key: 'next-week', title: 'Next week', range: formatWeekRange(nextMon) },
    { key: 'later', title: 'Later', range: `after ${formatShort(addCalendarDays(afterNext, -1))}` },
    { key: 'no-date', title: 'No date yet' },
    { key: 'delivered', title: 'Delivered this week' },
  ];
  return defs
    .map((g) => ({ ...g, rows: rows.filter((r) => keyOf(r) === g.key).sort(byDate) }))
    .filter((g) => g.rows.length > 0);
}

/** The one date sentence a row shows, and its tone. */
export function deliveryWhen(d: Delivery, today: string): { text: string; tone: Tone } {
  if (d.delivered) return { text: d.expected ? `Delivered ${formatShort(d.expected)}` : 'Delivered', tone: 'ok' };
  if (!d.expected) return { text: 'No date yet', tone: 'muted' };
  if (d.lateText) return { text: `Expected ${formatShort(d.expected)}, ${d.lateText}`, tone: 'late' };
  const ago = calendarDaysBetween(d.expected, today);
  if (ago > 0) return { text: `Expected ${formatShort(d.expected)}, ${ago} day${ago === 1 ? '' : 's'} ago, not marked delivered`, tone: 'amber' };
  if (ago === 0) return { text: `Expected today, ${formatShort(d.expected)}`, tone: 'plain' };
  return { text: `Expected ${formatShort(d.expected)}`, tone: 'plain' };
}

/** Marks a delivery as arrived through the API. Shipments take their open material items with them. */
export function markDelivered(api: TrackerApi, d: Delivery): void {
  if (d.kind === 'item') {
    api.updateItemStatus(d.id, 'done');
    return;
  }
  api.setShipmentStatus(d.id, 'delivered');
  for (const id of d.openItemIds) api.updateItemStatus(id, 'done');
}

export function DeliveryRow({
  delivery: d,
  today,
  showJob,
  onMark,
}: {
  delivery: Delivery;
  today: string;
  showJob?: boolean;
  /** Renders the "Mark delivered" button when given and the row is still open. */
  onMark?: (d: Delivery) => void;
}) {
  const when = deliveryWhen(d, today);
  return (
    <li className="deliveries__row plate" data-testid={`delivery-${d.id}`}>
      <p className="deliveries__when">
        <StatusText tone={when.tone} plain={when.tone === 'plain'}>
          {when.text}
        </StatusText>
        <span className="deliveries__status" data-testid={`delivery-status-${d.id}`}>
          {d.status}
        </span>
      </p>
      <div className="deliveries__main">
        <p className="deliveries__head">
          <span className="deliveries__title">{d.title}</span>
          {showJob && <span className="deliveries__job">{d.jobName}</span>}
        </p>
        {d.from && <p className="deliveries__from">from {d.from}</p>}
        {d.contents.length > 0 && <p className="deliveries__contents">{d.contents.join(', ')}</p>}
      </div>
      {onMark && !d.delivered && (
        <button type="button" className="btn btn--fill deliveries__mark" onClick={() => onMark(d)} data-testid={`delivery-mark-${d.id}`}>
          Mark delivered
        </button>
      )}
    </li>
  );
}

export default function Deliveries() {
  const api = useApi();
  const { today } = useSession();
  const jobs = useQuery((api) => api.listJobs().filter((j) => j.kind === 'build'), []);
  const rows = useQuery((api) => collectDeliveries(api, today), [today]);
  const groups = groupDeliveries(rows, today);
  const open = rows.filter((r) => !r.delivered).length;
  const showJob = jobs.length > 1;

  return (
    <main className="page deliveries" data-testid="deliveries">
      <PageHeader
        title="Deliveries"
        meta={
          open === 0
            ? 'Nothing on its way'
            : `${open} on the way${showJob ? ` across ${jobs.length} jobs` : jobs[0] ? ` to ${jobs[0].name}` : ''}`
        }
      />
      {groups.length === 0 ? (
        <p className="deliveries__empty" data-testid="deliveries-empty">
          No deliveries expected in the next fortnight.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="deliveries__group" aria-labelledby={`deliveries-${g.key}`} data-testid={`deliveries-group-${g.key}`}>
            <h2 id={`deliveries-${g.key}`} className="deliveries__group-title">
              <span>{g.title}</span>
              {g.range && <span className="deliveries__range num">{g.range}</span>}
            </h2>
            <ul className="deliveries__list">
              {g.rows.map((d) => (
                <DeliveryRow key={d.id} delivery={d} today={today} showJob={showJob} onMark={(d) => markDelivered(api, d)} />
              ))}
            </ul>
          </section>
        ))
      )}
      {jobs[0] && (
        <p className="deliveries__foot">
          <Link to={`/jobs/${jobs[0].id}/notes`} className="btn btn--ghost" data-testid="deliveries-notes-link">
            Write today's note
          </Link>
        </p>
      )}
    </main>
  );
}
