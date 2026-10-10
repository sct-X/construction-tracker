/**
 * The Overview: the web's home (v1's Overview, timing first; SPEC "Revision
 * 2026-10-10"). One card per job: its name, a slim bar across its stages with
 * the current one named, the next three not-done steps with their dates, the
 * top three waiting-on items with one date phrase each, and how fresh that is,
 * in words. A job with anything past its date carries the one red cue,
 * "! 4 overdue". No forecast finish, slip or money.
 *
 * Builds first in the side's order, then design jobs, oldest outstanding item
 * first. A column of cards on the phone, a grid of the same cards on the
 * desktop. The job's name is the card's link (stretched over the whole card).
 */
import type { DashboardApi, OverviewRow, OverviewView, SideFilter, WaitingRow } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { usePhoneWidth } from '../shell/useNarrow';
import { LoadError, LoadingRows } from '../components/bits';
import { PageHeader } from '../components/PageHeader';
import { StageBar } from '../components/StageBar';
import { StatusText } from '../components/StatusText';
import { href } from '../app/router';
import { jobHome } from '../app/jobNav';
import { stepWhen, whenWords } from '../ui/when';
import { plural } from '../ui/format';
import '../styles/overview.css';

export function loadOverviewView(api: DashboardApi, filter: SideFilter): Promise<OverviewView> {
  return api.getOverview(filter);
}

export function OverviewScreen() {
  const q = useSideQuery(loadOverviewView);
  const phone = usePhoneWidth();
  return (
    <div className="overview" data-testid="overview-screen">
      <PageHeader
        title="Overview"
        actions={
          phone ? null : (
            <a href={href('/setup')} className="btn btn--primary btn--desktop" data-testid="overview-new-job">
              New job
            </a>
          )
        }
      />
      {q.status === 'loading' && <LoadingRows rows={3} label="Loading the overview" />}
      {q.status === 'error' && <LoadError what="the overview" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <OverviewBody view={q.data} />}
    </div>
  );
}

export function OverviewBody({ view }: { view: OverviewView }) {
  if (view.builds.length === 0 && view.design.length === 0) {
    return (
      <p className="empty-line" data-testid="overview-empty">
        No jobs on this side yet.
      </p>
    );
  }
  return (
    <>
      {view.builds.length > 0 && <CardGroup id="overview-builds" title="Builds" rows={view.builds} today={view.today} />}
      {view.design.length > 0 && <CardGroup id="overview-design" title="Design" rows={view.design} today={view.today} />}
    </>
  );
}

function CardGroup({ id, title, rows, today }: { id: string; title: string; rows: OverviewRow[]; today: string }) {
  return (
    <section className="overview__group" aria-labelledby={`${id}-title`} data-testid={id}>
      <h2 className="overview__group-title" id={`${id}-title`}>
        {title}
      </h2>
      <ul className="overview__cards">
        {rows.map((row) => (
          <li key={row.jobId}>
            <JobCard row={row} today={today} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "4 overdue": the card's one red cue, only when an open item is past its date. */
export function overdueWords(n: number): string | null {
  return n > 0 ? `${n} overdue` : null;
}

/** "2 outstanding, oldest 23 days", "Nothing outstanding": how long something has sat is not a missed date, so never red. */
export function outstandingWords(outstanding: number, oldestDays: number | null): string {
  if (!outstanding) return 'Nothing outstanding';
  return oldestDays === null ? `${outstanding} outstanding` : `${outstanding} outstanding, oldest ${plural(oldestDays, 'day')}`;
}

function JobCard({ row, today }: { row: OverviewRow; today: string }) {
  const overdue = overdueWords(row.overdue);
  const stage = row.stageLabel ?? (row.stages.length === 0 ? 'No program yet' : 'All stages done');
  const position = row.kind === 'design' && row.path ? `${row.path}, ${row.stagePosition.toLowerCase()}` : row.stagePosition;
  return (
    <article className="overview__card" data-testid={`overview-card-${row.jobId}`} data-kind={row.kind} data-overdue={row.overdue || undefined} aria-labelledby={`card-${row.jobId}-name`}>
      <div className="overview__head">
        <h3 className="overview__name" id={`card-${row.jobId}-name`}>
          <a href={jobHome(row)} className="overview__link">
            {row.name}
          </a>
        </h3>
        {overdue ? (
          <StatusText tone="late" plain className="overview__overdue" testId="card-overdue">
            {overdue}
          </StatusText>
        ) : (
          <span className="overview__clear" data-testid="card-overdue">
            Nothing overdue
          </span>
        )}
        <span className="chevron overview__chevron" aria-hidden="true" />
      </div>
      <StageBar stages={row.stages} currentStageId={row.currentStageId} label={`${row.stagePosition}${row.stageLabel ? `, ${row.stageLabel}` : ''}`} testId="card-bar" />
      <p className="overview__stage">
        <span className="overview__stage-name" data-testid="card-stage">
          {stage}
        </span>
        <span className="overview__stage-of">{position}</span>
      </p>

      {row.kind === 'build' && (
        <div className="overview__part">
          <h4 className="overview__part-title">Next</h4>
          {row.nextSteps.length === 0 ? (
            <p className="overview__quiet">Nothing left</p>
          ) : (
            <ul className="overview__lines" data-testid="card-next">
              {row.nextSteps.map((s) => {
                const hp = s.isHoldPoint && row.nextHoldPoint?.stepId === s.stepId ? row.nextHoldPoint : null;
                return (
                  <li key={s.stepId} className="overview__line" data-testid={`card-step-${s.stepId}`}>
                    <span className="overview__line-title">{s.name}</span>
                    <span className="overview__line-when" data-testid="card-step-when">
                      {stepWhen(s, today)}
                      {hp && hp.required > 0 && hp.filled < hp.required ? `, hold point, ${hp.filled} of ${hp.required} photo sets` : hp ? ', hold point' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="overview__part">
        <h4 className="overview__part-title">
          Waiting on
          {row.kind === 'design' && <span className="overview__part-note">{outstandingWords(row.outstanding, row.oldestDays)}</span>}
        </h4>
        {row.waitingOn.length === 0 ? (
          <p className="overview__quiet">Nothing open</p>
        ) : (
          <ul className="overview__lines" data-testid="card-waiting">
            {row.waitingOn.map((w) => (
              <WaitLine key={w.itemId} w={w} today={today} />
            ))}
          </ul>
        )}
      </div>

      <p className="overview__fresh" data-testid="card-fresh" data-unconfirmed={row.unconfirmed ? 'true' : 'false'}>
        {row.freshnessWords}
      </p>
    </article>
  );
}

function WaitLine({ w, today }: { w: WaitingRow; today: string }) {
  const when = whenWords(w, today);
  return (
    <li className="overview__line" data-testid={`card-wait-${w.itemId}`} data-overdue={w.overdue || undefined}>
      <span className="overview__line-title">{w.title}</span>
      <StatusText tone={when.tone === 'late' ? 'late' : when.tone === 'muted' ? 'muted' : 'plain'} plain className="overview__line-when" testId="card-wait-when">
        {when.text}
      </StatusText>
    </li>
  );
}
