/**
 * TrackerApi over an in-memory store persisted to localStorage under one key,
 * seeded from src/seed on first run or after reset().
 *
 * Every read is scoped by the session's side and role; the site role has every
 * MONEY_FIELD deleted recursively. Every mutation logs activity and notifies
 * subscribers.
 */
import type {
  ActivityEntry,
  ActivityKind,
  DailyNote,
  ForecastSnapshot,
  Item,
  Job,
  Membership,
  Notification,
  NotificationKind,
  Person,
  Photo,
  PhotoCategory,
  PushSubscriptionRecord,
  Requirement,
  Role,
  SeedData,
  Shipment,
  Stage,
  StageStatus,
  Step,
  StepLink,
  StepStatus,
  Trade,
} from '../domain/types';
import { ITEM_STATUS_LABELS, ITEM_STATUS_ORDER, SHIPMENT_STATUS_LABELS } from '../domain/types';
import type { EtaPreview, ForecastBundle, JobForecast } from '../domain/forecast';
import { forecastJob, holdPointCheck, holdPointReadinessWords, holdPointRefusalText, overdueCount, previewEtaChange, topWaitingOn } from '../domain/forecast';
import {
  addCalendarWeeks,
  calendarDaysBetween,
  formatDayMonth,
  formatShort,
  lastMonday,
  maxDate,
  nextWorkingDay,
  previousWorkingDay,
  snapToWorkingDay,
  stepEnd,
  formatShortRelative,
} from '../domain/dates';
import { slipCostFor, stripMoney } from '../domain/money';
import { BOOKED_NEEDS_DATE, needsExpectedDate } from '../domain/itemFlow';
import { buildSeed, SEED_VERSION } from '../seed';
import type { CopyTemplateInput, JobListOptions, Listener, NextStep, NewPhotoInput, OverviewRow, ProgramPreview, ScreenKey, StepStatusResult, TrackerApi } from './api';
import { NOTIFICATION_PREF_KEYS, SCREEN_ACCESS } from './api';
import type { NotificationPrefs } from './api';
import { defaultStorage, type KeyValueStorage } from './storage';
import { loadSession, saveSession, type Session } from './session';
import { createPhotoQueue, type PhotoQueue, type QueuedPhoto } from './photoQueue';

export const DATA_KEY = 'construction-tracker.data.v1';

interface Store {
  seedVersion: number;
  data: SeedData;
  /** Notification preferences by person id (UI_PLAN 3.19); absent keys fall back to the person's flag. */
  prefs?: Record<string, Partial<NotificationPrefs>>;
  /** Stamp of the last write (settings' "last sync"). */
  lastSync?: string;
}

export interface MockApiOptions {
  storage?: KeyValueStorage;
  session?: Partial<Session>;
  photoQueue?: PhotoQueue;
  /** Real clock for activity timestamps (the date part is always the session's today). */
  clock?: () => Date;
}

const DESIGN_STAGES: Record<'DA' | 'CDC', string[]> = {
  DA: ['Design', 'Pending approval', 'Approved', 'Construction certificate'],
  CDC: ['Design', 'Pending approval', 'Approved'],
};

