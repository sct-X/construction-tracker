/**
 * Setup: new job. A build job is copied from a template (stages, steps, links,
 * needs, photo categories) with planned dates run forward from the start date;
 * a design job gets the DA or CDC checklist. The preview shows the planned
 * finish and each stage's dates before anything is saved.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  addCalendarDays,
  formatDate,
  formatLong,
  lastMonday,
  type Change,
  type DashboardApi,
  type ISODate,
  type SetupPreview,
  type Stage,
  type Step,
  type TemplateRow,
} from '@ct/core';
import { useData, useSideQuery } from '../data/DataContext';
import { useJobQuery } from '../data/useJobQuery';
import { jobHome } from '../app/jobNav';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { SetupFrame } from '../setup/SetupFrame';
import { canSave, previewProblem, usePreview, type PreviewState, type SetupCall } from '../setup/preview';
import { checkDate, checkMoney, checkName, moneyValue } from '../setup/validate';
import { plural } from '../ui/itemWords';

interface NewJobData {
  today: ISODate;
  templates: TemplateRow[];
}

/** Every template on every side: a template on one side can start a job on the other. */
export async function loadNewJob(api: DashboardApi): Promise<NewJobData> {
  const [today, templates] = await Promise.all([api.getToday(), api.listTemplates()]);
  return { today, templates: templates.filter((t) => t.kind === 'build') };
}

const NO_TEMPLATE = '__none__';

function loadTemplateProgram(api: DashboardApi, id: string) {
  return id === NO_TEMPLATE ? Promise.resolve(null) : api.getProgramSetup(id);
}

/** "?template=tpl-duplex" in the hash preselects a template (Templates screen's "Start a job"). */
function templateFromHash(): string | null {
  const q = (globalThis.location?.hash ?? '').split('?')[1] ?? '';
  return new URLSearchParams(q).get('template');
}

export function SetupNewJobScreen() {
  const q = useSideQuery(loadNewJob);
  return (
    <SetupFrame title="New job" sub="Start a build from a template, or a design job with its approval checklist. Nothing is saved until you press Create.">
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading templates" />}
      {q.status === 'error' && <LoadError what="the templates" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <NewJobForm data={q.data} />}
    </SetupFrame>
  );
}

type Kind = 'build' | 'design';

