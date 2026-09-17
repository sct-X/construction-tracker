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
import { formatLong } from '../domain/dates';
import { Gantt, lateText, type GanttView } from '../components/gantt/Gantt';
import { LookAhead } from '../components/gantt/LookAhead';
import { StagesList, StagesStrip } from '../components/gantt/StagesStrip';
import { StatusText } from '../components/StatusText';
import { PageHeader } from '../shell/PageHeader';
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
        <PageHeader title={job.name} meta="Program" back={{ to: `/jobs/${job.id}`, label: `Back to ${job.name}` }} />
        <p className="page__lede" data-testid="program-design-note">
          {job.name} is a design job, so it has no steps and no program. Its stages are a checklist:{' '}
          <Link to={`/jobs/${job.id}`} data-testid="program-checklist-link">
            open the checklist
          </Link>
          .
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

  const finish = forecast?.forecastFinish;
  const meta = finish ? (
    <>
      Forecast finish <span className="num">{formatLong(finish)}</span>
      {forecast.lateDays > 0 ? (
        <>
          {' '}
          <StatusText tone="late" plain>
            {lateText(forecast.lateDays)}
          </StatusText>
        </>
      ) : (
        <span className="program__onplan">, on plan</span>
      )}
    </>
  ) : (
    'Program'
  );

  const showGantt = layout === 'desktop' || viewParam === 'gantt';
  const ganttView: GanttView = viewParam === 'lookahead' || viewParam === 'late' ? viewParam : 'all';

  const actions = hasProgram ? (
    <>
      {showGantt && layout === 'desktop' && (
        <div className="program__views" role="group" aria-label="Show">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              className="program__view"
              aria-pressed={ganttView === v.key}
              data-testid={`program-view-${v.key}`}
              onClick={() => setView(v.key === 'all' ? null : v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      {layout === 'phone' &&
        (showGantt ? (
          <button type="button" className="btn" data-testid="program-lookahead-link" onClick={() => setView(null)}>
            Look-ahead
          </button>
        ) : (
          <button type="button" className="btn" data-testid="program-full-link" onClick={() => setView('gantt')}>
            Full program
          </button>
        ))}
      {canEdit && (
        <Link to={`/jobs/${job.id}/edit`} className="btn btn--desktop" data-testid="program-edit">
          Edit program
        </Link>
      )}
    </>
  ) : undefined;

  return (
    <main className="page program" data-testid="program" data-layout={layout}>
      <PageHeader title={job.name} meta={meta} actions={actions} back={{ to: `/jobs/${job.id}`, label: `Back to ${job.name}` }} />

      {!hasProgram || !forecast ? (
        <p className="page__lede" data-testid="program-empty">
          No program yet. Dominic sets this up in the program editor.
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
