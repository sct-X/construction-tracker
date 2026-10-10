/** Setup: programs. Every build job on this side, each with a link into the program editor. */
import { stageDisplayName, type DashboardApi, type JobsListView, type SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { SetupFrame } from '../setup/SetupFrame';
import { plural } from '../ui/itemWords';

export function loadPrograms(api: DashboardApi, filter: SideFilter): Promise<JobsListView> {
  return api.listJobs(filter);
}

export function SetupProgramsScreen() {
  const q = useSideQuery(loadPrograms);
  const meta = q.status === 'ready' ? (q.data.builds.length ? plural(q.data.builds.length, 'build') : 'No builds yet') : null;
  return (
    <SetupFrame title="Programs" meta={meta}>
      {q.status === 'loading' && <LoadingRows rows={3} label="Loading jobs" />}
      {q.status === 'error' && <LoadError what="the jobs" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ProgramsList view={q.data} />}
    </SetupFrame>
  );
}

/** One inset grouped list: each build with its stage now, opening its editor. */
function ProgramsList({ view }: { view: JobsListView }) {
  if (!view.builds.length) {
    return (
      <p className="empty-line">
        No builds on this side yet. Start one from <a href={href('/setup')}>New job</a>.
      </p>
    );
  }
  return (
    <section className="group su-programs" aria-label="Builds">
      <ul className="group__list" data-testid="setup-programs">
        {view.builds.map((j) => (
          <li key={j.jobId} data-testid={`setup-program-${j.jobId}`}>
            <a className="cell cell--link su-programs__cell" href={href(`/setup/programs/${encodeURIComponent(j.jobId)}`)} aria-label={`Edit ${j.name}'s program`}>
              <span className="cell__title su-programs__name">{j.name}</span>
              <span className="cell__detail">{stageDisplayName(j.currentStageName) ?? 'Not started'}</span>
            </a>
          </li>
        ))}
      </ul>
      {view.design.length > 0 && <p className="group__footer">Design jobs have a checklist, not a program: {view.design.map((d) => d.name).join(', ')}.</p>}
    </section>
  );
}
