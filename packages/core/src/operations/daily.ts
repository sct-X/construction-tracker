/**
 * Day-to-day operations: what the Telegram bot can do on Dominic's say-so.
 * Names are fuzzy-matched; a clash becomes a question, never a guess.
 */
import { z } from 'zod';
import { forecastJob, holdPointCheck, type HoldPointCheck } from '../calculator.js';
import type { Change } from '../changes.js';
import { ITEM_STATUSES, ITEM_STATUS_LABELS, ITEM_TYPES, ITEM_TYPE_LABELS, SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS, STAGE_STATUSES } from '../types.js';
import type { Dataset, Item, JsonValue, Stage } from '../types.js';
import {
  ask,
  dateArg,
  defineOp,
  insert,
  jobName,
  proposal,
  readDate,
  refuse,
  resolveCategory,
  resolveItem,
  resolveJob,
  resolveShipment,
  resolveStage,
  resolveStep,
  resolveTrade,
  update,
  OpStop,
  type OpRunContext,
} from './framework.js';
import { resolveDate } from '../relativeDates.js';
import { formatMoney } from '../money.js';
import { stageDisplayName } from '../readModelsTiming.js';

/** v1 copy rule (SPEC revision 2026-10-10): "With council" / "With certifier" read "Pending approval". */
const shownStage = (name: string): string => stageDisplayName(name) ?? name;

/** Runs a resolver; when it would refuse or ask, runs `instead` (which asks its own question). */
function asQuestion<T>(resolve: () => T, instead: () => never, keepQuestions = false): T {
  try {
    return resolve();
  } catch (e) {
    if (e instanceof OpStop && !(keepQuestions && e.result.kind === 'question')) instead();
    throw e;
  }
}

/** Rule 8: actual dates never go on a template's steps. */
function refuseTemplateStep(ds: Dataset, ctx: OpRunContext, jobId: string): void {
  const job = ds.jobs.find((j) => j.id === jobId);
  if (job?.isTemplate) refuse(ctx, `${job.name} is a template: it has no dates, so its steps can't be started or done.`);
}

const jobRef = z.string().describe('Job name as said, e.g. "Park Rd". Fuzzy-matched.');
const optionalJobRef = jobRef.optional();

export const setShipmentEta = defineOp({
  name: 'set_shipment_eta',
  group: 'daily',
  description:
    'Change when a shipment (e.g. the windows from overseas) is expected to arrive. Linked items take their expected date from it.',
  schema: z.object({
    shipment: z.string().describe('Shipment name as said, e.g. "the windows". Fuzzy-matched.'),
    job: optionalJobRef,
    eta: dateArg('New ETA'),
  }),
  ask: { shipment: 'Which shipment?', eta: 'What is the new ETA?' },
  run(ds, a, ctx) {
    const sh = resolveShipment(ds, ctx, a.shipment, a.job);
    const eta = readDate(ctx, a.eta);
    if (sh.eta === eta) refuse(ctx, `${sh.name} is already expected ${ctx.fmt(eta)}.`);
    const linked = ds.items.filter((i) => i.shipmentId === sh.id);
    return proposal(
      ctx,
      ds,
      update('shipment', sh, 'eta', eta),
      `${sh.name} ETA ${ctx.fmt(sh.eta)} to ${ctx.fmt(eta)}`,
      linked.map((i) => i.jobId),
    );
  },
});

export const setShipmentStatus = defineOp({
  name: 'set_shipment_status',
  group: 'daily',
  description: 'Move a shipment along: design, in production, shipped, delivered.',
  schema: z.object({
    shipment: z.string().describe('Shipment name as said. Fuzzy-matched.'),
    job: optionalJobRef,
    status: z.enum(SHIPMENT_STATUSES),
  }),
  ask: { shipment: 'Which shipment?', status: 'Where is it up to: design, in production, shipped or delivered?' },
  run(ds, a, ctx) {
    const sh = resolveShipment(ds, ctx, a.shipment, a.job);
    if (sh.status === a.status) refuse(ctx, `${sh.name} is already ${SHIPMENT_STATUS_LABELS[a.status].toLowerCase()}.`);
    return proposal(
      ctx,
      ds,
      update('shipment', sh, 'status', a.status),
      `${sh.name}: ${SHIPMENT_STATUS_LABELS[sh.status]} to ${SHIPMENT_STATUS_LABELS[a.status]}`,
    );
  },
});

