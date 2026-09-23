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
  PushSubscriptionRecord,
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

export interface SignInOption {
  person: Person;
  roles: { side: Side; role: Role }[];
}

export interface NextStep {
  stepId: string;
  name: string;
  stageName: string;
  /** The date the step is expected to start; undefined when the program has no dates. */
  start?: string;
  status: StepStatus;
  isHoldPoint: boolean;
}

/** One job on the overview: where it is, what comes next, what it waits on, how fresh that is. */
export interface OverviewRow {
  jobId: string;
  name: string;
  kind: JobKind;
  path?: ApprovalPath;
  freshness: Freshness;
  currentStageName?: string;
  /** Builds: the next few steps not yet done, in date order, the running one first. */
  nextSteps: NextStep[];
  /** Top three: late first, then soonest act-by within 14 days. */
  waitingOn: WaitingOnRow[];
  nextHoldPoint?: HoldPointCheck;
  /** Open items past their date (forecast isOverdue); drives the red cue on the card. */
  overdue: number;
  /** Design jobs. */
  nextStageName?: string;
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
  /** A template (rule 8): no dates, hidden from the jobs list. Design templates still get the checklist stages. */
  isTemplate?: boolean;
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

/** What `copyTemplate` would make, before it is made: the new job screen shows the planned finish under the form. */
export interface TemplatePreview {
  templateId: string;
  /** The template's durations run forward over working days from the start date (undefined for a design template). */
  plannedFinish?: string;
  /** The first working day on or after the start date. */
  startsOn: string;
  stageCount: number;
  /** Stages before "starts from", marked done on create. */
  stagesDone: number;
  stepCount: number;
}

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

/** My settings (UI_PLAN 3.19): what a person wants to be told about. Stored per person, off by key. */
export type NotificationPrefKey = 'reminders' | 'hold_points' | 'eta_changes' | 'unconfirmed_jobs';
export const NOTIFICATION_PREF_KEYS: NotificationPrefKey[] = ['reminders', 'hold_points', 'eta_changes', 'unconfirmed_jobs'];
export type NotificationPrefs = Record<NotificationPrefKey, boolean>;

/** One phone's push subscription (model gap 6). The prototype stores a placeholder; the real server fills `subscription`. */
export interface PushSubscriptionInput {
  /** Words for the device, e.g. "iPhone, Safari". */
  device: string;
  /** The PushSubscription JSON from the browser, or a placeholder while there is no push server. */
  subscription: string;
  enabled?: boolean;
}

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

/**
 * The program editor's unsaved program (Stage 6): the whole of one job's
 * stages, steps, links, requirements and photo categories as they would be
 * after Save. Records the editor added carry ids of its own choosing; the
 * preview never writes them.
 */
export interface ProgramDraft {
  stages: Stage[];
  steps: Step[];
  links: StepLink[];
  requirements: Requirement[];
  photoCategories?: PhotoCategory[];
}

/** What a program draft would do to the forecast, before it is saved ("finish Fri 26 Feb 2027 -> Fri 5 Mar 2027, +7 days"). */
export interface ProgramPreview {
  jobId: string;
  finishBefore?: string;
  finishAfter?: string;
  /** finishAfter minus finishBefore, calendar days. */
  deltaDays: number;
  /** Money: holding cost of the delta alone. */
  costDelta?: number;
  /** The forecast over the draft, for drawing the Gantt as it would be. */
  forecast: JobForecast;
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
  /** False until someone picks a name on the sign-in page. */
  signedIn(): boolean;
  /** Everyone who can sign in, across every side, with the roles they hold. */
  listSignIns(): SignInOption[];
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
  /** Notification preferences, defaulting to the person's `notificationsEnabled` flag for every key. Current person by default. */
  getNotificationPrefs(personId?: string): NotificationPrefs;
  setNotificationPref(key: NotificationPrefKey, enabled: boolean, personId?: string): NotificationPrefs;
  /** This person's phones (any side; a phone is not side-specific). Current person by default. */
  listPushSubscriptions(personId?: string): PushSubscriptionRecord[];
  /** Upserts by person and device for the current person. Logs "allowed notifications on <device>". */
  savePushSubscription(input: PushSubscriptionInput): PushSubscriptionRecord;

  // ---- jobs and programs ----
  listJobs(opts?: JobListOptions): Job[];
  listTemplates(): Job[];
  getJob(id: string): Job | undefined;
  addJob(input: NewJobInput): Job;
  updateJob(id: string, patch: JobPatch): Job;
  copyTemplate(templateId: string, input: CopyTemplateInput): Job;
  /** The planned finish and counts `copyTemplate` would give, without saving anything. */
  previewTemplate(templateId: string, input: Pick<CopyTemplateInput, 'startDate' | 'startsFromStageId'>): TemplatePreview;
  /** Rule 8: copies a job's stages, steps, links, requirements and photo categories into a template with every date and status stripped. */
  saveJobAsTemplate(jobId: string, name: string): Job;
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
  /**
   * The program editor's live preview: the forecast the draft would give,
   * against the saved program. Writes nothing. Undefined for templates and
   * design jobs, which have no forecast finish.
   */
  previewProgramChange(jobId: string, draft: ProgramDraft): ProgramPreview | undefined;
  getOverviewRows(): OverviewRow[];
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
  /** When the local copy last changed (the mock: the last write through the API), as a `YYYY-MM-DDTHH:mm` stamp; undefined before any write. */
  getLastSync(): string | undefined;
}

/** Screen keys used by navigation and `canSee`. Routes are in src/screens/README.md. */
export type ScreenKey =
  | 'overview'
  | 'jobs'
  | 'job'
  | 'program'
  | 'step'
  | 'checklist'
  | 'waiting'
  | 'deliveries'
  | 'item'
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
  overview: ['admin', 'partner', 'builder', 'site'],
  jobs: ['admin', 'partner', 'builder', 'site'],
  job: ['admin', 'partner', 'builder', 'site'],
  program: ['admin', 'partner', 'builder', 'site'],
  step: ['admin', 'partner', 'builder', 'site'],
  checklist: ['admin', 'partner', 'builder'],
  waiting: ['admin', 'partner', 'builder'],
  deliveries: ['site'],
  item: ['admin', 'partner', 'builder'],
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
