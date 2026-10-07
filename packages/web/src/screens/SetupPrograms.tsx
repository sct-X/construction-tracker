/** Setup: programs. Every build job on this side, each with a link into the program editor. */
import { formatLong, type DashboardApi, type JobsListView, type SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { SetupFrame } from '../setup/SetupFrame';

export function loadPrograms(api: DashboardApi, filter: SideFilter): Promise<JobsListView> {
  return api.listJobs(filter);
}

export function SetupProgramsScreen() {
  const q = useSideQuery(loadPrograms);
  return (
    <SetupFrame title="Programs" sub="Change a build's stages and steps. Each change shows what it does to the forecast before you save it.">
      {q.status === 'loading' && <LoadingRows rows={3} label="Loading jobs" />}
      {q.status === 'error' && <LoadError what="the jobs" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ProgramsTable view={q.data} />}
    </SetupFrame>
  );
}

function ProgramsTable({ view }: { view: JobsListView }) {
  if (!view.builds.length) {
    return (
      <p className="empty">
        No builds on this side yet. Start one from <a href={href('/setup')}>New job</a>.
      </p>
    );
  }
  return (
    <>
      <table className="su-table" data-testid="setup-programs">
        <thead>
          <tr>
            <th scope="col">Build</th>
            <th scope="col">Stage now</th>
            <th scope="col">Forecast finish</th>
            <th scope="col">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {view.builds.map((j) => (
            <tr key={j.jobId} data-testid={`setup-program-${j.jobId}`}>
              <th scope="row" className="su-strong">
                {j.name}
              </th>
              <td>{j.currentStageName ?? 'Not started'}</td>
              <td className="su-nowrap">{j.forecastFinish ? formatLong(j.forecastFinish) : 'No finish yet'}</td>
              <td className="su-right">
                <a className="btn su-link-btn" href={href(`/setup/programs/${encodeURIComponent(j.jobId)}`)}>
                  Edit {j.name}'s program
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {view.design.length > 0 && (
        <p className="su-muted su-below">
          Design jobs ({view.design.map((d) => d.name).join(', ')}) have a stage checklist, not a program. Their stages move on through the bot.
        </p>
      )}
    </>
  );
}