export const markStepStarted = defineOp({
  name: 'mark_step_started',
  group: 'daily',
  description: 'Record that a program step has started on site.',
  schema: z.object({
    step: z.string().describe('Step name as said, e.g. "cladding". Fuzzy-matched.'),
    job: optionalJobRef,
    date: dateArg('The day it started (default today)').optional(),
  }),
  ask: { step: 'Which step?' },
  run(ds, a, ctx) {
    const step = resolveStep(ds, ctx, a.step, a.job);
    refuseTemplateStep(ds, ctx, step.jobId);
    if (step.status !== 'not_started') refuse(ctx, `${step.name} at ${jobName(ds, step.jobId)} is already ${step.status === 'done' ? 'done' : 'started'}.`);
    const date = a.date ? readDate(ctx, a.date, 'past') : ctx.today;
    return proposal(
      ctx,
      ds,
      [...update('step', step, 'status', 'in_progress'), ...update('step', step, 'actualStart', date)],
      `${step.name} at ${jobName(ds, step.jobId)} started ${ctx.fmt(date)}`,
    );
  },
});

/**
 * Rule 6 in plain words, naming the empty required categories:
 * "Can't sign off Slab inspection before pour yet. No photos for: Plumbing under slab, Membrane and termite barrier."
 */
export function holdPointSignOffRefusal(check: HoldPointCheck): string {
  return `Can't sign off ${check.stepName} yet. No photos for: ${check.missingCategories.join(', ')}.`;
}

export const markStepDone = defineOp({
  name: 'mark_step_done',
  group: 'daily',
  description:
    'Mark a program step done (e.g. "slab inspection is done"). A hold point is refused until every required photo category has a photo.',
  schema: z.object({
    step: z.string().describe('Step name as said, e.g. "slab inspection". Fuzzy-matched.'),
    job: optionalJobRef,
    date: dateArg('The day it finished (default today)').optional(),
  }),
  ask: { step: 'Which step?' },
  run(ds, a, ctx) {
    const step = resolveStep(ds, ctx, a.step, a.job);
    refuseTemplateStep(ds, ctx, step.jobId);
    const where = jobName(ds, step.jobId);
    if (step.status === 'done') refuse(ctx, `${step.name} at ${where} is already done.`);
    if (step.isHoldPoint) {
      const check = holdPointCheck(step, ds.photoCategories, ds.photos);
      if (!check.ok) refuse(ctx, holdPointSignOffRefusal(check));
    }
    const date = a.date ? readDate(ctx, a.date, 'past') : ctx.today;
    const changes: Change[] = [...update('step', step, 'status', 'done'), ...update('step', step, 'actualEnd', date)];
    if (!step.actualStart) {
      const f = forecastJob(ds, step.jobId, ctx.today).steps[step.id];
      const start = f && f.forecastStart <= date ? f.forecastStart : date;
      changes.push(...update('step', step, 'actualStart', start));
    }
    return proposal(ctx, ds, changes, `${step.name} at ${where} done ${ctx.fmt(date)}`);
  },
});

