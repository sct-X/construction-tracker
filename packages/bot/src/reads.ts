/**
 * Read-only answers for the parser's read tools. Everything goes through
 * DashboardApi (LocalDashboardApi over the store), so a question can never
 * create a change set.
 */
import { formatDate, fuzzyMatch, rankWaiting, type DashboardApi, type ISODate, type JobListRow, type WaitingRow } from '@ct/core';
import { finishSentence, slipText } from './format.js';

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
  if (r.kind === 'ambiguous') return { ok: false, text: `Which job: ${r.candidates.map((c) => c.name).join(' or ')}?` };
  return { ok: false, text: `I can't find a job called "${query}".` };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** "- Book tiler (Tiler): 7 days after needed" */
export function waitingLine(r: WaitingRow, today: ISODate, withJob = false): string {
  const who = r.waitingOn ? ` (${r.waitingOn})` : '';
  const job = withJob ? `${r.jobName}: ` : '';
  let detail: string;
  if (r.isLate && r.lateText) detail = r.expected ? `expected ${formatDate(r.expected, today)}, ${r.lateText}` : r.lateText;
  else if (r.status === 'to_do' && r.actBy) detail = `act by ${formatDate(r.actBy, today)}${r.actByPassed ? ' (passed)' : ''}`;
  else if (r.expected) detail = `expected ${formatDate(r.expected, today)}`;
  else if (r.neededBy) detail = `needed ${formatDate(r.neededBy, today)}`;
  else detail = r.statusLabel.toLowerCase();
  return `- ${job}${r.title}${who}: ${detail}`;
}

function more(n: number): string[] {
  return n > 0 ? [`…and ${n} more.`] : [];
}

export async function answerRead(api: DashboardApi, tool: string, args: Record<string, unknown>): Promise<ReadAnswer> {
  const today = await api.getToday();
  switch (tool) {
    case 'get_job_finish': {
      const p = await pickJob(api, args.job);
      if (!p.ok) return p;
      const o = await api.getJobOverview(p.job.jobId);
      const f = o.forecast;
      if (f.kind === 'design' || !f.forecastFinish) {
        return { text: `${p.job.name} is a design job, so it has no finish date. It's at ${f.currentStageName ?? 'the start'}.` };
      }
      const sentence = finishSentence(p.job.name, f.forecastFinish, f.slipDays, f.slipCost, today);
      const planned = f.plannedFinish && f.lateDays !== 0 ? ` Planned ${formatDate(f.plannedFinish, today)}.` : '';
      return { text: sentence + planned };
    }
    case 'get_why_it_moved': {
      const p = await pickJob(api, args.job);
      if (!p.ok) return p;
      const w = await api.getWhyItMoved(p.job.jobId);
      if (!w.forecastFinish) return { text: `${w.jobName} is a design job, so it has no finish to move.` };
      const since = w.snapshotDate ? ` since ${formatDate(w.snapshotDate, today)}` : '';
      if (!w.slipDays && !w.causes.length) {
        return { text: `${w.jobName} hasn't moved${since}: it finishes ${formatDate(w.forecastFinish, today)}.` };
      }
      const head = `${w.jobName} finishes ${formatDate(w.forecastFinish, today)}, ${slipText(w.slipDays, w.slipCost)}${since}.`;
      const causes = w.causes.map((c) => `- ${c.summary}: ${c.deltaDays === 0 ? 'no change to the finish' : `${c.deltaDays > 0 ? '+' : '-'}${Math.abs(c.deltaDays)} days`}`);
      const other = w.otherDays ? w.lines.filter((l) => /reasons not in the change log/.test(l)).map((l) => `- ${l}`) : [];
      return { text: [head, ...causes, ...other].join('\n') };
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
      const rows = rankWaiting(view.groups.flatMap((g) => g.rows), today);
      const whose = owner ? ` for ${owner}` : '';
      if (!rows.length) return { text: `${label}: nothing outstanding${whose}.` };
      const lines = rows.slice(0, MAX_ROWS).map((r) => waitingLine(r, today, !jobId));
      return { text: [`${label}, ${rows.length} outstanding${whose}:`, ...lines, ...more(rows.length - MAX_ROWS)].join('\n') };
    }
    case 'get_to_chase': {
      const owner = str(args.owner);
      const view = await api.getToChase(owner ? { owner } : {});
      const rows = view.jobs.flatMap((j) => j.rows);
      if (!rows.length) return { text: 'Nothing to chase in the next two weeks.' };
      const lines = rows.slice(0, MAX_ROWS).map((r) => waitingLine(r, today, true));
      return { text: [`To chase (${rows.length}):`, ...lines, ...more(rows.length - MAX_ROWS)].join('\n') };
    }
    case 'get_shipments': {
      let rows = await api.getShipments();
      if (str(args.job)) {
        const p = await pickJob(api, args.job);
        if (!p.ok) return p;
        rows = rows.filter((r) => r.jobId === p.job.jobId);
      }
      if (!rows.length) return { text: 'No shipments.' };
      const lines = rows.map(
        (r) => `- ${r.name}: ${r.eta ? formatDate(r.eta, today) : 'no ETA'}, ${r.statusLabel.toLowerCase()}${r.isLate ? `, ${r.lateDays} days after needed` : ''}`,
      );
      return { text: lines.join('\n') };
    }
    case 'get_next_hold_point': {
      const p = await pickJob(api, args.job);
      if (!p.ok) return p;
      const h = (await api.getJobOverview(p.job.jobId)).nextHoldPoint;
      if (!h) return { text: `${p.job.name} has no hold point coming up.` };
      const when = h.forecastStart ? `, ${formatDate(h.forecastStart, today)}` : '';
      const photos = h.required.length
        ? h.ok
          ? ` All ${h.required.length} photo categories have photos.`
          : ` ${h.filledCount} of ${h.required.length} photo categories filled. Still need: ${h.missingCategories.join('; ')}.`
        : '';
      return { text: `${p.job.name}: ${h.stepName}${when}.${photos}` };
    }
    default:
      return { text: "I can't answer that one yet. Ask about a job's finish, what we're waiting on, or shipments." };
  }
}
