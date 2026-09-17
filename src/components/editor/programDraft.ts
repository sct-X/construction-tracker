/**
 * The program editor's draft: pure helpers over a `ProgramDraft` (one job's
 * stages, steps, links, requirements and photo categories as they would be
 * after Save). Nothing here touches the API except `applyProgramDraft`, which
 * turns the difference between the saved program and the draft into the
 * existing API calls, each of which logs its own activity line.
 *
 * Draft-made records carry `draft-` ids; on save the API hands back real ids
 * and every reference (a link, a requirement's step, a category's stage) is
 * remapped before it is written.
 */
import type { ProgramDraft, TrackerApi } from '../../data/api';
import { addWorkingDays, stepEnd } from '../../domain/dates';
import type { PhotoCategory, Requirement, Stage, Step, StepLink } from '../../domain/types';

export const DRAFT_PREFIX = 'draft-';

let draftCounter = 0;
export function draftId(kind: 'stage' | 'step' | 'link' | 'rq' | 'pc'): string {
  draftCounter += 1;
  return `${DRAFT_PREFIX}${kind}-${draftCounter}`;
}

export function isDraftId(id: string): boolean {
  return id.startsWith(DRAFT_PREFIX);
}

// ---------------------------------------------------------------------------
// Links and cycles
// ---------------------------------------------------------------------------

/**
 * If `stepId` waited for `waitsForId`, would the links loop? Returns the
 * chain of step ids from `waitsForId` back to `stepId` when it would (so the
 * refusal can name it), else null. A step waiting for itself is the shortest loop.
 */
export function cyclePath(links: Pick<StepLink, 'stepId' | 'waitsForStepId'>[], stepId: string, waitsForId: string): string[] | null {
  if (stepId === waitsForId) return [stepId];
  const waits = new Map<string, string[]>();
  for (const l of links) {
    if (!waits.has(l.stepId)) waits.set(l.stepId, []);
    waits.get(l.stepId)!.push(l.waitsForStepId);
  }
  // Depth-first from the proposed predecessor: does anything it waits for lead back to stepId?
  const seen = new Set<string>();
  const walk = (from: string, path: string[]): string[] | null => {
    for (const next of waits.get(from) ?? []) {
      if (next === stepId) return [...path, next];
      if (seen.has(next)) continue;
      seen.add(next);
      const found = walk(next, [...path, next]);
      if (found) return found;
    }
    return null;
  };
  return walk(waitsForId, [waitsForId]);
}

/** "External doors can't wait for Handover: Handover already waits for External doors (through Fit-off, Painting)." */
export function cycleWords(path: string[], stepId: string, names: Map<string, string>): string {
  const name = (id: string) => names.get(id) ?? id;
  const first = path[0];
  if (path.length === 1) return `${name(stepId)} can't wait for itself.`;
  const through = path.slice(1, -1).map(name);
  const via = through.length ? ` (through ${through.join(', ')})` : '';
  return `${name(stepId)} can't wait for ${name(first)}: ${name(first)} already waits for ${name(stepId)}${via}. That would loop.`;
}

// ---------------------------------------------------------------------------
// New records
// ---------------------------------------------------------------------------

/** The working day after the latest planned end in `steps`, or `today` when nothing is dated. */
export function nextPlannedStart(steps: Step[], today: string): string {
  const ends = steps.map((s) => s.plannedEnd ?? (s.plannedStart ? stepEnd(s.plannedStart, s.durationDays) : undefined)).filter((d): d is string => !!d);
  if (!ends.length) return addWorkingDays(today, 0);
  return addWorkingDays(ends.reduce((a, b) => (a > b ? a : b)), 1);
}

export function makeStage(draft: ProgramDraft, base: Pick<Stage, 'sideId' | 'jobId'>, name = 'New stage'): Stage {
  return { id: draftId('stage'), sideId: base.sideId, jobId: base.jobId, name, order: draft.stages.length + 1, status: 'not_started' };
}

export function makeStep(draft: ProgramDraft, stage: Stage, opts: { today: string; dated: boolean; name?: string }): Step {
  const siblings = draft.steps.filter((s) => s.stageId === stage.id);
  const plannedStart = opts.dated ? nextPlannedStart(siblings.length ? siblings : draft.steps, opts.today) : undefined;
  return {
    id: draftId('step'),
    sideId: stage.sideId,
    jobId: stage.jobId,
    stageId: stage.id,
    name: opts.name ?? 'New step',
    order: siblings.length + 1,
    durationDays: 5,
    plannedStart,
    plannedEnd: plannedStart ? stepEnd(plannedStart, 5) : undefined,
    status: 'not_started',
    isHoldPoint: false,
  };
}

/** Planned end always follows planned start over working days (rule 3: the start is set by hand, the end derives). */
export function withPlannedEnd(step: Step): Step {
  return { ...step, plannedEnd: step.plannedStart ? stepEnd(step.plannedStart, step.durationDays) : undefined };
}