export const setItemStatus = defineOp({
  name: 'set_item_status',
  group: 'daily',
  description:
    'Move a waiting-on item along: to_do, ordered_or_booked, confirmed, done (e.g. "pump is booked", "tiles confirmed"). ' +
    'Booked or confirmed needs an expected date: pass expectedDate when the message says when it comes ("booked for Friday").',
  schema: z.object({
    item: z.string().describe('Item as said, e.g. "concrete pump". Fuzzy-matched against item titles and who it waits on.'),
    job: optionalJobRef,
    status: z.enum(ITEM_STATUSES),
    date: dateArg('When it happened (default today). Not when the trade comes or the delivery arrives: that is expectedDate').optional(),
    expectedDate: dateArg('When the trade comes or the delivery arrives, if the message says ("booked for Friday")').optional(),
  }),
  ask: { item: 'Which item?', status: 'Is it booked, confirmed or done?' },
  run(ds, a, ctx) {
    const item = resolveItem(ds, ctx, a.item, a.job);
    if (item.status === a.status) refuse(ctx, `${item.title} at ${jobName(ds, item.jobId)} is already ${ITEM_STATUS_LABELS[a.status].toLowerCase()}.`);
    const date = a.date ? readDate(ctx, a.date, 'past') : ctx.today;
    const changes: Change[] = update('item', item, 'status', a.status);
    if (a.status === 'confirmed') changes.push(...update('item', item, 'confirmedDate', date));
    if (a.status === 'done') changes.push(...update('item', item, 'doneAt', date));
    if (a.status !== 'done' && item.doneAt) changes.push(...update('item', item, 'doneAt', null));
    // v1 rule: booked (or confirmed) needs an expected date, its own or its shipment's ETA,
    // so a booked item with no date never looks overdue. Missing -> ask, never guess.
    const shipment = item.shipmentId ? ds.shipments.find((s) => s.id === item.shipmentId) : undefined;
    let expected: string | null = null;
    if (a.expectedDate) {
      if (shipment) refuse(ctx, `${item.title} takes its date from the ${shipment.name} ETA. Change the shipment ETA instead.`);
      expected = readDate(ctx, a.expectedDate);
      changes.push(...update('item', item, 'expectedDate', expected));
    } else if (NEEDS_EXPECTED.has(a.status) && !(shipment ? shipment.eta : item.expectedDate)) {
      if (shipment) {
        refuse(ctx, `${ITEM_STATUS_LABELS[a.status]} needs an expected date, and ${item.title} takes its date from the ${shipment.name} ETA, which isn't set. Give the shipment an ETA first.`);
      }
      ask(ctx, `${item.title} at ${jobName(ds, item.jobId)} needs an expected date to be ${ITEM_STATUS_LABELS[a.status].toLowerCase()}. When is it expected?`, 'expectedDate');
    }
    const when = expected ? `, expected ${ctx.fmt(expected)}` : '';
    return proposal(
      ctx,
      ds,
      changes,
      `${item.title} at ${jobName(ds, item.jobId)}: ${ITEM_STATUS_LABELS[item.status]} to ${ITEM_STATUS_LABELS[a.status]}${when}`,
    );
  },
});

/** Statuses that need an expected date (v1: "Ordered or booked needs an expected date"). */
const NEEDS_EXPECTED = new Set<string>(['ordered_or_booked', 'confirmed']);

export const setItemExpectedDate = defineOp({
  name: 'set_item_expected_date',
  group: 'daily',
  description:
    'Change when a waiting-on item is expected (e.g. "tiler can\'t start Beatty till 5 Oct"). Not for shipment items: change the shipment ETA.',
  schema: z.object({
    item: z.string().describe('Item as said, e.g. "the tiler". Fuzzy-matched.'),
    job: optionalJobRef,
    date: dateArg('New expected date'),
  }),
  ask: { item: 'Which item?', date: 'When is it expected now?' },
  run(ds, a, ctx) {
    const item = resolveItem(ds, ctx, a.item, a.job);
    if (item.shipmentId) {
      const sh = ds.shipments.find((s) => s.id === item.shipmentId);
      refuse(ctx, `${item.title} takes its date from the ${sh?.name ?? 'shipment'} ETA. Change the shipment ETA instead.`);
    }
    const date = readDate(ctx, a.date);
    if (item.expectedDate === date) refuse(ctx, `${item.title} is already expected ${ctx.fmt(date)}.`);
    return proposal(
      ctx,
      ds,
      update('item', item, 'expectedDate', date),
      `${item.title} at ${jobName(ds, item.jobId)} expected ${ctx.fmt(item.expectedDate)} to ${ctx.fmt(date)}`,
    );
  },
});

