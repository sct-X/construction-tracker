/**
 * Setup operations for the desktop Setup area (new job from template, program
 * editor, templates, trades). Same proposal/undo path as the bot's operations.
 * Setup screens pass ids, which match exactly; names also work.
 */
import { z } from 'zod';
import { topoSortSteps } from '../calculator.js';
import type { Change } from '../changes.js';
import { maxDate, nextWorkingDay, previousWorkingDay, snapToWorkingDay, stepEnd } from '../dates.js';
import type { Dataset, ISODate, Job, PhotoCategory, Requirement, Stage, Step, StepLink } from '../types.js';
import {
  dateArg,
  defineOp,
  insert,
  jobName,
  OpStop,
  proposal,
  readDate,
  refuse,
  remove,
  resolveJob,
  resolveStage,
  resolveStep,
  resolveTrade,
  update,
  type OpRunContext,
} from './framework.js';

const DESIGN_STAGES: Record<'DA' | 'CDC', string[]> = {
  DA: ['Design', 'With council', 'Approved', 'Construction certificate'],
  CDC: ['Design', 'With certifier', 'Approved'],
};

function defaultSide(ds: Dataset, ctx: OpRunContext, side: string | undefined): string {
  if (!side) {
    const first = ds.sides[0];
    if (!first) refuse(ctx, 'There is no side to put it on.');
    return first.id;
  }
  const s = ds.sides.find((x) => x.id === side || x.name.toLowerCase() === side.toLowerCase());
  if (!s) refuse(ctx, `There is no side called "${side}".`);
  return s.id;
}

/** Planned dates for a step given its predecessors (none on templates). */
function plannedFor(
  job: Job,
  ds: Dataset,
  durationDays: number,
  plannedStart: ISODate | null,
  afterIds: string[],
): { plannedStart: ISODate | null; plannedEnd: ISODate | null } {
  if (job.isTemplate) return { plannedStart: null, plannedEnd: null };
  let start = plannedStart;
  if (!start && afterIds.length) {
    const ends = afterIds.map((id) => ds.steps.find((s) => s.id === id)?.plannedEnd ?? null);
    const latest = maxDate(...ends);
    if (latest) start = nextWorkingDay(latest);
  }
  if (!start) start = job.startDate;
  if (!start) return { plannedStart: null, plannedEnd: null };
  start = snapToWorkingDay(start);
  return { plannedStart: start, plannedEnd: stepEnd(start, durationDays) };
}

/** Rule 9: design jobs have stages as a checklist, no steps, links or requirements. */
function requireBuild(ds: Dataset, ctx: OpRunContext, jobId: string, what: string): Job {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (!job) refuse(ctx, 'That job no longer exists.');
  if (job.kind === 'design') refuse(ctx, `${job.name} is a design job: it has a stage checklist, not ${what}.`);
  return job;
}

/** Rule 8: templates carry no dates. */
function refuseTemplateDates(ctx: OpRunContext, job: { name: string; isTemplate: boolean }, given: Record<string, unknown>): void {
  if (!job.isTemplate) return;
  const dated = Object.entries(given).filter(([, v]) => v !== undefined).map(([k]) => k);
  if (dated.length) refuse(ctx, `${job.name} is a template, and templates have no dates (${dated.join(', ')}).`);
}

function wouldCycle(links: { stepId: string; waitsForStepId: string }[], stepId: string, waitsForId: string): boolean {
  // Adding stepId -> waitsForId cycles if waitsForId already (transitively) waits for stepId.
  const seen = new Set<string>();
  const stack = [waitsForId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === stepId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const l of links) if (l.stepId === cur) stack.push(l.waitsForStepId);
  }
  return false;
}

