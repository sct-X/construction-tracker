/**
 * Setup: the program editor (v1 ProgramEditor look), for a build job or a template. Desktop only.
 *
 * The Gantt is the picture (the Program screen's chart, read-only): a bar picks its step into the panel
 * beside or under it; the numbered stage chips above pick a stage (rename, move, add a step). A template
 * has no dates, so its steps are a list under their stages instead. The footer is v1's: Thick Liquid
 * Glass, sticky, always there. One change at a time: an edit in the panel is dry-run with previewSetup,
 * the chart redraws from the dry run and the footer says what moves (steps only: never the finish or
 * money on the web); Save sends that one setup op. Day-to-day things stay on the bot.
 */
import { useState, type ReactNode } from 'react';
import {
  formatDate,
  stepWhenWords,
  type DashboardApi,
  type ISODate,
  type ProgramSetupView,
  type ProgramView,
  type Requirement,
  type SetupStage,
  type SetupStep,
} from '@ct/core';
import { useData } from '../data/DataContext';
import { useJobQuery } from '../data/useJobQuery';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { Gantt, HoldDiamond } from '../components/gantt/Gantt';
import { SetupFrame } from '../setup/SetupFrame';
import { canSave, MovedSteps, previewProblem, usePreview, type PreviewState } from '../setup/preview';
import { checkDays, checkName, checkWeeks, wholeNumber, weeksValue } from '../setup/validate';
import { plural } from '../ui/itemWords';
import '../styles/program.css';

export interface EditorData {
  today: ISODate;
  view: ProgramSetupView;
  /** The Gantt's data: live builds only (templates and design jobs have no forecast). */
  program: ProgramView | null;
}

export async function loadEditor(api: DashboardApi, jobId: string): Promise<EditorData> {
  const [today, view] = await Promise.all([api.getToday(), api.getProgramSetup(jobId)]);
  const live = view.job.kind === 'build' && !view.job.isTemplate;
  const program = live ? await api.getProgram(jobId).catch(() => null) : null;
  return { today, view, program };
}

/** The one change waiting for Save. `args` is null while the inputs don't make sense yet (then `error` says why). */
export interface PendingEdit {
  key: string;
  label: string;
  op: string;
  args: Record<string, unknown> | null;
  error: string | null;
  /** What the edited input shows meanwhile. */
  draft?: string | boolean;
}

type Pick = { kind: 'step'; id: string } | { kind: 'stage'; id: string } | { kind: 'new-stage' } | null;

export function SetupProgramEditorScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadEditor, jobId);
  const view = q.status === 'ready' ? q.data.view : null;
  const template = !!view?.job.isTemplate;
  return (
    <SetupFrame
      title={view ? view.job.name : 'Program editor'}
      meta={view ? <EditorMeta view={view} /> : undefined}
      back={
        template || !view
          ? { href: href('/setup/templates'), label: 'Templates' }
          : { href: href(`/jobs/${encodeURIComponent(view.job.id)}/program`), label: 'Program' }
      }
      className="su-ed"
    >
      {q.status === 'loading' && <LoadingRows rows={6} label="Loading the program" />}
      {q.status === 'error' && <LoadError what="the program" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ProgramEditor data={q.data} />}
    </SetupFrame>
  );
}

/** "Program editor" / "Template editor, 160 working days" (v1 meta). */
function EditorMeta({ view }: { view: ProgramSetupView }) {
  if (view.job.isTemplate) return <>Template editor, {view.workingDays} working days</>;
  if (view.job.kind === 'design') return <>Checklist</>;
  return <>Program editor</>;
}

