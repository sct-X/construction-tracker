/**
 * The single API every screen reads and writes through. The prototype
 * implementation (mockApi.ts) holds seed data in the browser; the real server
 * swaps in behind this same interface later.
 *
 * Contract notes (see docs/CONTRACTS.md):
 *  - Reads are synchronous over the local copy of the data. A server-backed
 *    implementation keeps that copy warm and calls subscribers when it changes,
 *    which is exactly the "show the saved copy, refresh quietly" behaviour.
 *  - Every read is scoped to the current session's side and role. The site
 *    role gets every MONEY_FIELD deleted, recursively, and build jobs only.
 *  - Reads return copies. Mutating a returned object changes nothing.
 *  - Every mutation writes an activity entry and notifies subscribers.
 *  - Photo queue methods are async: they live in IndexedDB.
 */
import type {
  ActivityEntry,
  DailyNote,
  ForecastSnapshot,
  Item,
  ItemStatus,
  Job,
  JobKind,
  ApprovalPath,
  Membership,
  Notification,
  Person,
  Photo,
  PhotoCategory,
  Requirement,
  Role,
  Shipment,
  ShipmentStatus,
  Side,
  Stage,
  Step,
  StepLink,
  StepStatus,
  Trade,
  Weather,
} from '../domain/types';
import type { EtaPreview, Freshness, HoldPointCheck, JobForecast, WaitingOnRow } from '../domain/forecast';
import type { Session } from './session';
import type { QueuedPhoto } from './photoQueue';

export type { Session } from './session';
export type { QueuedPhoto } from './photoQueue';

// ---------------------------------------------------------------------------
// Row and result shapes
// ---------------------------------------------------------------------------

export interface MondayRow {
  jobId: string;
  name: string;
  kind: JobKind;
  forecastFinish?: string;
  plannedFinish?: string;
  /** Undefined before the first Monday snapshot. */
  slipDays?: number;
  /** Money. */
  slipCost?: number;
  slipSincePlanDays?: number;
  /** Money. */
  slipSincePlanCost?: number;
  /** Money. */
  weeklyHoldingCost?: number;
  freshness: Freshness;
  currentStageName?: string;
  /** Top three: late first, then soonest act-by within 14 days. */
  waitingOn: WaitingOnRow[];
  nextHoldPoint?: HoldPointCheck;
  /** Design jobs. */
  outstanding?: number;
  oldestDays?: number | null;
  oldestItemTitle?: string;
  oldestItemWaitingOn?: string;
}

export type StepStatusResult =
  | { ok: true; step: Step }
  /**
   * Refused. `reason` says why: a hold point with empty required photo
   * categories (rule 6; `missingCategories` names them) or a step whose
   * forecast start is after today (`startsOn`). Show `message` as is.
   */
  | { ok: false; reason: 'hold_point' | 'not_started'; missingCategories: string[]; startsOn?: string; message: string };

export interface ItemFilter {
  jobId?: string;
  stepId?: string;
  ownerId?: string;
  status?: ItemStatus | ItemStatus[];
  type?: Item['type'] | Item['type'][];
  shipmentId?: string;
  tradeId?: string;
  /** Default false: done items are hidden unless asked for. */
  includeDone?: boolean;
}

export interface PhotoFilter {
  stageId?: string | null;
  categoryId?: string;
  uploadedById?: string;
  takenOn?: string;
}

export interface ActivityFilter {
  jobId?: string;
  personId?: string;
  itemId?: string;
  shipmentId?: string;
  stepId?: string;
  limit?: number;
}

export interface NotificationFilter {
  /** Defaults to the current person. */
  personId?: string;
  unreadOnly?: boolean;
}

