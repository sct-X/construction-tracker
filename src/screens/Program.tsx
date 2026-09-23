/**
 * Screen 5: build job program (UI_PLAN 3.5, wireframes "Build job program,
 * desktop Gantt" and "How the Gantt works on a phone").
 *
 * Desktop: the Gantt with All / Look-ahead / Late only. Phone: the stages
 * strip and the three-week look-ahead, with a "Full program" link to the
 * Gantt for anyone who insists. Read-only in this stage; bars are links to
 * step detail. Design jobs have no steps, so this route points them to the
 * checklist.
 */
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useSession } from '../data/context';
import { Gantt, type GanttView } from '../components/gantt/Gantt';
import { LookAhead } from '../components/gantt/LookAhead';
import { StagesList, StagesStrip } from '../components/gantt/StagesStrip';
import { JobHeader } from '../shell/JobHeader';
import { useLayout } from '../shell/AppShell';
import NotFound from './NotFound';
import './program.css';

const VIEWS: { key: GanttView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lookahead', label: 'Look-ahead' },
  { key: 'late', label: 'Late only' },
];

export default function Program() {
  const { id = '' } = useParams();
  const { role, today } = useSession();
  const layout = useLayout();
  const [params, setParams] = useSearchParams();
  const job = useQuery((api) => api.getJob(id), [id]);
  const forecast = useQuery((api) => api.getForecast(id), [id]);
  const steps = useQuery((api) => api.listSteps(id), [id]);
  const items = useQuery((api) => api.listItems({ jobId: id }), [id]);

  if (!job) return <NotFound />;

  if (job.kind === 'design') {
    return (
      <main className="page program" data-testid="program">
        <JobHeader job={job} section="program" meta="Program" back={{ to: `/jobs/${job.id}`, label: job.name }} />
        <p className="page__lede" data-testid="program-design-note">
          {job.name} is a design job: no program, a checklist.{' '}
          <Link to={`/jobs/${job.id}`} data-testid="program-checklist-link">
            Open the checklist
          </Link>
        </p>
      </main>
    );
  }

  const viewParam = params.get('view');
  const canEdit = role === 'admin' || role === 'partner';
  const hasProgram = !!forecast && steps.length > 0;

  const setView = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set('view', v);
    else next.delete('view');
    setParams(next, { replace: true });
  };

  const meta = forecast?.currentStageName ? `${forecast.currentStageName} stage` : 'Program';

  const showGantt = layout === 'desktop' || viewParam === 'gantt';
  const ganttView: GanttView = viewParam === 'lookahead' || viewParam === 'late' ? viewParam : 'all';

  const actions = hasProgram ? (
    <>
      {showGantt && layout === 'desktop' && (
        <span className="seg" role="group" aria-label="Show">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              className="seg__btn"
              aria-pressed={ganttView === v.key}
              data-testid={`program-view-${v.key}`}
              onClick={() => setView(v.key === 'all' ? null : v.key)}
            >
              {v.label}
            </button>
          ))}
        </span>
      )}
      {layout === 'phone' && (
        <span className="seg program__phone-views" role="group" aria-label="Show">
          <button type="button" className="seg__btn" aria-pressed={!showGantt} data-testid="program-lookahead-link" onClick={() => setView(null)}>
            Look-ahead
          </button>
          <button type="button" className="seg__btn" aria-pressed={showGantt} data-testid="program-full-link" onClick={() => setView('gantt')}>
            Full program
          </button>
        </span>
      )}
      {canEdit && layout === 'desktop' && (
        <Link to={`/jobs/${job.id}/edit`} className="btn btn--desktop" data-testid="program-edit">
          Edit program
        </Link>
      )}
    </>
  ) : undefined;

  return (
    <main className="page program" data-testid="program" data-layout={layout}>
      <JobHeader job={job} section="program" meta={meta} switchMeta={forecast?.currentStageName ? `Program, ${forecast.currentStageName} stage` : 'Program'} actions={actions} back={{ to: `/jobs/${job.id}`, label: job.name }} />

      {!hasProgram || !forecast ? (
        <p className="page__lede" data-testid="program-empty">
          No program yet.
        </p>
      ) : showGantt ? (
        <Gantt forecast={forecast} steps={steps} today={today} view={ganttView} dense={layout === 'phone'} />
      ) : (
        <>
          <StagesStrip forecast={forecast} />
          <LookAhead forecast={forecast} steps={steps} items={items} today={today} />
          <StagesList forecast={forecast} today={today} />
        </>
      )}
    </main>
  );
}