export const createJob = defineOp({
  name: 'create_job',
  group: 'setup',
  description: 'Create an empty job (build or design). Design jobs get the standard DA or CDC checklist stages.',
  schema: z.object({
    name: z.string().min(1).max(120),
    kind: z.enum(['build', 'design']),
    path: z.enum(['DA', 'CDC']).optional(),
    side: z.string().optional(),
    weeklyHoldingCost: z.number().min(0).optional(),
    startDate: dateArg('Start date').optional(),
    plannedFinish: dateArg('Planned finish').optional(),
    isTemplate: z.boolean().optional(),
  }),
  run(ds, a, ctx) {
    refuseTemplateDates(ctx, { name: a.name, isTemplate: !!a.isTemplate }, { startDate: a.startDate, plannedFinish: a.plannedFinish });
    if (ds.jobs.some((j) => j.name.toLowerCase() === a.name.toLowerCase() && !j.isTemplate === !a.isTemplate)) {
      refuse(ctx, `There is already a job called ${a.name}.`);
    }
    const job: Job = {
      id: ctx.id('job'),
      sideId: defaultSide(ds, ctx, a.side),
      name: a.name,
      kind: a.kind,
      path: a.path ?? (a.kind === 'design' ? 'DA' : null),
      weeklyHoldingCost: a.weeklyHoldingCost ?? null,
      lastConfirmed: a.isTemplate ? null : ctx.today,
      isTemplate: !!a.isTemplate,
      plannedFinish: a.plannedFinish ? readDate(ctx, a.plannedFinish) : null,
      startDate: a.startDate ? readDate(ctx, a.startDate) : null,
      startsFromStageId: null,
      templateId: null,
      createdAt: ctx.today,
    };
    const changes: Change[] = [insert('job', job)];
    if (a.kind === 'design') {
      DESIGN_STAGES[a.path ?? 'DA'].forEach((name, i) => {
        changes.push(insert('stage', { id: ctx.id('stage'), jobId: job.id, name, order: i + 1, status: i === 0 ? 'in_progress' : 'not_started' }));
      });
    }
    changes.push(insert('photo_category', { id: ctx.id('pcat'), jobId: job.id, stageId: null, name: 'General', requiredForHoldPoint: false, order: 0 }));
    return proposal(ctx, ds, changes, `New ${a.kind} job: ${a.name}`);
  },
});

export const editJob = defineOp({
  name: 'edit_job',
  group: 'setup',
  description: "Change a job's name, approval path, weekly holding cost, start date or planned finish.",
  schema: z.object({
    job: z.string(),
    name: z.string().min(1).max(120).optional(),
    path: z.enum(['DA', 'CDC']).optional(),
    weeklyHoldingCost: z.number().min(0).optional(),
    startDate: dateArg('Start date').optional(),
    plannedFinish: dateArg('Planned finish').optional(),
  }),
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    refuseTemplateDates(ctx, job, { startDate: a.startDate, plannedFinish: a.plannedFinish });
    const changes: Change[] = [
      ...(a.name !== undefined ? update('job', job, 'name', a.name) : []),
      ...(a.path !== undefined ? update('job', job, 'path', a.path) : []),
      ...(a.weeklyHoldingCost !== undefined ? update('job', job, 'weeklyHoldingCost', a.weeklyHoldingCost) : []),
      ...(a.startDate !== undefined ? update('job', job, 'startDate', readDate(ctx, a.startDate)) : []),
      ...(a.plannedFinish !== undefined ? update('job', job, 'plannedFinish', readDate(ctx, a.plannedFinish)) : []),
    ];
    return proposal(ctx, ds, changes, `Edited ${job.name}`);
  },
});

/** Changes that renumber a job's stages so `moving` sits at `order` (1-based). */
function reorderStages(stages: Stage[], movingId: string, order: number): Change[] {
  const sorted = [...stages].sort((x, y) => x.order - y.order).filter((s) => s.id !== movingId);
  const target = Math.max(1, Math.min(order, sorted.length + 1));
  const ids = sorted.map((s) => s.id);
  ids.splice(target - 1, 0, movingId);
  const out: Change[] = [];
  ids.forEach((id, i) => {
    const s = stages.find((x) => x.id === id);
    if (s) out.push(...update('stage', s, 'order', i + 1));
  });
  return out;
}

export const addStage = defineOp({
  name: 'add_stage',
  group: 'setup',
  description: 'Add a stage to a job or template, at the end or at a given position.',
  schema: z.object({ job: z.string(), name: z.string().min(1).max(120), order: z.number().int().min(1).optional() }),
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    const stages = ds.stages.filter((s) => s.jobId === job.id);
    const order = Math.min(a.order ?? stages.length + 1, stages.length + 1);
    const stage: Stage = { id: ctx.id('stage'), jobId: job.id, name: a.name, order, status: 'not_started' };
    const shift = stages.filter((s) => s.order >= order).flatMap((s) => update('stage', s, 'order', s.order + 1));
    return proposal(ctx, ds, [...shift, insert('stage', stage)], `New stage at ${job.name}: ${a.name}`);
  },
});

