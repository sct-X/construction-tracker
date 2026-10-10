/**
 * DashboardApi: the one data-layer interface the web app talks to. Two
 * implementations later: the browser mock (LocalDashboardApi over an
 * InMemoryStore with the seed) and the HTTP client for the local API (whose
 * server routes call LocalDashboardApi over the SqliteStore). Read-only except
 * Setup, which goes through the same operations, proposals and undo as the bot.
 */
import { isISODate, overrideClock, type Clock } from './dates.js';
import { buildSeed, DEFAULT_TODAY } from './seed/index.js';
import { InMemoryStore } from './store.js';
import { dryRun, type DryRunResult } from './dryRun.js';
import { getOperation, runOperation, type OpResult, type Proposal } from './operations/index.js';
import {
  changeHistory,
  dailyNotes,
  designChecklist,
  jobOverview,
  jobsList,
  mondayRows,
  photoGallery,
  programView,
  shipmentsList,
  stepDetail,
  templatesList,
  toChase,
  tradesList,
  waitingOn,
  whyItMoved,
  type DesignChecklist,
  type HistoryEntry,
  type HistoryFilter,
  type JobOverview,
  type JobsListView,
  type MondayView,
  type PhotoGallery,
  type ProgramView,
  type ShipmentRow,
  type SideFilter,
  type StepDetail,
  type TemplateRow,
  type ToChaseFilter,
  type ToChaseView,
  type WaitingFilter,
  type WaitingOnView,
  type WhyItMoved,
} from './readModels.js';
import { programSetup, programWorkingDays, type ProgramSetupView } from './setupViews.js';
import { overview, type OverviewView } from './readModelsOverview.js';
import { applyChanges, jobIdsOfChanges } from './changes.js';
import type { Store, UndoResult } from './store.js';
import type { ChangeSet, DailyNote, Dataset, ISODate, Photo, Side, Trade } from './types.js';

export interface SetupPreview {
  result: OpResult;
  /** Present when result is a proposal. */
  impact: DryRunResult['impacts'] | null;
  /**
   * Templates have no dates, so no forecast impact: instead, each touched template's longest chain in
   * working days before and after. Empty when no template is touched (or result is not a proposal).
   */
  templates: TemplateImpact[];
}

export interface TemplateImpact {
  jobId: string;
  name: string;
  workingDaysBefore: number;
  workingDaysAfter: number;
}

/** Who Setup change sets are recorded as coming from: inbound channel "web", this sender, no text. */
export const SETUP_SENDER = 'web-setup';

export type SetupApplyResult = { ok: true; changeSet: ChangeSet; result: Proposal } | { ok: false; result: OpResult; reason: string };

export interface DashboardApi {
  /** The "today is" the data is computed for (Sydney). */
  getToday(): Promise<ISODate>;
  listSides(): Promise<Side[]>;

  getMonday(filter?: SideFilter): Promise<MondayView>;
  /** The web's home (timing first): one row per job, no finish, slip or money. */
  getOverview(filter?: SideFilter): Promise<OverviewView>;
  getWhyItMoved(jobId: string): Promise<WhyItMoved>;
  listJobs(filter?: SideFilter): Promise<JobsListView>;
  getJobOverview(jobId: string): Promise<JobOverview>;
  getProgram(jobId: string): Promise<ProgramView>;
  getStep(stepId: string): Promise<StepDetail>;
  getDesignChecklist(jobId: string): Promise<DesignChecklist>;
  getWaitingOn(filter?: WaitingFilter): Promise<WaitingOnView>;
  getToChase(filter?: ToChaseFilter): Promise<ToChaseView>;
  getShipments(filter?: SideFilter): Promise<ShipmentRow[]>;
  getPhotos(jobId: string): Promise<PhotoGallery>;
  getDailyNotes(jobId: string, opts?: { from?: ISODate; to?: ISODate }): Promise<DailyNote[]>;
  getChangeHistory(filter?: HistoryFilter): Promise<HistoryEntry[]>;
  listTrades(filter?: SideFilter): Promise<(Trade & { openItems: number; jobNames: string[] })[]>;
  listTemplates(filter?: SideFilter): Promise<TemplateRow[]>;
  /** Setup area: one job's or template's program as stored (stages, steps, links, requirements). */
  getProgramSetup(jobId: string): Promise<ProgramSetupView>;

