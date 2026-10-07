/**
 * DashboardApi: the one data-layer interface the web app talks to. Two
 * implementations later: the browser mock (LocalDashboardApi over an
 * InMemoryStore with the seed) and the HTTP client for the local API (whose
 * server routes call LocalDashboardApi over the SqliteStore). Read-only except
 * Setup, which goes through the same operations, proposals and undo as the bot.
 */
import type { Clock } from './dates.js';
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
import type { Store, UndoResult } from './store.js';
import type { ChangeSet, DailyNote, Dataset, ISODate, Side, Trade } from './types.js';

export interface SetupPreview {
  result: OpResult;
  /** Present when result is a proposal. */
  impact: DryRunResult['impacts'] | null;
}

export type SetupApplyResult = { ok: true; changeSet: ChangeSet; result: Proposal } | { ok: false; result: OpResult; reason: string };

export interface DashboardApi {
  /** The "today is" the data is computed for (Sydney). */
  getToday(): Promise<ISODate>;
  listSides(): Promise<Side[]>;

  getMonday(filter?: SideFilter): Promise<MondayView>;
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
  listTrades(filter?: SideFilter): Promise<(Trade & { openItems: number })[]>;
  listTemplates(filter?: SideFilter): Promise<TemplateRow[]>;

  /** Setup area: validate and dry-run a setup operation without saving. */
  previewSetup(op: string, args: unknown): Promise<SetupPreview>;
  /** Setup area: run and save a setup operation (one confirmed change set). */
  applySetup(op: string, args: unknown): Promise<SetupApplyResult>;
  undo(changeSetId: string): Promise<UndoResult>;
}

/** DashboardApi over any Store and Clock. The web mock uses it directly; the server routes call it. */
export class LocalDashboardApi implements DashboardApi {
  constructor(
    private readonly store: Store,
    private readonly clock: Clock,
  ) {}

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
    return changeHistory(this.ds, filter);
  }
  async listTrades(filter?: SideFilter) {
    return tradesList(this.ds, filter);
  }
  async listTemplates(filter?: SideFilter) {
    return templatesList(this.ds, filter);
  }

  /** Only setup operations run from the web; day-to-day changes come through the bot. */
  private runSetup(ds: Dataset, op: string, args: unknown): OpResult {
    if (getOperation(op)?.group !== 'setup') return { kind: 'refusal', op, reason: `${op} is not a Setup operation.` };
    return runOperation(ds, op, args, { today: this.today, now: this.clock.now() });
  }

  async previewSetup(op: string, args: unknown): Promise<SetupPreview> {
    const ds = this.ds;
    const result = this.runSetup(ds, op, args);
    return { result, impact: result.kind === 'proposal' ? dryRun(ds, result, this.today).impacts : null };
  }

  async applySetup(op: string, args: unknown): Promise<SetupApplyResult> {
    const result = this.runSetup(this.ds, op, args);
    if (result.kind !== 'proposal') {
      return { ok: false, result, reason: result.kind === 'refusal' ? result.reason : result.question };
    }
    const changeSet = this.store.applyChangeSet({ summary: result.summary, opName: result.op, opArgs: result.args, changes: result.changes });
    return { ok: true, changeSet, result };
  }

  async undo(changeSetId: string) {
    return this.store.undo(changeSetId);
  }
}