export const editStage = defineOp({
  name: 'edit_stage',
  group: 'setup',
  description: 'Rename or move a stage.',
  schema: z.object({ stage: z.string(), job: z.string().optional(), name: z.string().min(1).max(120).optional(), order: z.number().int().min(1).optional() }),
  run(ds, a, ctx) {
    const job = a.job ? resolveJob(ds, ctx, a.job) : null;
    const stage = resolveStage(ds, ctx, a.stage, job);
    const changes: Change[] = [];
    if (a.name !== undefined) changes.push(...update('stage', stage, 'name', a.name));
    if (a.order !== undefined) changes.push(...reorderStages(ds.stages.filter((s) => s.jobId === stage.jobId), stage.id, a.order));
    return proposal(ctx, ds, changes, `Edited stage ${stage.name} at ${jobName(ds, stage.jobId)}`);
  },
});

export const deleteStage = defineOp({
  name: 'delete_stage',
  group: 'setup',
  description: 'Delete an empty stage (no steps) and its photo categories.',
  schema: z.object({ stage: z.string(), job: z.string().optional() }),
  run(ds, a, ctx) {
    const job = a.job ? resolveJob(ds, ctx, a.job) : null;
    const stage = resolveStage(ds, ctx, a.stage, job);
    const steps = ds.steps.filter((s) => s.stageId === stage.id);
    if (steps.length) refuse(ctx, `${stage.name} still has ${steps.length} step${steps.length === 1 ? '' : 's'}. Move or delete them first.`);
    const cats = ds.photoCategories.filter((c) => c.stageId === stage.id);
    if (cats.some((c) => ds.photos.some((p) => p.categoryId === c.id))) refuse(ctx, `${stage.name} has photos filed under it.`);
    const rest = ds.stages.filter((s) => s.jobId === stage.jobId && s.id !== stage.id).sort((x, y) => x.order - y.order);
    const renumber = rest.flatMap((s, i) => update('stage', s, 'order', i + 1));
    return proposal(ctx, ds, [...cats.map((c) => remove('photo_category', c)), remove('stage', stage), ...renumber], `Deleted stage ${stage.name} at ${jobName(ds, stage.jobId)}`);
  },
});

export const addStep = defineOp({
  name: 'add_step',
  group: 'setup',
  description: 'Add a step to a stage, with its duration in working days and the steps it waits for.',
  schema: z.object({
    job: z.string(),
    stage: z.string(),
    name: z.string().min(1).max(160),
    durationDays: z.number().int().min(1).max(1000),
    plannedStart: dateArg('Planned start (default: after the steps it waits for)').optional(),
    after: z.array(z.string()).optional().describe('Steps it waits for.'),
    afterChoice: z.string().optional().describe('The answer (a step id) to "which step do you mean" about an entry in after.'),
    isHoldPoint: z.boolean().optional(),
    isPlaceholder: z.boolean().optional(),
    tradeType: z.string().optional(),
  }),
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    requireBuild(ds, ctx, job.id, 'steps');
    refuseTemplateDates(ctx, job, { plannedStart: a.plannedStart });
    const stage = resolveStage(ds, ctx, a.stage, job);
    if (stage.jobId !== job.id) refuse(ctx, `${stage.name} is not a stage of ${job.name}.`);
    // An ambiguous entry in `after` asks with field "afterChoice" (a known arg), so re-running with
    // { ...args, afterChoice: id } fills that entry in. The question's args carry the entries answered so far.
    const refs = [...(a.after ?? [])];
    let choice = a.afterChoice ?? null;
    const afterSteps: Step[] = [];
    for (let i = 0; i < refs.length; i++) {
      try {
        afterSteps.push(resolveStep(ds, ctx, refs[i]!, job.id, 'afterChoice'));
      } catch (e) {
        if (!(e instanceof OpStop) || e.result.kind !== 'question') throw e;
        const q = e.result;
        const picked = choice && q.options?.some((o) => o.value === choice) ? choice : null;
        const pickedStep = picked ? ds.steps.find((s) => s.id === picked) : undefined;
        if (pickedStep) {
          refs[i] = pickedStep.id;
          choice = null;
          afterSteps.push(pickedStep);
          continue;
        }
        const { afterChoice: _answered, ...rest } = ctx.args;
        return { ...q, field: 'afterChoice', args: { ...rest, after: refs } };
      }
    }
    const id = ctx.id('step');
    const dates = plannedFor(job, ds, a.durationDays, a.plannedStart ? readDate(ctx, a.plannedStart) : null, afterSteps.map((s) => s.id));
    const step: Step = {
      id,
      jobId: job.id,
      stageId: stage.id,
      name: a.name,
      order: ds.steps.filter((s) => s.stageId === stage.id).length + 1,
      durationDays: a.durationDays,
      ...dates,
      actualStart: null,
      actualEnd: null,
      status: 'not_started',
      isHoldPoint: !!a.isHoldPoint,
      isPlaceholder: !!a.isPlaceholder,
      tradeType: a.tradeType ?? null,
    };
    const links: StepLink[] = afterSteps.map((p) => ({ id: ctx.id('link'), jobId: job.id, stepId: id, waitsForStepId: p.id }));
    return proposal(ctx, ds, [insert('step', step), ...links.map((l) => insert('step_link', l))], `New step at ${job.name}, ${stage.name}: ${a.name}`);
  },
});

