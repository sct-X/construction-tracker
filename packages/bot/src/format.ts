/**
 * Telegram wording: short, plain English, dates as "Mon 16 Nov". Everything
 * here is pure (data in, text out) so cards can be tested without a bot.
 * Replies are sent as plain text (no parse mode), so nothing needs escaping.
 */
import {
  formatDate,
  formatDays,
  formatMoney,
  formatStamp,
  isISODate,
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
  STAGE_STATUSES,
  STEP_STATUS_LABELS,
  type Change,
  type Dataset,
  type ISODate,
  type JobImpact,
  type JsonValue,
} from '@ct/core';

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
      case 'stage':
        return ds.stages.find((x) => x.id === id)?.name;
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

/** One line per change: "Park Rd windows, ETA: Mon 26 Oct → Mon 16 Nov". */
export function changeLines(ds: Dataset, changes: Change[], today: ISODate): string[] {
  return changes.map((c) => {
    const label = clip(rowLabel(ds, c));
    if (c.kind === 'update') {
      const before = valueText(ds, c.table, c.field, c.before, today);
      const after = valueText(ds, c.table, c.field, c.after, today);
      return `${label}, ${fieldLabel(c.field)}: ${before} → ${after}`;
    }
    const noun = TABLE_NOUNS[c.table] ?? c.table;
    return c.kind === 'insert' ? `New ${noun}: ${label}` : `Remove ${noun}: ${label}`;
  });
}

/** Days and dollars of slip in words: "+14 days, $9,000", "on track". */
export function slipText(days: number | null, cost: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return 'on track';
  return cost !== null && cost !== 0 ? `${formatDays(days)}, ${formatMoney(Math.abs(cost))}` : formatDays(days);
}

const MAX_MOVED_STEPS = 4;

/** The forecast impact lines for one job on a confirm card. */
export function impactLines(impact: JobImpact, today: ISODate): string[] {
  if (impact.kind === 'design') return [];
  const moved = impact.movedSteps;
  if (!moved.length && impact.finishDeltaDays === 0) {
    return [`No change to the forecast${impact.finishAfter ? ` (finish ${formatDate(impact.finishAfter, today)})` : ''}`];
  }
  const lines: string[] = [];
  for (const m of moved.slice(0, MAX_MOVED_STEPS)) {
    lines.push(`${m.name} starts ${formatDate(m.to, today)} (was ${formatDate(m.from, today)})`);
  }
  if (moved.length > MAX_MOVED_STEPS) lines.push(`and ${moved.length - MAX_MOVED_STEPS} more steps move`);
  if (impact.finishAfter) {
    lines.push(
      impact.finishDeltaDays === 0 || !impact.finishBefore
        ? `Finish ${formatDate(impact.finishAfter, today)}, no change`
        : `Finish ${formatDate(impact.finishAfter, today)} (was ${formatDate(impact.finishBefore, today)})`,
    );
  }
  const slip = slipText(impact.slipAfter, impact.slipCostAfter);
  if (slip && impact.slipAfter !== 0) lines.push(`Slip ${slip} since last Monday`);
  else if (slip) lines.push('Slip: none since last Monday');
  if (impact.amberBefore && !impact.amberAfter) lines.push('No longer amber');
  return lines;
}

export interface CardInput {
  summary: string;
  /** Voice transcript (Stage 3) shown as "Heard: ...". */
  transcript?: string | null;
  changes: Change[];
  impacts: JobImpact[];
  /** Dataset before the change (row labels). */
  ds: Dataset;
  today: ISODate;
}

/** The confirm card: what was understood, every field before → after, the dry-run forecast impact. */
export function cardText(c: CardInput): string {
  const parts: string[] = [];
  if (c.transcript) parts.push(`Heard: "${clip(c.transcript, 300)}"`);
  parts.push(`${c.summary}.`);
  parts.push(changeLines(c.ds, c.changes, c.today).map((l) => `- ${l}`).join('\n'));
  for (const impact of c.impacts) {
    const lines = impactLines(impact, c.today);
    if (lines.length) parts.push(`${impact.jobName}:\n${lines.map((l) => `- ${l}`).join('\n')}`);
  }
  parts.push('Save this?');
  return parts.join('\n\n');
}

/** "Park Rd finishes Fri 12 Mar 2027 (+14 days, $9,000)." for one forecast. */
export function finishSentence(
  jobName: string,
  finish: ISODate | null,
  slipDays: number | null,
  slipCost: number | null,
  today: ISODate,
): string {
  if (!finish) return '';
  const slip = slipText(slipDays, slipCost);
  return `${jobName} finishes ${formatDate(finish, today)}${slip ? `, ${slip === 'on track' ? 'on track' : `${slip} since last Monday`}` : ''}.`;
}
