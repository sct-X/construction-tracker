/**
 * Telegram wording: short, plain English, dates as "Mon 16 Nov". Everything
 * here is pure (data in, text out) so cards can be tested without a bot.
 * Messages are Telegram HTML (parse_mode HTML, see html.ts): functions named
 * ...Text / ...Lines / ...Block return HTML with every user and database
 * string escaped; fieldLabel, valueText, rowLabel, slipText and cardTitle
 * return plain words.
 */
import {
  calendarDaysBetween,
  formatDate,
  formatDays,
  formatMoney,
  formatStamp,
  isISODate,
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
  STAGE_STATUSES,
  stageDisplayName,
  STEP_STATUS_LABELS,
  type Change,
  type Dataset,
  type ISODate,
  type JobImpact,
  type JsonValue,
} from '@ct/core';
import { b, beforeAfter, blocks, bullet, esc, heardLine } from './html.js';

/** Human names for the fields operations change. Unknown fields fall back to spaced words. */
const FIELD_LABELS: Record<string, string> = {
  eta: 'ETA',
  status: 'status',
  expectedDate: 'expected date',
  leadTimeWeeks: 'lead time',
  actualStart: 'started',
  actualEnd: 'finished',
  lastConfirmed: 'last confirmed',
  confirmedDate: 'confirmed date',
  doneAt: 'done',
  neededBy: 'needed by',
  waitingOn: 'waiting on',
  owner: 'owner',
  notes: 'notes',
  title: 'title',
  tradeId: 'trade',
  stepId: 'step',
  shipmentId: 'shipment',
  categoryId: 'photo category',
  plannedStart: 'planned start',
  plannedEnd: 'planned end',
  durationDays: 'duration',
  weeklyHoldingCost: 'weekly holding cost',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const STAGE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STAGE_STATUSES.map((s) => [s, s === 'not_started' ? 'Not started' : s === 'in_progress' ? 'In progress' : 'Done']),
);

/** A before/after value in words. */
export function valueText(ds: Dataset, table: string, field: string, v: JsonValue, today: ISODate): string {
  if (v === null || v === undefined || v === '') return 'none';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') {
    if (field === 'leadTimeWeeks') return `${v} week${v === 1 ? '' : 's'}`;
    if (field === 'durationDays') return `${v} working day${v === 1 ? '' : 's'}`;
    if (field === 'weeklyHoldingCost') return `${formatMoney(v)}/wk`;
    return String(v);
  }
  if (typeof v === 'string') {
    if (isISODate(v)) return formatDate(v, today);
    if (ISO_INSTANT.test(v)) return formatStamp(v);
    if (field === 'status') {
      const labels: Record<string, string> =
        table === 'item' ? ITEM_STATUS_LABELS : table === 'shipment' ? SHIPMENT_STATUS_LABELS : table === 'step' ? STEP_STATUS_LABELS : STAGE_STATUS_LABELS;
      return labels[v] ?? v;
    }
    if (field === 'type' && table === 'item') return (ITEM_TYPE_LABELS as Record<string, string>)[v] ?? v;
    if (field === 'tradeId') return ds.trades.find((t) => t.id === v)?.name ?? v;
    if (field === 'stepId') return ds.steps.find((s) => s.id === v)?.name ?? v;
    if (field === 'shipmentId') return ds.shipments.find((s) => s.id === v)?.name ?? v;
    if (field === 'categoryId') return ds.photoCategories.find((c) => c.id === v)?.name ?? v;
    return v;
  }
  return JSON.stringify(v);
}

const TABLE_NOUNS: Record<string, string> = {
  item: 'item',
  daily_note: 'daily note',
  photo: 'photo',
  shipment: 'shipment',
  step: 'step',
  stage: 'stage',
  job: 'job',
  trade: 'trade',
  photo_category: 'photo category',
  step_link: 'step link',
  requirement: 'requirement',
};

/** "Park Rd windows", "Book tiler", or the row's own title/name/text. */
export function rowLabel(ds: Dataset, change: Change): string {
  const id = change.rowId;
  const live = (() => {
    switch (change.table) {
      case 'item':
        return ds.items.find((x) => x.id === id)?.title;
      case 'shipment':
        return ds.shipments.find((x) => x.id === id)?.name;
      case 'step':
        return ds.steps.find((x) => x.id === id)?.name;
      case 'stage': {
        const n = ds.stages.find((x) => x.id === id)?.name;
        return n ? (stageDisplayName(n) ?? n) : undefined;
      }
      case 'job':
        return ds.jobs.find((x) => x.id === id)?.name;
      case 'trade':
        return ds.trades.find((x) => x.id === id)?.name;
      case 'photo_category':
        return ds.photoCategories.find((x) => x.id === id)?.name;
      default:
        return undefined;
    }
  })();
  if (live) return live;
  if (change.table === 'photo') {
    const r = (change.kind === 'update' ? ds.photos.find((x) => x.id === id) : change.row) as Record<string, JsonValue> | undefined;
    const cat = r && typeof r.categoryId === 'string' ? ds.photoCategories.find((c) => c.id === r.categoryId)?.name : undefined;
    const job = r && typeof r.jobId === 'string' ? ds.jobs.find((j) => j.id === r.jobId)?.name : undefined;
    if (cat) return `${cat}${job ? ` (${job})` : ''}`;
  }
  if (change.kind !== 'update') {
    const r = change.row as Record<string, JsonValue>;
    const t = r.title ?? r.name ?? r.text ?? r.caption;
    if (typeof t === 'string' && t) return t;
  }
  return id;
}

