/**
 * A build's first page (v1, timing first): is this job on time?
 *
 *   1. Progress: the stage's name, "Stage 5 of 8", a large bar across every
 *      stage, then the next hold point with its date and whether its photo
 *      sets are in.
 *   2. Overdue: every open item of this job past its date (core isOverdue, the
 *      same test as the Overview's count), longest overdue first.
 *   3. Trades on this week: who is on site or starting from today to a week out.
 *   4. Freshness in words at the foot ("Not confirmed for 9 days").
 * No forecast finish, slip or money. The job header (name, switcher, tabs) is
 * the shell's. Next steps and the rest of the open items live in the Program
 * and Waiting on tabs.
 */
import type { DashboardApi, JobOverview, WaitingRow } from '@ct/core';
import { useJobQuery } from '../data/useJobQuery';
import { LoadError, LoadingRows } from '../components/bits';
import { StageBar } from '../components/StageBar';
import { StatusText } from '../components/StatusText';
import { href } from '../app/router';
import { shortRelative, whenWords } from '../ui/when';
import '../styles/job.css';

export function loadOverview(api: DashboardApi, jobId: string): Promise<JobOverview> {
  return api.getJobOverview(jobId);
}

export function JobOverviewScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadOverview, jobId);
  if (q.status === 'loading') return <LoadingRows rows={3} label="Loading the job" />;
  if (q.status === 'error') return <LoadError what="this job" error={q.error} retry={q.retry} />;
  if (q.data.job.kind === 'design') {
    // A design job's home is its checklist.
    globalThis.location?.replace(href(`/jobs/${encodeURIComponent(jobId)}/checklist`));
    return <LoadingRows rows={3} label="Opening the checklist" />;
  }
  return <JobTiming o={q.data} />;
}

/** "1 of 3 required photo sets", "No photo sets needed". */
export function photoSetWords(filled: number, required: number): string {
  if (required === 0) return 'No photo sets needed';
  return `${filled} of ${required} required photo set${required === 1 ? '' : 's'}`;
}

export function JobTiming({ o }: { o: JobOverview }) {
  const today = o.forecast.today;
  const hp = o.nextHoldPoint;
  const stepHref = (stepId: string) => href(`/jobs/${encodeURIComponent(o.job.id)}/steps/${encodeURIComponent(stepId)}`);
  if (o.stages.length === 0) return <p className="empty-line">No program yet.</p>;
  return (
    <div className="job__timing">
      <section className="job__progress" aria-labelledby="job-progress-title" data-testid="job-progress">
        <div className="job__progress-head">
          <h2 id="job-progress-title" className="job__stage-title" data-testid="job-stage">
            {o.stageLabel ?? 'All stages done'}
          </h2>
          <span className="job__stage-of" data-testid="job-stage-of">
            {o.stagePosition}
          </span>
        </div>
        <StageBar stages={o.stages} currentStageId={o.forecast.currentStageId} size="large" label={`${o.stagePosition}${o.stageLabel ? `, ${o.stageLabel}` : ''}`} testId="job-stage-bar" />
        <div className="job__hp" data-testid="job-next-hold">
          {hp ? (
            <a href={stepHref(hp.stepId)} className="cell cell--link job__hp-cell">
              <span className="job__hp-body">
                <span className="job__hp-label">Next hold point</span>
                <span className="job__hp-name">{hp.stepName}</span>
                {hp.forecastStart && <span className="job__hp-when">{shortRelative(hp.forecastStart, today)}</span>}
                <StatusText tone={hp.ok ? 'ok' : 'note'} className="job__hp-photos" testId="job-hold-photos">
                  {photoSetWords(hp.filledCount, hp.required.length)}
                </StatusText>
              </span>
            </a>
          ) : (
            <p className="job__hp-none">No hold points left</p>
          )}
        </div>
      </section>

      <section className="group job__group" aria-labelledby="job-overdue-title" data-testid="job-overdue">
        <h2 id="job-overdue-title" className="group__header group__header--large job__group-head">
          Overdue
          {o.overdue.length > 0 && (
            <span className="job__group-count" data-testid="job-overdue-count">
              {o.overdue.length}
            </span>
          )}
        </h2>
        <ul className="group__list">
          {o.overdue.length === 0 ? (
            <li className="cell job__none" data-testid="job-overdue-none">
              Nothing overdue
            </li>
          ) : (
            o.overdue.map((r) => <OverdueRow key={r.itemId} r={r} today={today} href={r.stepId ? stepHref(r.stepId) : null} />)
          )}
        </ul>
      </section>

      <section className="group job__group" aria-labelledby="job-trades-title" data-testid="job-trades">
        <h2 id="job-trades-title" className="group__header group__header--large">
          Trades on this week
        </h2>
        <ul className="group__list">
          {o.tradesThisWeek.length === 0 ? (
            <li className="cell job__none" data-testid="job-trades-none">
              No trades on this week
            </li>
          ) : (
            o.tradesThisWeek.map((t) => (
              <li key={t.key} className="job__li">
                <a href={stepHref(t.stepId)} className="cell cell--link job__row" data-testid={`job-trade-${t.stepId}`}>
                  <span className="job__row-body">
                    <span className="job__row-title">{t.trade}</span>
                    <span className="job__row-detail">{t.stepName}</span>
                    <span className="job__row-when">{t.when}</span>
                  </span>
                </a>
              </li>
            ))
          )}
        </ul>
      </section>

      <p className="job__fresh" data-testid="job-fresh">
        {o.freshnessWords}
      </p>
    </div>
  );
}

function OverdueRow({ r, today, href: to }: { r: WaitingRow; today: string; href: string | null }) {
  const when = whenWords(r, today);
  const who = r.waitingOn ?? r.owner;
  const body = (
    <span className="job__row-body">
      <span className="job__row-title">{r.title}</span>
      {who && <span className="job__row-detail">{who}</span>}
      <StatusText tone="late" plain className="job__row-late">
        {when.text}
      </StatusText>
    </span>
  );
  return (
    <li className="job__li" data-testid={`job-overdue-${r.itemId}`}>
      {to ? (
        <a href={to} className="cell cell--link job__row">
          {body}
        </a>
      ) : (
        <div className="cell job__row">{body}</div>
      )}
    </li>
  );
}
