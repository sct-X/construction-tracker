/**
 * Row types for every table in SPEC.md "Data model".
 *
 * Conventions (every later stage relies on these):
 *  - A calendar date is an ISO string `YYYY-MM-DD` in Australia/Sydney (type ISODate).
 *  - A moment in time is an ISO 8601 UTC instant from `Date.prototype.toISOString()`
 *    (type Instant), e.g. "2026-09-15T00:12:00.000Z". Format it for people with
 *    the Sydney helpers in dates.ts.
 *  - Every key is always present. "No value" is `null`, never `undefined`, so a
 *    row survives JSON and SQLite unchanged.
 *  - Ids are strings. Field names are camelCase here and snake_case in SQLite.
 *  - Forecast dates (step forecast start/end, item needed-by/act-by) are never
 *    stored: the calculator derives them. Snapshots store them per step.
 */

export type ISODate = string;
export type Instant = string;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JobKind = 'build' | 'design';
export type ApprovalPath = 'DA' | 'CDC';
export type StageStatus = 'not_started' | 'in_progress' | 'done';
export type StepStatus = 'not_started' | 'in_progress' | 'done';
export type RequirementKind = 'trade' | 'material';

export const ITEM_TYPES = [
  'trade', // trade to book
  'material', // material to order
  'decision',
  'consultant_report',
  'council_request',
  'inspection',
  'defect',
  'condition_of_consent',
  'manual_reminder',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** In order: each "move forward" goes one step right. */
export const ITEM_STATUSES = ['to_do', 'ordered_or_booked', 'confirmed', 'done'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const SHIPMENT_STATUSES = ['design', 'in_production', 'shipped', 'delivered'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const STEP_STATUSES = ['not_started', 'in_progress', 'done'] as const;
export const STAGE_STATUSES = ['not_started', 'in_progress', 'done'] as const;

export type InboundChannel = 'telegram' | 'email' | 'web';
export type ChangeSetStatus = 'proposed' | 'confirmed' | 'cancelled' | 'undone';

export interface Side {
  id: string;
  name: string;
}

/** Dominic. One row; the Telegram user id comes from .env at runtime. */
export interface User {
  id: string;
  name: string;
  telegramUserId: string | null;
}

export interface Job {
  id: string;
  sideId: string;
  name: string;
  kind: JobKind;
  path: ApprovalPath | null;
  /** Dollars per week. Null on templates and design jobs. */
  weeklyHoldingCost: number | null;
  lastConfirmed: ISODate | null;
  isTemplate: boolean;
  plannedFinish: ISODate | null;
  startDate: ISODate | null;
  /** A live job copied from a template starts from this stage; earlier stages are done. */
  startsFromStageId: string | null;
  templateId: string | null;
  createdAt: ISODate;
}

export interface Stage {
  id: string;
  jobId: string;
  name: string;
  order: number;
  /** Set by hand on design jobs; derived from steps on build jobs (calculator). */
  status: StageStatus;
}

export interface Step {
  id: string;
  jobId: string;
  stageId: string;
  name: string;
  order: number;
  /** Working days, the start day counting as the first. Minimum 1. */
  durationDays: number;
  /** Templates carry no dates. Planned dates never change once set (rule 3) except in Setup. */
  plannedStart: ISODate | null;
  plannedEnd: ISODate | null;
  /** Recorded when the step is marked started / done. */
  actualStart: ISODate | null;
  actualEnd: ISODate | null;
  status: StepStatus;
  isHoldPoint: boolean;
  /** The one step per stage on stage-level jobs ("Frame, whole stage"). */
  isPlaceholder: boolean;
  tradeType: string | null;
}

/** "This step waits for that step." */
export interface StepLink {
  id: string;
  jobId: string;
  stepId: string;
  waitsForStepId: string;
}

/** What a step needs: a trade to book or a material to order, with its lead time. */
export interface Requirement {
  id: string;
  jobId: string;
  stepId: string;
  kind: RequirementKind;
  name: string;
  /** Calendar weeks. */
  leadTimeWeeks: number;
  tradeType: string | null;
}

export interface Item {
  id: string;
  jobId: string;
  type: ItemType;
  title: string;
  /** Who or what we are waiting on, as plain text ("Harbour Tiling", "Council"). */
  waitingOn: string | null;
  /** Who chases it, as plain text ("Raff", "Dominic"). */
  owner: string | null;
  tradeId: string | null;
  /** Typed needed-by, used only when the item has no step (rule 1 computes it otherwise). */
  neededBy: ISODate | null;
  /** Calendar weeks. Null falls back to the requirement's lead time, then 0. */
  leadTimeWeeks: number | null;
  /** Ignored when the item is on a shipment: the shipment ETA is used. */
  expectedDate: ISODate | null;
  status: ItemStatus;
  confirmedDate: ISODate | null;
  notes: string | null;
  stepId: string | null;
  requirementId: string | null;
  shipmentId: string | null;
  photoId: string | null;
  createdAt: ISODate;
  doneAt: ISODate | null;
}

export interface Trade {
  id: string;
  sideId: string;
  name: string;
  /** "Plumber", "Tiler". */
  type: string;
  phone: string | null;
}

export interface Shipment {
  id: string;
  jobId: string;
  name: string;
  supplier: string | null;
  status: ShipmentStatus;
  eta: ISODate | null;
  notes: string | null;
}

export interface PhotoCategory {
  id: string;
  jobId: string;
  /** Null for the job-wide "General" category. */
  stageId: string | null;
  name: string;
  requiredForHoldPoint: boolean;
  order: number;
}

export interface Photo {
  id: string;
  jobId: string;
  stageId: string | null;
  categoryId: string;
  /** Relative to the photos folder, with forward slashes ("park-rd/2026-09-16-abc.jpg"). */
  filePath: string;
  caption: string | null;
  takenOn: ISODate;
  receivedAt: Instant;
  /** Seed stand-ins: no file on disk; the web draws a flat placeholder. */
  isPlaceholder: boolean;
  messageId: string | null;
}

export interface DailyNote {
  id: string;
  jobId: string;
  date: ISODate;
  text: string;
  createdAt: Instant;
  messageId: string | null;
}

/** Saved each Monday. Per-step starts/ends let "why it moved" compare against it. */
export interface ForecastSnapshot {
  id: string;
  jobId: string;
  /** The Monday it was saved for. */
  date: ISODate;
  savedAt: Instant;
  forecastFinish: ISODate | null;
  stepStarts: Record<string, ISODate>;
  stepEnds: Record<string, ISODate>;
}

export interface InboundMessage {
  id: string;
  channel: InboundChannel;
  /** Telegram user id (or email address later). */
  sender: string;
  rawText: string | null;
  /** Relative to DATA_DIR. */
  audioPath: string | null;
  transcript: string | null;
  /** Relative to the photos folder, when the message carried a photo. */
  photoPath: string | null;
  receivedAt: Instant;
}

export interface ChangeSet {
  id: string;
  messageId: string | null;
  status: ChangeSetStatus;
  summary: string;
  /** The operation that produced it, and its validated args, for the audit trail. */
  opName: string | null;
  opArgs: JsonValue;
  createdAt: Instant;
  confirmedAt: Instant | null;
  cancelledAt: Instant | null;
  undoneAt: Instant | null;
}

export type ChangeKind = 'update' | 'insert' | 'delete';

/**
 * One stored change. update: field + before/after values. insert: field null,
 * before null, after = the whole row. delete: field null, before = the whole
 * row, after null.
 */
export interface ChangeRecord {
  id: string;
  changeSetId: string;
  seq: number;
  kind: ChangeKind;
  table: TableName;
  rowId: string;
  field: string | null;
  before: JsonValue;
  after: JsonValue;
}

/** Tables that operations may change (the log tables are written by the Store only). */
export type TableName =
  | 'side'
  | 'user'
  | 'job'
  | 'stage'
  | 'step'
  | 'step_link'
  | 'requirement'
  | 'item'
  | 'trade'
  | 'shipment'
  | 'photo_category'
  | 'photo'
  | 'daily_note';

export interface Dataset {
  sides: Side[];
  users: User[];
  jobs: Job[];
  stages: Stage[];
  steps: Step[];
  stepLinks: StepLink[];
  requirements: Requirement[];
  items: Item[];
  trades: Trade[];
  shipments: Shipment[];
  photoCategories: PhotoCategory[];
  photos: Photo[];
  dailyNotes: DailyNote[];
  snapshots: ForecastSnapshot[];
  inboundMessages: InboundMessage[];
  changeSets: ChangeSet[];
  changes: ChangeRecord[];
}

export interface RowByTable {
  side: Side;
  user: User;
  job: Job;
  stage: Stage;
  step: Step;
  step_link: StepLink;
  requirement: Requirement;
  item: Item;
  trade: Trade;
  shipment: Shipment;
  photo_category: PhotoCategory;
  photo: Photo;
  daily_note: DailyNote;
}

/** Dataset key for each changeable table. */
export const TABLE_KEYS = {
  side: 'sides',
  user: 'users',
  job: 'jobs',
  stage: 'stages',
  step: 'steps',
  step_link: 'stepLinks',
  requirement: 'requirements',
  item: 'items',
  trade: 'trades',
  shipment: 'shipments',
  photo_category: 'photoCategories',
  photo: 'photos',
  daily_note: 'dailyNotes',
} as const satisfies Record<TableName, keyof Dataset>;

export const TABLE_NAMES = Object.keys(TABLE_KEYS) as TableName[];

export function emptyDataset(): Dataset {
  return {
    sides: [],
    users: [],
    jobs: [],
    stages: [],
    steps: [],
    stepLinks: [],
    requirements: [],
    items: [],
    trades: [],
    shipments: [],
    photoCategories: [],
    photos: [],
    dailyNotes: [],
    snapshots: [],
    inboundMessages: [],
    changeSets: [],
    changes: [],
  };
}

/** Deep copy. Rows are JSON-shaped by contract, so this is exact. */
export function cloneDataset(ds: Dataset): Dataset {
  return JSON.parse(JSON.stringify(ds)) as Dataset;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  trade: 'Trade to book',
  material: 'Material to order',
  decision: 'Decision',
  consultant_report: 'Consultant report',
  council_request: 'Council request',
  inspection: 'Inspection',
  defect: 'Defect',
  condition_of_consent: 'Condition of consent',
  manual_reminder: 'Reminder',
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  to_do: 'To do',
  ordered_or_booked: 'Ordered or booked',
  confirmed: 'Confirmed',
  done: 'Done',
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  design: 'Design',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  not_started: 'Not started',
  in_progress: 'Started',
  done: 'Done',
};
