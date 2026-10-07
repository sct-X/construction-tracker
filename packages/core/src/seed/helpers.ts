/**
 * Small builders so the seed reads like a program, not a JSON dump. Planned
 * ends come from planned starts and durations, so the seed can never disagree
 * with the calendar. Tune durations here, never the calculator.
 */
import { maxDate, nextWorkingDay, stepEnd } from '../dates.js';
import type {
  ISODate,
  Item,
  ItemStatus,
  ItemType,
  PhotoCategory,
  Requirement,
  RequirementKind,
  Stage,
  StageStatus,
  Step,
  StepLink,
  StepStatus,
} from '../types.js';

export const SIDE_ND = 'side-nd';
export const SIDE_NORM = 'side-norm';

export interface StepSpec {
  id: string;
  stage: string;
  name: string;
  duration: number;
  /** Explicit planned start. */
  start?: ISODate;
  /** Waits for these; when `start` is absent, starts the working day after the latest one ends. */
  after?: string | string[];
  /** Extra links that do not set the planned start. */
  waits?: string[];
  status?: StepStatus;
  hold?: boolean;
  placeholder?: boolean;
  trade?: string;
  actualStart?: ISODate;
  actualEnd?: ISODate;
}

export class ProgramBuilder {
  stages: Stage[] = [];
  steps: Step[] = [];
  links: StepLink[] = [];
  requirements: Requirement[] = [];
  categories: PhotoCategory[] = [];
  private readonly index = new Map<string, Step>();
  private readonly orderByStage = new Map<string, number>();
  private catOrder = 0;

  constructor(
    readonly jobId: string,
    /** Templates carry no dates and no statuses (rule 8). */
    readonly dated = true,
  ) {}

  stage(id: string, name: string, status: StageStatus = 'not_started'): this {
    this.stages.push({ id, jobId: this.jobId, name, order: this.stages.length + 1, status: this.dated ? status : 'not_started' });
    return this;
  }

  step(spec: StepSpec): this {
    if (!this.stages.some((s) => s.id === spec.stage)) throw new Error(`Unknown stage ${spec.stage} for step ${spec.id}`);
    const order = (this.orderByStage.get(spec.stage) ?? 0) + 1;
    this.orderByStage.set(spec.stage, order);
    const afters = spec.after === undefined ? [] : Array.isArray(spec.after) ? spec.after : [spec.after];
    for (const w of [...afters, ...(spec.waits ?? [])]) {
      if (!this.index.has(w)) throw new Error(`Step ${spec.id} waits for unknown step ${w}`);
      this.links.push({ id: `${spec.id}--${w}`, jobId: this.jobId, stepId: spec.id, waitsForStepId: w });
    }
    let plannedStart: ISODate | null = null;
    let plannedEnd: ISODate | null = null;
    if (this.dated) {
      plannedStart = spec.start ?? null;
      if (!plannedStart && afters.length) {
        const latest = maxDate(...afters.map((a) => this.index.get(a)!.plannedEnd));
        if (!latest) throw new Error(`Step ${spec.id}: predecessors have no planned end`);
        plannedStart = nextWorkingDay(latest);
      }
      if (!plannedStart) throw new Error(`Step ${spec.id} has no planned start`);
      plannedEnd = stepEnd(plannedStart, spec.duration);
    }
    const step: Step = {
      id: spec.id,
      jobId: this.jobId,
      stageId: spec.stage,
      name: spec.name,
      order,
      durationDays: spec.duration,
      plannedStart,
      plannedEnd,
      actualStart: this.dated ? (spec.actualStart ?? null) : null,
      actualEnd: this.dated ? (spec.actualEnd ?? null) : null,
      status: this.dated ? (spec.status ?? 'not_started') : 'not_started',
      isHoldPoint: !!spec.hold,
      isPlaceholder: !!spec.placeholder,
      tradeType: spec.trade ?? null,
    };
    this.steps.push(step);
    this.index.set(spec.id, step);
    return this;
  }

  req(id: string, step: string, kind: RequirementKind, name: string, lead: number, trade?: string): this {
    if (!this.index.has(step)) throw new Error(`Requirement ${id} on unknown step ${step}`);
    this.requirements.push({ id, jobId: this.jobId, stepId: step, kind, name, leadTimeWeeks: lead, tradeType: trade ?? null });
    return this;
  }

  category(id: string, stage: string | null, name: string, required = false): this {
    if (stage && !this.stages.some((s) => s.id === stage)) throw new Error(`Category ${id} on unknown stage ${stage}`);
    this.categories.push({ id, jobId: this.jobId, stageId: stage, name, requiredForHoldPoint: required, order: ++this.catOrder });
    return this;
  }

  /** Prefix every id so two jobs can share one structure. */
  prefixIds(prefix: string): this {
    const m = (id: string) => `${prefix}-${id}`;
    for (const s of this.stages) s.id = m(s.id);
    for (const s of this.steps) {
      s.id = m(s.id);
      s.stageId = m(s.stageId);
    }
    for (const l of this.links) {
      l.id = m(l.id);
      l.stepId = m(l.stepId);
      l.waitsForStepId = m(l.waitsForStepId);
    }
    for (const r of this.requirements) {
      r.id = m(r.id);
      r.stepId = m(r.stepId);
    }
    for (const c of this.categories) {
      c.id = m(c.id);
      if (c.stageId) c.stageId = m(c.stageId);
    }
    return this;
  }
}

export interface ItemSpec {
  id: string;
  job: string;
  type: ItemType;
  title: string;
  waitingOn?: string;
  owner?: string;
  trade?: string;
  step?: string;
  requirement?: string;
  shipment?: string;
  lead?: number;
  status?: ItemStatus;
  expected?: ISODate;
  neededBy?: ISODate;
  confirmed?: ISODate;
  created: ISODate;
  notes?: string;
  photo?: string;
  doneAt?: ISODate;
}

export function item(s: ItemSpec): Item {
  return {
    id: s.id,
    jobId: s.job,
    type: s.type,
    title: s.title,
    waitingOn: s.waitingOn ?? null,
    owner: s.owner ?? null,
    tradeId: s.trade ?? null,
    neededBy: s.neededBy ?? null,
    leadTimeWeeks: s.lead ?? null,
    expectedDate: s.expected ?? null,
    status: s.status ?? 'to_do',
    confirmedDate: s.confirmed ?? null,
    notes: s.notes ?? null,
    stepId: s.step ?? null,
    requirementId: s.requirement ?? null,
    shipmentId: s.shipment ?? null,
    photoId: s.photo ?? null,
    createdAt: s.created,
    doneAt: s.doneAt ?? null,
  };
}