export function createMockApi(options: MockApiOptions = {}): TrackerApi {
  const storage = options.storage ?? defaultStorage();
  const queue = options.photoQueue ?? createPhotoQueue();
  const clock = options.clock ?? (() => new Date());
  const listeners = new Set<Listener>();

  // ---- store ----
  let store: Store = load();

  function load(): Store {
    try {
      const raw = storage.getItem(DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Store;
        if (parsed && parsed.seedVersion === SEED_VERSION && parsed.data) return parsed;
      }
    } catch {
      /* reseed */
    }
    const fresh: Store = { seedVersion: SEED_VERSION, data: buildSeed() };
    persist(fresh);
    return fresh;
  }

  function persist(s: Store = store): void {
    try {
      storage.setItem(DATA_KEY, JSON.stringify(s));
    } catch {
      /* storage blocked: keep going in memory */
    }
  }

  const d = () => store.data;

  // ---- session ----
  let session: Session = { ...loadSession(storage), ...options.session };
  if (!options.session?.sideId) session.sideId = firstSideFor(session.personId) ?? session.sideId;
  saveSession(storage, session);

  function firstSideFor(personId: string): string | undefined {
    const m = d().memberships.find((m) => m.personId === personId);
    return m?.sideId;
  }

  function notify(): void {
    for (const l of listeners) l();
  }

  function commit(): void {
    store.lastSync = stamp();
    persist();
    notify();
  }

  // ---- scoping ----
  function role(): Role | undefined {
    return d().memberships.find((m) => m.personId === session.personId && m.sideId === session.sideId)?.role;
  }

  function isSite(): boolean {
    return role() === 'site';
  }

  /** Copy out of the store, minus money for the site role. */
  function scoped<T>(value: T): T {
    const copy = JSON.parse(JSON.stringify(value)) as T;
    return isSite() ? stripMoney(copy) : copy;
  }

  function onSide<T extends { sideId: string }>(rows: T[]): T[] {
    return rows.filter((r) => r.sideId === session.sideId);
  }

  function visibleJobIds(): Set<string> {
    return new Set(visibleJobs({ includeTemplates: true }).map((j) => j.id));
  }

  function visibleJobs(opts: JobListOptions = {}): Job[] {
    let jobs = onSide(d().jobs);
    if (!opts.includeTemplates) jobs = jobs.filter((j) => !j.isTemplate);
    if (isSite()) jobs = jobs.filter((j) => j.kind === 'build');
    if (opts.kind) jobs = jobs.filter((j) => j.kind === opts.kind);
    return jobs;
  }

  function requireJob(id: string): Job {
    const job = d().jobs.find((j) => j.id === id && j.sideId === session.sideId);
    if (!job) throw new Error(`No job ${id} on this side`);
    return job;
  }

  function stamp(): string {
    const now = clock();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${session.today}T${p(now.getHours())}:${p(now.getMinutes())}`;
  }

  let idCounter = 0;
  function newId(prefix: string): string {
    idCounter++;
    return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
  }

  function log(
    kind: ActivityKind,
    text: string,
    refs: Partial<Pick<ActivityEntry, 'jobId' | 'itemId' | 'stepId' | 'shipmentId' | 'photoId' | 'from' | 'to'>> = {},
  ): ActivityEntry {
    const entry: ActivityEntry = {
      id: newId('act'),
      sideId: session.sideId,
      kind,
      at: stamp(),
      personId: session.personId,
      text,
      ...refs,
    };
    d().activity.push(entry);
    return entry;
  }

  function raise(personId: string, kind: NotificationKind, text: string, refs: Partial<Notification> = {}): Notification {
    const n: Notification = {
      id: newId('nt'),
      sideId: session.sideId,
      personId,
      kind,
      at: stamp(),
      text,
      read: false,
      ...refs,
    };
    d().notifications.push(n);
    return n;
  }

  // ---- forecast ----
  function bundleFor(job: Job): ForecastBundle {
    const data = d();
    return {
      job,
      stages: data.stages.filter((s) => s.jobId === job.id),
      steps: data.steps.filter((s) => s.jobId === job.id),
      links: data.stepLinks.filter((l) => l.jobId === job.id),
      requirements: data.requirements.filter((r) => r.jobId === job.id),
      items: data.items.filter((i) => i.jobId === job.id),
      shipments: data.shipments.filter((s) => s.jobId === job.id),
      snapshots: data.snapshots.filter((s) => s.jobId === job.id),
      photoCategories: data.photoCategories.filter((c) => c.jobId === job.id),
      photos: data.photos.filter((p) => p.jobId === job.id),
      activity: data.activity.filter((a) => a.jobId === job.id),
      people: data.people,
      today: session.today,
    };
  }

  function rawForecast(jobId: string): JobForecast | undefined {
    const job = d().jobs.find((j) => j.id === jobId && j.sideId === session.sideId);
    if (!job || job.isTemplate) return undefined;
    return forecastJob(bundleFor(job));
  }

  // ---- program helpers ----
  function recomputePlannedEnd(step: Step): void {
    step.plannedEnd = step.plannedStart ? stepEnd(step.plannedStart, step.durationDays) : undefined;
  }

  function nextOrder(rows: { order: number }[]): number {
    return rows.reduce((m, r) => Math.max(m, r.order), 0) + 1;
  }

  function requireStep(id: string): Step {
    const step = d().steps.find((s) => s.id === id && s.sideId === session.sideId);
    if (!step) throw new Error(`No step ${id}`);
    return step;
  }

  function requireItem(id: string): Item {
    const item = d().items.find((i) => i.id === id && i.sideId === session.sideId);
    if (!item) throw new Error(`No item ${id}`);
    return item;
  }

  function requireShipment(id: string): Shipment {
    const sh = d().shipments.find((s) => s.id === id && s.sideId === session.sideId);
    if (!sh) throw new Error(`No shipment ${id}`);
    return sh;
  }

  function jobName(jobId: string): string {
    return d().jobs.find((j) => j.id === jobId)?.name ?? jobId;
  }

  function insertPhoto(input: NewPhotoInput, uploadedById: string, sideId: string = session.sideId): Photo {
    requireJob(input.jobId);
    const photo: Photo = {
      id: newId('ph'),
      sideId,
      jobId: input.jobId,
      stageId: input.stageId,
      categoryId: input.categoryId,
      uploadedById,
      uploadedAt: stamp(),
      takenOn: input.takenOn ?? session.today,
      dataUrl: input.dataUrl,
      caption: input.caption,
    };
    d().photos.push(photo);
    const cat = d().photoCategories.find((c) => c.id === input.categoryId);
    const stage = input.stageId ? d().stages.find((s) => s.id === input.stageId) : undefined;
    log('photo_added', `Added a photo to ${jobName(input.jobId)}${stage ? `, ${stage.name}` : ''}${cat ? `, ${cat.name}` : ''}`, {
      jobId: input.jobId,
      photoId: photo.id,
    });
    return photo;
  }

  /**
   * Rule 8: what copying a template into a dated job makes. Stages before
   * "starts from" are done with planned start = end = the working day before
   * the start date; the rest run forward from the start date through the
   * links. Design templates give checklist stages only (rule 9). Pure over the
   * store: nothing is pushed, so `previewTemplate` can call it too.
   */
  function planCopy(
    tpl: Job,
    input: CopyTemplateInput,
  ): { job: Job; stages: Stage[]; steps: Step[]; links: StepLink[]; requirements: Requirement[]; categories: PhotoCategory[] } {
    const data = d();
    const sideId = input.sideId ?? session.sideId;
    const job: Job = {
      id: newId('job'),
      sideId,
      name: input.name,
      address: input.address,
      kind: tpl.kind,
      path: input.path ?? tpl.path,
      weeklyHoldingCost: input.weeklyHoldingCost,
      startDate: input.startDate,
      // Made today by the person who knows the program: confirmed as of today (rule 7's clock starts now).
      lastConfirmed: session.today,
      isTemplate: false,
      templateId: tpl.id,
      createdAt: session.today,
    };
    const stageMap = new Map<string, string>();
    const stepMap = new Map<string, string>();
    const tplStages = data.stages.filter((s) => s.jobId === tpl.id).sort((a, b) => a.order - b.order);
    const fromIndex = input.startsFromStageId ? Math.max(0, tplStages.findIndex((s) => s.id === input.startsFromStageId)) : 0;
    const newStages: Stage[] = tplStages.map((s, i) => {
      const id = newId('stage');
      stageMap.set(s.id, id);
      const status = i < fromIndex ? 'done' : i === fromIndex && tpl.kind === 'design' ? 'in_progress' : 'not_started';
      return { id, sideId, jobId: job.id, name: s.name, order: s.order, status };
    });
    if (fromIndex > 0) job.startsFromStageId = stageMap.get(tplStages[fromIndex].id);
    const doneStageIds = new Set(newStages.filter((s) => s.status === 'done').map((s) => s.id));
    const tplSteps = tpl.kind === 'design' ? [] : data.steps.filter((s) => s.jobId === tpl.id);
    const newSteps: Step[] = tplSteps.map((s) => {
      const id = newId('step');
      stepMap.set(s.id, id);
      const stageId = stageMap.get(s.stageId)!;
      return {
        id,
        sideId,
        jobId: job.id,
        stageId,
        name: s.name,
        order: s.order,
        durationDays: s.durationDays,
        status: doneStageIds.has(stageId) ? 'done' : 'not_started',
        isHoldPoint: s.isHoldPoint,
        isPlaceholder: s.isPlaceholder,
        tradeType: s.tradeType,
      };
    });
    const newLinks: StepLink[] = data.stepLinks
      .filter((l) => l.jobId === tpl.id && stepMap.has(l.stepId) && stepMap.has(l.waitsForStepId))
      .map((l) => ({ id: newId('link'), sideId, jobId: job.id, stepId: stepMap.get(l.stepId)!, waitsForStepId: stepMap.get(l.waitsForStepId)! }));
    const newReqs: Requirement[] = data.requirements
      .filter((r) => r.jobId === tpl.id && stepMap.has(r.stepId))
      .map((r) => ({ ...r, id: newId('rq'), sideId, jobId: job.id, stepId: stepMap.get(r.stepId)! }));
    const newCats: PhotoCategory[] = data.photoCategories
      .filter((c) => c.jobId === tpl.id)
      .map((c) => ({ ...c, id: newId('pc'), sideId, jobId: job.id, stageId: c.stageId ? stageMap.get(c.stageId)! : null }));
    if (!newCats.some((c) => c.stageId === null)) {
      newCats.push({ id: newId('pc'), sideId, jobId: job.id, stageId: null, name: 'General', requiredForHoldPoint: false, order: 1 });
    }

    // Planned dates run forward from the start date. Steps in earlier stages are done the day before.
    const before = previousWorkingDay(input.startDate);
    const preds = new Map<string, string[]>();
    for (const l of newLinks) {
      if (!preds.has(l.stepId)) preds.set(l.stepId, []);
      preds.get(l.stepId)!.push(l.waitsForStepId);
    }
    const stageOrder = new Map(newStages.map((s) => [s.id, s.order]));
    const remaining = [...newSteps].sort((a, b) => stageOrder.get(a.stageId)! - stageOrder.get(b.stageId)! || a.order - b.order);
    const placed = new Set<string>();
    const byId = new Map(newSteps.map((s) => [s.id, s]));
    let guard = 0;
    while (remaining.length && guard++ < 10_000) {
      const idx = remaining.findIndex((s) => (preds.get(s.id) ?? []).every((p) => placed.has(p)));
      const step = remaining.splice(idx < 0 ? 0 : idx, 1)[0];
      if (step.status === 'done') {
        step.plannedStart = before;
        step.plannedEnd = before;
      } else {
        const predEnds = (preds.get(step.id) ?? []).map((p) => byId.get(p)!.plannedEnd);
        const latest = maxDate(...predEnds);
        step.plannedStart = latest && latest >= input.startDate ? nextWorkingDay(latest) : snapToWorkingDay(input.startDate);
        recomputePlannedEnd(step);
      }
      placed.add(step.id);
    }
    job.plannedFinish = maxDate(...newSteps.map((s) => s.plannedEnd));
    return { job, stages: newStages, steps: newSteps, links: newLinks, requirements: newReqs, categories: newCats };
  }

  // ---- the api ----
  const api: TrackerApi = {
    getSession() {
      return { ...session };
    },
    setSession(patch) {
      const next = { ...session, ...patch };
      if (patch.personId && !patch.sideId) {
        const stillMember = d().memberships.some((m) => m.personId === next.personId && m.sideId === next.sideId);
        if (!stillMember) next.sideId = firstSideFor(next.personId) ?? next.sideId;
      }
      session = next;
      saveSession(storage, session);
      notify();
    },
    signedIn() {
      return !!session.personId && d().people.some((p) => p.id === session.personId);
    },
    listSignIns() {
      return scoped(
        d().people.map((person) => ({
          person,
          roles: d()
            .memberships.filter((m) => m.personId === person.id)
            .map((m) => ({ side: d().sides.find((s) => s.id === m.sideId)!, role: m.role }))
            .filter((r) => r.side),
        })),
      );
    },
    whoami() {
      const person = d().people.find((p) => p.id === session.personId) ?? d().people[0];
      const r = role() ?? 'site';
      const side = d().sides.find((s) => s.id === session.sideId) ?? d().sides[0];
      const sides = d()
        .memberships.filter((m) => m.personId === person.id)
        .map((m) => d().sides.find((s) => s.id === m.sideId)!)
        .filter(Boolean);
      return { person: scoped(person), role: r, side: scoped(side), sides: scoped(sides) };
    },
    canSee(screen: ScreenKey) {
      const r = role();
      return !!r && SCREEN_ACCESS[screen].includes(r);
    },

    // ---- people ----
    listSides() {
      return scoped(d().sides);
    },
    listPeople() {
      const memberIds = new Set(onSide(d().memberships).map((m) => m.personId));
      return scoped(d().people.filter((p) => memberIds.has(p.id)));
    },
    getPerson(id) {
      const p = d().people.find((p) => p.id === id);
      return p ? scoped(p) : undefined;
    },
    listMemberships() {
      return scoped(onSide(d().memberships));
    },
    addPerson(input) {
      const person: Person = { id: newId('person'), ...input };
      d().people.push(person);
      log('person_edited', `Added ${person.name}`);
      commit();
      return scoped(person);
    },
    updatePerson(id, patch) {
      const person = d().people.find((p) => p.id === id);
      if (!person) throw new Error(`No person ${id}`);
      Object.assign(person, patch);
      log('person_edited', `Updated ${person.name}`);
      commit();
      return scoped(person);
    },
    removePerson(id) {
      const data = d();
      data.people = data.people.filter((p) => p.id !== id);
      data.memberships = data.memberships.filter((m) => m.personId !== id);
      log('person_edited', `Removed a person`);
      commit();
    },
    setMembership(personId, sideId, r) {
      const data = d();
      data.memberships = data.memberships.filter((m) => !(m.personId === personId && m.sideId === sideId));
      if (r) data.memberships.push({ id: newId('m'), personId, sideId, role: r } as Membership);
      const person = data.people.find((p) => p.id === personId);
      log('person_edited', r ? `${person?.name ?? personId} is now ${r}` : `${person?.name ?? personId} removed from side`);
      commit();
    },
    getNotificationPrefs(personId = session.personId) {
      const person = d().people.find((p) => p.id === personId);
      const fallback = person?.notificationsEnabled ?? true;
      const stored = store.prefs?.[personId] ?? {};
      const out = {} as NotificationPrefs;
      for (const key of NOTIFICATION_PREF_KEYS) out[key] = stored[key] ?? fallback;
      return out;
    },
    setNotificationPref(key, enabled, personId = session.personId) {
      store.prefs = store.prefs ?? {};
      store.prefs[personId] = { ...store.prefs[personId], [key]: enabled };
      commit();
      return api.getNotificationPrefs(personId);
    },
    listPushSubscriptions(personId = session.personId) {
      return scoped(d().pushSubscriptions.filter((s) => s.personId === personId));
    },
    savePushSubscription(input) {
      const data = d();
      const existing = data.pushSubscriptions.find((s) => s.personId === session.personId && s.device === input.device);
      const record: PushSubscriptionRecord = existing ?? { id: newId('push'), sideId: session.sideId, personId: session.personId, device: input.device, subscription: '', enabled: true };
      record.subscription = input.subscription;
      record.enabled = input.enabled ?? true;
      if (!existing) data.pushSubscriptions.push(record);
      const person = data.people.find((p) => p.id === session.personId);
      if (person) person.notificationsEnabled = record.enabled;
      log('person_edited', `${person?.shortName ?? 'Someone'} ${record.enabled ? 'allowed' : 'turned off'} notifications on ${input.device}`);
      commit();
      return scoped(record);
    },

    // ---- jobs ----
    listJobs(opts) {
      return scoped(visibleJobs(opts));
    },
    listTemplates() {
      return scoped(onSide(d().jobs).filter((j) => j.isTemplate));
    },
    getJob(id) {
      const job = d().jobs.find((j) => j.id === id && j.sideId === session.sideId);
      if (!job || (isSite() && job.kind !== 'build')) return undefined;
      return scoped(job);
    },
    addJob(input) {
      const job: Job = {
        id: newId('job'),
        sideId: input.sideId ?? session.sideId,
        name: input.name,
        address: input.address,
        kind: input.kind,
        path: input.path,
        weeklyHoldingCost: input.weeklyHoldingCost,
        startDate: input.isTemplate ? undefined : input.startDate,
        plannedFinish: input.isTemplate ? undefined : input.plannedFinish,
        lastConfirmed: input.isTemplate ? undefined : session.today,
        isTemplate: !!input.isTemplate,
        createdAt: session.today,
      };
      d().jobs.push(job);
      if (job.kind === 'design') {
        const names = DESIGN_STAGES[job.path ?? 'DA'];
        names.forEach((name, i) =>
          d().stages.push({ id: newId('stage'), sideId: job.sideId, jobId: job.id, name, order: i + 1, status: i === 0 ? 'in_progress' : 'not_started' }),
        );
      }
      d().photoCategories.push({ id: newId('pc'), sideId: job.sideId, jobId: job.id, stageId: null, name: 'General', requiredForHoldPoint: false, order: 1 });
      log('job_added', job.isTemplate ? `Created the ${job.name} template` : `Created ${job.name}`, { jobId: job.id });
      commit();
      return scoped(job);
    },
    updateJob(id, patch) {
      const job = requireJob(id);
      Object.assign(job, patch);
      log('job_edited', `Updated ${job.name}`, { jobId: job.id });
      commit();
      return scoped(job);
    },
    copyTemplate(templateId, input) {
      const tpl = requireJob(templateId);
      const data = d();
      const plan = planCopy(tpl, input);
      data.jobs.push(plan.job);
      data.stages.push(...plan.stages);
      data.steps.push(...plan.steps);
      data.stepLinks.push(...plan.links);
      data.requirements.push(...plan.requirements);
      data.photoCategories.push(...plan.categories);
      log('job_added', `Created ${plan.job.name} from the ${tpl.name} template`, { jobId: plan.job.id });
      commit();
      return scoped(plan.job);
    },
    previewTemplate(templateId, input) {
      const tpl = requireJob(templateId);
      const plan = planCopy(tpl, { name: tpl.name, startDate: input.startDate, startsFromStageId: input.startsFromStageId });
      return {
        templateId,
        plannedFinish: plan.job.plannedFinish,
        startsOn: snapToWorkingDay(input.startDate),
        stageCount: plan.stages.length,
        stagesDone: plan.stages.filter((s) => s.status === 'done').length,
        stepCount: plan.steps.length,
      };
    },
    saveJobAsTemplate(jobId, name) {
      const source = requireJob(jobId);
      const data = d();
      const sideId = source.sideId;
      const tpl: Job = {
        id: newId('tpl'),
        sideId,
        name,
        kind: source.kind,
        path: source.path,
        isTemplate: true,
        createdAt: session.today,
      };
      const stageMap = new Map<string, string>();
      const stepMap = new Map<string, string>();
      const stages: Stage[] = data.stages
        .filter((s) => s.jobId === source.id)
        .sort((a, b) => a.order - b.order)
        .map((s) => {
          const id = newId('stage');
          stageMap.set(s.id, id);
          return { id, sideId, jobId: tpl.id, name: s.name, order: s.order, status: 'not_started' };
        });
      // Design jobs carry checklist stages only (rule 9).
      const steps: Step[] =
        source.kind === 'design'
          ? []
          : data.steps
              .filter((s) => s.jobId === source.id)
              .map((s) => {
                const id = newId('step');
                stepMap.set(s.id, id);
                return {
                  id,
                  sideId,
                  jobId: tpl.id,
                  stageId: stageMap.get(s.stageId)!,
                  name: s.name,
                  order: s.order,
                  durationDays: s.durationDays,
                  status: 'not_started',
                  isHoldPoint: s.isHoldPoint,
                  isPlaceholder: s.isPlaceholder,
                  tradeType: s.tradeType,
                };
              });
      const links: StepLink[] = data.stepLinks
        .filter((l) => l.jobId === source.id && stepMap.has(l.stepId) && stepMap.has(l.waitsForStepId))
        .map((l) => ({ id: newId('link'), sideId, jobId: tpl.id, stepId: stepMap.get(l.stepId)!, waitsForStepId: stepMap.get(l.waitsForStepId)! }));
      const requirements: Requirement[] = data.requirements
        .filter((r) => r.jobId === source.id && stepMap.has(r.stepId))
        .map((r) => ({ ...r, id: newId('rq'), sideId, jobId: tpl.id, stepId: stepMap.get(r.stepId)! }));
      const categories: PhotoCategory[] = data.photoCategories
        .filter((c) => c.jobId === source.id)
        .map((c) => ({ ...c, id: newId('pc'), sideId, jobId: tpl.id, stageId: c.stageId ? stageMap.get(c.stageId)! : null }));
      data.jobs.push(tpl);
      data.stages.push(...stages);
      data.steps.push(...steps);
      data.stepLinks.push(...links);
      data.requirements.push(...requirements);
      data.photoCategories.push(...categories);
      log('job_added', `Saved ${source.name} as the ${tpl.name} template`, { jobId: tpl.id });
      commit();
      return scoped(tpl);
    },
    confirmJob(jobId, date) {
      const job = requireJob(jobId);
      job.lastConfirmed = date ?? session.today;
      log('job_confirmed', `Confirmed ${job.name}`, { jobId: job.id });
      commit();
      return scoped(job);
    },
    finishCall(input) {
      const caller = d().people.find((p) => p.id === session.personId);
      const callee = d().people.find((p) => p.id === input.personId);
      const jobs: Job[] = [];
      const activity: ActivityEntry[] = [];
      for (const { jobId, itemsUpdated } of input.jobs) {
        const job = requireJob(jobId);
        job.lastConfirmed = session.today;
        const changed = itemsUpdated === 0 ? 'nothing changed' : `${itemsUpdated} item${itemsUpdated === 1 ? '' : 's'} updated`;
        const text = `${caller?.shortName ?? 'Someone'} rang ${callee?.shortName ?? 'someone'}: ${changed} on ${job.name}`;
        activity.push(log('job_confirmed', text, { jobId: job.id }));
        jobs.push(job);
      }
      commit();
      return { jobs: scoped(jobs), activity: scoped(activity) };
    },
    listStages(jobId) {
      if (!visibleJobIds().has(jobId)) return [];
      return scoped(d().stages.filter((s) => s.jobId === jobId).sort((a, b) => a.order - b.order));
    },
    addStage(input) {
      const job = requireJob(input.jobId);
      const stages = d().stages.filter((s) => s.jobId === job.id).sort((a, b) => a.order - b.order);
      const order = input.order ?? nextOrder(stages);
      for (const s of stages) if (s.order >= order) s.order++;
      const stage: Stage = { id: newId('stage'), sideId: job.sideId, jobId: job.id, name: input.name, order, status: 'not_started' };
      d().stages.push(stage);
      log('program_edited', `Added stage ${stage.name} to ${job.name}`, { jobId: job.id });
      commit();
      return scoped(stage);
    },
    updateStage(id, patch) {
      const stage = d().stages.find((s) => s.id === id && s.sideId === session.sideId);
      if (!stage) throw new Error(`No stage ${id}`);
      const from = stage.status;
      Object.assign(stage, patch);
      if (patch.status && patch.status !== from) {
        const words: Record<StageStatus, string> = { not_started: 'reset to not started', in_progress: 'under way', done: 'done' };
        log('program_edited', `${stage.name} ${words[patch.status]} on ${jobName(stage.jobId)}`, { jobId: stage.jobId, from, to: patch.status });
      } else {
        log('program_edited', `Updated stage ${stage.name} on ${jobName(stage.jobId)}`, { jobId: stage.jobId });
      }
      commit();
      return scoped(stage);
    },
    deleteStage(id) {
      const data = d();
      const stage = data.stages.find((s) => s.id === id);
      if (!stage) return;
      const stepIds = new Set(data.steps.filter((s) => s.stageId === id).map((s) => s.id));
      data.steps = data.steps.filter((s) => s.stageId !== id);
      data.stepLinks = data.stepLinks.filter((l) => !stepIds.has(l.stepId) && !stepIds.has(l.waitsForStepId));
      data.requirements = data.requirements.filter((r) => !stepIds.has(r.stepId));
      data.photoCategories = data.photoCategories.filter((c) => c.stageId !== id);
      for (const i of data.items) if (i.stepId && stepIds.has(i.stepId)) i.stepId = undefined;
      data.stages = data.stages.filter((s) => s.id !== id);
      log('program_edited', `Deleted stage ${stage.name}`, { jobId: stage.jobId });
      commit();
    },
    reorderStages(jobId, orderedIds) {
      orderedIds.forEach((id, i) => {
        const s = d().stages.find((s) => s.id === id && s.jobId === jobId);
        if (s) s.order = i + 1;
      });
      log('program_edited', `Reordered stages on ${jobName(jobId)}`, { jobId });
      commit();
    },
    listSteps(jobId) {
      if (!visibleJobIds().has(jobId)) return [];
      const stageOrder = new Map(d().stages.filter((s) => s.jobId === jobId).map((s) => [s.id, s.order]));
      return scoped(
        d()
          .steps.filter((s) => s.jobId === jobId)
          .sort((a, b) => (stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0) || a.order - b.order),
      );
    },
    getStep(id) {
      const s = d().steps.find((s) => s.id === id && s.sideId === session.sideId);
      return s && visibleJobIds().has(s.jobId) ? scoped(s) : undefined;
    },
    addStep(input) {
      const job = requireJob(input.jobId);
      const siblings = d().steps.filter((s) => s.stageId === input.stageId);
      const order = input.order ?? nextOrder(siblings);
      for (const s of siblings) if (s.order >= order) s.order++;
      const step: Step = {
        id: newId('step'),
        sideId: job.sideId,
        jobId: job.id,
        stageId: input.stageId,
        name: input.name,
        order,
        durationDays: Math.max(1, input.durationDays),
        plannedStart: job.isTemplate ? undefined : input.plannedStart,
        status: 'not_started',
        isHoldPoint: !!input.isHoldPoint,
        tradeType: input.tradeType,
      };
      recomputePlannedEnd(step);
      d().steps.push(step);
      for (const w of input.waitsForStepIds ?? []) {
        d().stepLinks.push({ id: newId('link'), sideId: job.sideId, jobId: job.id, stepId: step.id, waitsForStepId: w });
      }
      log('program_edited', `Added step ${step.name} to ${job.name}`, { jobId: job.id, stepId: step.id });
      commit();
      return scoped(step);
    },
    updateStep(id, patch) {
      const step = requireStep(id);
      const before = { ...step };
      Object.assign(step, patch);
      if (patch.durationDays !== undefined) step.durationDays = Math.max(1, patch.durationDays);
      if (patch.plannedStart !== undefined || patch.durationDays !== undefined) recomputePlannedEnd(step);
      const changes: string[] = [];
      if (before.durationDays !== step.durationDays) changes.push(`duration ${before.durationDays} to ${step.durationDays} days`);
      if (before.plannedStart !== step.plannedStart && step.plannedStart) changes.push(`planned start to ${formatDayMonth(step.plannedStart)}`);
      log('step_edited', `${step.name}: ${changes.length ? changes.join(', ') : 'edited'}`, { jobId: step.jobId, stepId: step.id });
      commit();
      return scoped(step);
    },
    deleteStep(id) {
      const data = d();
      const step = data.steps.find((s) => s.id === id);
      if (!step) return;
      data.steps = data.steps.filter((s) => s.id !== id);
      data.stepLinks = data.stepLinks.filter((l) => l.stepId !== id && l.waitsForStepId !== id);
      data.requirements = data.requirements.filter((r) => r.stepId !== id);
      for (const i of data.items) if (i.stepId === id) i.stepId = undefined;
      log('program_edited', `Deleted step ${step.name}`, { jobId: step.jobId });
      commit();
    },
    reorderSteps(stageId, orderedIds) {
      let jobId: string | undefined;
      orderedIds.forEach((id, i) => {
        const s = d().steps.find((s) => s.id === id && s.stageId === stageId);
        if (s) {
          s.order = i + 1;
          jobId = s.jobId;
        }
      });
      if (jobId) log('program_edited', `Reordered steps`, { jobId });
      commit();
    },
    setStepStatus(stepId, status): StepStatusResult {
      const step = requireStep(stepId);
      if (status === 'done' && step.isHoldPoint) {
        const check = holdPointCheck(
          step,
          d().photoCategories.filter((c) => c.jobId === step.jobId),
          d().photos.filter((p) => p.jobId === step.jobId),
        );
        if (!check.ok) return { ok: false, reason: 'hold_point', missingCategories: check.missingCategories, message: holdPointRefusalText(check) };
      }
      if (status === 'done') {
        // A step that has not started yet cannot be finished today.
        const startsOn = rawForecast(step.jobId)?.steps[step.id]?.forecastStart;
        if (startsOn && startsOn > session.today) {
          return {
            ok: false,
            reason: 'not_started',
            missingCategories: [],
            startsOn,
            message: `This step hasn't started yet; it starts ${formatShortRelative(startsOn, session.today)}.`,
          };
        }
      }
      const from = step.status;
      step.status = status;
      if (status === 'in_progress' && !step.actualStart) step.actualStart = session.today;
      if (status === 'done') {
        step.actualStart = step.actualStart ?? step.plannedStart ?? session.today;
        step.actualEnd = session.today < step.actualStart ? step.actualStart : session.today;
      }
      if (status === 'not_started') {
        step.actualStart = undefined;
        step.actualEnd = undefined;
      }
      const words: Record<StepStatus, string> = { not_started: 'reset to not started', in_progress: 'started', done: 'done' };
      log('step_status', `${step.name} ${words[status]}`, { jobId: step.jobId, stepId: step.id, from, to: status });
      commit();
      return { ok: true, step: scoped(step) };
    },
    listStepLinks(jobId) {
      if (!visibleJobIds().has(jobId)) return [];
      return scoped(d().stepLinks.filter((l) => l.jobId === jobId));
    },
    addStepLink(stepId, waitsForStepId) {
      const step = requireStep(stepId);
      const existing = d().stepLinks.find((l) => l.stepId === stepId && l.waitsForStepId === waitsForStepId);
      if (existing) return scoped(existing);
      const link: StepLink = { id: newId('link'), sideId: step.sideId, jobId: step.jobId, stepId, waitsForStepId };
      d().stepLinks.push(link);
      log('program_edited', `${step.name} now waits for ${requireStep(waitsForStepId).name}`, { jobId: step.jobId, stepId });
      commit();
      return scoped(link);
    },
    removeStepLink(id) {
      const data = d();
      const link = data.stepLinks.find((l) => l.id === id);
      if (!link) return;
      data.stepLinks = data.stepLinks.filter((l) => l.id !== id);
      log('program_edited', `Removed a link`, { jobId: link.jobId, stepId: link.stepId });
      commit();
    },
    listRequirements(jobId) {
      if (!visibleJobIds().has(jobId)) return [];
      return scoped(d().requirements.filter((r) => r.jobId === jobId));
    },
    addRequirement(input) {
      const step = requireStep(input.stepId);
      const req: Requirement = { id: newId('rq'), sideId: step.sideId, jobId: step.jobId, ...input };
      d().requirements.push(req);
      log('program_edited', `${step.name} needs ${req.name} (${req.leadTimeWeeks} weeks)`, { jobId: step.jobId, stepId: step.id });
      commit();
      return scoped(req);
    },
    updateRequirement(id, patch) {
      const req = d().requirements.find((r) => r.id === id);
      if (!req) throw new Error(`No requirement ${id}`);
      Object.assign(req, patch);
      log('program_edited', `Updated need ${req.name}`, { jobId: req.jobId, stepId: req.stepId });
      commit();
      return scoped(req);
    },
    removeRequirement(id) {
      const data = d();
      const req = data.requirements.find((r) => r.id === id);
      if (!req) return;
      data.requirements = data.requirements.filter((r) => r.id !== id);
      for (const i of data.items) if (i.requirementId === id) i.requirementId = undefined;
      log('program_edited', `Removed need ${req.name}`, { jobId: req.jobId, stepId: req.stepId });
      commit();
    },

    // ---- items ----
    listItems(filter = {}) {
      const jobIds = visibleJobIds();
      let rows = d().items.filter((i) => jobIds.has(i.jobId));
      if (filter.jobId) rows = rows.filter((i) => i.jobId === filter.jobId);
      if (filter.stepId) rows = rows.filter((i) => i.stepId === filter.stepId);
      if (filter.ownerId) rows = rows.filter((i) => i.ownerId === filter.ownerId);
      if (filter.shipmentId) rows = rows.filter((i) => i.shipmentId === filter.shipmentId);
      if (filter.tradeId) rows = rows.filter((i) => i.tradeId === filter.tradeId);
      if (filter.status) {
        const set = new Set(Array.isArray(filter.status) ? filter.status : [filter.status]);
        rows = rows.filter((i) => set.has(i.status));
      } else if (!filter.includeDone) {
        rows = rows.filter((i) => i.status !== 'done');
      }
      if (filter.type) {
        const set = new Set(Array.isArray(filter.type) ? filter.type : [filter.type]);
        rows = rows.filter((i) => set.has(i.type));
      }
      if (isSite()) rows = rows.filter((i) => i.type === 'material');
      return scoped(rows);
    },
    getItem(id) {
      const item = d().items.find((i) => i.id === id && i.sideId === session.sideId);
      return item && visibleJobIds().has(item.jobId) ? scoped(item) : undefined;
    },
    addItem(input) {
      const job = requireJob(input.jobId);
      if (needsExpectedDate(input, input.status ?? 'to_do')) throw new Error(BOOKED_NEEDS_DATE);
      if (input.stepId) {
        const step = d().steps.find((s) => s.id === input.stepId);
        if (!step || step.jobId !== job.id) throw new Error(`Step ${input.stepId} is not on ${job.name}`);
      }
      const item: Item = {
        id: newId('it'),
        sideId: job.sideId,
        jobId: job.id,
        type: input.type,
        title: input.title,
        waitingOn: input.waitingOn,
        tradeId: input.tradeId,
        ownerId: input.ownerId ?? session.personId,
        stepId: input.stepId,
        requirementId: input.requirementId,
        shipmentId: input.shipmentId,
        neededBy: input.neededBy,
        leadTimeWeeks: input.leadTimeWeeks,
        expectedDate: input.expectedDate,
        status: input.status ?? 'to_do',
        notes: input.notes,
        photoId: input.photoId,
        createdAt: session.today,
      };
      d().items.push(item);
      log('item_added', `Added ${item.title} to ${job.name}`, { jobId: job.id, itemId: item.id });
      commit();
      return scoped(item);
    },
    updateItem(id, patch) {
      const item = requireItem(id);
      if (patch.status && needsExpectedDate({ ...item, ...patch }, patch.status)) throw new Error(BOOKED_NEEDS_DATE);
      const before = { ...item };
      Object.assign(item, patch);
      if (patch.status === 'done' && before.status !== 'done') item.doneAt = session.today;
      if (before.expectedDate !== item.expectedDate) {
        log('item_expected_changed', `${item.title} expected date ${before.expectedDate ? `moved ${formatDayMonth(before.expectedDate)} to ` : 'set to '}${item.expectedDate ? formatDayMonth(item.expectedDate) : 'none'}`, { jobId: item.jobId, itemId: item.id, from: before.expectedDate, to: item.expectedDate });
      } else if (before.status !== item.status) {
        log('item_status', `${item.title}: ${ITEM_STATUS_LABELS[item.status]}`, { jobId: item.jobId, itemId: item.id, from: before.status, to: item.status });
      } else {
        log('item_edited', `Edited ${item.title}`, { jobId: item.jobId, itemId: item.id });
      }
      commit();
      return scoped(item);
    },
    deleteItem(id) {
      const data = d();
      const item = data.items.find((i) => i.id === id);
      if (!item) return;
      data.items = data.items.filter((i) => i.id !== id);
      log('item_deleted', `Deleted ${item.title}`, { jobId: item.jobId, itemId: item.id });
      commit();
    },
    updateItemStatus(id, status, confirmedDate) {
      const item = requireItem(id);
      // Booked means a date is on the way (Dom's brief): refuse it without one.
      if (status !== item.status && needsExpectedDate(item, status)) throw new Error(BOOKED_NEEDS_DATE);
      const from = item.status;
      item.status = status;
      if (status === 'confirmed') item.confirmedDate = confirmedDate ?? session.today;
      if (status === 'done') item.doneAt = session.today;
      if (status === 'to_do') {
        item.confirmedDate = undefined;
        item.doneAt = undefined;
      }
      log('item_status', `${item.title}: ${ITEM_STATUS_LABELS[status]}`, { jobId: item.jobId, itemId: item.id, from, to: status });
      commit();
      return scoped(item);
    },
    advanceItemStatus(id) {
      const item = requireItem(id);
      const idx = ITEM_STATUS_ORDER.indexOf(item.status);
      const next = ITEM_STATUS_ORDER[Math.min(idx + 1, ITEM_STATUS_ORDER.length - 1)];
      return api.updateItemStatus(id, next);
    },
    setItemExpectedDate(id, expectedDate) {
      return api.updateItem(id, { expectedDate });
    },

    // ---- trades ----
    listTrades() {
      return scoped(onSide(d().trades).sort((a, b) => a.name.localeCompare(b.name)));
    },
    getTrade(id) {
      const t = d().trades.find((t) => t.id === id && t.sideId === session.sideId);
      return t ? scoped(t) : undefined;
    },
    addTrade(input) {
      const trade: Trade = { id: newId('tr'), sideId: session.sideId, ...input };
      d().trades.push(trade);
      log('trade_edited', `Added trade ${trade.name}`);
      commit();
      return scoped(trade);
    },
    updateTrade(id, patch) {
      const trade = d().trades.find((t) => t.id === id);
      if (!trade) throw new Error(`No trade ${id}`);
      Object.assign(trade, patch);
      log('trade_edited', `Updated trade ${trade.name}`);
      commit();
      return scoped(trade);
    },
    deleteTrade(id) {
      const data = d();
      const trade = data.trades.find((t) => t.id === id);
      if (!trade) return;
      data.trades = data.trades.filter((t) => t.id !== id);
      for (const i of data.items) if (i.tradeId === id) i.tradeId = undefined;
      log('trade_edited', `Removed trade ${trade.name}`);
      commit();
    },

    // ---- shipments ----
    listShipments(jobId) {
      const jobIds = visibleJobIds();
      let rows = d().shipments.filter((s) => jobIds.has(s.jobId));
      if (jobId) rows = rows.filter((s) => s.jobId === jobId);
      return scoped(rows);
    },
    getShipment(id) {
      const s = d().shipments.find((s) => s.id === id && s.sideId === session.sideId);
      return s && visibleJobIds().has(s.jobId) ? scoped(s) : undefined;
    },
    addShipment(input) {
      const job = requireJob(input.jobId);
      const sh: Shipment = {
        id: newId('sh'),
        sideId: job.sideId,
        jobId: job.id,
        name: input.name,
        supplier: input.supplier,
        status: input.status ?? 'design',
        eta: input.eta,
        notes: input.notes,
      };
      d().shipments.push(sh);
      log('shipment_status', `Added shipment ${sh.name}, ETA ${formatDayMonth(sh.eta)}`, { jobId: job.id, shipmentId: sh.id });
      commit();
      return scoped(sh);
    },
    updateShipment(id, patch) {
      const sh = requireShipment(id);
      Object.assign(sh, patch);
      log('shipment_status', `Updated shipment ${sh.name}`, { jobId: sh.jobId, shipmentId: sh.id });
      commit();
      return scoped(sh);
    },
    setShipmentEta(id, eta) {
      const sh = requireShipment(id);
      const from = sh.eta;
      if (from === eta) return scoped(sh);
      sh.eta = eta;
      log('eta_changed', `${sh.name} ETA changed ${formatDayMonth(from)} to ${formatDayMonth(eta)}`, { jobId: sh.jobId, shipmentId: sh.id, from, to: eta });
      // Tell each owner of a linked item how many of theirs moved.
      const linked = d().items.filter((i) => i.shipmentId === sh.id && i.status !== 'done');
      const byOwner = new Map<string, number>();
      for (const i of linked) if (i.ownerId) byOwner.set(i.ownerId, (byOwner.get(i.ownerId) ?? 0) + 1);
      for (const [ownerId, n] of byOwner) {
        raise(ownerId, 'eta_moved', `${sh.name} now expected ${formatDayMonth(eta)}. ${n} of your items moved.`, { jobId: sh.jobId, shipmentId: sh.id });
      }
      commit();
      return scoped(sh);
    },
    setShipmentStatus(id, status) {
      const sh = requireShipment(id);
      const from = sh.status;
      sh.status = status;
      log('shipment_status', `${sh.name} moved to ${SHIPMENT_STATUS_LABELS[status]}`, { jobId: sh.jobId, shipmentId: sh.id, from, to: status });
      commit();
      return scoped(sh);
    },
    linkItemToShipment(itemId, shipmentId) {
      const item = requireItem(itemId);
      item.shipmentId = shipmentId ?? undefined;
      const sh = shipmentId ? requireShipment(shipmentId) : undefined;
      log('item_edited', sh ? `${item.title} linked to ${sh.name}` : `${item.title} unlinked from its shipment`, { jobId: item.jobId, itemId: item.id, shipmentId: shipmentId ?? undefined });
      commit();
      return scoped(item);
    },
    previewEtaChange(shipmentId, newEta): EtaPreview {
      const sh = requireShipment(shipmentId);
      const job = requireJob(sh.jobId);
      return scoped(previewEtaChange(bundleFor(job), shipmentId, newEta));
    },

    // ---- photos ----
    listPhotoCategories(jobId, stageId) {
      if (!visibleJobIds().has(jobId)) return [];
      let rows = d().photoCategories.filter((c) => c.jobId === jobId);
      if (stageId !== undefined) rows = rows.filter((c) => c.stageId === stageId || c.stageId === null);
      return scoped(rows.sort((a, b) => a.order - b.order));
    },
    addPhotoCategory(input) {
      const job = requireJob(input.jobId);
      const cat: PhotoCategory = {
        id: newId('pc'),
        sideId: job.sideId,
        jobId: job.id,
        stageId: input.stageId,
        name: input.name,
        requiredForHoldPoint: !!input.requiredForHoldPoint,
        order: nextOrder(d().photoCategories.filter((c) => c.jobId === job.id)),
      };
      d().photoCategories.push(cat);
      log('program_edited', `Added photo category ${cat.name}`, { jobId: job.id });
      commit();
      return scoped(cat);
    },
    updatePhotoCategory(id, patch) {
      const cat = d().photoCategories.find((c) => c.id === id);
      if (!cat) throw new Error(`No photo category ${id}`);
      Object.assign(cat, patch);
      log('program_edited', `Updated photo category ${cat.name}`, { jobId: cat.jobId });
      commit();
      return scoped(cat);
    },
    deletePhotoCategory(id) {
      const data = d();
      const cat = data.photoCategories.find((c) => c.id === id);
      if (!cat) return;
      const general = data.photoCategories.find((c) => c.jobId === cat.jobId && c.stageId === null && c.id !== id);
      data.photoCategories = data.photoCategories.filter((c) => c.id !== id);
      for (const p of data.photos) if (p.categoryId === id && general) p.categoryId = general.id;
      log('program_edited', `Removed photo category ${cat.name}`, { jobId: cat.jobId });
      commit();
    },
    listPhotos(jobId, filter = {}) {
      if (!visibleJobIds().has(jobId)) return [];
      let rows = d().photos.filter((p) => p.jobId === jobId);
      if (filter.stageId !== undefined) rows = rows.filter((p) => p.stageId === filter.stageId);
      if (filter.categoryId) rows = rows.filter((p) => p.categoryId === filter.categoryId);
      if (filter.uploadedById) rows = rows.filter((p) => p.uploadedById === filter.uploadedById);
      if (filter.takenOn) rows = rows.filter((p) => p.takenOn === filter.takenOn);
      return scoped(rows.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)));
    },
    getPhoto(id) {
      const p = d().photos.find((p) => p.id === id && p.sideId === session.sideId);
      return p ? scoped(p) : undefined;
    },
    addPhoto(input) {
      const photo = insertPhoto(input, input.uploadedById ?? session.personId);
      commit();
      return scoped(photo);
    },
    movePhoto(id, categoryId) {
      const photo = d().photos.find((p) => p.id === id);
      if (!photo) throw new Error(`No photo ${id}`);
      const cat = d().photoCategories.find((c) => c.id === categoryId);
      if (!cat) throw new Error(`No photo category ${categoryId}`);
      photo.categoryId = categoryId;
      photo.stageId = cat.stageId;
      log('photo_moved', `Moved a photo to ${cat.name}`, { jobId: photo.jobId, photoId: photo.id });
      commit();
      return scoped(photo);
    },
    deletePhoto(id) {
      const data = d();
      const photo = data.photos.find((p) => p.id === id);
      if (!photo) return;
      data.photos = data.photos.filter((p) => p.id !== id);
      log('photo_deleted', `Deleted a photo`, { jobId: photo.jobId });
      commit();
    },
    async queuePhoto(input) {
      const q = await queue.enqueue({
        sideId: session.sideId,
        jobId: input.jobId,
        stageId: input.stageId,
        categoryId: input.categoryId,
        dataUrl: input.dataUrl,
        takenOn: input.takenOn ?? session.today,
        caption: input.caption,
        uploadedById: input.uploadedById ?? session.personId,
      });
      notify();
      return q;
    },
    listQueuedPhotos() {
      return queue.list();
    },
    async removeQueuedPhoto(id) {
      await queue.remove(id);
      notify();
    },
    async flushPhotoQueue() {
      const had = (await queue.list()).length > 0;
      const sent = await queue.flush(
        (photo: QueuedPhoto) => {
          if (session.offline) throw new Error('No signal');
          insertPhoto(photo, photo.uploadedById, photo.sideId ?? session.sideId);
          persist();
        },
        () => !session.offline,
      );
      if (had) notify(); // states changed (sent, or marked failed), even when nothing went through
      return sent;
    },

    // ---- daily notes ----
    listDailyNotes(jobId) {
      if (!visibleJobIds().has(jobId)) return [];
      return scoped(d().dailyNotes.filter((n) => n.jobId === jobId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1)));
    },
    addDailyNote(input) {
      const job = requireJob(input.jobId);
      const note: DailyNote = {
        id: newId('dn'),
        sideId: job.sideId,
        jobId: job.id,
        date: input.date ?? session.today,
        authorId: session.personId,
        text: input.text,
        createdAt: stamp(),
        ...(input.weather ? { weather: input.weather } : {}),
        ...(input.onSite && input.onSite.length ? { onSite: [...input.onSite] } : {}),
        ...(input.photoIds && input.photoIds.length ? { photoIds: [...input.photoIds] } : {}),
        ...(input.queued ? { queued: true } : {}),
      };
      d().dailyNotes.push(note);
      log('note_added', `Daily note on ${job.name}: ${note.text.slice(0, 60)}${note.text.length > 60 ? '...' : ''}`, { jobId: job.id });
      commit();
      return scoped(note);
    },
    updateDailyNote(id, patch) {
      const note = d().dailyNotes.find((n) => n.id === id);
      if (!note) throw new Error(`No note ${id}`);
      if (typeof patch === 'string') note.text = patch;
      else {
        if (patch.text !== undefined) note.text = patch.text;
        if (patch.weather !== undefined) note.weather = patch.weather;
        if (patch.onSite !== undefined) note.onSite = patch.onSite;
        if (patch.photoIds !== undefined) note.photoIds = patch.photoIds;
        if (patch.queued !== undefined) {
          if (patch.queued) note.queued = true;
          else delete note.queued;
        }
      }
      commit();
      return scoped(note);
    },
    flushDailyNotes() {
      if (session.offline) return 0;
      const held = d().dailyNotes.filter((n) => n.queued);
      if (held.length === 0) return 0;
      for (const n of held) delete n.queued;
      persist();
      notify();
      return held.length;
    },

    // ---- forecast ----
    getForecast(jobId) {
      if (!visibleJobIds().has(jobId)) return undefined;
      const f = rawForecast(jobId);
      return f ? scoped(f) : undefined;
    },
    previewProgramChange(jobId, draft): ProgramPreview | undefined {
      if (!visibleJobIds().has(jobId)) return undefined;
      const job = d().jobs.find((j) => j.id === jobId && j.sideId === session.sideId);
      if (!job || job.isTemplate || job.kind !== 'build') return undefined;
      const bundle = bundleFor(job);
      const before = forecastJob(bundle);
      // Planned end always derives from planned start over working days (rule 3: the editor sets planned start by hand).
      const steps = draft.steps.map((s) => ({ ...s, plannedEnd: s.plannedStart ? stepEnd(s.plannedStart, s.durationDays) : undefined }));
      const after = forecastJob({
        ...bundle,
        stages: draft.stages,
        steps,
        links: draft.links,
        requirements: draft.requirements,
        photoCategories: draft.photoCategories ?? bundle.photoCategories,
      });
      const deltaDays = before.forecastFinish && after.forecastFinish ? calendarDaysBetween(before.forecastFinish, after.forecastFinish) : 0;
      return scoped({
        jobId,
        finishBefore: before.forecastFinish,
        finishAfter: after.forecastFinish,
        deltaDays,
        costDelta: slipCostFor(deltaDays, job.weeklyHoldingCost),
        forecast: after,
      });
    },
    holdPointReadiness(stepId) {
      const step = d().steps.find((s) => s.id === stepId);
      if (!step || !step.isHoldPoint || !visibleJobIds().has(step.jobId)) return undefined;
      const check = rawForecast(step.jobId)?.holdPoints.find((h) => h.stepId === stepId);
      if (!check) return undefined;
      return scoped({
        stepId,
        stepName: step.name,
        jobId: step.jobId,
        jobName: jobName(step.jobId),
        stageId: step.stageId,
        forecastStart: check.forecastStart,
        filled: check.required.filter((r) => r.uploadedCount > 0).length,
        total: check.required.length,
        words: holdPointReadinessWords(check),
        missingCategories: check.missingCategories,
        ok: check.ok,
        check,
      });
    },
    listForecasts() {
      return visibleJobs()
        .map((j) => rawForecast(j.id))
        .filter((f): f is JobForecast => !!f)
        .map((f) => scoped(f));
    },
    getOverviewRows() {
      if (!api.canSee('overview')) return [];
      const rows: OverviewRow[] = [];
      for (const job of visibleJobs()) {
        const f = rawForecast(job.id);
        if (!f) continue;
        const items = d().items.filter((i) => i.jobId === job.id);
        const oldest = f.checklist?.outstandingItems[0];
        const stageName = new Map(f.stages.map((st) => [st.stageId, st.name]));
        // The next few steps: anything not done, the running one first, then by start date.
        const nextSteps: NextStep[] = Object.values(f.steps)
          .filter((st) => st.status !== 'done')
          .sort((a, b) => (a.status === 'in_progress' ? -1 : b.status === 'in_progress' ? 1 : 0) || a.forecastStart.localeCompare(b.forecastStart))
          .slice(0, 3)
          .map((st) => ({
            stepId: st.stepId,
            name: st.name,
            stageName: stageName.get(st.stageId) ?? '',
            start: st.forecastStart,
            status: st.status,
            isHoldPoint: st.isHoldPoint,
          }));
        const nextStage = f.checklist ? f.stages.find((st) => st.status === 'not_started') : undefined;
        rows.push({
          jobId: job.id,
          name: job.name,
          kind: job.kind,
          path: job.path,
          freshness: f.freshness,
          currentStageName: f.currentStageName,
          nextSteps,
          waitingOn: job.kind === 'build' ? topWaitingOn(f, items) : [],
          nextHoldPoint: f.nextHoldPoint,
          overdue: overdueCount(f),
          nextStageName: nextStage?.name,
          outstanding: f.checklist?.outstanding,
          oldestDays: f.checklist?.oldestDays,
          oldestItemTitle: oldest?.title,
          oldestItemWaitingOn: oldest?.waitingOn,
        });
      }
      // Builds first, in the side's own order; design jobs after, the longest-waiting first.
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'build' ? -1 : 1;
        if (a.kind === 'build') return 0;
        return (b.oldestDays ?? -1) - (a.oldestDays ?? -1) || a.name.localeCompare(b.name);
      });
      return scoped(rows);
    },
    listSnapshots(jobId) {
      if (!visibleJobIds().has(jobId)) return [];
      return scoped(d().snapshots.filter((s) => s.jobId === jobId).sort((a, b) => (a.date < b.date ? -1 : 1)));
    },
    saveMondaySnapshot(date) {
      const monday = lastMonday(date ?? session.today);
      const saved: ForecastSnapshot[] = [];
      for (const job of visibleJobs({ kind: 'build' })) {
        const f = rawForecast(job.id);
        if (!f?.forecastFinish) continue;
        const data = d();
        data.snapshots = data.snapshots.filter((s) => !(s.jobId === job.id && s.date === monday));
        const snap: ForecastSnapshot = {
          id: newId('snap'),
          sideId: job.sideId,
          jobId: job.id,
          date: monday,
          forecastFinish: f.forecastFinish,
          stepStarts: Object.fromEntries(Object.values(f.steps).map((s) => [s.stepId, s.forecastStart])),
          stepEnds: Object.fromEntries(Object.values(f.steps).map((s) => [s.stepId, s.forecastEnd])),
        };
        data.snapshots.push(snap);
        saved.push(snap);
        log('snapshot_saved', `Monday snapshot saved for ${formatDayMonth(monday)}: finish ${formatDayMonth(f.forecastFinish)}`, { jobId: job.id });
      }
      commit();
      return scoped(saved);
    },

    // ---- activity and notifications ----
    listActivity(filter = {}) {
      if (!api.canSee('activity')) return [];
      const jobIds = visibleJobIds();
      let rows = onSide(d().activity).filter((a) => !a.jobId || jobIds.has(a.jobId));
      if (filter.jobId) rows = rows.filter((a) => a.jobId === filter.jobId);
      if (filter.personId) rows = rows.filter((a) => a.personId === filter.personId);
      if (filter.itemId) rows = rows.filter((a) => a.itemId === filter.itemId);
      if (filter.shipmentId) rows = rows.filter((a) => a.shipmentId === filter.shipmentId);
      if (filter.stepId) rows = rows.filter((a) => a.stepId === filter.stepId);
      rows = rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      if (filter.limit) rows = rows.slice(0, filter.limit);
      return scoped(rows);
    },
    listNotifications(filter = {}) {
      const personId = (!isSite() && filter.personId) || session.personId;
      let rows = onSide(d().notifications).filter((n) => n.personId === personId);
      if (filter.unreadOnly) rows = rows.filter((n) => !n.read);
      return scoped(rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)));
    },
    markNotificationRead(id) {
      const n = d().notifications.find((n) => n.id === id);
      if (n) n.read = true;
      commit();
    },
    markAllNotificationsRead() {
      for (const n of d().notifications) if (n.personId === session.personId && n.sideId === session.sideId) n.read = true;
      commit();
    },
    fireRemindersDueToday() {
      const today = session.today;
      const raised: Notification[] = [];
      // One reminder per person, kind, thing and day. `jobId` only narrows when given (job-level reminders).
      const already = (personId: string, kind: NotificationKind, ref: { itemId?: string; stepId?: string; jobId?: string }) =>
        d().notifications.some(
          (n) =>
            n.personId === personId &&
            n.kind === kind &&
            n.at.startsWith(today) &&
            n.itemId === ref.itemId &&
            n.stepId === ref.stepId &&
            (ref.jobId === undefined || n.jobId === ref.jobId),
        );
      const members = (roles: Role[]) => onSide(d().memberships).filter((m) => roles.includes(m.role));
      for (const job of visibleJobs()) {
        const f = rawForecast(job.id);
        if (!f) continue;
        for (const item of d().items.filter((i) => i.jobId === job.id && i.status !== 'done')) {
          const fi = f.items[item.id];
          if (!fi || !item.ownerId) continue;
          if (fi.actBy === today && item.status === 'to_do' && !already(item.ownerId, 'act_by_today', { itemId: item.id })) {
            raised.push(raise(item.ownerId, 'act_by_today', `${item.title} at ${job.name}: act by today`, { jobId: job.id, itemId: item.id }));
          }
          if (fi.isLate && !already(item.ownerId, 'overdue', { itemId: item.id })) {
            const why = fi.expected && fi.neededBy && fi.expected > fi.neededBy
              ? `expected ${formatDayMonth(fi.expected)}, needed ${formatDayMonth(fi.neededBy)}`
              : `needed ${fi.neededBy ? formatDayMonth(fi.neededBy) : 'earlier'}, ${fi.lateText}`;
            raised.push(raise(item.ownerId, 'overdue', `${item.title} at ${job.name} is late: ${why}`, { jobId: job.id, itemId: item.id }));
          } else if (fi.actByPassed && fi.actBy && !already(item.ownerId, 'overdue', { itemId: item.id })) {
            // Not late yet, but the day to act on it has gone by and nothing has been done.
            raised.push(
              raise(item.ownerId, 'overdue', `${item.title} at ${job.name}: act by ${formatShort(fi.actBy)} has passed`, { jobId: job.id, itemId: item.id }),
            );
          }
        }
        // A hold point a week away with photos missing: tell the builders and admins on the side, with the readiness words.
        const weekAway = addCalendarWeeks(today, 1);
        for (const hp of f.holdPoints) {
          const step = d().steps.find((s) => s.id === hp.stepId);
          if (!step || step.status === 'done' || hp.ok) continue;
          if (hp.forecastStart < today || hp.forecastStart > weekAway) continue;
          for (const m of members(['builder', 'admin'])) {
            if (already(m.personId, 'hold_point_week_away', { stepId: step.id })) continue;
            raised.push(
              raise(
                m.personId,
                'hold_point_week_away',
                `${step.name} at ${job.name} is on ${formatShort(hp.forecastStart)}: ${holdPointReadinessWords(hp)}. Still empty: ${hp.missingCategories.join('; ')}`,
                { jobId: job.id, stepId: step.id },
              ),
            );
          }
        }
        // Photos uploaded today into a required category of an open hold point: tell the builders and admins who tick it off.
        for (const hp of f.holdPoints) {
          const step = d().steps.find((s) => s.id === hp.stepId);
          if (!step || step.status === 'done') continue;
          const requiredIds = new Set(hp.required.map((r) => r.categoryId));
          const todays = d().photos.filter((p) => p.jobId === job.id && p.uploadedAt.startsWith(today) && requiredIds.has(p.categoryId));
          if (!todays.length) continue;
          const uploaders = [...new Set(todays.map((p) => p.uploadedById))]
            .map((id) => d().people.find((p) => p.id === id)?.shortName ?? 'Someone')
            .join(' and ');
          for (const m of members(['builder', 'admin'])) {
            if (already(m.personId, 'photos_uploaded', { stepId: step.id })) continue;
            raised.push(
              raise(
                m.personId,
                'photos_uploaded',
                `${uploaders} added ${todays.length} photo${todays.length === 1 ? '' : 's'} for ${step.name} at ${job.name}: ${holdPointReadinessWords(hp)}`,
                { jobId: job.id, stepId: step.id },
              ),
            );
          }
        }
        // Rule 7: a job unconfirmed for more than 7 days is amber; tell the admin and the partners.
        if (f.freshness.amber && job.kind === 'build') {
          for (const m of members(['admin', 'partner'])) {
            if (already(m.personId, 'job_unconfirmed', { jobId: job.id })) continue;
            const words = f.freshness.lastConfirmed ? `has not been confirmed for ${f.freshness.daysUnconfirmed} days` : 'has never been confirmed';
            raised.push(raise(m.personId, 'job_unconfirmed', `${job.name} ${words}`, { jobId: job.id }));
          }
        }
      }
      if (raised.length) log('reminders_fired', `Fired ${raised.length} reminder${raised.length === 1 ? '' : 's'} for ${formatDayMonth(today)}`);
      commit();
      return scoped(raised);
    },
    sendTestBuzz() {
      const n = raise(session.personId, 'test_buzz', 'Test buzz. If you felt this, notifications work.');
      commit();
      return scoped(n);
    },

    // ---- plumbing ----
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      store = { seedVersion: SEED_VERSION, data: buildSeed(), lastSync: stamp() };
      persist();
      void queue.clear().then(() => notify());
      notify();
    },
    getLastSync() {
      return store.lastSync;
    },
  };

  return api;
}