export const editStep = defineOp({
  name: 'edit_step',
  group: 'setup',
  description: 'Change a step: name, duration (working days), planned start, hold point, trade, or move it to another stage.',
  schema: z.object({
    step: z.string(),
    job: z.string().optional(),
    name: z.string().min(1).max(160).optional(),
    durationDays: z.number().int().min(1).max(1000).optional(),
    plannedStart: dateArg('Planned start').optional(),
    isHoldPoint: z.boolean().optional(),
    tradeType: z.string().optional(),
    stage: z.string().optional(),
  }),
  run(ds, a, ctx) {
    const step = resolveStep(ds, ctx, a.step, a.job);
    const job = requireBuild(ds, ctx, step.jobId, 'steps');
    refuseTemplateDates(ctx, job, { plannedStart: a.plannedStart });
    const changes: Change[] = [];
    if (a.name !== undefined) changes.push(...update('step', step, 'name', a.name));
    if (a.isHoldPoint !== undefined) changes.push(...update('step', step, 'isHoldPoint', a.isHoldPoint));
    if (a.tradeType !== undefined) changes.push(...update('step', step, 'tradeType', a.tradeType));
    if (a.stage !== undefined) {
      const target = resolveStage(ds, ctx, a.stage, job);
      if (target.jobId !== job.id) refuse(ctx, `${target.name} is not a stage of ${job.name}.`);
      if (target.id !== step.stageId) {
        changes.push(...update('step', step, 'stageId', target.id));
        changes.push(...update('step', step, 'order', ds.steps.filter((s) => s.stageId === target.id).length + 1));
      }
    }
    const duration = a.durationDays ?? step.durationDays;
    if (a.durationDays !== undefined) changes.push(...update('step', step, 'durationDays', a.durationDays));
    if ((a.durationDays !== undefined || a.plannedStart !== undefined) && !job.isTemplate) {
      const start = a.plannedStart ? snapToWorkingDay(readDate(ctx, a.plannedStart)) : step.plannedStart;
      if (start) {
        changes.push(...update('step', step, 'plannedStart', start));
        changes.push(...update('step', step, 'plannedEnd', stepEnd(start, duration)));
      }
    }
    return proposal(ctx, ds, changes, `Edited step ${step.name} at ${job.name}`);
  },
});

export const deleteStep = defineOp({
  name: 'delete_step',
  group: 'setup',
  description: 'Delete a step with its links and requirements. Refused while items are linked to it.',
  schema: z.object({ step: z.string(), job: z.string().optional() }),
  run(ds, a, ctx) {
    const step = resolveStep(ds, ctx, a.step, a.job);
    const items = ds.items.filter((i) => i.stepId === step.id);
    if (items.length) refuse(ctx, `${step.name} has ${items.length} item${items.length === 1 ? '' : 's'} linked. Move or delete them first.`);
    const links = ds.stepLinks.filter((l) => l.stepId === step.id || l.waitsForStepId === step.id);
    const reqs = ds.requirements.filter((r) => r.stepId === step.id);
    return proposal(
      ctx,
      ds,
      [...links.map((l) => remove('step_link', l)), ...reqs.map((r) => remove('requirement', r)), remove('step', step)],
      `Deleted step ${step.name} at ${jobName(ds, step.jobId)}`,
    );
  },
});

