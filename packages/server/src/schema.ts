/**
 * How each Dataset table maps to SQLite: table name, columns, and value
 * conversion. Must agree with migrations/*.sql (a test checks it).
 */
import type { Dataset, TableName } from '@ct/core';

export type ColType = 'text' | 'num' | 'bool' | 'json';

export interface ColumnSpec {
  field: string;
  column: string;
  type: ColType;
}

export interface TableSpec {
  /** SQL table name. */
  sql: string;
  /** Dataset key. */
  key: keyof Dataset;
  columns: ColumnSpec[];
}

function snake(field: string): string {
  if (field === 'order') return 'sort_order';
  if (field === 'table') return 'table_name';
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function cols(spec: Record<string, ColType>, rename: Record<string, string> = {}): ColumnSpec[] {
  return Object.entries(spec).map(([field, type]) => ({ field, column: rename[field] ?? snake(field), type }));
}

const t = 'text' as const;
const n = 'num' as const;
const b = 'bool' as const;
const j = 'json' as const;

/** Changeable tables (operations write them through change sets). */
export const TABLES: Record<TableName, TableSpec> = {
  side: { sql: 'side', key: 'sides', columns: cols({ id: t, name: t }) },
  user: { sql: 'user', key: 'users', columns: cols({ id: t, name: t, telegramUserId: t }) },
  job: {
    sql: 'job',
    key: 'jobs',
    columns: cols({
      id: t, sideId: t, name: t, kind: t, path: t, weeklyHoldingCost: n, lastConfirmed: t, isTemplate: b,
      plannedFinish: t, startDate: t, startsFromStageId: t, templateId: t, createdAt: t,
    }),
  },
  stage: { sql: 'stage', key: 'stages', columns: cols({ id: t, jobId: t, name: t, order: n, status: t }) },
  step: {
    sql: 'step',
    key: 'steps',
    columns: cols({
      id: t, jobId: t, stageId: t, name: t, order: n, durationDays: n, plannedStart: t, plannedEnd: t,
      actualStart: t, actualEnd: t, status: t, isHoldPoint: b, isPlaceholder: b, tradeType: t,
    }),
  },
  step_link: { sql: 'step_link', key: 'stepLinks', columns: cols({ id: t, jobId: t, stepId: t, waitsForStepId: t }) },
  requirement: {
    sql: 'requirement',
    key: 'requirements',
    columns: cols({ id: t, jobId: t, stepId: t, kind: t, name: t, leadTimeWeeks: n, tradeType: t }),
  },
  item: {
    sql: 'item',
    key: 'items',
    columns: cols({
      id: t, jobId: t, type: t, title: t, waitingOn: t, owner: t, tradeId: t, neededBy: t, leadTimeWeeks: n,
      expectedDate: t, status: t, confirmedDate: t, notes: t, stepId: t, requirementId: t, shipmentId: t,
      photoId: t, createdAt: t, doneAt: t,
    }),
  },
  trade: { sql: 'trade', key: 'trades', columns: cols({ id: t, sideId: t, name: t, type: t, phone: t }) },
  shipment: {
    sql: 'shipment',
    key: 'shipments',
    columns: cols({ id: t, jobId: t, name: t, supplier: t, status: t, eta: t, notes: t }),
  },
  photo_category: {
    sql: 'photo_category',
    key: 'photoCategories',
    columns: cols({ id: t, jobId: t, stageId: t, name: t, requiredForHoldPoint: b, order: n }),
  },
  photo: {
    sql: 'photo',
    key: 'photos',
    columns: cols({
      id: t, jobId: t, stageId: t, categoryId: t, filePath: t, caption: t, takenOn: t, receivedAt: t,
      isPlaceholder: b, messageId: t,
    }),
  },
  daily_note: {
    sql: 'daily_note',
    key: 'dailyNotes',
    columns: cols({ id: t, jobId: t, date: t, text: t, createdAt: t, messageId: t }),
  },
};

/** Log tables, written by the Store only. */
export const LOG_TABLES = {
  snapshot: {
    sql: 'forecast_snapshot',
    key: 'snapshots',
    columns: cols({ id: t, jobId: t, date: t, savedAt: t, forecastFinish: t, stepStarts: j, stepEnds: j }),
  },
  inbound: {
    sql: 'inbound_message',
    key: 'inboundMessages',
    columns: cols({ id: t, channel: t, sender: t, rawText: t, audioPath: t, transcript: t, photoPath: t, receivedAt: t }),
  },
  changeSet: {
    sql: 'change_set',
    key: 'changeSets',
    columns: cols({
      id: t, messageId: t, status: t, summary: t, opName: t, opArgs: j, createdAt: t, confirmedAt: t,
      cancelledAt: t, undoneAt: t,
    }),
  },
  change: {
    sql: 'change',
    key: 'changes',
    columns: cols(
      { id: t, changeSetId: t, seq: n, kind: t, table: t, rowId: t, field: t, before: j, after: j },
      { before: 'before_json', after: 'after_json' },
    ),
  },
} satisfies Record<string, TableSpec>;

/**
 * Insert order that satisfies foreign keys even without deferral
 * (inbound messages before photos and notes, photos before items).
 */
export const LOAD_ORDER: TableSpec[] = [
  TABLES.side,
  TABLES.user,
  LOG_TABLES.inbound,
  TABLES.job,
  TABLES.stage,
  TABLES.step,
  TABLES.step_link,
  TABLES.requirement,
  TABLES.trade,
  TABLES.shipment,
  TABLES.photo_category,
  TABLES.photo,
  TABLES.item,
  TABLES.daily_note,
  LOG_TABLES.snapshot,
  LOG_TABLES.changeSet,
  LOG_TABLES.change,
];

export function quote(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

export function toSql(value: unknown, type: ColType): string | number | null {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'bool':
      return value ? 1 : 0;
    case 'json':
      return JSON.stringify(value);
    case 'num':
      return Number(value);
    default:
      return String(value);
  }
}

export function fromSql(value: unknown, type: ColType): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'bool':
      return value === 1 || value === true || value === '1';
    case 'json':
      return JSON.parse(String(value));
    case 'num':
      return Number(value);
    default:
      return String(value);
  }
}

export function rowFromSql(spec: TableSpec, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of spec.columns) out[c.field] = fromSql(raw[c.column], c.type);
  return out;
}

export function columnOf(spec: TableSpec, field: string): ColumnSpec {
  const c = spec.columns.find((x) => x.field === field);
  if (!c) throw new Error(`${spec.sql} has no field ${field}`);
  return c;
}