export const overrideLeadTime = defineOp({
  name: 'override_lead_time',
  group: 'daily',
  description: "Change one item's lead time in calendar weeks (e.g. \"tiles are 10 weeks now\"). Moves its act-by date.",
  schema: z.object({
    item: z.string().describe('Item as said. Fuzzy-matched.'),
    job: optionalJobRef,
    weeks: z.number().min(0).max(104).describe('Lead time in calendar weeks.'),
  }),
  ask: { item: 'Which item?', weeks: 'How many weeks is the lead time?' },
  run(ds, a, ctx) {
    const item = resolveItem(ds, ctx, a.item, a.job);
    const plural = (n: number | null) => (n === null ? 'the default' : `${n} week${n === 1 ? '' : 's'}`);
    return proposal(
      ctx,
      ds,
      update('item', item, 'leadTimeWeeks', a.weeks),
      `${item.title} at ${jobName(ds, item.jobId)} lead time ${plural(item.leadTimeWeeks)} to ${plural(a.weeks)}`,
    );
  },
});

export const addItem = defineOp({
  name: 'add_item',
  group: 'daily',
  description:
    'Add a waiting-on item to a job: a trade to book, material to order, decision, consultant report, council request, inspection, defect, condition of consent or reminder.',
  schema: z.object({
    job: jobRef,
    type: z.enum(ITEM_TYPES),
    title: z.string().min(1).max(200),
    waitingOn: z.string().optional().describe('Who or what it waits on, plain text.'),
    owner: z.string().optional().describe('Who chases it, plain text. Default "Dominic".'),
    trade: z.string().optional().describe('Trade from the directory, fuzzy-matched.'),
    step: z.string().optional().describe('Program step it is needed for, fuzzy-matched. Sets needed-by.'),
    neededBy: dateArg('Needed-by date when there is no step').optional(),
    expectedDate: dateArg('Expected date').optional(),
    leadTimeWeeks: z.number().min(0).max(104).optional(),
    notes: z.string().optional(),
  }),
  ask: { job: 'Which job is it for?', type: 'What kind of item is it?', title: 'What should I call it?' },
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    const step = a.step ? resolveStep(ds, ctx, a.step, job.id) : null;
    const trade = a.trade ? resolveTrade(ds, ctx, a.trade) : null;
    if (job.kind === 'build' && !step && !a.neededBy && a.type !== 'defect' && a.type !== 'manual_reminder') {
      ask(ctx, `Which step at ${job.name} is "${a.title}" needed for, or what date is it needed by?`, 'step');
    }
    const row: Item = {
      id: ctx.id('item'),
      jobId: job.id,
      type: a.type,
      title: a.title,
      waitingOn: a.waitingOn ?? trade?.name ?? null,
      owner: a.owner ?? 'Dominic',
      tradeId: trade?.id ?? null,
      neededBy: a.neededBy ? readDate(ctx, a.neededBy) : null,
      leadTimeWeeks: a.leadTimeWeeks ?? null,
      expectedDate: a.expectedDate ? readDate(ctx, a.expectedDate) : null,
      status: 'to_do',
      confirmedDate: null,
      notes: a.notes ?? null,
      stepId: step?.id ?? null,
      requirementId: null,
      shipmentId: null,
      photoId: null,
      createdAt: ctx.today,
      doneAt: null,
    };
    return proposal(
      ctx,
      ds,
      [insert('item', row as unknown as { id: string } & Record<string, JsonValue>)],
      `New ${ITEM_TYPE_LABELS[a.type].toLowerCase()} at ${job.name}: ${a.title}`,
    );
  },
});

export const addDailyNote = defineOp({
  name: 'add_daily_note',
  group: 'daily',
  description: 'Add a daily site note to a job (what happened on site, who was there, weather).',
  schema: z.object({
    job: jobRef,
    text: z.string().min(1).max(4000),
    date: dateArg('The day it is about (default today)').optional(),
    messageId: z.string().optional().describe('Inbound message id (set by the bot).'),
  }),
  ask: { job: 'Which job is the note for?', text: 'What should the note say?' },
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    const date = a.date ? readDate(ctx, a.date, 'past') : ctx.today;
    const row = { id: ctx.id('note'), jobId: job.id, date, text: a.text, createdAt: ctx.stamp(), messageId: a.messageId ?? null };
    return proposal(ctx, ds, [insert('daily_note', row)], `Daily note for ${job.name}, ${ctx.fmt(date)}`);
  },
});

