/**
 * Setup: the program editor, for a build job or a template. A table of
 * stages and steps (name, working days, waits for, hold point, needs, trade).
 * One change at a time: each edit is dry-run with previewSetup and the bar at
 * the bottom says what it does (steps that move, the new forecast finish; for a
 * template, the length in working days) before Save. Templates have no dates.
 * Day-to-day things (ETAs, item status, a step done) stay on the bot.
 */
import { useState, type ReactNode } from 'react';
import {
  formatDate,
  formatLong,
  type DashboardApi,
  type ISODate,
  type ProgramSetupView,
  type Requirement,
  type SetupStage,
  type SetupStep,
} from '@ct/core';
import { useData } from '../data/DataContext';
import { useJobQuery } from '../data/useJobQuery';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { SetupFrame } from '../setup/SetupFrame';
import { canSave, FinishMove, MovedSteps, previewProblem, usePreview, type PreviewState } from '../setup/preview';
import { checkDays, checkName, checkWeeks, wholeNumber, weeksValue } from '../setup/validate';
import { plural } from '../ui/itemWords';

export interface EditorData {
  today: ISODate;
  view: ProgramSetupView;
}

export async function loadEditor(api: DashboardApi, jobId: string): Promise<EditorData> {
  const [today, view] = await Promise.all([api.getToday(), api.getProgramSetup(jobId)]);
  return { today, view };
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

export function SetupProgramEditorScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadEditor, jobId);
  const view = q.status === 'ready' ? q.data.view : null;
  const title = view ? (view.job.isTemplate ? `Template: ${view.job.name}` : `Program: ${view.job.name}`) : 'Program editor';
  return (
    <SetupFrame title={title} sub={view ? <EditorSub data={q.status === 'ready' ? q.data : null} /> : undefined} className="su-editor">
      {q.status === 'loading' && <LoadingRows rows={6} label="Loading the program" />}
      {q.status === 'error' && <LoadError what="the program" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ProgramEditor data={q.data} />}
    </SetupFrame>
  );
}

function EditorSub({ data }: { data: EditorData | null }) {
  if (!data) return null;
  const { view } = data;
  const steps = view.stages.reduce((n, s) => n + s.steps.length, 0);
  if (view.job.isTemplate) {
    return (
      <>
        {plural(view.stages.length, 'stage')}, {plural(steps, 'step')}, {view.workingDays} working days along the longest chain. Templates have no
        dates: a job made from one gets its dates from its start date.
      </>
    );
  }
  if (view.job.kind === 'design') return <>A design job has a stage checklist, not a program.</>;
  return (
    <>
      Forecast finish {view.forecastFinish ? formatLong(view.forecastFinish) : 'not set'}
      {view.job.plannedFinish ? `, planned ${formatLong(view.job.plannedFinish)}` : ''}. Changes save one at a time and are listed in{' '}
      <a href={href(`/history/${encodeURIComponent(view.job.id)}`)}>Changes</a>. <a href={href(`/jobs/${encodeURIComponent(view.job.id)}/program`)}>See the Gantt</a>.
    </>
  );
}