export function NewJobForm({ data }: { data: NewJobData }) {
  const { api, sides, sideId, refresh } = useData();
  const { today, templates } = data;
  const wanted = templateFromHash();
  const [kind, setKind] = useState<Kind>(templates.length ? 'build' : 'design');
  const [templateId, setTemplateId] = useState(templates.find((t) => t.jobId === wanted)?.jobId ?? templates[0]?.jobId ?? '');
  const [name, setName] = useState('');
  const [side, setSide] = useState(sideId ?? sides[0]?.id ?? '');
  const [path, setPath] = useState<'' | 'DA' | 'CDC'>('');
  const [startDate, setStartDate] = useState<string>(addCalendarDays(lastMonday(today), 7));
  const [fromStage, setFromStage] = useState('');
  const [cost, setCost] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const program = useJobQuery(loadTemplateProgram, kind === 'build' && templateId ? templateId : NO_TEMPLATE);
  const tplStages = program.status === 'ready' && program.data ? program.data.stages : [];

  const errors = {
    name: checkName(name, 'job'),
    startDate: kind === 'build' ? checkDate(startDate, 'start date') : null,
    cost: checkMoney(cost),
    template: kind === 'build' && !templateId ? 'Pick a template.' : null,
  };
  const valid = !errors.name && !errors.startDate && !errors.cost && !errors.template;

  const call = useMemo<SetupCall | null>(() => {
    if (!valid) return null;
    const weeklyHoldingCost = moneyValue(cost) ?? undefined;
    if (kind === 'design') {
      return { op: 'create_job', args: { name: name.trim(), kind: 'design', path: path || 'DA', side, weeklyHoldingCost } };
    }
    return {
      op: 'copy_template',
      args: { template: templateId, name: name.trim(), startDate, startsFromStage: fromStage || undefined, weeklyHoldingCost, path: path || undefined, side },
    };
  }, [valid, kind, name, path, side, cost, templateId, startDate, fromStage]);
  const preview = usePreview(call);

  async function create() {
    setTouched(true);
    if (!call || !canSave(preview)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await api.applySetup(call.op, call.args);
      if (!r.ok) {
        setSaveError(r.reason);
        return;
      }
      const jobId = r.result.changes.find((c) => c.kind === 'insert' && c.table === 'job')?.rowId;
      refresh();
      if (jobId) window.location.hash = jobHome({ jobId, kind });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const show = (msg: string | null) => (touched ? msg : null);

  return (
    <form
      className="su-newjob"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <div className="su-form">
        <fieldset className="su-fieldset">
          <legend className="su-legend">What kind of job</legend>
          <div className="oseg seg-small" role="group" aria-label="Kind of job">
            <button type="button" className="seg-btn" aria-pressed={kind === 'build'} onClick={() => setKind('build')} disabled={!templates.length}>
              Build, from a template
            </button>
            <button type="button" className="seg-btn" aria-pressed={kind === 'design'} onClick={() => setKind('design')}>
              Design, approval checklist
            </button>
          </div>
          {!templates.length && (
            <p className="su-hint">
              No templates yet. Build the duplex template first on <a href={href('/setup/templates')}>Templates</a>.
            </p>
          )}
        </fieldset>

        {kind === 'build' && (
          <Field id="nj-template" label="Template" error={show(errors.template)}>
            <select id="nj-template" value={templateId} onChange={(e) => (setTemplateId(e.target.value), setFromStage(''))}>
              {templates.map((t) => (
                <option key={t.jobId} value={t.jobId}>
                  {t.name} ({plural(t.stages, 'stage')}, {plural(t.steps, 'step')})
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field id="nj-name" label="Job name" hint='As you say it, like "Smith St".' error={show(errors.name)}>
          <input id="nj-name" type="text" value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} onBlur={() => name && setTouched(true)} />
        </Field>

        <div className="su-row2">
          <Field id="nj-side" label="Side">
            <select id="nj-side" value={side} onChange={(e) => setSide(e.target.value)}>
              {sides.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="nj-path" label="Approval path">
            <select id="nj-path" value={path} onChange={(e) => setPath(e.target.value as '' | 'DA' | 'CDC')}>
              {kind === 'build' && <option value="">Not set</option>}
              <option value="DA">DA, through council</option>
              <option value="CDC">CDC, through a certifier</option>
            </select>
          </Field>
        </div>

        {kind === 'build' && (
          <div className="su-row2">
            <Field id="nj-start" label="Start date" hint="Planned dates run forward from here, in working days." error={show(errors.startDate)}>
              <input id="nj-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field id="nj-from" label="Starts from stage" hint="For a job already under way: earlier stages are marked done.">
              <select id="nj-from" value={fromStage} onChange={(e) => setFromStage(e.target.value)}>
                <option value="">The first stage</option>
                {tplStages.slice(1).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field id="nj-cost" label="Weekly holding cost" hint="Dollars a week. The bot prices a slip with it on its confirm card." error={show(errors.cost)}>
          <span className="su-money">
            <span aria-hidden="true">$</span>
            <input id="nj-cost" type="text" inputMode="decimal" value={cost} placeholder="4500" onChange={(e) => setCost(e.target.value)} />
          </span>
        </Field>

        <div className="su-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || (touched && (!valid || !canSave(preview)))} data-testid="nj-create">
            {saving ? 'Creating…' : name.trim() ? `Create ${name.trim()}` : 'Create job'}
          </button>
          {saveError && (
            <p className="su-error" role="alert">
              {saveError}
            </p>
          )}
        </div>
      </div>

      <NewJobPreview kind={kind} preview={preview} today={today} valid={valid} name={name.trim()} />
    </form>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className={error ? 'su-field has-error' : 'su-field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="su-hint">{hint}</span>}
      {error && (
        <span className="su-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

interface StageLine {
  id: string;
  name: string;
  done: boolean;
  start: ISODate | null;
  end: ISODate | null;
  steps: number;
}

/** Stage dates from the proposal's inserted rows. */
export function stageLines(preview: SetupPreview): { finish: ISODate | null; stages: StageLine[] } {
  if (preview.result.kind !== 'proposal') return { finish: null, stages: [] };
  const rows = <T,>(table: Change['table']) =>
    preview.result.kind === 'proposal'
      ? preview.result.changes.filter((c): c is Extract<Change, { kind: 'insert' }> => c.kind === 'insert' && c.table === table).map((c) => c.row as unknown as T)
      : [];
  const job = rows<{ plannedFinish: ISODate | null }>('job')[0];
  const steps = rows<Step>('step');
  const stages = rows<Stage>('stage')
    .sort((a, b) => a.order - b.order)
    .map((s): StageLine => {
      const mine = steps.filter((x) => x.stageId === s.id);
      const starts = mine.map((x) => x.plannedStart).filter((d): d is string => !!d).sort();
      const ends = mine.map((x) => x.plannedEnd).filter((d): d is string => !!d).sort();
      return { id: s.id, name: s.name, done: s.status === 'done', start: starts[0] ?? null, end: ends[ends.length - 1] ?? null, steps: mine.length };
    });
  return { finish: job?.plannedFinish ?? null, stages };
}

function NewJobPreview({ kind, preview, today, valid, name }: { kind: Kind; preview: PreviewState; today: ISODate; valid: boolean; name: string }) {
  const problem = previewProblem(preview);
  return (
    <aside className="su-panel su-nj-preview" aria-label="Preview" aria-live="polite" data-testid="nj-preview">
      <h2 className="su-panel-h">Before you create it</h2>
      {!valid && <p className="su-muted">Fill in the job name{kind === 'build' ? ' and start date' : ''} to see the {kind === 'build' ? 'planned dates' : 'checklist'}.</p>}
      {valid && preview.status === 'checking' && <p className="su-muted">Working out the dates…</p>}
      {problem && (
        <p className="su-error" role="alert" data-testid="nj-problem">
          {problem}
        </p>
      )}
      {valid && preview.status === 'ready' && preview.preview.result.kind === 'proposal' && (
        <PreviewBody kind={kind} preview={preview.preview} today={today} name={name} />
      )}
    </aside>
  );
}

function PreviewBody({ kind, preview, today, name }: { kind: Kind; preview: SetupPreview; today: ISODate; name: string }) {
  const { finish, stages } = stageLines(preview);
  if (kind === 'design') {
    return (
      <>
        <p className="su-panel-lead">{name} gets this checklist, starting at the first stage:</p>
        <ol className="su-nj-checklist">
          {stages.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ol>
        <p className="su-muted">Design jobs have no program and no finish date until they become a build.</p>
      </>
    );
  }
  const live = stages.filter((s) => !s.done && s.start && s.end);
  const done = stages.filter((s) => s.done);
  const first = live[0]?.start ?? null;
  const span = first && finish ? Math.max(1, dayNumber(finish) - dayNumber(first) + 1) : 1;
  return (
    <>
      <p className="su-nj-finish-label">Planned finish</p>
      <p className="su-nj-finish" data-testid="nj-finish">
        {finish ? formatLong(finish) : 'No finish'}
      </p>
      {first && <p className="su-muted">Starts {formatDate(first, today)}. The forecast starts equal to the plan.</p>}
      {done.length > 0 && (
        <p className="su-nj-done" data-testid="nj-done">
          Marked done: {done.map((s) => s.name).join(', ')}.
        </p>
      )}
      <ol className="su-nj-stages" data-testid="nj-stages">
        {live.map((s) => {
          const left = ((dayNumber(s.start!) - dayNumber(first!)) / span) * 100;
          const width = Math.max(1.5, ((dayNumber(s.end!) - dayNumber(s.start!) + 1) / span) * 100);
          return (
            <li key={s.id} className="su-nj-stage">
              <span className="su-nj-stage-name">{s.name}</span>
              <span className="su-nj-stage-dates">
                {formatDate(s.start!, today)} to {formatDate(s.end!, today)}
              </span>
              <span className="su-nj-track" aria-hidden="true">
                <span className="su-nj-bar" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Days since 1970 for a calendar date (UTC arithmetic on the date only, never the time zone). */
function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