/**
 * A stored photo path: relative to the photos folder, forward slashes, no ".." anywhere,
 * not absolute (no leading slash or backslash, no drive letter), no NUL.
 */
export function isSafePhotoPath(p: string): boolean {
  if (!p || p.includes('..') || p.includes('\\') || p.includes('\0')) return false;
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p) || /^[a-z][a-z0-9+.-]*:/i.test(p)) return false;
  return p.split('/').every((seg) => seg !== '' && seg !== '.');
}

export const attachPhoto = defineOp({
  name: 'attach_photo',
  group: 'daily',
  description:
    'File a photo Dominic sent under a job, stage and photo category (from the caption). Asks when the category is unclear.',
  schema: z.object({
    job: jobRef,
    category: z.string().optional().describe('Photo category as said, e.g. "plumbing under slab". Fuzzy-matched.'),
    stage: z.string().optional().describe('Stage as said, e.g. "slab". Fuzzy-matched.'),
    filePath: z.string().min(1).describe('Stored photo path relative to the photos folder (set by the bot).'),
    caption: z.string().optional(),
    takenOn: dateArg('Day the photo was taken (default today)').optional(),
    messageId: z.string().optional(),
  }),
  ask: { job: 'Which job is this photo for?' },
  // No caption (or no job in it): ask with a button per live job, never a bare question.
  askOptions: { job: (ds) => ds.jobs.filter((j) => !j.isTemplate).map((j) => ({ label: j.name, value: j.id })) },
  run(ds, a, ctx) {
    // SPEC Telegram 7: whatever the caption can't settle, ask; never refuse, so the photo isn't lost.
    const job = asQuestion(() => resolveJob(ds, ctx, a.job), () =>
      ask(
        ctx,
        `Which job is this photo for?`,
        'job',
        ds.jobs.filter((j) => !j.isTemplate).map((j) => ({ label: j.name, value: j.id })),
      ),
      true, // an ambiguous job already asks with the matching jobs
    );
    const allCats = ds.photoCategories.filter((c) => c.jobId === job.id).sort((x, y) => x.order - y.order);
    const stageName = (id: string | null) => {
      const n = ds.stages.find((s) => s.id === id)?.name;
      return n ? shownStage(n) : null;
    };
    const optionsFor = (cats: typeof allCats) => cats.map((c) => ({ label: stageName(c.stageId) ? `${stageName(c.stageId)}: ${c.name}` : c.name, value: c.id }));
    const askCategory = (stage: Stage | null, cats = allCats): never =>
      ask(ctx, `Which photo category at ${job.name}${stage ? `, ${shownStage(stage.name)}` : ''}?`, 'category', optionsFor(cats));
    // An unmatched stage is not fatal: the category question covers the whole job.
    const stage: Stage | null = a.stage ? asQuestion(() => resolveStage(ds, ctx, a.stage!, job), () => askCategory(null)) : null;
    const pool = stage ? allCats.filter((c) => c.stageId === stage.id || c.stageId === null) : allCats;
    const staged = stage ? pool.filter((c) => c.stageId === stage.id) : [];
    const category = a.category
      ? asQuestion(() => resolveCategory(ds, ctx, a.category!, job, stage), () => askCategory(stage, pool))
      : staged.length === 1
        ? staged[0]!
        : askCategory(stage, pool);
    // The path is relative to the photos folder and set by the bot from a file it stored; never outside it.
    if (!isSafePhotoPath(a.filePath)) refuse(ctx, `That photo path isn't inside the photos folder ("${a.filePath}"). Send the photo itself.`);
    const row = {
      id: ctx.id('photo'),
      jobId: job.id,
      stageId: category.stageId,
      categoryId: category.id,
      filePath: a.filePath,
      caption: a.caption ?? null,
      takenOn: a.takenOn ? (resolveDate(a.takenOn, ctx.today, { prefer: 'past' }) ?? ctx.today) : ctx.today,
      receivedAt: ctx.stamp(),
      isPlaceholder: false,
      messageId: a.messageId ?? null,
    };
    const sn = stageName(category.stageId);
    return proposal(ctx, ds, [insert('photo', row)], `Photo filed: ${job.name}, ${sn ? `${sn}, ` : ''}${category.name}`);
  },
});