export const addLink = defineOp({
  name: 'add_link',
  group: 'setup',
  description: 'Make one step wait for another.',
  schema: z.object({ step: z.string(), waitsFor: z.string(), job: z.string().optional() }),
  run(ds, a, ctx) {
    const step = resolveStep(ds, ctx, a.step, a.job);
    requireBuild(ds, ctx, step.jobId, 'links between steps');
    const pred = resolveStep(ds, ctx, a.waitsFor, step.jobId, 'waitsFor');
    if (pred.jobId !== step.jobId) refuse(ctx, 'A step can only wait for a step on the same job.');
    if (pred.id === step.id) refuse(ctx, 'A step cannot wait for itself.');
    if (ds.stepLinks.some((l) => l.stepId === step.id && l.waitsForStepId === pred.id)) refuse(ctx, `${step.name} already waits for ${pred.name}.`);
    if (wouldCycle(ds.stepLinks, step.id, pred.id)) refuse(ctx, `${pred.name} already waits for ${step.name}, so that would go round in a circle.`);
    const link: StepLink = { id: ctx.id('link'), jobId: step.jobId, stepId: step.id, waitsForStepId: pred.id };
    return proposal(ctx, ds, [insert('step_link', link)], `${step.name} now waits for ${pred.name}`);
  },
});

export const removeLink = defineOp({
  name: 'remove_link',
  group: 'setup',
  description: 'Stop one step waiting for another.',
  schema: z.object({ step: z.string(), waitsFor: z.string(), job: z.string().optional() }),
  run(ds, a, ctx) {
    const step = resolveStep(ds, ctx, a.step, a.job);
    const pred = resolveStep(ds, ctx, a.waitsFor, step.jobId, 'waitsFor');
    const link = ds.stepLinks.find((l) => l.stepId === step.id && l.waitsForStepId === pred.id);
    if (!link) refuse(ctx, `${step.name} doesn't wait for ${pred.name}.`);
    return proposal(ctx, ds, [remove('step_link', link)], `${step.name} no longer waits for ${pred.name}`);
  },
});

export const addRequirement = defineOp({
  name: 'add_requirement',
  group: 'setup',
  description: 'Say what a step needs: a trade to book or a material to order, with its lead time in weeks.',
  schema: z.object({
    step: z.string(),
    job: z.string().optional(),
    kind: z.enum(['trade', 'material']),
    name: z.string().min(1).max(120),
    leadTimeWeeks: z.number().min(0).max(104),
    tradeType: z.string().optional(),
  }),
  run(ds, a, ctx) {
    const step = resolveStep(ds, ctx, a.step, a.job);
    requireBuild(ds, ctx, step.jobId, 'step requirements');
    const req: Requirement = {
      id: ctx.id('req'),
      jobId: step.jobId,
      stepId: step.id,
      kind: a.kind,
      name: a.name,
      leadTimeWeeks: a.leadTimeWeeks,
      tradeType: a.tradeType ?? null,
    };
    return proposal(ctx, ds, [insert('requirement', req)], `${step.name} needs ${a.name} (${a.leadTimeWeeks} weeks)`);
  },
});

export const addPhotoCategory = defineOp({
  name: 'add_photo_category',
  group: 'setup',
  description: 'Add a photo category to a stage (or the whole job), optionally required before the stage hold point.',
  schema: z.object({
    job: z.string(),
    stage: z.string().optional(),
    name: z.string().min(1).max(120),
    requiredForHoldPoint: z.boolean().optional(),
  }),
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    const stage = a.stage ? resolveStage(ds, ctx, a.stage, job) : null;
    const order = Math.max(0, ...ds.photoCategories.filter((c) => c.jobId === job.id).map((c) => c.order)) + 1;
    const cat: PhotoCategory = {
      id: ctx.id('pcat'),
      jobId: job.id,
      stageId: stage?.id ?? null,
      name: a.name,
      requiredForHoldPoint: !!a.requiredForHoldPoint,
      order,
    };
    return proposal(ctx, ds, [insert('photo_category', cat)], `New photo category at ${job.name}${stage ? `, ${stage.name}` : ''}: ${a.name}`);
  },
});

