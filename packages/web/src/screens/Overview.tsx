/**
 * The Overview: the web's home, v1's FINAL card (Dom's D8/D9, round 2; v1
 * PRODUCT.md): one card per job with only its name, a slim bar across its
 * stages, the current stage, and the one red cue "! 4 overdue" (or "Nothing
 * overdue"). The whole card opens the job, whose first page holds the detail
 * (progress, overdue items, trades on this week, freshness). No finish, slip
 * or money. Builds first in the side's order, then design jobs, oldest
 * outstanding item first. A column on the phone, a grid on the desktop.
 */
import type { DashboardApi, OverviewRow, OverviewView, SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { usePhoneWidth } from '../shell/useNarrow';
import { LoadError, LoadingRows } from '../components/bits';
import { PageHeader } from '../components/PageHeader';
import { StageBar } from '../components/StageBar';
import { StatusText } from '../components/StatusText';
import { href } from '../app/router';
import { jobHome } from '../app/jobNav';
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
      {view.builds.length > 0 && <CardGroup id="overview-builds" title="Builds" rows={view.builds} />}
      {view.design.length > 0 && <CardGroup id="overview-design" title="Design" rows={view.design} />}
    </>
  );
}

function CardGroup({ id, title, rows }: { id: string; title: string; rows: OverviewRow[] }) {
  return (
    <section className="overview__group" aria-labelledby={`${id}-title`} data-testid={id}>
      <h2 className="overview__group-title" id={`${id}-title`}>
        {title}
      </h2>
      <ul className="overview__cards">
        {rows.map((row) => (
          <li key={row.jobId}>
            <JobCard row={row} />
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

function JobCard({ row }: { row: OverviewRow }) {
  const overdue = overdueWords(row.overdue);
  const stage = row.stageLabel ?? (row.stages.length === 0 ? 'No program yet' : 'All stages done');
  return (
    <a href={jobHome(row)} className="overview__card" data-testid={`overview-card-${row.jobId}`} data-kind={row.kind} data-overdue={row.overdue || undefined}>
      <span className="overview__name">{row.name}</span>
      <StageBar stages={row.stages} currentStageId={row.currentStageId} label={`${row.stagePosition}${row.stageLabel ? `, ${row.stageLabel}` : ''}`} testId="card-bar" />
      <span className="overview__foot">
        <span className="overview__stage" data-testid="card-stage">
          {stage}
        </span>
        {overdue ? (
          <StatusText tone="late" plain className="overview__overdue" testId="card-overdue">
            {overdue}
          </StatusText>
        ) : (
          <span className="overview__clear" data-testid="card-overdue">
            Nothing overdue
          </span>
        )}
      </span>
      <span className="chevron overview__chevron" aria-hidden="true" />
    </a>
  );
}