function clip(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rowKey = (c: Change) => `${c.table}:${c.rowId}`;

/** "Park Rd windows" under the Park Rd header reads "Windows". */
function withoutJob(label: string, jobNames: string[]): string {
  for (const j of jobNames) {
    if (label.toLowerCase().startsWith(`${j.toLowerCase()} `) && label.length > j.length + 1) return cap(label.slice(j.length + 1));
  }
  return label;
}

/**
 * What a card is about, for its bold first line: "Park Rd · Windows ETA", "Seaview St · Book concrete pump",
 * "Beatty St · Last confirmed", "Seaview St · New photo", "Park Rd · 3 changes". Plain words.
 */
export function cardTitle(ds: Dataset, changes: Change[], jobNames: string[]): string {
  const rows = [...new Set(changes.map(rowKey))];
  let subject = '';
  if (rows.length === 1 && changes.length) {
    const c = changes[0]!;
    if (c.kind !== 'update') subject = `${c.kind === 'insert' ? 'New' : 'Remove'} ${TABLE_NOUNS[c.table] ?? c.table}`;
    else {
      const label = c.table === 'job' ? '' : withoutJob(clip(rowLabel(ds, c), 60), jobNames);
      subject = changes.length === 1 ? cap(label ? `${label} ${fieldLabel(c.field)}` : fieldLabel(c.field)) : label || 'Job';
    }
  } else if (rows.length > 1) subject = `${rows.length} changes`;
  return [jobNames.join(', '), subject].filter(Boolean).join(' · ') || 'Change';
}

/** One change in words. `own` = the card is about this one row, so its label is in the title already. */
function changeLine(ds: Dataset, c: Change, today: ISODate, own: { row: boolean; field: boolean }): string {
  if (c.kind === 'update') {
    const arrow = beforeAfter(valueText(ds, c.table, c.field, c.before, today), valueText(ds, c.table, c.field, c.after, today));
    if (own.field) return arrow;
    if (own.row) return `${esc(cap(fieldLabel(c.field)))}: ${arrow}`;
    return `${esc(clip(rowLabel(ds, c)))}, ${esc(fieldLabel(c.field))}: ${arrow}`;
  }
  const noun = TABLE_NOUNS[c.table] ?? c.table;
  return esc(`${c.kind === 'insert' ? 'New' : 'Remove'} ${noun}: ${clip(rowLabel(ds, c))}`);
}

/**
 * The card's changes, every field before → <b>after</b> on its own line. One row and one field:
 * just "Mon 26 Oct → <b>Mon 16 Nov</b>" (the title names it); one row, several fields: "Status: To do →
 * <b>Ordered or booked</b>" per field; several rows: "• Park Rd windows, ETA: ..." bullets. A single new row
 * (a photo, a note) is told by `summary`, core's sentence ("Photo filed: Seaview St, Slab, Plumbing under slab.").
 */
export function changeLines(ds: Dataset, changes: Change[], today: ISODate, summary?: string): string[] {
  const rows = new Set(changes.map(rowKey));
  if (rows.size === 1 && changes.length === 1 && changes[0]!.kind !== 'update' && summary) return [esc(summary.endsWith('.') ? summary : `${summary}.`)];
  const single = rows.size === 1;
  return changes.map((c) => {
    const line = changeLine(ds, c, today, { row: single, field: single && changes.length === 1 });
    return single ? line : bullet(line);
  });
}

/** Days and dollars of slip in words: "+14 days · $9,000 holding cost", "+14 days", "on track". Plain. */
export function slipText(days: number | null, cost: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return 'on track';
  return cost !== null && cost !== 0 ? `${formatDays(days)} · ${formatMoney(Math.abs(cost))} holding cost` : formatDays(days);
}

const MAX_MOVED_STEPS = 4;

/**
 * The forecast impact for one job on a confirm card, as its own block (HTML lines): the moved steps
 * ("• Install windows: Mon 2 Nov → <b>Mon 16 Nov</b>", at most 4), "Finish Fri 26 Feb 2027 → <b>Fri 12 Mar
 * 2027</b>" and "+14 days · $9,000 holding cost since last Monday". `before` (the data before the change) lets a
 * confirm say how long the job had gone unconfirmed; rule 7 is told in words, never as "amber".
 */
export function impactLines(impact: JobImpact, today: ISODate, before?: Dataset): string[] {
  if (impact.kind === 'design') return [];
  const moved = impact.movedSteps;
  const confirmed = impact.amberBefore && !impact.amberAfter ? [esc(confirmedAgainLine(impact.jobId, today, before))] : [];
  if (!moved.length && impact.finishDeltaDays === 0) {
    return [impact.finishAfter ? `No change to the finish (${esc(formatDate(impact.finishAfter, today))})` : 'No change to the forecast', ...confirmed];
  }
  const lines: string[] = [];
  for (const m of moved.slice(0, MAX_MOVED_STEPS)) {
    lines.push(bullet(`${esc(m.name)}: ${beforeAfter(formatDate(m.from, today), formatDate(m.to, today))}`));
  }
  if (moved.length > MAX_MOVED_STEPS) lines.push(bullet(`and ${moved.length - MAX_MOVED_STEPS} more steps move`));
  if (impact.finishAfter) {
    lines.push(
      impact.finishDeltaDays === 0 || !impact.finishBefore
        ? `Finish ${esc(formatDate(impact.finishAfter, today))}, no change`
        : `Finish ${beforeAfter(formatDate(impact.finishBefore, today), formatDate(impact.finishAfter, today))}`,
    );
  }
  const slip = slipText(impact.slipAfter, impact.slipCostAfter);
  if (slip && impact.slipAfter !== 0) lines.push(`${esc(slip)} since last Monday`);
  else if (slip) lines.push('No slip since last Monday');
  return [...lines, ...confirmed];
}

/** "Confirmed again: it hadn't been confirmed for 9 days" (or "Confirmed for the first time"). Plain. */
function confirmedAgainLine(jobId: string, today: ISODate, before?: Dataset): string {
  const job = before?.jobs.find((j) => j.id === jobId);
  if (job && !job.lastConfirmed) return 'Confirmed for the first time';
  const days = job?.lastConfirmed ? calendarDaysBetween(job.lastConfirmed, today) : null;
  return days !== null ? `Confirmed again: it hadn't been confirmed for ${days} days` : 'Confirmed again: it had gone over 7 days unconfirmed';
}

export interface CardInput {
  summary: string;
  /** Voice transcript (Stage 3) shown as "Heard: <i>...</i>". */
  transcript?: string | null;
  changes: Change[];
  impacts: JobImpact[];
  /** Dataset before the change (row labels). */
  ds: Dataset;
  today: ISODate;
  /** Extra lines (plain) before "Save this?", e.g. hold-point photo progress. */
  notes?: string[];
}

/**
 * The confirm card (HTML): a bold title saying what it's about, the transcript, every field before →
 * after, the dry-run forecast impact as its own block per build job, notes, then "Save this?".
 */
export function cardText(c: CardInput): string {
  const jobNames = [...new Set(c.impacts.map((x) => x.jobName))];
  const withLines = c.impacts.map((impact) => ({ impact, lines: impactLines(impact, c.today, c.ds) })).filter((x) => x.lines.length);
  const impactBlocks = withLines.map(({ impact, lines }) => (withLines.length > 1 ? [b(impact.jobName), ...lines] : lines).join('\n'));
  return blocks(
    b(cardTitle(c.ds, c.changes, jobNames)),
    c.transcript ? heardLine(c.transcript) : null,
    changeLines(c.ds, c.changes, c.today, c.summary).join('\n'),
    ...impactBlocks,
    c.notes?.length ? c.notes.map(esc).join('\n') : null,
    'Save this?',
  );
}

/**
 * A card's outcome, edited into it (HTML): "<b>Saved ✓</b>", "<b>Cancelled</b> · nothing saved",
 * "<b>Undone</b>" ... on the first line, then core's summary so the card still says what it was, then any
 * further lines (finish, hold-point progress) as a block.
 */
export function outcomeText(outcome: string, note: string | null, summary: string, more: string[] = []): string {
  const head = `${b(outcome)}${note ? ` · ${esc(note)}` : ''}`;
  return blocks(`${head}\n${esc(summary.endsWith('.') ? summary : `${summary}.`)}`, more.join('\n'));
}

/**
 * "Park Rd finishes <b>Fri 12 Mar 2027</b>: +14 days · $9,000 holding cost since last Monday" or
 * "Park Rd finishes <b>Fri 26 Feb 2027</b>, on track" (HTML), for one forecast.
 */
export function finishSentence(
  jobName: string,
  finish: ISODate | null,
  slipDays: number | null,
  slipCost: number | null,
  today: ISODate,
): string {
  if (!finish) return '';
  const slip = slipText(slipDays, slipCost);
  const head = `${esc(jobName)} finishes ${b(formatDate(finish, today))}`;
  if (!slip) return head;
  return slip === 'on track' ? `${head}, on track` : `${head}: ${esc(slip)} since last Monday`;
}