// ---------------------------------------------------------------------------
// Diff and save
// ---------------------------------------------------------------------------

export interface ProgramChange {
  kind:
    | 'stage_added'
    | 'stage_renamed'
    | 'stages_reordered'
    | 'stage_deleted'
    | 'step_added'
    | 'step_edited'
    | 'step_deleted'
    | 'link_added'
    | 'link_removed'
    | 'requirement_added'
    | 'requirement_edited'
    | 'requirement_removed'
    | 'category_added'
    | 'category_edited'
    | 'category_removed';
  id: string;
}

const STEP_FIELDS = ['name', 'durationDays', 'plannedStart', 'isHoldPoint', 'tradeType', 'stageId', 'order'] as const;
const RQ_FIELDS = ['kind', 'name', 'leadTimeWeeks', 'tradeType'] as const;
const PC_FIELDS = ['name', 'requiredForHoldPoint', 'stageId'] as const;

function stageOrder(stages: Stage[]): string[] {
  return [...stages].sort((a, b) => a.order - b.order).map((s) => s.id);
}

/** Every difference between the saved program and the draft, in the order Save applies them. */
export function diffProgram(saved: ProgramDraft, draft: ProgramDraft): ProgramChange[] {
  const out: ProgramChange[] = [];
  const savedStages = new Map(saved.stages.map((s) => [s.id, s]));
  const draftStages = new Map(draft.stages.map((s) => [s.id, s]));
  for (const s of draft.stages) {
    const was = savedStages.get(s.id);
    if (!was) out.push({ kind: 'stage_added', id: s.id });
    else if (was.name !== s.name) out.push({ kind: 'stage_renamed', id: s.id });
  }
  const keptOrder = stageOrder(saved.stages).filter((id) => draftStages.has(id));
  const newOrder = stageOrder(draft.stages).filter((id) => savedStages.has(id));
  if (keptOrder.join() !== newOrder.join()) out.push({ kind: 'stages_reordered', id: draft.stages[0]?.jobId ?? '' });

  const savedSteps = new Map(saved.steps.map((s) => [s.id, s]));
  const draftSteps = new Map(draft.steps.map((s) => [s.id, s]));
  for (const s of draft.steps) {
    const was = savedSteps.get(s.id);
    if (!was) out.push({ kind: 'step_added', id: s.id });
    else if (STEP_FIELDS.some((f) => (was[f] ?? undefined) !== (s[f] ?? undefined))) out.push({ kind: 'step_edited', id: s.id });
  }
  for (const s of saved.steps) if (!draftSteps.has(s.id) && draftStages.has(s.stageId)) out.push({ kind: 'step_deleted', id: s.id });

  const linkKey = (l: StepLink) => `${l.stepId}>${l.waitsForStepId}`;
  const savedLinks = new Map(saved.links.map((l) => [linkKey(l), l]));
  const draftLinks = new Set(draft.links.map(linkKey));
  for (const l of draft.links) if (!savedLinks.has(linkKey(l))) out.push({ kind: 'link_added', id: l.id });
  for (const l of saved.links) {
    if (draftLinks.has(linkKey(l))) continue;
    // Links whose step is going with a deleted step or stage go with it.
    if (!draftSteps.has(l.stepId) || !draftSteps.has(l.waitsForStepId)) continue;
    out.push({ kind: 'link_removed', id: l.id });
  }

  const savedRqs = new Map(saved.requirements.map((r) => [r.id, r]));
  const draftRqs = new Map(draft.requirements.map((r) => [r.id, r]));
  for (const r of draft.requirements) {
    const was = savedRqs.get(r.id);
    if (!was) out.push({ kind: 'requirement_added', id: r.id });
    else if (RQ_FIELDS.some((f) => (was[f] ?? undefined) !== (r[f] ?? undefined))) out.push({ kind: 'requirement_edited', id: r.id });
  }
  for (const r of saved.requirements) if (!draftRqs.has(r.id) && draftSteps.has(r.stepId)) out.push({ kind: 'requirement_removed', id: r.id });

  const savedCats = new Map((saved.photoCategories ?? []).map((c) => [c.id, c]));
  const draftCats = new Map((draft.photoCategories ?? []).map((c) => [c.id, c]));
  for (const c of draft.photoCategories ?? []) {
    const was = savedCats.get(c.id);
    if (!was) out.push({ kind: 'category_added', id: c.id });
    else if (PC_FIELDS.some((f) => (was[f] ?? undefined) !== (c[f] ?? undefined))) out.push({ kind: 'category_edited', id: c.id });
  }
  for (const c of saved.photoCategories ?? []) {
    if (draftCats.has(c.id)) continue;
    if (c.stageId && !draftStages.has(c.stageId)) continue;
    out.push({ kind: 'category_removed', id: c.id });
  }

  for (const s of saved.stages) if (!draftStages.has(s.id)) out.push({ kind: 'stage_deleted', id: s.id });
  return out;
}