  /** Setup area: validate and dry-run a setup operation without saving. */
  previewSetup(op: string, args: unknown): Promise<SetupPreview>;
  /** Setup area: run and save a setup operation (one confirmed change set). */
  applySetup(op: string, args: unknown): Promise<SetupApplyResult>;
  undo(changeSetId: string): Promise<UndoResult>;

  /**
   * The URL to put in an <img src> for a photo. Synchronous so galleries can
   * map over photos. HTTP client and server: `/api/photos/:id/file`. Browser
   * mock: a flat placeholder SVG data URL (seed photos have no file).
   */
  photoUrl(photo: Pick<Photo, 'id' | 'caption' | 'isPlaceholder'>): string;
}

/**
 * The Pages demo's dev bar ("today is" and reset). Only the browser mock
 * implements it; the real API never does. Kept off DashboardApi on purpose.
 */
export interface DevControls {
  getToday(): Promise<ISODate>;
  setToday(today: ISODate): Promise<void>;
  /** Back to the seed (or the dataset given). */
  reset(dataset?: Dataset): Promise<void>;
}

/** Server-side photo file route, shared by the server and the HTTP client. */
export function apiPhotoUrl(photoId: string): string {
  return `/api/photos/${encodeURIComponent(photoId)}/file`;
}

const PLACEHOLDER_TONES = ['#6b6f73', '#4f5a63', '#8a7a68', '#5c6670', '#7b7268', '#3f4a54'];

