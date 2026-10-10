/**
 * Read-only answers for the parser's read tools. Everything goes through
 * DashboardApi (LocalDashboardApi over the store), so a question can never
 * create a change set. Answers are Telegram HTML: a bold "<Job> · <topic>"
 * line, then a short structured list (see html.ts).
 */
import { calendarDaysBetween, formatDate, fuzzyMatch, rankWaiting, stageDisplayName, type DashboardApi, type ISODate, type JobListRow, type WaitingRow } from '@ct/core';
import { slipText } from './format.js';
import { b, blocks, bullet, esc, overdueMark } from './html.js';

/** `text` is Telegram HTML. */
export type ReadAnswer = { text: string };

const MAX_ROWS = 8;

type JobPick = { ok: true; job: JobListRow } | { ok: false; text: string };

async function pickJob(api: DashboardApi, query: unknown): Promise<JobPick> {
  if (typeof query !== 'string' || !query.trim()) return { ok: false, text: 'Which job?' };
  const jobs = await api.listJobs();
  const all = [...jobs.builds, ...jobs.design];
  const exact = all.find((j) => j.jobId === query);
  if (exact) return { ok: true, job: exact };
  const r = fuzzyMatch(query, all.map((j) => ({ id: j.jobId, name: j.name, value: j })));
  if (r.kind === 'unique') return { ok: true, job: r.match.value as JobListRow };
  if (r.kind === 'ambiguous') return { ok: false, text: esc(`Which job: ${r.candidates.map((c) => c.name).join(' or ')}?`) };
  return { ok: false, text: esc(`I can't find a job called "${query}".`) };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * v1 rule, in words (SPEC revision 2026-10-10): overdue = needed-by and expected both passed (or nothing
 * expected) and not done; late = expected after it's needed, said plainly, never as a warning.
 */
export type ItemTiming = 'overdue' | 'late' | 'other';

export function itemTiming(r: Pick<WaitingRow, 'status' | 'neededBy' | 'expected'>, today: ISODate): ItemTiming {
  if (r.status === 'done') return 'other';
  if (r.neededBy && r.neededBy < today && (!r.expected || r.expected < today)) return 'overdue';
  if (r.neededBy && r.expected && r.expected > r.neededBy) return 'late';
  return 'other';
}

/**
 * One waiting-on row (HTML, no bullet): overdue ones lead with the mark, "⚠️ Overdue by 3 days: Tile choice
 * (Dominic), needed Mon 14 Sep"; late but not overdue in plain words, "Book tiler (Harbour Tiling): expected
 * Mon 5 Oct, 7 days late (needed Mon 28 Sep)"; otherwise "Order tiles (Tile warehouse): act by Mon 28 Sep".
 */
export function waitingLine(r: WaitingRow, today: ISODate, withJob = false): string {
  const who = r.waitingOn ? ` (${r.waitingOn})` : '';
  const what = `${withJob ? `${r.jobName}: ` : ''}${r.title}${who}`;
  const timing = itemTiming(r, today);
  if (timing === 'overdue') {
    const n = calendarDaysBetween(r.neededBy!, today);
    const expected = r.expected ? `, expected ${formatDate(r.expected, today)}` : '';
    return `${overdueMark(`overdue by ${n} day${n === 1 ? '' : 's'}`)}: ${esc(`${what}, needed ${formatDate(r.neededBy!, today)}${expected}`)}`;
  }
  let detail: string;
  if (timing === 'late') {
    const n = calendarDaysBetween(r.neededBy!, r.expected!);
    detail = `expected ${formatDate(r.expected!, today)}, ${n} day${n === 1 ? '' : 's'} late (needed ${formatDate(r.neededBy!, today)})`;
  } else if (r.status === 'to_do' && r.actBy) detail = `act by ${formatDate(r.actBy, today)}${r.actByPassed ? ' (passed)' : ''}`;
  else if (r.expected) detail = `expected ${formatDate(r.expected, today)}`;
  else if (r.neededBy) detail = `needed ${formatDate(r.neededBy, today)}`;
  else detail = r.statusLabel.toLowerCase();
  return esc(`${what}: ${detail}`);
}

/**
 * Rows as bullets; across jobs, grouped under bold job names in order of first appearance (so the
 * job with the first, most urgent row leads), rows keeping their order inside a job.
 */
function rowLines(rows: WaitingRow[], today: ISODate, acrossJobs: boolean): string {
  if (!acrossJobs) return rows.map((r) => bullet(waitingLine(r, today))).join('\n');
  const jobs = [...new Set(rows.map((r) => r.jobName))];
  return jobs.map((j) => [b(j), ...rows.filter((r) => r.jobName === j).map((r) => bullet(waitingLine(r, today)))].join('\n')).join('\n\n');
}

/** Overdue first, then late, then the rest; otherwise the read model's order. */
function overdueFirst(rows: WaitingRow[], today: ISODate): WaitingRow[] {
  const rank = { overdue: 0, late: 1, other: 2 } as const;
  return rows.map((r, i) => ({ r, i, k: rank[itemTiming(r, today)] })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.r);
}

function more(n: number): string | null {
  return n > 0 ? `…and ${n} more.` : null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function answerRead(api: DashboardApi, tool: string, args: Record<string, unknown>): Promise<ReadAnswer> {
  const today = await api.getToday();
  switch (tool) {
    case 'get_job_finish': {
      const p = await pickJob(api, args.job);
      if (!p.ok) return p;
      const o = await api.getJobOverview(p.job.jobId);
      const f = o.forecast;
      const head = b(`${p.job.name} · Finish`);
      if (f.kind === 'design' || !f.forecastFinish) {
        return { text: `${head}\n${esc(`${p.job.name} is a design job, so it has no finish date. ${f.currentStageName ? `It's at the ${stageDisplayName(f.currentStageName)} stage.` : "It hasn't started a stage yet."}`)}` };
      }
      const slip = slipText(f.slipDays, f.slipCost);
      const lines = [
        `${b(formatDate(f.forecastFinish, today))}${slip === 'on track' ? ', on track' : ''}`,
        slip && slip !== 'on track' ? esc(`${slip} since last Monday`) : null,
        f.plannedFinish && f.lateDays !== 0 ? esc(`Planned ${formatDate(f.plannedFinish, today)}`) : null,
      ].filter(Boolean);
      return { text: [head, ...lines].join('\n') };
    }
    case 'get_why_it_moved': {
      const p = await pickJob(api, args.job);
      if (!p.ok) return p;
      const w = await api.getWhyItMoved(p.job.jobId);
      const head = b(`${w.jobName} · Why it moved`);
      if (!w.forecastFinish) return { text: `${head}\n${esc(`${w.jobName} is a design job, so it has no finish to move.`)}` };
      const since = w.snapshotDate ? ` since ${formatDate(w.snapshotDate, today)}` : '';
      if (!w.slipDays && !w.causes.length) {
        return { text: `${head}\n${esc(`It hasn't moved${since}: it finishes ${formatDate(w.forecastFinish, today)}.`)}` };
      }
      const finish = `Finishes ${b(formatDate(w.forecastFinish, today))}: ${esc(`${slipText(w.slipDays, w.slipCost)}${since}`)}`;
      const causes = w.causes.map((c) => bullet(esc(`${c.summary}: ${c.deltaDays === 0 ? 'no change to the finish' : `${c.deltaDays > 0 ? '+' : '-'}${Math.abs(c.deltaDays)} days`}`)));
      const other = w.otherDays ? w.lines.filter((l) => /reasons not in the change log/.test(l)).map((l) => bullet(esc(l))) : [];
      return { text: blocks(`${head}\n${finish}`, [...causes, ...other].join('\n')) };
    }
    case 'get_waiting_on': {
      const owner = str(args.owner);
      let jobId: string | undefined;
      let label = 'All jobs';
      if (str(args.job)) {
        const p = await pickJob(api, args.job);
        if (!p.ok) return p;
        jobId = p.job.jobId;
        label = p.job.name;
      }
      const view = await api.getWaitingOn({ ...(jobId ? { jobId } : {}), ...(owner ? { owner } : {}) });
      const rows = overdueFirst(rankWaiting(view.groups.flatMap((g) => g.rows), today), today);
      const whose = owner ? ` for ${owner}` : '';
      const head = b(`${label} · Waiting on`);
      if (!rows.length) return { text: `${head}\n${esc(`Nothing outstanding${whose}.`)}` };
      const overdue = rows.filter((r) => itemTiming(r, today) === 'overdue').length;
      const count = esc(`${rows.length} outstanding${whose}${overdue ? `, ${overdue} overdue` : ''}`);
      return { text: blocks(`${head}\n${count}`, rowLines(rows.slice(0, MAX_ROWS), today, !jobId), more(rows.length - MAX_ROWS)) };
    }
    case 'get_to_chase': {
      const owner = str(args.owner);
      const view = await api.getToChase(owner ? { owner } : {});
      const rows = overdueFirst(view.jobs.flatMap((j) => j.rows), today);
      const head = b(owner ? `To chase · ${owner}` : 'To chase');
      if (!rows.length) return { text: `${head}\nNothing to chase in the next two weeks.` };
      const overdue = rows.filter((r) => itemTiming(r, today) === 'overdue').length;
      const count = esc(`${plural(rows.length, 'item')} in the next two weeks${overdue ? `, ${overdue} overdue` : ''}`);
      return { text: blocks(`${head}\n${count}`, rowLines(rows.slice(0, MAX_ROWS), today, true), more(rows.length - MAX_ROWS)) };
    }
    case 'get_shipments': {
      let rows = await api.getShipments();
      let head = b('Shipments');
      if (str(args.job)) {
        const p = await pickJob(api, args.job);
        if (!p.ok) return p;
        rows = rows.filter((r) => r.jobId === p.job.jobId);
        head = b(`${p.job.name} · Shipments`);
      }
      if (!rows.length) return { text: `${head}\nNo shipments.` };
      const lines = rows.map((r) =>
        bullet(esc(`${r.name}: ${r.eta ? `ETA ${formatDate(r.eta, today)}` : 'no ETA'}, ${r.statusLabel.toLowerCase()}${r.isLate ? `, ${r.lateDays} day${r.lateDays === 1 ? '' : 's'} late for when it's needed` : ''}`)),
      );
      return { text: blocks(head, lines.join('\n')) };
    }
    case 'get_next_hold_point': {
      const p = await pickJob(api, args.job);
      if (!p.ok) return p;
      const h = (await api.getJobOverview(p.job.jobId)).nextHoldPoint;
      const head = b(`${p.job.name} · Next hold point`);
      if (!h) return { text: `${head}\nNo hold point coming up.` };
      const when = h.forecastStart ? `, ${formatDate(h.forecastStart, today)}` : '';
      const photos = !h.required.length
        ? null
        : h.ok
          ? esc(`All ${h.required.length} photo categories have photos.`)
          : [esc(`${h.filledCount} of ${h.required.length} photo categories filled. Still need:`), ...h.missingCategories.map((c) => bullet(esc(c)))].join('\n');
      return { text: blocks(`${head}\n${esc(`${h.stepName}${when}`)}`, photos) };
    }
    default:
      return { text: esc("I can't answer that one yet. Ask about a job's finish, what we're waiting on, or shipments.") };
  }
}
