/**
 * Small builders so the seed reads like a program, not a JSON dump.
 * Planned ends are derived from planned starts and durations (working days)
 * so the seed can never disagree with the calendar.
 */
import type {
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
} from '../domain/types';
import { maxDate, nextWorkingDay, stepEnd } from '../domain/dates';

export const SIDE_ND = 'side-nd';
export const SIDE_NORM = 'side-norm';

export const P = {
  dominic: 'dominic',
  dom: 'dom',
  norm: 'norm',
  raff: 'raff',
  alec: 'alec',
  pino: 'pino',
} as const;

export interface StepSpec {
  id: string;
  stage: string;
  name: string;
  duration: number;
  /** Explicit planned start. */
  start?: string;
  /** Wait for these steps; when `start` is absent, start the working day after the latest one ends. */
  after?: string | string[];
  /** Extra links that do not set the start. */
  waits?: string[];
  status?: StepStatus;
  hold?: boolean;
  placeholder?: boolean;
  trade?: string;
  actualStart?: string;
  actualEnd?: string;
}

export interface ReqSpec {
  id: string;
  step: string;
  kind: RequirementKind;
  name: string;
  lead: number;
  trade?: string;
}

export class ProgramBuilder {
  stages: Stage[] = [];
  steps: Step[] = [];
  links: StepLink[] = [];
  requirements: Requirement[] = [];
  categories: PhotoCategory[] = [];
  private stepIndex = new Map<string, Step>();
  private orderByStage = new Map<string, number>();
  private catOrder = 0;

  constructor(
    readonly jobId: string,
    readonly sideId: string,
    /** Templates carry no dates and no statuses. */
    readonly dated = true,
  ) {}

  stage(id: string, name: string, status: StageStatus = 'not_started'): this {
    this.stages.push({
      id,
      sideId: this.sideId,
      jobId: this.jobId,
      name,
      order: this.stages.length + 1,
      status: this.dated ? status : 'not_started',
    });
    return this;
  }

  step(spec: StepSpec): this {
    const stage = this.stages.find((s) => s.id === spec.stage);
    if (!stage) throw new Error(`Unknown stage ${spec.stage} for step ${spec.id}`);
    const order = (this.orderByStage.get(spec.stage) ?? 0) + 1;
    this.orderByStage.set(spec.stage, order);
    const afters = spec.after === undefined ? [] : Array.isArray(spec.after) ? spec.after : [spec.after];
    for (const w of [...afters, ...(spec.waits ?? [])]) {
      if (!this.stepIndex.has(w)) throw new Error(`Step ${spec.id} waits for unknown step ${w}`);
      this.links.push({
        id: `${spec.id}<-${w}`,
        sideId: this.sideId,
        jobId: this.jobId,
        stepId: spec.id,
        waitsForStepId: w,
      });
    }
    let plannedStart: string | undefined;
    let plannedEnd: string | undefined;
    if (this.dated) {
      plannedStart = spec.start;
      if (!plannedStart && afters.length) {
        const ends = afters.map((a) => this.stepIndex.get(a)!.plannedEnd);
        const latest = maxDate(...ends);
        if (!latest) throw new Error(`Step ${spec.id}: predecessors have no planned end`);
        plannedStart = nextWorkingDay(latest);
      }
      if (!plannedStart) throw new Error(`Step ${spec.id} has no planned start`);
      plannedEnd = stepEnd(plannedStart, spec.duration);
    }
    const step: Step = {
      id: spec.id,
      sideId: this.sideId,
      jobId: this.jobId,
      stageId: spec.stage,
      name: spec.name,
      order,
      durationDays: spec.duration,
      plannedStart,
      plannedEnd,
      actualStart: this.dated ? spec.actualStart : undefined,
      actualEnd: this.dated ? spec.actualEnd : undefined,
      status: this.dated ? (spec.status ?? 'not_started') : 'not_started',
      isHoldPoint: !!spec.hold,
      isPlaceholder: spec.placeholder,
      tradeType: spec.trade,
    };
    this.steps.push(step);
    this.stepIndex.set(spec.id, step);
    return this;
  }

  req(spec: ReqSpec): this {
    if (!this.stepIndex.has(spec.step)) throw new Error(`Requirement ${spec.id} on unknown step ${spec.step}`);
    this.requirements.push({
      id: spec.id,
      sideId: this.sideId,
      jobId: this.jobId,
      stepId: spec.step,
      kind: spec.kind,
      name: spec.name,
      leadTimeWeeks: spec.lead,
      tradeType: spec.trade,
    });
    return this;
  }

  category(id: string, stage: string | null, name: string, required = false): this {
    if (stage && !this.stages.find((s) => s.id === stage)) throw new Error(`Category ${id} on unknown stage ${stage}`);
    this.categories.push({
      id,
      sideId: this.sideId,
      jobId: this.jobId,
      stageId: stage,
      name,
      requiredForHoldPoint: required,
      order: ++this.catOrder,
    });
    return this;
  }

  get(id: string): Step {
    const s = this.stepIndex.get(id);
    if (!s) throw new Error(`Unknown step ${id}`);
    return s;
  }
}

export interface ItemSpec {
  id: string;
  job: string;
  type: ItemType;
  title: string;
  waitingOn?: string;
  trade?: string;
  owner?: string;
  step?: string;
  requirement?: string;
  shipment?: string;
  lead?: number;
  status?: ItemStatus;
  expected?: string;
  neededBy?: string;
  confirmed?: string;
  created: string;
  notes?: string;
  photo?: string;
  doneAt?: string;
  side?: string;
}

export function item(spec: ItemSpec): Item {
  return {
    id: spec.id,
    sideId: spec.side ?? SIDE_ND,
    jobId: spec.job,
    type: spec.type,
    title: spec.title,
    waitingOn: spec.waitingOn,
    tradeId: spec.trade,
    ownerId: spec.owner,
    neededBy: spec.neededBy,
    leadTimeWeeks: spec.lead,
    expectedDate: spec.expected,
    status: spec.status ?? 'to_do',
    confirmedDate: spec.confirmed,
    stepId: spec.step,
    requirementId: spec.requirement,
    shipmentId: spec.shipment,
    photoId: spec.photo,
    notes: spec.notes,
    createdAt: spec.created,
    doneAt: spec.doneAt,
  };
}

/** A tiny flat SVG stand-in for a site photo. No stock imagery. */
export function svgPhoto(label: string, fill: string, ink = '#f3f2ef'): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">` +
    `<rect width="160" height="120" fill="${fill}"/>` +
    `<rect x="12" y="78" width="136" height="30" fill="${ink}" opacity="0.18"/>` +
    `<text x="80" y="66" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="${ink}">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PHOTO_TONES = ['#6b6f73', '#4f5a63', '#8a7a68', '#5c6670', '#7b7268', '#3f4a54'];