/**
 * Applies the draft through the API: adds first (so draft ids get real
 * ones), then edits, then removals, then whole stages last because deleting
 * a stage takes its steps, links, requirements and categories with it.
 * Returns the id map from draft ids to saved ids.
 */
export function applyProgramDraft(api: TrackerApi, jobId: string, saved: ProgramDraft, draft: ProgramDraft): Map<string, string> {
  const ids = new Map<string, string>();
  const real = (id: string) => ids.get(id) ?? id;
  const changes = diffProgram(saved, draft);
  const has = (kind: ProgramChange['kind'], id: string) => changes.some((c) => c.kind === kind && c.id === id);

  const stagesInOrder = [...draft.stages].sort((a, b) => a.order - b.order);
  for (const s of stagesInOrder) {
    if (has('stage_added', s.id)) ids.set(s.id, api.addStage({ jobId, name: s.name }).id);
    else if (has('stage_renamed', s.id)) api.updateStage(s.id, { name: s.name });
  }
  if (changes.some((c) => c.kind === 'stages_reordered') || draft.stages.some((s) => isDraftId(s.id))) {
    api.reorderStages(
      jobId,
      stagesInOrder.map((s) => real(s.id)),
    );
  }

  const savedSteps = new Map(saved.steps.map((s) => [s.id, s]));
  const stepsInOrder = [...draft.steps].sort((a, b) => a.order - b.order);
  for (const s of stepsInOrder) {
    if (has('step_added', s.id)) {
      ids.set(
        s.id,
        api.addStep({
          jobId,
          stageId: real(s.stageId),
          name: s.name,
          durationDays: s.durationDays,
          plannedStart: s.plannedStart,
          isHoldPoint: s.isHoldPoint,
          tradeType: s.tradeType,
        }).id,
      );
    } else if (has('step_edited', s.id)) {
      const was = savedSteps.get(s.id)!;
      const patch: Partial<Pick<Step, (typeof STEP_FIELDS)[number]>> = {};
      for (const f of STEP_FIELDS) {
        if ((was[f] ?? undefined) !== (s[f] ?? undefined)) (patch as Record<string, unknown>)[f] = f === 'stageId' ? real(s.stageId) : s[f];
      }
      api.updateStep(s.id, patch);
    }
  }
  for (const c of changes) if (c.kind === 'step_deleted') api.deleteStep(c.id);

  for (const c of changes) if (c.kind === 'link_removed') api.removeStepLink(c.id);
  for (const l of draft.links) if (has('link_added', l.id)) api.addStepLink(real(l.stepId), real(l.waitsForStepId));

  const savedRqs = new Map(saved.requirements.map((r) => [r.id, r]));
  for (const r of draft.requirements) {
    if (has('requirement_added', r.id)) {
      api.addRequirement({ stepId: real(r.stepId), kind: r.kind, name: r.name, leadTimeWeeks: r.leadTimeWeeks, tradeType: r.tradeType });
    } else if (has('requirement_edited', r.id)) {
      const was = savedRqs.get(r.id)!;
      const patch: Partial<Pick<Requirement, (typeof RQ_FIELDS)[number]>> = {};
      for (const f of RQ_FIELDS) if ((was[f] ?? undefined) !== (r[f] ?? undefined)) (patch as Record<string, unknown>)[f] = r[f];
      api.updateRequirement(r.id, patch);
    }
  }
  for (const c of changes) if (c.kind === 'requirement_removed') api.removeRequirement(c.id);

  const savedCats = new Map((saved.photoCategories ?? []).map((c) => [c.id, c]));
  for (const c of draft.photoCategories ?? []) {
    if (has('category_added', c.id)) {
      api.addPhotoCategory({ jobId, stageId: c.stageId ? real(c.stageId) : null, name: c.name, requiredForHoldPoint: c.requiredForHoldPoint });
    } else if (has('category_edited', c.id)) {
      const was = savedCats.get(c.id)!;
      const patch: Partial<Pick<PhotoCategory, 'name' | 'requiredForHoldPoint'>> = {};
      if (was.name !== c.name) patch.name = c.name;
      if (was.requiredForHoldPoint !== c.requiredForHoldPoint) patch.requiredForHoldPoint = c.requiredForHoldPoint;
      api.updatePhotoCategory(c.id, patch);
    }
  }
  for (const c of changes) if (c.kind === 'category_removed') api.deletePhotoCategory(c.id);

  for (const c of changes) if (c.kind === 'stage_deleted') api.deleteStage(c.id);
  return ids;
}

/** The saved program, read fresh from the API. */
export function readProgram(api: TrackerApi, jobId: string): ProgramDraft {
  return {
    stages: api.listStages(jobId),
    steps: api.listSteps(jobId),
    links: api.listStepLinks(jobId),
    requirements: api.listRequirements(jobId),
    photoCategories: api.listPhotoCategories(jobId),
  };
}