export function ProgramEditor({ data }: { data: EditorData }) {
  const { api, refresh } = useData();
  const { view, today } = data;
  const job = view.job;
  const [edit, setEdit] = useState<PendingEdit | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const preview = usePreview(edit?.args ? { op: edit.op, args: edit.args } : null);

  if (job.kind === 'design') {
    return (
      <p className="empty-line">
        {job.name} is a design job: its stages are a checklist that moves on through the bot. <a href={href('/setup/programs')}>Pick a build</a>.
      </p>
    );
  }

  const steps = view.stages.flatMap((s) => s.steps);
  const names = new Map(steps.map((s) => [s.id, s.name]));
  const propose = (e: PendingEdit | null) => {
    setSaved(null);
    setSaveError(null);
    setEdit(e);
  };
  const locked = (key: string) => !!edit && edit.key !== key;
  const ctx: RowCtx = { edit, propose, locked, names, today, job, steps, stages: view.stages, tradeTypes: view.tradeTypes, reset };
  // The chart draws the dry run while a change is pending (v1 redrew from its draft).
  const chart = (preview.status === 'ready' && edit?.args ? preview.preview.program : null) ?? data.program;
  const forecastOf = (stepId: string) => chart?.steps.find((s) => s.stepId === stepId) ?? null;

  async function save() {
    if (!edit?.args || !canSave(preview)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await api.applySetup(edit.op, edit.args);
      if (!r.ok) {
        setSaveError(r.reason);
        return;
      }
      // Keep the panel on what was made or changed (v1).
      const made = (table: string) => r.result.changes.find((c) => c.kind === 'insert' && c.table === table)?.rowId;
      if (edit.op === 'add_step' && made('step')) setPick({ kind: 'step', id: made('step')! });
      else if (edit.op === 'add_stage' && made('stage')) setPick({ kind: 'stage', id: made('stage')! });
      else if (edit.op === 'delete_step') setPick(pick?.kind === 'step' ? { kind: 'stage', id: view.stages.find((st) => st.steps.some((x) => x.id === pick.id))?.id ?? '' } : null);
      else if (edit.op === 'delete_stage') setPick(null);
      setSaved(r.result.summary);
      setEdit(null);
      setReset((n) => n + 1);
      refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const pickedStep = pick?.kind === 'step' ? steps.find((s) => s.id === pick.id) : undefined;
  const pickedStage = pick?.kind === 'stage' ? view.stages.find((s) => s.id === pick.id) : undefined;
  const stageOf = (stepId: string) => view.stages.find((st) => st.steps.some((s) => s.id === stepId))!;

  return (
    <div className="su-ed__body" data-testid="editor">
      {saved && (
        <p className="su-saved" role="status" data-testid="ed-saved">
          Saved: {saved}. It's listed in <a href={href(`/history/${encodeURIComponent(job.id)}`)}>Changes</a>.
        </p>
      )}
      <datalist id="trade-types">
        {view.tradeTypes.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="su-ed__stages" role="group" aria-label="Stages" data-testid="ed-stages">
        {view.stages.map((st, i) => (
          <button
            key={st.id}
            type="button"
            className="su-ed__chip"
            aria-pressed={pick?.kind === 'stage' && pick.id === st.id}
            data-testid={`ed-chip-${st.id}`}
            onClick={() => setPick({ kind: 'stage', id: st.id })}
          >
            <span className="su-ed__chip-n" aria-hidden="true">
              {i + 1}
            </span>
            {st.name}
          </button>
        ))}
        <button type="button" className="su-ed__chip su-ed__chip--add" aria-pressed={pick?.kind === 'new-stage'} data-testid="ed-chip-add" onClick={() => setPick({ kind: 'new-stage' })}>
          Add stage
        </button>
      </div>

      <div className="su-ed__cols">
        <div className="su-ed__chart">
          {chart ? (
            <Gantt p={chart} view="all" onPickStep={(id) => setPick({ kind: 'step', id })} pickedStepId={pick?.kind === 'step' ? pick.id : null} />
          ) : (
            <StepTree view={view} pick={pick} onPick={(id) => setPick({ kind: 'step', id })} />
          )}
        </div>
        <aside className="su-ed__panel" aria-label="Edit" data-testid="editor-panel" data-kind={pick?.kind ?? 'none'}>
          {pickedStep ? (
            <StepPanel key={pickedStep.id} step={pickedStep} stage={stageOf(pickedStep.id)} ctx={ctx} forecast={forecastOf(pickedStep.id)} onPickStage={(id) => setPick({ kind: 'stage', id })} />
          ) : pickedStage ? (
            <StagePanel key={pickedStage.id} stage={pickedStage} ctx={ctx} onPickStep={(id) => setPick({ kind: 'step', id })} />
          ) : pick?.kind === 'new-stage' ? (
            <div className="su-ed__form">
              <h2 className="su-ed__title">New stage</h2>
              <AddStage key={reset} ctx={ctx} />
            </div>
          ) : (
            <div className="su-ed__form">
              <h2 className="su-ed__title">Nothing picked</h2>
              <p className="su-ed__help">{chart ? 'Pick a bar on the chart, or a stage above.' : 'Pick a step from the list, or a stage above.'}</p>
            </div>
          )}
        </aside>
      </div>

      <ChangeBar
        edit={edit}
        preview={preview}
        view={view}
        today={today}
        saving={saving}
        saveError={saveError}
        onSave={() => void save()}
        onDiscard={() => {
          propose(null);
          setReset((n) => n + 1);
        }}
      />
    </div>
  );
}

interface RowCtx {
  edit: PendingEdit | null;
  propose: (e: PendingEdit | null) => void;
  locked: (key: string) => boolean;
  names: Map<string, string>;
  today: ISODate;
  job: ProgramSetupView['job'];
  steps: SetupStep[];
  stages: SetupStage[];
  tradeTypes: string[];
  reset: number;
}

/** What an inline input shows: the pending draft for its key, else the stored value. */
function shown<T extends string | boolean>(ctx: RowCtx, key: string, stored: T): T {
  return ctx.edit?.key === key && ctx.edit.draft !== undefined ? (ctx.edit.draft as T) : stored;
}

/** Templates have no forecast, so no chart: the steps as a list under their stages (v1 StepTree). */
function StepTree({ view, pick, onPick }: { view: ProgramSetupView; pick: Pick; onPick: (id: string) => void }) {
  return (
    <div className="su-ed__tree" data-testid="ed-tree">
      {view.stages.map((st, i) => (
        <section key={st.id} className="su-ed__tree-stage" aria-label={st.name}>
          <h3 className="su-ed__tree-title">
            <span className="su-ed__tree-n" aria-hidden="true">
              {i + 1}
            </span>
            {st.name}
          </h3>
          {st.steps.length === 0 ? (
            <p className="su-ed__help">No steps yet.</p>
          ) : (
            <ul className="su-ed__tree-list">
              {st.steps.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="su-ed__tree-step"
                    aria-pressed={pick?.kind === 'step' && pick.id === s.id}
                    aria-label={`${s.name}, ${plural(s.durationDays, 'working day')}${s.isHoldPoint ? ', hold point' : ''}`}
                    data-testid={`ed-pick-${s.id}`}
                    onClick={() => onPick(s.id)}
                  >
                    <span className="su-ed__tree-name">
                      {s.isHoldPoint && <HoldDiamond className="su-ed__tree-hold-glyph" />}
                      {s.name}
                      {s.isHoldPoint && <span className="su-ed__tree-hold"> hold point</span>}
                    </span>
                    <span className="su-ed__tree-days">{plural(s.durationDays, 'day')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** The panel for one stage (v1 StageForm): rename, move, its steps, add a step, delete when empty. */
function StagePanel({ stage, ctx, onPickStep }: { stage: SetupStage; ctx: RowCtx; onPickStep: (id: string) => void }) {
  const index = ctx.stages.findIndex((s) => s.id === stage.id);
  const last = ctx.stages.length - 1;
  const nameKey = `stage:${stage.id}:name`;
  return (
    <div className="su-ed__form" data-testid={`ed-stage-${stage.id}`}>
      <div>
        <h2 className="su-ed__title">{stage.name}</h2>
        <p className="su-ed__sub">
          Stage {index + 1} of {ctx.stages.length}, {plural(stage.steps.length, 'step')}
        </p>
      </div>
      <div className="su-ed__field">
        <label className="su-label" htmlFor={`stn-${stage.id}`}>
          Stage name
        </label>
        <input
          id={`stn-${stage.id}`}
          className="su-input"
          value={shown(ctx, nameKey, stage.name)}
          disabled={ctx.locked(nameKey)}
          onChange={(e) => {
            const v = e.target.value;
            if (v.trim() === stage.name) return ctx.propose(null);
            const err = checkName(v, 'stage');
            ctx.propose({ key: nameKey, label: `Rename the ${stage.name} stage`, op: 'edit_stage', args: err ? null : { stage: stage.id, name: v.trim() }, error: err, draft: v });
          }}
        />
      </div>
      <div className="su-ed__actions">
        <button
          type="button"
          className="btn btn--desktop"
          aria-label={`Move the ${stage.name} stage up`}
          disabled={index === 0 || ctx.locked(`stage:${stage.id}:order`)}
          onClick={() => ctx.propose({ key: `stage:${stage.id}:order`, label: `Move the ${stage.name} stage up, above ${ctx.stages[index - 1]?.name}`, op: 'edit_stage', args: { stage: stage.id, order: index }, error: null })}
        >
          Move earlier
        </button>
        <button
          type="button"
          className="btn btn--desktop"
          aria-label={`Move the ${stage.name} stage down`}
          disabled={index === last || ctx.locked(`stage:${stage.id}:order`)}
          onClick={() => ctx.propose({ key: `stage:${stage.id}:order`, label: `Move the ${stage.name} stage down, below ${ctx.stages[index + 1]?.name}`, op: 'edit_stage', args: { stage: stage.id, order: index + 2 }, error: null })}
        >
          Move later
        </button>
      </div>
      <section className="su-ed__section" aria-label={`Steps in ${stage.name}`}>
        <h3 className="su-ed__section-title">Steps</h3>
        {stage.steps.length ? (
          <ul className="su-ed__list">
            {stage.steps.map((s) => (
              <li key={s.id} className="su-ed__item" data-step-name={s.name}>
                <button type="button" className="su-ed__link" onClick={() => onPickStep(s.id)}>
                  {s.name}
                </button>
                <span className="su-muted">{plural(s.durationDays, 'day')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="su-ed__help">No steps yet.</p>
        )}
        <AddStep key={`${stage.id}-${ctx.reset}`} stage={stage} ctx={ctx} />
      </section>
      {stage.steps.length === 0 && (
        <section className="su-ed__section">
          <button
            type="button"
            className="btn btn--desktop"
            disabled={ctx.locked(`stage:${stage.id}:delete`)}
            onClick={() => ctx.propose({ key: `stage:${stage.id}:delete`, label: `Delete the empty ${stage.name} stage`, op: 'delete_stage', args: { stage: stage.id }, error: null })}
          >
            Delete stage
          </button>
        </section>
      )}
    </div>
  );
}

/** The panel for one step (v1 StepForm): its fields, its order, what it waits for, what it needs. */
function StepPanel({ step, stage, ctx, forecast, onPickStage }: { step: SetupStep; stage: SetupStage; ctx: RowCtx; forecast: ProgramView['steps'][number] | null; onPickStage: (id: string) => void }) {
  const k = (f: string) => `step:${step.id}:${f}`;
  const isTemplate = ctx.job.isTemplate;
  const index = stage.steps.findIndex((s) => s.id === step.id);
  const nameV = shown(ctx, k('name'), step.name);
  const daysV = shown(ctx, k('days'), String(step.durationDays));
  const holdV = shown(ctx, k('hold'), step.isHoldPoint);
  const tradeV = shown(ctx, k('trade'), step.tradeType ?? '');
  return (
    <div className="su-ed__form" data-testid={`ed-step-${step.id}`} data-step-name={step.name}>
      <div>
        <h2 className="su-ed__title">{step.name}</h2>
        <p className="su-ed__sub">
          <button type="button" className="su-ed__link su-ed__link--quiet" onClick={() => onPickStage(stage.id)}>
            {stage.name}
          </button>{' '}
          stage
        </p>
      </div>
      <div className="su-ed__field">
        <label className="su-label" htmlFor={`sn-${step.id}`}>
          Step name
        </label>
        {/* A one-line textarea that grows, so a long step name wraps instead of being cut off. */}
        <div className="su-grow" data-value={nameV}>
          <textarea
            id={`sn-${step.id}`}
            className="su-input"
            rows={1}
            data-testid="ed-name"
            value={nameV}
            disabled={ctx.locked(k('name'))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            onChange={(e) => {
              const v = e.target.value.replace(/\s*[\r\n]+\s*/g, ' ');
              if (v.trim() === step.name) return ctx.propose(null);
              const err = checkName(v, 'step');
              ctx.propose({ key: k('name'), label: `Rename ${step.name}`, op: 'edit_step', args: err ? null : { step: step.id, name: v.trim() }, error: err, draft: v });
            }}
          />
        </div>
      </div>
      <div className="su-ed__row">
        <div className="su-ed__field su-ed__field--short">
          <label className="su-label" htmlFor={`sd-${step.id}`}>
            Working days
          </label>
          <input
            id={`sd-${step.id}`}
            className="su-input su-num-input"
            inputMode="numeric"
            data-testid="ed-days"
            value={daysV}
            disabled={ctx.locked(k('days'))}
            onChange={(e) => {
              const v = e.target.value;
              if (wholeNumber(v) === step.durationDays) return ctx.propose(null);
              const err = checkDays(v);
              ctx.propose({
                key: k('days'),
                label: `${step.name}: ${step.durationDays} to ${v.trim() || '?'} working days`,
                op: 'edit_step',
                args: err ? null : { step: step.id, durationDays: wholeNumber(v) },
                error: err,
                draft: v,
              });
            }}
          />
        </div>
        <div className="su-ed__field">
          <label className="su-label" htmlFor={`st-${step.id}`}>
            Trade
          </label>
          <input
            id={`st-${step.id}`}
            className="su-input"
            list="trade-types"
            data-testid="ed-trade"
            value={tradeV}
            placeholder="None"
            disabled={ctx.locked(k('trade'))}
            onChange={(e) => {
              const v = e.target.value;
              if (v.trim() === (step.tradeType ?? '')) return ctx.propose(null);
              const err = v.trim() ? null : "Type the trade, like Plumber. A step's trade can be changed here but not cleared.";
              ctx.propose({ key: k('trade'), label: `${step.name}: trade`, op: 'edit_step', args: err ? null : { step: step.id, tradeType: v.trim() }, error: err, draft: v });
            }}
          />
        </div>
      </div>
      {!isTemplate && forecast && (
        <p className="su-ed__derived su-step-dates" data-testid="ed-dates">
          {step.status === 'done' ? 'Done. ' : ''}Forecast <strong>{forecast.forecastStart === forecast.forecastEnd ? formatDate(forecast.forecastStart, ctx.today) : `${formatDate(forecast.forecastStart, ctx.today)} to ${formatDate(forecast.forecastEnd, ctx.today)}`}</strong>
          , {stepWhenWords(forecast, ctx.today)}
          {forecast.lateDays > 0 && step.status !== 'done' ? `, ${plural(forecast.lateDays, 'day')} late` : ''}
        </p>
      )}
      <label className="su-check">
        <input
          type="checkbox"
          data-testid="ed-hold"
          checked={holdV}
          disabled={ctx.locked(k('hold'))}
          onChange={(e) => {
            const v = e.target.checked;
            if (v === step.isHoldPoint) return ctx.propose(null);
            ctx.propose({ key: k('hold'), label: v ? `Make ${step.name} a hold point` : `${step.name} is no longer a hold point`, op: 'edit_step', args: { step: step.id, isHoldPoint: v }, error: null, draft: v });
          }}
        />
        <span>Hold point</span>
      </label>
      <div className="su-ed__actions">
        <IconButton
          label={`Move ${step.name} up`}
          testId="ed-up"
          disabled={index <= 0 || ctx.locked(k('order'))}
          onClick={() => ctx.propose({ key: k('order'), label: `List ${step.name} above ${stage.steps[index - 1]?.name}`, op: 'edit_step', args: { step: step.id, order: index }, error: null })}
        >
          Earlier in {stage.name}
        </IconButton>
        <IconButton
          label={`Move ${step.name} down`}
          testId="ed-down"
          disabled={index === stage.steps.length - 1 || ctx.locked(k('order'))}
          onClick={() => ctx.propose({ key: k('order'), label: `List ${step.name} below ${stage.steps[index + 1]?.name}`, op: 'edit_step', args: { step: step.id, order: index + 2 }, error: null })}
        >
          Later in {stage.name}
        </IconButton>
      </div>
      <StepDetailEditor step={step} ctx={ctx} />
    </div>
  );
}

function IconButton({ label, disabled, onClick, children, testId }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button type="button" className="btn btn--desktop" title={label} disabled={disabled} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}

function weeksWords(n: number): string {
  if (n === 0) return 'no lead time';
  return `${n} week${n === 1 ? '' : 's'}`;
}

function StepDetailEditor({ step, ctx }: { step: SetupStep; ctx: RowCtx }) {
  const others = ctx.stages.map((st) => ({ stage: st, steps: st.steps.filter((s) => s.id !== step.id && !step.waitsFor.includes(s.id)) })).filter((g) => g.steps.length);
  const addKey = `link:${step.id}:add`;
  return (
    <div className="su-ed__details" data-testid={`ed-detail-${step.id}`}>
      <section className="su-ed__section" aria-label={`What ${step.name} waits for`}>
        <h3 className="su-ed__section-title">Waits for</h3>
        {step.waitsFor.length ? (
          <ul className="su-links">
            {step.waitsFor.map((id) => {
              const key = `link:${step.id}:${id}:remove`;
              const name = ctx.names.get(id) ?? id;
              return (
                <li key={id} className={ctx.edit?.key === key ? 'su-link is-pending' : 'su-link'}>
                  <span>{name}</span>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={ctx.locked(key)}
                    onClick={() => ctx.propose({ key, label: `${step.name} stops waiting for ${name}`, op: 'remove_link', args: { step: step.id, waitsFor: id }, error: null })}
                  >
                    Stop waiting<span className="sr-only"> for {name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="su-muted">Nothing. {ctx.job.isTemplate ? 'It starts with the job.' : 'It starts on its planned date.'}</p>
        )}
        <label className="su-mini-label" htmlFor={`addlink-${step.id}`}>
          Add a step it waits for
        </label>
        <select
          id={`addlink-${step.id}`}
          className="su-input"
          value={ctx.edit?.key === addKey ? String(ctx.edit.draft ?? '') : ''}
          disabled={ctx.locked(addKey)}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return ctx.propose(null);
            ctx.propose({ key: addKey, label: `${step.name} waits for ${ctx.names.get(id)}`, op: 'add_link', args: { step: step.id, waitsFor: id }, error: null, draft: id });
          }}
        >
          <option value="">Pick a step</option>
          {others.map((g) => (
            <optgroup key={g.stage.id} label={g.stage.name}>
              {g.steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </section>

      <section className="su-ed__section" aria-label={`What ${step.name} needs`}>
        <h3 className="su-ed__section-title">Needs</h3>
        <p className="su-hint">Act by = forecast start minus the lead time.</p>
        {step.requirements.length > 0 && (
          <ul className="su-reqs">
            {step.requirements.map((r) => (
              <RequirementLine key={r.id} req={r} step={step} ctx={ctx} />
            ))}
          </ul>
        )}
        <AddRequirement key={`${step.id}-${ctx.reset}`} step={step} ctx={ctx} />
      </section>

      <section className="su-ed__section" aria-label={`Remove ${step.name}`}>
        <h3 className="su-ed__section-title">Remove</h3>
        {step.itemCount > 0 ? (
          <p className="su-muted">
            {plural(step.itemCount, 'item')} {step.itemCount === 1 ? 'is' : 'are'} linked to {step.name}, so it stays. Items change through the bot.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn--desktop"
            disabled={ctx.locked(`step:${step.id}:delete`)}
            onClick={() =>
              ctx.propose({ key: `step:${step.id}:delete`, label: `Delete ${step.name}, with its links and needs`, op: 'delete_step', args: { step: step.id }, error: null })
            }
          >
            Delete {step.name}
          </button>
        )}
      </section>
    </div>
  );
}

function RequirementLine({ req, step, ctx }: { req: Requirement; step: SetupStep; ctx: RowCtx }) {
  const key = `req:${req.id}:weeks`;
  const delKey = `req:${req.id}:delete`;
  const v = shown(ctx, key, String(req.leadTimeWeeks));
  return (
    <li className={ctx.edit?.key === key || ctx.edit?.key === delKey ? 'su-req is-pending' : 'su-req'} data-testid={`ed-req-${req.id}`}>
      <span className="su-req-name">
        {req.name}, {weeksWords(req.leadTimeWeeks)} <span className="su-muted">{req.kind === 'trade' ? 'trade to book' : 'material to order'}</span>
      </span>
      <label className="su-req-weeks">
        <input
          className="su-input su-num-input"
          inputMode="decimal"
          value={v}
          disabled={ctx.locked(key)}
          aria-label={`Lead time in weeks for ${req.name}`}
          onChange={(e) => {
            const nv = e.target.value;
            if (weeksValue(nv) === req.leadTimeWeeks) return ctx.propose(null);
            const err = checkWeeks(nv);
            ctx.propose({
              key,
              label: `${req.name} for ${step.name}: lead time ${weeksWords(req.leadTimeWeeks)} to ${nv.trim() || '?'} weeks`,
              op: 'edit_requirement',
              args: err ? null : { requirement: req.id, leadTimeWeeks: weeksValue(nv) },
              error: err,
              draft: nv,
            });
          }}
        />
        <span aria-hidden="true">weeks</span>
      </label>
      <button
        type="button"
        className="btn btn--small"
        disabled={ctx.locked(delKey)}
        onClick={() => ctx.propose({ key: delKey, label: `${step.name} no longer needs ${req.name}`, op: 'delete_requirement', args: { requirement: req.id }, error: null })}
      >
        Remove<span className="sr-only"> {req.name}</span>
      </button>
    </li>
  );
}

function AddRequirement({ step, ctx }: { step: SetupStep; ctx: RowCtx }) {
  const key = `req:new:${step.id}`;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'trade' | 'material'>('material');
  const [weeks, setWeeks] = useState('');
  const disabled = ctx.locked(key);
  const update = (n: string, k: 'trade' | 'material', w: string) => {
    setName(n);
    setKind(k);
    setWeeks(w);
    if (!n.trim() && !w.trim()) return ctx.edit?.key === key ? ctx.propose(null) : undefined;
    const err = (n.trim() ? null : 'Say what the step needs, like Windows or Plumber.') ?? checkWeeks(w);
    ctx.propose({
      key,
      label: `${step.name} needs ${n.trim() || 'something new'}`,
      op: 'add_requirement',
      args: err ? null : { step: step.id, kind: k, name: n.trim(), leadTimeWeeks: weeksValue(w), ...(k === 'trade' ? { tradeType: n.trim() } : {}) },
      error: err,
    });
  };
  return (
    <fieldset className="su-addreq" disabled={disabled}>
      <legend className="su-mini-label">Add a need</legend>
      <input className="su-input" aria-label="What it needs" placeholder="Windows" value={name} onChange={(e) => update(e.target.value, kind, weeks)} />
      <select className="su-input" aria-label="Trade or material" value={kind} onChange={(e) => update(name, e.target.value as 'trade' | 'material', weeks)}>
        <option value="material">Material to order</option>
        <option value="trade">Trade to book</option>
      </select>
      <span className="su-req-weeks">
        <input className="su-input su-num-input" aria-label="Lead time in weeks" inputMode="decimal" placeholder="2" value={weeks} onChange={(e) => update(name, kind, e.target.value)} />
        <span aria-hidden="true">weeks</span>
      </span>
    </fieldset>
  );
}

/** The step a new step should wait for by default: the last one in this stage, else the last in the stage before. */
function defaultAfter(stage: SetupStage, stages: SetupStage[]): string {
  const i = stages.findIndex((s) => s.id === stage.id);
  for (let j = i; j >= 0; j--) {
    const st = stages[j]!;
    const last = st.steps[st.steps.length - 1];
    if (last) return last.id;
  }
  return '';
}

function AddStep({ stage, ctx }: { stage: SetupStage; ctx: RowCtx }) {
  const key = `step:new:${stage.id}`;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const [after, setAfter] = useState(() => defaultAfter(stage, ctx.stages));
  const [hold, setHold] = useState(false);
  const [trade, setTrade] = useState('');
  if (!open) {
    return (
      <button type="button" className="su-add" disabled={!!ctx.edit} onClick={() => setOpen(true)} data-testid={`ed-addstep-${stage.id}`}>
        Add a step to {stage.name}
      </button>
    );
  }
  const update = (p: { name?: string; days?: string; after?: string; hold?: boolean; trade?: string }) => {
    const n = p.name ?? name;
    const d = p.days ?? days;
    const a = p.after ?? after;
    const h = p.hold ?? hold;
    const t = p.trade ?? trade;
    setName(n);
    setDays(d);
    setAfter(a);
    setHold(h);
    setTrade(t);
    const err = checkName(n, 'step') ?? checkDays(d);
    ctx.propose({
      key,
      label: `New step in ${stage.name}: ${n.trim() || 'not named yet'}`,
      op: 'add_step',
      args: err
        ? null
        : { job: ctx.job.id, stage: stage.id, name: n.trim(), durationDays: wholeNumber(d), ...(a ? { after: [a] } : {}), isHoldPoint: h, ...(t.trim() ? { tradeType: t.trim() } : {}) },
      error: err,
    });
  };
  return (
    <fieldset className="su-addstep-form" data-testid={`ed-newstep-${stage.id}`}>
      <legend className="su-mini-label">New step in {stage.name}</legend>
      <label className="su-mini">
        <span>Name</span>
        <input className="su-input" value={name} autoFocus onChange={(e) => update({ name: e.target.value })} />
      </label>
      <label className="su-mini su-mini-days">
        <span>Working days</span>
        <input className="su-input su-num-input" inputMode="numeric" value={days} onChange={(e) => update({ days: e.target.value })} />
      </label>
      <label className="su-mini">
        <span>Waits for</span>
        <select className="su-input" value={after} onChange={(e) => update({ after: e.target.value })}>
          <option value="">Nothing</option>
          {ctx.stages.map((st) =>
            st.steps.length ? (
              <optgroup key={st.id} label={st.name}>
                {st.steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
      </label>
      <label className="su-mini">
        <span>Trade</span>
        <input className="su-input" list="trade-types" value={trade} placeholder="None" onChange={(e) => update({ trade: e.target.value })} />
      </label>
      <label className="su-check su-mini-hold">
        <input type="checkbox" checked={hold} onChange={(e) => update({ hold: e.target.checked })} />
        <span>Hold point</span>
      </label>
      <button
        type="button"
        className="btn btn--small"
        onClick={() => {
          setOpen(false);
          if (ctx.edit?.key === key) ctx.propose(null);
        }}
      >
        Cancel
      </button>
    </fieldset>
  );
}

function AddStage({ ctx }: { ctx: RowCtx }) {
  const key = 'stage:new';
  const [name, setName] = useState('');
  return (
    <div className="su-addstage-form">
      <label className="su-mini-label" htmlFor="new-stage">
        Add a stage at the end
      </label>
      <input
        id="new-stage"
        className="su-input"
        placeholder="Stage name"
        value={name}
        disabled={ctx.locked(key)}
        onChange={(e) => {
          const v = e.target.value;
          setName(v);
          if (!v.trim()) return ctx.edit?.key === key ? ctx.propose(null) : undefined;
          ctx.propose({ key, label: `New stage at the end: ${v.trim()}`, op: 'add_stage', args: { job: ctx.job.id, name: v.trim() }, error: checkName(v, 'stage') });
        }}
      />
    </div>
  );
}

/**
 * v1 editor footer: Thick Liquid Glass, sticky over the scrolling program, always there. With nothing
 * pending it says how to start; with an edit it says what it does (the steps that move, never the
 * finish or money; for a template, the working days) and its Save lights up. One change at a time.
 */
function ChangeBar(props: {
  edit: PendingEdit | null;
  preview: PreviewState;
  view: ProgramSetupView;
  today: ISODate;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { edit, preview, view, today } = props;
  const problem = edit ? (edit.error ?? previewProblem(preview)) : null;
  const ok = !!edit && !edit.error && canSave(preview);
  const p = edit && preview.status === 'ready' ? preview.preview : null;
  const proposal = p && p.result.kind === 'proposal' ? p.result : null;
  const impact = p?.impact?.find((i) => i.jobId === view.job.id) ?? null;
  const tpl = p?.templates.find((t) => t.jobId === view.job.id) ?? null;
  return (
    <section
      className="su-ed__foot glass glass--thick glass--float"
      aria-label={edit ? 'This change, before you save it' : 'Changes'}
      data-testid={edit ? 'change-bar' : 'editor-foot'}
    >
      <div className="su-ed__foot-body" aria-live="polite">
        {!edit && <p className="su-ed__foot-note">{view.job.isTemplate ? 'Edit a step to see the working days.' : 'Edit a step to see what moves.'}</p>}
        {edit && <p className="su-ed__foot-what">{proposal?.summary ?? edit.label}</p>}
        {problem && (
          <p className="su-error" role="alert" data-testid="bar-problem">
            {problem}
          </p>
        )}
        {edit && !problem && preview.status === 'checking' && <p className="su-ed__foot-note">Working out what moves…</p>}
        {edit && !problem && proposal && view.job.isTemplate && (
          <p className="su-ed__foot-note" data-testid="template-impact">
            {tpl && tpl.workingDaysAfter !== tpl.workingDaysBefore
              ? `Longest chain ${tpl.workingDaysBefore} to ${tpl.workingDaysAfter} working days. `
              : `Longest chain stays ${tpl?.workingDaysAfter ?? view.workingDays} working days. `}
            Templates have no dates. New jobs from it get the change; jobs already started keep their own.
          </p>
        )}
        {edit && !problem && proposal && !view.job.isTemplate && impact && (
          <>
            <MovedSteps impact={impact} today={today} max={3} />
            <p className="su-ed__foot-note" data-testid="bar-note">
              {edit.op === 'edit_step' && edit.args && 'durationDays' in edit.args
                ? "Planned dates don't change, apart from this step's own planned end."
                : "Planned dates don't change."}
            </p>
          </>
        )}
        {props.saveError && (
          <p className="su-error" role="alert">
            Not saved: {props.saveError}
          </p>
        )}
      </div>
      <div className="su-ed__foot-actions">
        <span className="su-ed__changes">{edit ? '1 unsaved change' : 'No unsaved changes'}</span>
        <button type="button" className="btn btn--glass btn--desktop" disabled={!edit} onClick={props.onDiscard} data-testid="bar-discard">
          Discard
        </button>
        <button type="button" className="btn btn--glass-prominent btn--desktop" disabled={!ok || props.saving} onClick={props.onSave} data-testid="bar-save">
          {props.saving ? 'Saving…' : edit ? 'Save 1 change' : 'Save'}
        </button>
      </div>
    </section>
  );
}