export interface JobListOptions {
  includeTemplates?: boolean;
  kind?: JobKind;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface NewItemInput {
  jobId: string;
  type: Item['type'];
  title: string;
  waitingOn?: string;
  tradeId?: string;
  ownerId?: string;
  stepId?: string;
  requirementId?: string;
  shipmentId?: string;
  neededBy?: string;
  leadTimeWeeks?: number;
  expectedDate?: string;
  status?: ItemStatus;
  notes?: string;
  photoId?: string;
}

export type ItemPatch = Partial<Omit<Item, 'id' | 'sideId' | 'createdAt'>>;

export interface NewShipmentInput {
  jobId: string;
  name: string;
  supplier?: string;
  status?: ShipmentStatus;
  eta: string;
  notes?: string;
}

export interface NewPhotoInput {
  jobId: string;
  stageId: string | null;
  categoryId: string;
  dataUrl: string;
  takenOn?: string;
  caption?: string;
  /** Defaults to the current person. */
  uploadedById?: string;
}

export interface NewJobInput {
  name: string;
  kind: JobKind;
  path?: ApprovalPath;
  address?: string;
  sideId?: string;
  weeklyHoldingCost?: number;
  startDate?: string;
  plannedFinish?: string;
}

export interface CopyTemplateInput {
  name: string;
  address?: string;
  sideId?: string;
  path?: ApprovalPath;
  startDate: string;
  weeklyHoldingCost?: number;
  /** Stages before this one are marked done; planned dates run forward from the start date. */
  startsFromStageId?: string;
}

export type JobPatch = Partial<Omit<Job, 'id' | 'sideId' | 'createdAt' | 'isTemplate'>>;

/** The end of a call-list call: who was rung and, per job worked through, how many items changed. */
export interface FinishCallInput {
  /** The person rung (the call list's owner filter, Raff by default). */
  personId: string;
  /** Every job ticked "Confirmed today" at the end of the call, with the count of items changed during it. */
  jobs: { jobId: string; itemsUpdated: number }[];
}

export interface FinishCallResult {
  jobs: Job[];
  /** One entry per job: "Dominic rang Raff: 3 items updated on Park Rd". */
  activity: ActivityEntry[];
}

export interface NewStageInput {
  jobId: string;
  name: string;
  /** Insert position (1-based). Appends by default. */
  order?: number;
}

export interface NewStepInput {
  jobId: string;
  stageId: string;
  name: string;
  durationDays: number;
  plannedStart?: string;
  isHoldPoint?: boolean;
  tradeType?: string;
  waitsForStepIds?: string[];
  order?: number;
}

export type StepPatch = Partial<Pick<Step, 'name' | 'durationDays' | 'plannedStart' | 'isHoldPoint' | 'tradeType' | 'stageId' | 'order'>>;

export interface NewRequirementInput {
  stepId: string;
  kind: Requirement['kind'];
  name: string;
  leadTimeWeeks: number;
  tradeType?: string;
}

export interface NewPhotoCategoryInput {
  jobId: string;
  stageId: string | null;
  name: string;
  requiredForHoldPoint?: boolean;
}

export type TradeInput = Omit<Trade, 'id' | 'sideId'>;
export type PersonInput = Omit<Person, 'id'>;

export interface DailyNoteInput {
  jobId: string;
  text: string;
  /** Defaults to the session's today. */
  date?: string;
  weather?: Weather;
  onSite?: string[];
  photoIds?: string[];
  /** Saved without signal: the note carries the flag until `flushDailyNotes` clears it. */
  queued?: boolean;
}

export type DailyNotePatch = Partial<Pick<DailyNote, 'text' | 'weather' | 'onSite' | 'photoIds' | 'queued'>>;

/** Rule 6 readiness for one hold-point step, for the step sheet and for notifications ("1 of 3 sets uploaded"). */
export interface HoldPointReadiness {
  stepId: string;
  stepName: string;
  jobId: string;
  jobName: string;
  stageId: string;
  forecastStart: string;
  /** Required categories with at least one uploaded photo. */
  filled: number;
  total: number;
  /** "1 of 3 required photo sets uploaded". */
  words: string;
  missingCategories: string[];
  ok: boolean;
  check: HoldPointCheck;
}

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

export type Listener = () => void;

export interface TrackerApi {
  // ---- session and access ----
  getSession(): Session;
  setSession(patch: Partial<Session>): void;
  /** The current person, their role on the current side, and the sides they belong to. */
  whoami(): { person: Person; role: Role; side: Side; sides: Side[] };
  /** Screens a role can open. Routes not listed show "You don't have access to this". */
  canSee(screen: ScreenKey): boolean;

