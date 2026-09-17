/**
 * New job (UI_PLAN 3.21): turns a template into a dated job.
 *
 * `#/jobs/new?template=<id>`. Name, side, kind (build | design), path
 * (DA | CDC), weekly holding cost, template (buttons), start date, and
 * "starts from stage" for a live job that is already part way: the stages
 * before it are marked done and the planned dates run forward from the
 * start date. The planned finish is derived live through
 * `api.previewTemplate` (the template's durations over working days from
 * the start date) and drawn as the screen's one hero figure before Create.
 *
 * Create goes through `api.copyTemplate`; a design job with no template
 * goes through `api.addJob`, which gives it the standard DA or CDC
 * checklist stages (rule 9). The new job then opens; the jobs list and
 * Monday show it with forecast = planned and "Slip appears after the first
 * Monday", because no snapshot exists yet.
 *
 * Creating a job sets dates, so Create needs signal.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { ApprovalPath, JobKind } from '../domain/types';
import { calendarDaysBetween, formatLong, formatShort, isISODate, nextMonday } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { PageHeader } from '../shell/PageHeader';
import { countWords, plural, type TemplateShape } from './Templates';
import './newJob.css';

const KIND_WORDS: Record<JobKind, { name: string; sub: string }> = {
  build: { name: 'Build', sub: 'a program of steps with a forecast finish' },
  design: { name: 'Design', sub: 'a checklist of stages, no program' },
};
const PATH_WORDS: Record<ApprovalPath, string> = { DA: 'DA, through council', CDC: 'CDC, through a certifier' };

/** Stage ids in a `startsFrom` list: the first stage means "from the start". */
export default function NewJob() {
  const api = useApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { role, side, sides, today, offline } = useSession();
  const templates = useQuery((api) => api.listTemplates(), []);
  const canMoney = role === 'admin' || role === 'partner';

  const preset = params.get('template');
  const presetTemplate = templates.find((t) => t.id === preset);

  const [name, setName] = useState('');
  const [sideId, setSideId] = useState(side.id);
  const [kind, setKind] = useState<JobKind>(presetTemplate?.kind ?? 'build');
  const [path, setPath] = useState<ApprovalPath>(presetTemplate?.path ?? 'DA');
  const [holding, setHolding] = useState('');
  const [templateId, setTemplateId] = useState<string>(presetTemplate?.id ?? templates.find((t) => t.kind === kind)?.id ?? '');
  const [startDate, setStartDate] = useState(nextMonday(today));
  const [fromStageId, setFromStageId] = useState<string>('');

  const options = templates.filter((t) => t.kind === kind);
  const template = options.find((t) => t.id === templateId);
  const blankDesign = kind === 'design' && templateId === 'blank';
  const shape = useQuery<TemplateShape | undefined>(
    (api) =>
      template
        ? {
            stages: api.listStages(template.id).slice().sort((a, b) => a.order - b.order),
            steps: api.listSteps(template.id),
            links: api.listStepLinks(template.id),
            requirements: api.listRequirements(template.id),
            categories: api.listPhotoCategories(template.id),
          }
        : undefined,
    [template?.id],
  );
  const fromIndex = shape ? Math.max(0, shape.stages.findIndex((s) => s.id === fromStageId)) : 0;
  const validStart = isISODate(startDate);
  const preview = useQuery(
    (api) => (template && validStart ? api.previewTemplate(template.id, { startDate, startsFromStageId: fromStageId || undefined }) : undefined),
    [template?.id, startDate, fromStageId, validStart],
  );

  const pickKind = (k: JobKind) => {
    setKind(k);
    const first = templates.find((t) => t.kind === k);
    setTemplateId(first ? first.id : k === 'design' ? 'blank' : '');
    setFromStageId('');
  };
  const pickTemplate = (id: string) => {
    setTemplateId(id);
    setFromStageId('');
  };

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push('Give it a name, usually the address.');
    if (kind === 'build' && !template) list.push(templates.some((t) => t.kind === 'build') ? 'Pick a template.' : 'There is no build template yet. Build the duplex template first.');
    if (kind === 'design' && !template && !blankDesign) list.push('Pick a template, or the standard checklist.');
    if (!validStart) list.push('Pick a start date.');
    if (holding && (Number.isNaN(Number(holding)) || Number(holding) < 0)) list.push('Holding cost is dollars a week, 0 or more.');
    return list;
  }, [name, kind, template, blankDesign, validStart, holding, templates]);
  const ready = problems.length === 0 && !offline;

  const create = () => {
    if (!ready) return;
    const weeklyHoldingCost = canMoney && holding.trim() !== '' ? Math.round(Number(holding)) : undefined;
    let jobId: string;
    if (template) {
      const job = api.copyTemplate(template.id, {
        name: name.trim(),
        sideId,
        path,
        startDate,
        weeklyHoldingCost,
        startsFromStageId: fromIndex > 0 ? fromStageId : undefined,
      });
      jobId = job.id;
    } else {
      const job = api.addJob({ name: name.trim(), kind: 'design', path, sideId, startDate, weeklyHoldingCost });
      jobId = job.id;
    }
    // A job made for the other side shows there; switch so the overview opens.
    if (sideId !== side.id) api.setSession({ sideId });
    navigate(`/jobs/${jobId}`);
  };

  const weeks = preview?.plannedFinish ? Math.round(calendarDaysBetween(preview.startsOn, preview.plannedFinish) / 7) : 0;
  const doneStageIds = new Set(shape ? shape.stages.slice(0, fromIndex).map((s) => s.id) : []);
  const stepsToRun = shape ? shape.steps.filter((s) => !doneStageIds.has(s.stageId)).length : 0;

  return (
    <main className="page newjob" data-testid="newjob">
      <PageHeader title="New job" back={{ to: '/templates', label: 'Templates' }} meta="Starts from a template. The dates run forward from the day you pick." />

      <form
        className="newjob__form"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="newjob__field">
          <label htmlFor="newjob-name">Name</label>
          <input id="newjob-name" className="newjob__input" value={name} data-testid="newjob-name" placeholder="12 Smith St" autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="newjob__field">
          <span className="newjob__label" id="newjob-side-label">
            Side
          </span>
          {sides.length > 1 ? (
            <div className="newjob__picker" role="group" aria-labelledby="newjob-side-label">
              {sides.map((s) => (
                <button key={s.id} type="button" className="newjob__pick" aria-pressed={s.id === sideId} data-testid={`newjob-side-${s.id}`} onClick={() => setSideId(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          ) : (
            <span data-testid="newjob-side-name">{side.name}</span>
          )}
          {sideId !== side.id && <span className="newjob__hint">It will show once you switch to that side.</span>}
        </div>

        <div className="newjob__field">
          <span className="newjob__label" id="newjob-kind-label">
            Kind
          </span>
          <div className="newjob__picker" role="group" aria-labelledby="newjob-kind-label">
            {(['build', 'design'] as JobKind[]).map((k) => (
              <button key={k} type="button" className="newjob__pick" aria-pressed={kind === k} data-testid={`newjob-kind-${k}`} onClick={() => pickKind(k)}>
                {KIND_WORDS[k].name}
                <span className="newjob__pick-sub">{KIND_WORDS[k].sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="newjob__field">
          <span className="newjob__label" id="newjob-path-label">
            Approval path
          </span>
          <div className="newjob__picker" role="group" aria-labelledby="newjob-path-label">
            {(['DA', 'CDC'] as ApprovalPath[]).map((p) => (
              <button key={p} type="button" className="newjob__pick" aria-pressed={path === p} data-testid={`newjob-path-${p}`} onClick={() => setPath(p)}>
                {PATH_WORDS[p]}
              </button>
            ))}
          </div>
        </div>

        {canMoney && (
          <div className="newjob__field">
            <label htmlFor="newjob-holding">Weekly holding cost</label>
            <div className="newjob__money">
              <span className="newjob__money-sign" aria-hidden="true">
                $
              </span>
              <input id="newjob-holding" className="newjob__input" type="number" min={0} step={100} inputMode="numeric" value={holding} data-testid="newjob-holding" placeholder="4500" onChange={(e) => setHolding(e.target.value)} />
              <span className="newjob__money-unit">/wk</span>
            </div>
            <span className="newjob__hint">Interest, rates and the rest of owning the site. Slip is priced against it on Monday.</span>
          </div>
        )}

        <div className="newjob__field">
          <span className="newjob__label" id="newjob-template-label">
            Template
          </span>
          {options.length === 0 && kind === 'build' ? (
            <p className="newjob__empty" data-testid="newjob-no-templates">
              No build templates yet. Build the duplex template first, or <Link to="/templates">save a running job as one</Link>.
            </p>
          ) : (
            <div className="newjob__picker" role="group" aria-labelledby="newjob-template-label">
              {options.map((t) => (
                <TemplateOption key={t.id} id={t.id} name={t.name} pressed={t.id === templateId} onPick={pickTemplate} />
              ))}
              {kind === 'design' && (
                <button type="button" className="newjob__pick" aria-pressed={blankDesign} data-testid="newjob-template-blank" onClick={() => pickTemplate('blank')}>
                  Standard {path} checklist
                  <span className="newjob__pick-sub">{path === 'DA' ? 'Design, With council, Approved, Construction certificate' : 'Design, With certifier, Approved'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="newjob__field">
          <label htmlFor="newjob-start">{kind === 'build' ? 'Start on site' : 'Start'}</label>
          <input id="newjob-start" className="newjob__input newjob__date" type="date" value={startDate} data-testid="newjob-start" onChange={(e) => setStartDate(e.target.value)} />
          {validStart && preview && preview.startsOn !== startDate && (
            <span className="newjob__hint">That is a weekend or the shutdown; the first working day is {formatShort(preview.startsOn)}.</span>
          )}
        </div>

        {shape && shape.stages.length > 0 && (
          <div className="newjob__field">
            <span className="newjob__label" id="newjob-from-label">
              Starts from
            </span>
            <span className="newjob__hint">A job already under way starts from the stage it is at now. Earlier stages are marked done.</span>
            <div className="newjob__stages" role="group" aria-labelledby="newjob-from-label">
              {shape.stages.map((s, i) => {
                const pressed = i === fromIndex;
                const done = i < fromIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="newjob__stage"
                    aria-pressed={pressed}
                    data-done={done}
                    data-testid={`newjob-from-stage-${s.id}`}
                    onClick={() => setFromStageId(i === 0 ? '' : s.id)}
                  >
                    <span className="newjob__stage-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span>{s.name}</span>
                    <span className="newjob__stage-words">{done ? 'done' : pressed ? (i === 0 ? 'the start' : 'starts here') : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {kind === 'build' && (
          <div className="newjob__finish" data-testid="newjob-planned-finish" aria-live="polite">
            {preview?.plannedFinish ? (
              <>
                <BigNumber value={formatLong(preview.plannedFinish)} label="Planned finish" testId="newjob-planned-finish-date" />
                <p className="newjob__finish-words">
                  {plural(stepsToRun, 'step')} over about {plural(weeks, 'week')} from {formatLong(preview.startsOn)}
                  {fromIndex > 0 && shape ? `, with ${plural(preview.stagesDone, 'stage')} before ${shape.stages[fromIndex].name} marked done` : ''}. Working days only; the shutdown from 21 Dec to 8 Jan is skipped.
                </p>
                <p className="newjob__finish-words">The forecast starts equal to the plan. Slip appears after the first Monday.</p>
              </>
            ) : (
              <p className="newjob__finish-words">Pick a template and a start date to see the planned finish.</p>
            )}
          </div>
        )}
        {kind === 'design' && (
          <div className="newjob__finish" data-testid="newjob-planned-finish">
            <p className="newjob__finish-words">
              A design job has no program and no finish date: the checklist starts at {template && shape?.stages[0] ? shape.stages[0].name : 'Design'} and the Monday screen counts what is outstanding.
            </p>
          </div>
        )}

        {problems.length > 0 && (
          <ul className="newjob__problems" data-testid="newjob-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="newjob__actions">
          <button type="submit" className="btn btn--primary" data-testid="newjob-create" disabled={!ready}>
            {name.trim() ? `Create ${name.trim()}` : 'Create job'}
          </button>
          <Link to="/templates" className="btn btn--desktop" data-testid="newjob-cancel">
            Cancel
          </Link>
          {offline && <span className="newjob__hint">Needs signal: a new job sets dates.</span>}
        </div>
      </form>
    </main>
  );
}

function TemplateOption({ id, name, pressed, onPick }: { id: string; name: string; pressed: boolean; onPick: (id: string) => void }) {
  const words = useQuery(
    (api) => {
      const job = api.getJob(id);
      if (!job) return '';
      return countWords(job, {
        stages: api.listStages(id),
        steps: api.listSteps(id),
        links: api.listStepLinks(id),
        requirements: api.listRequirements(id),
        categories: api.listPhotoCategories(id),
      });
    },
    [id],
  );
  return (
    <button type="button" className="newjob__pick" aria-pressed={pressed} data-testid={`newjob-template-${id}`} onClick={() => onPick(id)}>
      {name}
      <span className="newjob__pick-sub">{words}</span>
    </button>
  );
}