export function ProgramEditor({ data }: { data: EditorData }) {
  const { api, refresh } = useData();
  const { view, today } = data;
  const job = view.job;
  const [edit, setEdit] = useState<PendingEdit | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const preview = usePreview(edit?.args ? { op: edit.op, args: edit.args } : null);

  if (job.kind === 'design') {
    return (
      <p className="empty">
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

  return (
    <div className="su-editor-body">
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
      <table className="su-table su-prog" data-testid="editor">
        <colgroup>
          <col className="c-step" />
          <col className="c-days" />
          <col className="c-waits" />
          <col className="c-hold" />
          <col className="c-needs" />
          <col className="c-trade" />
          <col className="c-tools" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Working days</th>
            <th scope="col">Waits for</th>
            <th scope="col">Hold point</th>
            <th scope="col">Needs, with lead time</th>
            <th scope="col">Trade</th>
            <th scope="col">
              <span className="sr-only">Order and details</span>
            </th>
          </tr>
        </thead>
        {view.stages.map((st, i) => (
          <StageRows key={st.id} stage={st} index={i} ctx={ctx} open={open} setOpen={setOpen} />
        ))}
        <tbody>
          <tr className="su-addstage">
            <td colSpan={7}>
              <AddStage key={reset} ctx={ctx} />
            </td>
          </tr>
        </tbody>
      </table>
      {edit && (
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
      )}
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

function StageRows({ stage, index, ctx, open, setOpen }: { stage: SetupStage; index: number; ctx: RowCtx; open: string | null; setOpen: (id: string | null) => void }) {
  const nameKey = `stage:${stage.id}:name`;
  const last = ctx.stages.length - 1;
  return (
    <tbody className="su-stage" data-testid={`ed-stage-${stage.id}`}>
      <tr className="su-stage-row">
        <th scope="colgroup" colSpan={7}>
          <div className="su-stage-head">
            <span className="su-stage-num" aria-hidden="true">
              {index + 1}
            </span>
            <label className="sr-only" htmlFor={`stn-${stage.id}`}>
              Stage {index + 1} name
            </label>
            <input
              id={`stn-${stage.id}`}
              className="su-input su-stage-name"
              value={shown(ctx, nameKey, stage.name)}
              disabled={ctx.locked(nameKey)}
              onChange={(e) => {
                const v = e.target.value;
                if (v.trim() === stage.name) return ctx.propose(null);
                const err = checkName(v, 'stage');
                ctx.propose({ key: nameKey, label: `Rename the ${stage.name} stage`, op: 'edit_stage', args: err ? null : { stage: stage.id, name: v.trim() }, error: err, draft: v });
              }}
            />
            <span className="su-stage-count">{plural(stage.steps.length, 'step')}</span>
            <span className="su-stage-tools">
              <IconButton
                label={`Move the ${stage.name} stage up`}
                disabled={index === 0 || ctx.locked(`stage:${stage.id}:order`)}
                onClick={() => ctx.propose({ key: `stage:${stage.id}:order`, label: `Move the ${stage.name} stage up, above ${ctx.stages[index - 1]?.name}`, op: 'edit_stage', args: { stage: stage.id, order: index }, error: null })}
              >
                ↑
              </IconButton>
              <IconButton
                label={`Move the ${stage.name} stage down`}
                disabled={index === last || ctx.locked(`stage:${stage.id}:order`)}
                onClick={() => ctx.propose({ key: `stage:${stage.id}:order`, label: `Move the ${stage.name} stage down, below ${ctx.stages[index + 1]?.name}`, op: 'edit_stage', args: { stage: stage.id, order: index + 2 }, error: null })}
              >
                ↓
              </IconButton>
              {stage.steps.length === 0 && (
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={ctx.locked(`stage:${stage.id}:delete`)}
                  onClick={() => ctx.propose({ key: `stage:${stage.id}:delete`, label: `Delete the empty ${stage.name} stage`, op: 'delete_stage', args: { stage: stage.id }, error: null })}
                >
                  Delete stage
                </button>
              )}
            </span>
          </div>
        </th>
      </tr>
      {stage.steps.map((s, i) => (
        <StepRows key={s.id} step={s} index={i} stage={stage} ctx={ctx} open={open === s.id} toggle={() => setOpen(open === s.id ? null : s.id)} />
      ))}
      <tr className="su-addstep">
        <td colSpan={7}>
          <AddStep key={`${stage.id}-${ctx.reset}`} stage={stage} ctx={ctx} />
        </td>
      </tr>
    </tbody>
  );
}

function IconButton({ label, disabled, onClick, children, testId }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button type="button" className="su-icon" aria-label={label} title={label} disabled={disabled} onClick={onClick} data-testid={testId}>
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

function StepRows({ step, index, stage, ctx, open, toggle }: { step: SetupStep; index: number; stage: SetupStage; ctx: RowCtx; open: boolean; toggle: () => void }) {
  const k = (f: string) => `step:${step.id}:${f}`;
  const isTemplate = ctx.job.isTemplate;
  const nameV = shown(ctx, k('name'), step.name);
  const daysV = shown(ctx, k('days'), String(step.durationDays));
  const holdV = shown(ctx, k('hold'), step.isHoldPoint);
  const tradeV = shown(ctx, k('trade'), step.tradeType ?? '');
  const waits = step.waitsFor.map((id) => ctx.names.get(id) ?? id);
  const pendingHere = !!ctx.edit && ctx.edit.key.startsWith(`step:${step.id}:`);
  return (
    <>
      <tr className={pendingHere ? 'su-step is-pending' : 'su-step'} data-testid={`ed-step-${step.id}`} data-step-name={step.name}>
        <th scope="row" className="su-c-step">
          <div className="su-step-cell">
          <span className="su-order">
              <IconButton
                label={`Move ${step.name} up`}
                testId="ed-up"
                disabled={index === 0 || ctx.locked(k('order'))}
                onClick={() => ctx.propose({ key: k('order'), label: `List ${step.name} above ${stage.steps[index - 1]?.name}`, op: 'edit_step', args: { step: step.id, order: index }, error: null })}
              >
                ↑
              </IconButton>
              <IconButton
                label={`Move ${step.name} down`}
                testId="ed-down"
                disabled={index === stage.steps.length - 1 || ctx.locked(k('order'))}
                onClick={() => ctx.propose({ key: k('order'), label: `List ${step.name} below ${stage.steps[index + 1]?.name}`, op: 'edit_step', args: { step: step.id, order: index + 2 }, error: null })}
              >
                ↓
              </IconButton>
          </span>
          <label className="sr-only" htmlFor={`sn-${step.id}`}>
            Step name
          </label>
          <input
            id={`sn-${step.id}`}
            className="su-input"
            data-testid="ed-name"
            value={nameV}
            disabled={ctx.locked(k('name'))}
            onChange={(e) => {
              const v = e.target.value;
              if (v.trim() === step.name) return ctx.propose(null);
              const err = checkName(v, 'step');
              ctx.propose({ key: k('name'), label: `Rename ${step.name}`, op: 'edit_step', args: err ? null : { step: step.id, name: v.trim() }, error: err, draft: v });
            }}
          />
          {!isTemplate && step.forecastStart && step.forecastEnd && (
            <span className="su-step-dates">
              {step.status === 'done' ? 'Done. ' : ''}
              {formatDate(step.forecastStart, ctx.today)} to {formatDate(step.forecastEnd, ctx.today)}
              {step.lateDays > 0 && <span className="flag su-flag">{plural(step.lateDays, 'day')} late</span>}
            </span>
          )}
          </div>
        </th>
        <td className="su-c-days">
          <label className="sr-only" htmlFor={`sd-${step.id}`}>
            Working days for {step.name}
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
        </td>
        <td className="su-c-waits">{waits.length ? waits.join(', ') : <span className="su-muted">{isTemplate ? 'Nothing' : 'Nothing, starts on plan'}</span>}</td>
        <td className="su-c-hold">
          <label className="su-check">
            <input
              type="checkbox"
              data-testid="ed-hold"
              checked={holdV}
              disabled={ctx.locked(k('hold'))}
              onChange={(e) => {
                const v = e.target.checked;
                if (v === step.isHoldPoint) return ctx.propose(null);
                ctx.propose({
                  key: k('hold'),
                  label: v ? `Make ${step.name} a hold point` : `${step.name} is no longer a hold point`,
                  op: 'edit_step',
                  args: { step: step.id, isHoldPoint: v },
                  error: null,
                  draft: v,
                });
              }}
            />
            <span>{holdV ? 'Yes' : 'No'}</span>
            <span className="sr-only"> for {step.name}</span>
          </label>
        </td>
        <td className="su-c-needs">
          {step.requirements.length ? (
            <ul className="su-needs">
              {step.requirements.map((r) => (
                <li key={r.id}>
                  {r.name}, {weeksWords(r.leadTimeWeeks)}
                </li>
              ))}
            </ul>
          ) : (
            <span className="su-muted">Nothing</span>
          )}
        </td>
        <td className="su-c-trade">
          <label className="sr-only" htmlFor={`st-${step.id}`}>
            Trade for {step.name}
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
        </td>
        <td className="su-c-tools">
          <button type="button" className="btn btn-small" aria-expanded={open} aria-controls={`more-${step.id}`} data-testid="ed-more" onClick={toggle}>
              {open ? 'Close' : 'Links and needs'}
              <span className="sr-only"> for {step.name}</span>
            </button>
        </td>
      </tr>
      {open && (
        <tr className="su-detail" id={`more-${step.id}`} data-testid={`ed-detail-${step.id}`}>
          <td colSpan={7}>
            <StepDetailEditor step={step} ctx={ctx} />
          </td>
        </tr>
      )}
    </>
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
    <div className="su-detail-grid">
      <section className="su-detail-sec" aria-label={`What ${step.name} waits for`}>
        <h3 className="su-detail-h">Waits for</h3>
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
                    className="btn btn-small"
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

      <section className="su-detail-sec" aria-label={`What ${step.name} needs`}>
        <h3 className="su-detail-h">Needs</h3>
        <p className="su-hint">A trade to book or a material to order. The act-by date is the forecast start minus the lead time.</p>
        {step.requirements.length > 0 && (
          <ul className="su-reqs">
            {step.requirements.map((r) => (
              <RequirementLine key={r.id} req={r} step={step} ctx={ctx} />
            ))}
          </ul>
        )}
        <AddRequirement key={`${step.id}-${ctx.reset}`} step={step} ctx={ctx} />
      </section>

      <section className="su-detail-sec su-detail-remove" aria-label={`Remove ${step.name}`}>
        <h3 className="su-detail-h">Remove</h3>
        {step.itemCount > 0 ? (
          <p className="su-muted">
            {plural(step.itemCount, 'item')} {step.itemCount === 1 ? 'is' : 'are'} linked to {step.name}, so it stays. Items change through the bot.
          </p>
        ) : (
          <button
            type="button"
            className="btn"
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
        {req.name} <span className="su-muted">{req.kind === 'trade' ? 'trade to book' : 'material to order'}</span>
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
        className="btn btn-small"
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
        className="btn btn-small"
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

function ChangeBar(props: {
  edit: PendingEdit;
  preview: PreviewState;
  view: ProgramSetupView;
  today: ISODate;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { edit, preview, view, today } = props;
  const problem = edit.error ?? previewProblem(preview);
  const ok = !edit.error && canSave(preview);
  const p = preview.status === 'ready' ? preview.preview : null;
  const proposal = p && p.result.kind === 'proposal' ? p.result : null;
  const impact = p?.impact?.find((i) => i.jobId === view.job.id) ?? null;
  const tpl = p?.templates.find((t) => t.jobId === view.job.id) ?? null;
  return (
    <section className="su-bar" aria-label="This change, before you save it" data-testid="change-bar">
      <div className="su-bar-body" aria-live="polite">
        <p className="su-bar-what">{proposal?.summary ?? edit.label}</p>
        {problem && (
          <p className="su-error" role="alert" data-testid="bar-problem">
            {problem}
          </p>
        )}
        {!problem && preview.status === 'checking' && <p className="su-muted">Working out what moves…</p>}
        {!problem && proposal && view.job.isTemplate && (
          <p className="su-bar-note" data-testid="template-impact">
            {tpl && tpl.workingDaysAfter !== tpl.workingDaysBefore
              ? `Longest chain ${tpl.workingDaysBefore} to ${tpl.workingDaysAfter} working days. `
              : `Longest chain stays ${tpl?.workingDaysAfter ?? view.workingDays} working days. `}
            Templates have no dates. Jobs started from this template from now on get the change; jobs already started keep their own program.
          </p>
        )}
        {!problem && proposal && !view.job.isTemplate && impact && (
          <>
            <FinishMove impact={impact} weeklyHoldingCost={view.job.weeklyHoldingCost} />
            <MovedSteps impact={impact} today={today} max={3} />
            <p className="su-bar-note" data-testid="bar-note">
              {edit.op === 'edit_step' && edit.args && 'durationDays' in edit.args
                ? "Planned dates don't change, apart from this step's own planned end. The steps it pushes read as late against the plan."
                : "Planned dates don't change. Forecast against planned shows any step this pushes as late."}
            </p>
          </>
        )}
        {props.saveError && (
          <p className="su-error" role="alert">
            Not saved: {props.saveError}
          </p>
        )}
      </div>
      <div className="su-bar-actions">
        <button type="button" className="btn btn-primary" disabled={!ok || props.saving} onClick={props.onSave} data-testid="bar-save">
          {props.saving ? 'Saving…' : 'Save change'}
        </button>
        <button type="button" className="btn" onClick={props.onDiscard} data-testid="bar-discard">
          Discard
        </button>
        <p className="su-bar-one">One change at a time: save or discard this one to change something else.</p>
      </div>
    </section>
  );
}