  // ---- people and sides ----
  listSides(): Side[];
  listPeople(): Person[];
  getPerson(id: string): Person | undefined;
  listMemberships(): Membership[];
  addPerson(input: PersonInput): Person;
  updatePerson(id: string, patch: Partial<PersonInput>): Person;
  removePerson(id: string): void;
  /** role = null removes the membership. */
  setMembership(personId: string, sideId: string, role: Role | null): void;

  // ---- jobs and programs ----
  listJobs(opts?: JobListOptions): Job[];
  listTemplates(): Job[];
  getJob(id: string): Job | undefined;
  addJob(input: NewJobInput): Job;
  updateJob(id: string, patch: JobPatch): Job;
  copyTemplate(templateId: string, input: CopyTemplateInput): Job;
  confirmJob(jobId: string, date?: string): Job;
  /**
   * Finish call (UI_PLAN 3.11): stamps every listed job's last confirmed date
   * with today (rule 7's clock resets) and logs one `job_confirmed` entry per
   * job in the call's words. Notifies once.
   */
  finishCall(input: FinishCallInput): FinishCallResult;
  listStages(jobId: string): Stage[];
  addStage(input: NewStageInput): Stage;
  updateStage(id: string, patch: Partial<Pick<Stage, 'name' | 'status' | 'order'>>): Stage;
  deleteStage(id: string): void;
  reorderStages(jobId: string, orderedIds: string[]): void;
  listSteps(jobId: string): Step[];
  getStep(id: string): Step | undefined;
  addStep(input: NewStepInput): Step;
  updateStep(id: string, patch: StepPatch): Step;
  deleteStep(id: string): void;
  reorderSteps(stageId: string, orderedIds: string[]): void;
  /** Hold points are checked against uploaded photos (rule 6) and refuse with the empty categories named. */
  setStepStatus(stepId: string, status: StepStatus): StepStatusResult;
  listStepLinks(jobId: string): StepLink[];
  addStepLink(stepId: string, waitsForStepId: string): StepLink;
  removeStepLink(id: string): void;
  listRequirements(jobId: string): Requirement[];
  addRequirement(input: NewRequirementInput): Requirement;
  updateRequirement(id: string, patch: Partial<NewRequirementInput>): Requirement;
  removeRequirement(id: string): void;

  // ---- items ----
  listItems(filter?: ItemFilter): Item[];
  getItem(id: string): Item | undefined;
  addItem(input: NewItemInput): Item;
  updateItem(id: string, patch: ItemPatch): Item;
  deleteItem(id: string): void;
  updateItemStatus(id: string, status: ItemStatus, confirmedDate?: string): Item;
  /** to do -> ordered or booked -> confirmed -> done. */
  advanceItemStatus(id: string): Item;
  setItemExpectedDate(id: string, expectedDate: string | undefined): Item;

  // ---- trades ----
  listTrades(): Trade[];
  getTrade(id: string): Trade | undefined;
  addTrade(input: TradeInput): Trade;
  updateTrade(id: string, patch: Partial<TradeInput>): Trade;
  deleteTrade(id: string): void;

  // ---- shipments ----
  listShipments(jobId?: string): Shipment[];
  getShipment(id: string): Shipment | undefined;
  addShipment(input: NewShipmentInput): Shipment;
  updateShipment(id: string, patch: Partial<Omit<Shipment, 'id' | 'sideId' | 'jobId' | 'eta' | 'status'>>): Shipment;
  setShipmentEta(id: string, eta: string): Shipment;
  setShipmentStatus(id: string, status: ShipmentStatus): Shipment;
  linkItemToShipment(itemId: string, shipmentId: string | null): Item;
  /** The impact panel: what a new ETA would do, before it is saved. */
  previewEtaChange(shipmentId: string, newEta: string): EtaPreview;