/** A flat SVG stand-in for a seed photo: concrete/steel tones, the caption, no stock imagery. */
export function placeholderPhotoUrl(photo: Pick<Photo, 'id' | 'caption'>): string {
  let h = 0;
  for (const ch of photo.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const fill = PLACEHOLDER_TONES[h % PLACEHOLDER_TONES.length]!;
  const label = (photo.caption ?? 'Photo').replace(/[<>&"]/g, '').slice(0, 40);
  // About 24 characters fit across at 11px; longer captions shrink rather than run off the edge.
  const size = label.length > 24 ? Math.max(6.5, Math.round((11 * 24 * 10) / label.length) / 10) : 11;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="${fill}"/>` +
    `<rect x="12" y="78" width="136" height="30" fill="#f3f2ef" opacity="0.18"/>` +
    `<text x="80" y="66" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#f3f2ef">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface LocalDashboardOptions {
  /** Default: placeholder data URL for placeholder photos, apiPhotoUrl otherwise. */
  photoUrl?: (photo: Pick<Photo, 'id' | 'caption' | 'isPlaceholder'>) => string;
}

/** DashboardApi over any Store and Clock. The web mock uses it directly; the server routes call it. */
export class LocalDashboardApi implements DashboardApi {
  constructor(
    private readonly store: Store,
    private readonly clock: Clock,
    private readonly opts: LocalDashboardOptions = {},
  ) {}

  photoUrl(photo: Pick<Photo, 'id' | 'caption' | 'isPlaceholder'>): string {
    if (this.opts.photoUrl) return this.opts.photoUrl(photo);
    return photo.isPlaceholder ? placeholderPhotoUrl(photo) : apiPhotoUrl(photo.id);
  }

  private get ds() {
    return this.store.load();
  }
  private get today() {
    return this.clock.today();
  }

  async getToday() {
    return this.today;
  }
  async listSides() {
    return this.ds.sides;
  }
  async getMonday(filter?: SideFilter) {
    return mondayRows(this.ds, this.today, filter);
  }
  async getOverview(filter?: SideFilter) {
    return overview(this.ds, this.today, filter);
  }
  async getWhyItMoved(jobId: string) {
    return whyItMoved(this.ds, jobId, this.today);
  }
  async listJobs(filter?: SideFilter) {
    return jobsList(this.ds, this.today, filter);
  }
  async getJobOverview(jobId: string) {
    return jobOverview(this.ds, jobId, this.today);
  }
  async getProgram(jobId: string) {
    return programView(this.ds, jobId, this.today);
  }
  async getStep(stepId: string) {
    return stepDetail(this.ds, stepId, this.today);
  }
  async getDesignChecklist(jobId: string) {
    return designChecklist(this.ds, jobId, this.today);
  }
  async getWaitingOn(filter?: WaitingFilter) {
    return waitingOn(this.ds, this.today, filter);
  }
  async getToChase(filter?: ToChaseFilter) {
    return toChase(this.ds, this.today, filter);
  }
  async getShipments(filter?: SideFilter) {
    return shipmentsList(this.ds, this.today, filter);
  }
  async getPhotos(jobId: string) {
    return photoGallery(this.ds, jobId);
  }
  async getDailyNotes(jobId: string, opts?: { from?: ISODate; to?: ISODate }) {
    return dailyNotes(this.ds, jobId, opts);
  }
  async getChangeHistory(filter?: HistoryFilter) {
    return changeHistory(this.ds, filter, this.today);
  }
  async listTrades(filter?: SideFilter) {
    return tradesList(this.ds, filter);
  }
  async listTemplates(filter?: SideFilter) {
    return templatesList(this.ds, filter);
  }
  async getProgramSetup(jobId: string) {
    return programSetup(this.ds, jobId, this.today);
  }

  /** Only setup operations run from the web; day-to-day changes come through the bot. */
  private runSetup(ds: Dataset, op: string, args: unknown): OpResult {
    if (getOperation(op)?.group !== 'setup') return { kind: 'refusal', op, reason: `${op} is not a Setup operation.` };
    return runOperation(ds, op, args, { today: this.today, now: this.clock.now() });
  }

  async previewSetup(op: string, args: unknown): Promise<SetupPreview> {
    const ds = this.ds;
    const result = this.runSetup(ds, op, args);
    if (result.kind !== 'proposal') return { result, impact: null, templates: [] };
    const run = dryRun(ds, result, this.today);
    const templates: TemplateImpact[] = [];
    for (const id of jobIdsOfChanges(run.after, result.changes)) {
      const job = run.after.jobs.find((j) => j.id === id) ?? ds.jobs.find((j) => j.id === id);
      if (!job?.isTemplate) continue;
      const before = ds.jobs.some((j) => j.id === id) ? programWorkingDays(ds, id) : 0;
      templates.push({ jobId: id, name: job.name, workingDaysBefore: before, workingDaysAfter: programWorkingDays(run.after, id) });
    }
    return { result, impact: run.impacts, templates };
  }

  /**
   * Saves a setup operation as one confirmed change set, recorded as coming from Setup on the web: an
   * inbound message (channel "web", sender SETUP_SENDER, no text) so Change history can say where it came from.
   */
  async applySetup(op: string, args: unknown): Promise<SetupApplyResult> {
    const ds = this.ds;
    const result = this.runSetup(ds, op, args);
    if (result.kind !== 'proposal') {
      return { ok: false, result, reason: result.kind === 'refusal' ? result.reason : result.question };
    }
    // Check it applies before recording where it came from, so a stale edit leaves no stray message.
    applyChanges(ds, result.changes);
    const message = this.store.recordInbound({ channel: 'web', sender: SETUP_SENDER, rawText: null });
    const changeSet = this.store.applyChangeSet({
      messageId: message.id,
      summary: result.summary,
      opName: result.op,
      opArgs: result.args,
      changes: result.changes,
    });
    return { ok: true, changeSet, result };
  }

  async undo(changeSetId: string) {
    return this.store.undo(changeSetId);
  }
}

/** A clock whose "today" can be moved (the demo's "today is"). now() is that date at the current Sydney time. */
export class SettableClock implements Clock {
  private clock: Clock;
  constructor(private current: ISODate) {
    this.clock = overrideClock(current);
  }
  today(): ISODate {
    return this.current;
  }
  now(): Date {
    return this.clock.now();
  }
  set(today: ISODate): void {
    if (!isISODate(today)) throw new Error(`Not a date: ${today}`);
    this.current = today;
    this.clock = overrideClock(today);
  }
}

/** The browser mock: seed data in memory, the DashboardApi, and the dev bar's controls. */
export function createMockDashboard(
  dataset: Dataset = buildSeed(),
  today: ISODate = DEFAULT_TODAY,
): { api: DashboardApi; dev: DevControls; store: InMemoryStore; clock: SettableClock } {
  const clock = new SettableClock(today);
  const store = new InMemoryStore(dataset, { clock });
  const api = new LocalDashboardApi(store, clock);
  const dev: DevControls = {
    getToday: async () => clock.today(),
    setToday: async (iso) => clock.set(iso),
    reset: async (ds) => store.reset(ds ?? buildSeed()),
  };
  return { api, dev, store, clock };
}