export const addTrade = defineOp({
  name: 'add_trade',
  group: 'setup',
  description: 'Add a trade to the directory with its type and phone.',
  schema: z.object({ name: z.string().min(1).max(120), type: z.string().min(1).max(80), phone: z.string().max(40).optional(), side: z.string().optional() }),
  run(ds, a, ctx) {
    const sideId = defaultSide(ds, ctx, a.side);
    if (ds.trades.some((t) => t.sideId === sideId && t.name.toLowerCase() === a.name.toLowerCase())) refuse(ctx, `${a.name} is already in the directory.`);
    const trade = { id: ctx.id('trade'), sideId, name: a.name, type: a.type, phone: a.phone ?? null };
    return proposal(ctx, ds, [insert('trade', trade)], `New trade: ${a.name} (${a.type})`);
  },
});

export const editTrade = defineOp({
  name: 'edit_trade',
  group: 'setup',
  description: "Change a trade's name, type or phone.",
  schema: z.object({ trade: z.string(), name: z.string().min(1).max(120).optional(), type: z.string().min(1).max(80).optional(), phone: z.string().max(40).optional() }),
  run(ds, a, ctx) {
    const t = resolveTrade(ds, ctx, a.trade);
    const changes: Change[] = [
      ...(a.name !== undefined ? update('trade', t, 'name', a.name) : []),
      ...(a.type !== undefined ? update('trade', t, 'type', a.type) : []),
      ...(a.phone !== undefined ? update('trade', t, 'phone', a.phone) : []),
    ];
    return proposal(ctx, ds, changes, `Edited trade ${t.name}`);
  },
});

export const deleteTrade = defineOp({
  name: 'delete_trade',
  group: 'setup',
  description: 'Remove a trade from the directory. Refused while items point at it.',
  schema: z.object({ trade: z.string() }),
  run(ds, a, ctx) {
    const t = resolveTrade(ds, ctx, a.trade);
    const n = ds.items.filter((i) => i.tradeId === t.id).length;
    if (n) refuse(ctx, `${t.name} is on ${n} item${n === 1 ? '' : 's'}.`);
    return proposal(ctx, ds, [remove('trade', t)], `Removed trade ${t.name}`);
  },
});