  // ---- photos ----
  listPhotoCategories(jobId: string, stageId?: string | null): PhotoCategory[];
  addPhotoCategory(input: NewPhotoCategoryInput): PhotoCategory;
  updatePhotoCategory(id: string, patch: Partial<Pick<PhotoCategory, 'name' | 'requiredForHoldPoint' | 'order'>>): PhotoCategory;
  deletePhotoCategory(id: string): void;
  listPhotos(jobId: string, filter?: PhotoFilter): Photo[];
  getPhoto(id: string): Photo | undefined;
  /** Uploads straight to the photo table (counts for hold points). */
  addPhoto(input: NewPhotoInput): Photo;
  movePhoto(id: string, categoryId: string): Photo;
  deletePhoto(id: string): void;
  /** Saves to the phone's queue (IndexedDB). Sent by flushPhotoQueue when there is signal. */
  queuePhoto(input: NewPhotoInput): Promise<QueuedPhoto>;
  listQueuedPhotos(): Promise<QueuedPhoto[]>;
  removeQueuedPhoto(id: string): Promise<void>;
  /** Moves queued photos to the photo table, one at a time, only while not offline. Returns how many were sent. */
  flushPhotoQueue(): Promise<number>;

  // ---- daily notes ----
  listDailyNotes(jobId: string): DailyNote[];
  addDailyNote(input: DailyNoteInput): DailyNote;
  /** A bare string patches the text (Stage 0 shape); a patch sets any of text, weather, onSite, photoIds, queued. */
  updateDailyNote(id: string, patch: string | DailyNotePatch): DailyNote;
  /** Clears the queued flag on every note while there is signal. Returns how many sent. */
  flushDailyNotes(): number;

  // ---- forecast ----
  getForecast(jobId: string): JobForecast | undefined;
  listForecasts(): JobForecast[];
  /** Rule 6 readiness for a hold-point step (undefined for other steps). */
  holdPointReadiness(stepId: string): HoldPointReadiness | undefined;
  getMondayRows(): MondayRow[];
  listSnapshots(jobId: string): ForecastSnapshot[];
  /** Saves a snapshot for every build job for the Monday of the given date (default: last Monday of today). */
  saveMondaySnapshot(date?: string): ForecastSnapshot[];

  // ---- activity and notifications ----
  listActivity(filter?: ActivityFilter): ActivityEntry[];
  listNotifications(filter?: NotificationFilter): Notification[];
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  /** The dev bar's stand-in for the server's scheduler. Returns what it raised. */
  fireRemindersDueToday(): Notification[];
  sendTestBuzz(): Notification;

  // ---- plumbing ----
  subscribe(listener: Listener): () => void;
  /** Wipes local data and reseeds. Keeps the session. */
  reset(): void;
}

/** Screen keys used by navigation and `canSee`. Routes are in src/screens/README.md. */
export type ScreenKey =
  | 'monday'
  | 'jobs'
  | 'job'
  | 'program'
  | 'step'
  | 'checklist'
  | 'waiting'
  | 'deliveries'
  | 'item'
  | 'calls'
  | 'shipments'
  | 'shipment'
  | 'photos'
  | 'upload'
  | 'queue'
  | 'notes'
  | 'notifications'
  | 'activity'
  | 'settings'
  | 'editor'
  | 'templates'
  | 'trades'
  | 'people';

export const SCREEN_ACCESS: Record<ScreenKey, Role[]> = {
  monday: ['admin', 'partner', 'builder'],
  jobs: ['admin', 'partner', 'builder', 'site'],
  job: ['admin', 'partner', 'builder', 'site'],
  program: ['admin', 'partner', 'builder', 'site'],
  step: ['admin', 'partner', 'builder', 'site'],
  checklist: ['admin', 'partner', 'builder'],
  waiting: ['admin', 'partner', 'builder'],
  deliveries: ['site'],
  item: ['admin', 'partner', 'builder'],
  calls: ['admin', 'partner'],
  shipments: ['admin', 'partner', 'builder'],
  shipment: ['admin', 'partner', 'builder'],
  photos: ['admin', 'partner', 'builder', 'site'],
  upload: ['admin', 'partner', 'builder', 'site'],
  queue: ['admin', 'partner', 'builder', 'site'],
  notes: ['admin', 'partner', 'builder', 'site'],
  notifications: ['admin', 'partner', 'builder', 'site'],
  activity: ['admin', 'partner', 'builder'],
  settings: ['admin', 'partner', 'builder', 'site'],
  editor: ['admin', 'partner'],
  templates: ['admin', 'partner'],
  trades: ['admin', 'partner', 'builder'],
  people: ['admin'],
};
