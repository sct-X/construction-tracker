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
  relativeDays,
  stageDisplayName,
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
import { checkDate, checkName } from '../setup/validate';
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
    <SetupFrame title="New job" className="su-nj">
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading templates" />}
      {q.status === 'error' && <LoadError what="the templates" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <NewJobForm data={q.data} />}
    </SetupFrame>
  );
}

type Kind = 'build' | 'design';

const PATHS: { value: 'DA' | 'CDC'; label: string }[] = [
  { value: 'DA', label: 'DA' },
  { value: 'CDC', label: 'CDC' },
];

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
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const program = useJobQuery(loadTemplateProgram, kind === 'build' && templateId ? templateId : NO_TEMPLATE);
  const tplStages = program.status === 'ready' && program.data ? program.data.stages : [];

  const errors = {
    name: checkName(name, 'job'),
    startDate: kind === 'build' ? checkDate(startDate, 'start date') : null,
    template: kind === 'build' && !templateId ? 'Pick a template.' : null,
  };
  const valid = !errors.name && !errors.startDate && !errors.template;

  const call = useMemo<SetupCall | null>(() => {
    if (!valid) return null;
    // No money on the web (SPEC revision 2): a new job takes its template's weekly holding cost, or none;
    // the bot sets it (set_holding_cost).
    if (kind === 'design') {
      return { op: 'create_job', args: { name: name.trim(), kind: 'design', path: path || 'DA', side } };
    }
    return {
      op: 'copy_template',
      args: { template: templateId, name: name.trim(), startDate, startsFromStage: fromStage || undefined, path: path || undefined, side },
    };
  }, [valid, kind, name, path, side, templateId, startDate, fromStage]);
  const preview = usePreview(call);
  const lines = preview.status === 'ready' ? stageLines(preview.preview) : null;

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
  const pickKind = (k: Kind) => {
    setKind(k);
    if (k === 'design' && !path) setPath('DA');
  };
  // The path shown pressed: the one picked, else the template's (v1 had no "Not set").
  const tplPath = templates.find((t) => t.jobId === templateId)?.path ?? null;
  const shownPath = path || (kind === 'build' ? tplPath : 'DA') || '';
  const fromIndex = Math.max(0, tplStages.findIndex((s) => s.id === fromStage));

  return (
    <form
      className="su-nj__form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <Field id="nj-name" label="Job name" error={show(errors.name)}>
        <input id="nj-name" className="input input--desktop" type="text" value={name} placeholder="12 Smith St" autoComplete="off" onChange={(e) => setName(e.target.value)} onBlur={() => name && setTouched(true)} />
      </Field>

      {sides.length > 1 && (
        <Choice label="Side" id="nj-side">
          {sides.map((s) => (
            <button key={s.id} type="button" className="seg__btn" aria-pressed={side === s.id} data-testid={`nj-side-${s.id}`} onClick={() => setSide(s.id)}>
              {s.name}
            </button>
          ))}
        </Choice>
      )}

      <Choice label="Kind" id="nj-kind">
        <button type="button" className="seg__btn" aria-pressed={kind === 'build'} disabled={!templates.length} onClick={() => pickKind('build')}>
          Build
        </button>
        <button type="button" className="seg__btn" aria-pressed={kind === 'design'} onClick={() => pickKind('design')}>
          Design
        </button>
      </Choice>
      {!templates.length && (
        <p className="su-hint">
          No build templates yet. Make one on <a href={href('/setup/templates')}>Templates</a>.
        </p>
      )}

      <Choice label="Approval path" id="nj-path">
        {PATHS.map((p) => (
          <button key={p.label} type="button" className="seg__btn" aria-pressed={shownPath === p.value} data-testid={`nj-path-${p.value}`} onClick={() => setPath(p.value)}>
            {p.label}
          </button>
        ))}
      </Choice>

      {kind === 'build' && (
        <Choice label="Template" id="nj-template" wrap error={show(errors.template)}>
          {templates.map((t) => (
            <button
              key={t.jobId}
              type="button"
              className="seg__btn su-nj__pick"
              aria-pressed={templateId === t.jobId}
              data-testid={`nj-template-${t.jobId}`}
              onClick={() => {
                setTemplateId(t.jobId);
                setFromStage('');
              }}
            >
              {t.name}
              <span className="su-nj__pick-sub">{templateCountWords(t)}</span>
            </button>
          ))}
        </Choice>
      )}

      {kind === 'build' && (
        <Field id="nj-start" label="Start on site" error={show(errors.startDate)}>
          <input id="nj-start" className="input input--desktop su-nj__date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      )}

      {kind === 'build' && tplStages.length > 0 && (
        <div className="su-field">
          <span className="su-label" id="nj-from-label">
            Starts from
          </span>
          <ol className="su-nj__stages" aria-labelledby="nj-from-label" data-testid="nj-stages">
            {tplStages.map((s, i) => {
              const pressed = i === fromIndex;
              const done = i < fromIndex;
              const line = lines?.stages[i];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className="su-nj__stage"
                    aria-pressed={pressed}
                    data-done={done ? 'true' : 'false'}
                    data-testid={`nj-from-${s.id}`}
                    onClick={() => setFromStage(i === 0 ? '' : s.id)}
                  >
                    <span className="su-nj__stage-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="su-nj__stage-name">{s.name}</span>
                    <span className="su-nj__stage-words">
                      {done ? 'done' : line?.start && line.end ? `${formatDate(line.start, today)} to ${formatDate(line.end, today)}` : ''}
                      {pressed && <span className="sr-only">{i === 0 ? ', the start' : ', starts here'}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <NewJobPreview kind={kind} preview={preview} today={today} valid={valid} name={name.trim()} />

      <div className="su-actions">
        <button type="submit" className="btn btn--primary" disabled={saving || (touched && (!valid || !canSave(preview)))} data-testid="nj-create">
          {saving ? 'Creating…' : name.trim() ? `Create ${name.trim()}` : 'Create job'}
        </button>
        {saveError && (
          <p className="su-error" role="alert">
            {saveError}
          </p>
        )}
      </div>
    </form>
  );
}

/** "8 stages, 29 steps, 25 needs, 13 photo sets" (v1 countWords). */
export function templateCountWords(t: Pick<TemplateRow, 'stages' | 'steps' | 'needs' | 'photoSets'>): string {
  return [plural(t.stages, 'stage'), plural(t.steps, 'step'), plural(t.needs ?? 0, 'need'), plural(t.photoSets ?? 0, 'photo set')].join(', ');
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className={error ? 'su-field has-error' : 'su-field'}>
      <label className="su-label" htmlFor={id}>
        {label}
      </label>
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

/** A picker as a segmented control (v1: never a dropdown), with its label. */
function Choice({ id, label, wrap, error, children }: { id: string; label: string; wrap?: boolean; error?: string | null; children: ReactNode }) {
  return (
    <div className="su-field">
      <span className="su-label" id={`${id}-label`}>
        {label}
      </span>
      <div className={wrap ? 'seg su-seg--wrap' : 'seg'} role="group" aria-labelledby={`${id}-label`} data-testid={id}>
        {children}
      </div>
      {error && (
        <span className="su-error" role="alert">
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
    <div className="su-nj__finish" aria-live="polite" data-testid="nj-preview">
      {!valid && <p className="su-nj__words">{kind === 'build' ? 'Give it a name and a start date.' : 'Give it a name.'}</p>}
      {valid && preview.status === 'checking' && <p className="su-nj__words">Working out the dates…</p>}
      {problem && (
        <p className="su-error" role="alert" data-testid="nj-problem">
          {problem}
        </p>
      )}
      {valid && preview.status === 'ready' && preview.preview.result.kind === 'proposal' && <PreviewBody kind={kind} preview={preview.preview} today={today} name={name} />}
    </div>
  );
}

function PreviewBody({ kind, preview, today, name }: { kind: Kind; preview: SetupPreview; today: ISODate; name: string }) {
  const { finish, stages } = stageLines(preview);
  if (kind === 'design') {
    return (
      <>
        <p className="su-nj__words">
          {name} starts at {stageDisplayName(stages[0]?.name ?? 'Design')}. A design job has no program and no finish date.
        </p>
        <ol className="su-nj__checklist" aria-label="Checklist stages">
          {stages.map((s, i) => (
            <li key={s.id}>
              <span className="su-nj__stage-num" aria-hidden="true">
                {i + 1}
              </span>
              {stageDisplayName(s.name)}
            </li>
          ))}
        </ol>
      </>
    );
  }
  const live = stages.filter((s) => !s.done && s.start && s.end);
  const done = stages.filter((s) => s.done);
  const first = live[0]?.start ?? null;
  const steps = live.reduce((n, s) => n + s.steps, 0);
  const weeks = first && finish ? Math.max(1, Math.round((dayNumber(finish) - dayNumber(first) + 1) / 7)) : null;
  return (
    <>
      <p className="su-nj__finish-label">Planned finish</p>
      <p className="su-nj__finish-date" data-testid="nj-finish">
        {finish ? formatLong(finish) : 'No finish'}
      </p>
      {first && (
        <p className="su-nj__words">
          {plural(steps, 'step')}
          {weeks ? `, about ${plural(weeks, 'week')}` : ''}, from {formatLong(first)}, {relativeDays(first, today)}.
        </p>
      )}
      {done.length > 0 && (
        <p className="su-nj__words" data-testid="nj-done">
          Marked done: {done.map((s) => s.name).join(', ')}.
        </p>
      )}
    </>
  );
}

/** Days since 1970 for a calendar date (UTC arithmetic on the date only, never the time zone). */
function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