export const copyTemplate = defineOp({
  name: 'copy_template',
  group: 'setup',
  description:
    'Start a new job from a template: copies stages, steps, links, requirements and photo categories, and runs planned dates forward from the start date. Stages before "starts from" are marked done.',
  schema: z.object({
    template: z.string().describe('Template name, e.g. "Duplex".'),
    name: z.string().min(1).max(120),
    startDate: dateArg('Start date'),
    startsFromStage: z.string().optional().describe('For a job already under way: the stage it is at now.'),
    weeklyHoldingCost: z.number().min(0).optional(),
    path: z.enum(['DA', 'CDC']).optional(),
    side: z.string().optional(),
  }),
  ask: { template: 'Which template?', name: 'What is the new job called?', startDate: 'When does it start?' },
  run(ds, a, ctx) {
    const tpl = resolveJob(ds, ctx, a.template, { field: 'template', templates: true });
    if (ds.jobs.some((j) => !j.isTemplate && j.name.toLowerCase() === a.name.toLowerCase())) refuse(ctx, `There is already a job called ${a.name}.`);
    const startDate = snapToWorkingDay(readDate(ctx, a.startDate));
    const tStages = ds.stages.filter((s) => s.jobId === tpl.id).sort((x, y) => x.order - y.order);
    if (!tStages.length) refuse(ctx, `The ${tpl.name} template has no stages yet.`);
    const fromStage = a.startsFromStage ? resolveStage(ds, ctx, a.startsFromStage, tpl, 'startsFromStage') : null;
    const fromOrder = fromStage?.order ?? 1;
    const tSteps = ds.steps.filter((s) => s.jobId === tpl.id);
    const tLinks = ds.stepLinks.filter((l) => l.jobId === tpl.id);

    const jobId = ctx.id('job');
    const idMap = new Map<string, string>();
    const mapId = (old: string, prefix: string) => {
      if (!idMap.has(old)) idMap.set(old, ctx.id(prefix));
      return idMap.get(old)!;
    };
    const stageOrder = new Map(tStages.map((s) => [s.id, s.order]));
    const isBefore = (stageId: string) => (stageOrder.get(stageId) ?? 0) < fromOrder;
    const doneDay = previousWorkingDay(startDate);

    const stages: Stage[] = tStages.map((s) => ({
      id: mapId(s.id, 'stage'),
      jobId,
      name: s.name,
      order: s.order,
      status: s.order < fromOrder ? 'done' : 'not_started',
    }));

    // Forward pass through the links in dependency order.
    const planned = new Map<string, { start: ISODate; end: ISODate }>();
    for (const s of topoSortSteps(tSteps, tLinks, tStages)) {
      if (isBefore(s.stageId)) {
        planned.set(s.id, { start: doneDay, end: doneDay });
        continue;
      }
      const predEnds = tLinks
        .filter((l) => l.stepId === s.id && !isBefore(tSteps.find((x) => x.id === l.waitsForStepId)?.stageId ?? ''))
        .map((l) => planned.get(l.waitsForStepId)?.end ?? null);
      const latest = maxDate(...predEnds);
      const start = latest ? maxDate(startDate, nextWorkingDay(latest))! : startDate;
      planned.set(s.id, { start, end: stepEnd(start, s.durationDays) });
    }
    const steps: Step[] = tSteps.map((s) => {
      const p = planned.get(s.id)!;
      const before = isBefore(s.stageId);
      return {
        id: mapId(s.id, 'step'),
        jobId,
        stageId: mapId(s.stageId, 'stage'),
        name: s.name,
        order: s.order,
        durationDays: s.durationDays,
        plannedStart: p.start,
        plannedEnd: p.end,
        actualStart: before ? p.start : null,
        actualEnd: before ? p.end : null,
        status: before ? 'done' : 'not_started',
        isHoldPoint: s.isHoldPoint,
        isPlaceholder: s.isPlaceholder,
        tradeType: s.tradeType,
      };
    });
    const links: StepLink[] = tLinks.map((l) => ({
      id: mapId(l.id, 'link'),
      jobId,
      stepId: mapId(l.stepId, 'step'),
      waitsForStepId: mapId(l.waitsForStepId, 'step'),
    }));
    const reqs: Requirement[] = ds.requirements
      .filter((r) => r.jobId === tpl.id)
      .map((r) => ({ ...r, id: mapId(r.id, 'req'), jobId, stepId: mapId(r.stepId, 'step') }));
    const cats: PhotoCategory[] = ds.photoCategories
      .filter((c) => c.jobId === tpl.id)
      .map((c) => ({ ...c, id: mapId(c.id, 'pcat'), jobId, stageId: c.stageId ? mapId(c.stageId, 'stage') : null }));

    const job: Job = {
      id: jobId,
      sideId: a.side ? defaultSide(ds, ctx, a.side) : tpl.sideId,
      name: a.name,
      kind: tpl.kind,
      path: a.path ?? tpl.path,
      weeklyHoldingCost: a.weeklyHoldingCost ?? null,
      lastConfirmed: ctx.today,
      isTemplate: false,
      plannedFinish: maxDate(...steps.map((s) => s.plannedEnd)),
      startDate,
      startsFromStageId: fromStage ? mapId(fromStage.id, 'stage') : null,
      templateId: tpl.id,
      createdAt: ctx.today,
    };
    const changes: Change[] = [
      insert('job', job),
      ...stages.map((s) => insert('stage', s)),
      ...steps.map((s) => insert('step', s)),
      ...links.map((l) => insert('step_link', l)),
      ...reqs.map((r) => insert('requirement', r)),
      ...cats.map((c) => insert('photo_category', c)),
    ];
    return proposal(
      ctx,
      ds,
      changes,
      `New job ${a.name} from the ${tpl.name} template, starting ${ctx.fmt(startDate)}${fromStage ? ` at ${fromStage.name}` : ''}`,
    );
  },
});

export const SETUP_OPS = [
  copyTemplate,
  createJob,
  editJob,
  addStage,
  editStage,
  deleteStage,
  addStep,
  editStep,
  deleteStep,
  addLink,
  removeLink,
  addRequirement,
  addPhotoCategory,
  addTrade,
  editTrade,
  deleteTrade,
];