export const confirmJob = defineOp({
  name: 'confirm_job',
  group: 'daily',
  description: 'Stamp a job as confirmed today (figures checked with the builder). Clears the "not confirmed for over 7 days" warning.',
  schema: z.object({
    job: jobRef,
    date: dateArg('Day it was confirmed (default today)').optional(),
  }),
  ask: { job: 'Which job did you confirm?' },
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    const date = a.date ? readDate(ctx, a.date, 'past') : ctx.today;
    if (job.lastConfirmed === date) refuse(ctx, `${job.name} is already confirmed ${ctx.fmt(date)}.`);
    return proposal(ctx, ds, update('job', job, 'lastConfirmed', date), `${job.name} confirmed ${ctx.fmt(date)}`);
  },
});

export const setStageStatus = defineOp({
  name: 'set_stage_status',
  group: 'daily',
  description: 'Tick a design-job stage (design checklist): not_started, in_progress or done (e.g. "West St DA is with council" = the "With council" stage, shown as "Pending approval").',
  schema: z.object({
    job: jobRef,
    stage: z.string().describe('Stage name as said. Fuzzy-matched.'),
    status: z.enum(STAGE_STATUSES),
  }),
  ask: { job: 'Which job?', stage: 'Which stage?', status: 'Is it started or done?' },
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    if (job.kind !== 'design') refuse(ctx, `${job.name} is a build: its stages follow its steps. Mark the steps instead.`);
    const stage = resolveStage(ds, ctx, a.stage, job);
    const words = { not_started: 'not started', in_progress: 'in progress', done: 'done' } as const;
    const shown = shownStage(stage.name);
    if (stage.status === a.status) refuse(ctx, `${shown} at ${job.name} is already ${words[a.status]}.`);
    return proposal(ctx, ds, update('stage', stage, 'status', a.status), `${job.name}: ${shown} ${words[a.status]}`);
  },
});

/** "$4,500 a week". */
function weeklyWords(n: number): string {
  return `${formatMoney(n)} a week`;
}

export const setHoldingCost = defineOp({
  name: 'set_holding_cost',
  group: 'daily',
  description:
    "Set a build job's weekly holding cost in dollars (what a week of delay costs: finance, rent, site costs), e.g. \"Park Rd holding cost is 4500 a week\". The confirm card prices a slip with it. 0 means none.",
  schema: z.object({
    job: jobRef,
    dollars: z.number().min(0).max(1_000_000).describe('Dollars per week, a plain number (4500, not "$4.5k").'),
  }),
  ask: { job: 'Which job?', dollars: 'How much a week?' },
  run(ds, a, ctx) {
    const job = resolveJob(ds, ctx, a.job);
    if (job.isTemplate) refuse(ctx, `${job.name} is a template: a job made from it gets its own holding cost.`);
    if (job.kind !== 'build') refuse(ctx, `${job.name} is a design job: it has no program, so no holding cost.`);
    const dollars = Math.round(a.dollars);
    const next = dollars === 0 ? null : dollars;
    if (job.weeklyHoldingCost === next) refuse(ctx, next === null ? `${job.name} already has no holding cost.` : `${job.name}'s holding cost is already ${weeklyWords(next)}.`);
    const was = job.weeklyHoldingCost === null ? 'none before' : `was ${formatMoney(job.weeklyHoldingCost)}`;
    const summary = next === null ? `${job.name} holding cost removed (${was})` : `${job.name} holding cost ${weeklyWords(next)} (${was})`;
    return proposal(ctx, ds, update('job', job, 'weeklyHoldingCost', next), summary);
  },
});

export const DAILY_OPS = [
  setShipmentEta,
  setShipmentStatus,
  markStepStarted,
  markStepDone,
  setItemStatus,
  setItemExpectedDate,
  overrideLeadTime,
  addItem,
  addDailyNote,
  attachPhoto,
  confirmJob,
  setStageStatus,
  setHoldingCost,
];
