/**
 * Templates (UI_PLAN 3.21, rule 8): jobs with is_template and no dates.
 *
 * `#/templates` lists the side's templates. Each row is the template's stage
 * sequence in order with counts in words, "Use for a new job" (to
 * `#/jobs/new?template=<id>`) and the name as a link to the detail. "New
 * template" makes a blank one; "Save this job as a template" copies a live
 * job's stages, steps, links, requirements and photo categories with every
 * date and status stripped.
 *
 * `#/templates/:id` opens the sequence out: one section per stage, steps
 * with their working days, what each waits for, what it needs, the hold
 * point flag, and the stage's photo categories, all editable in place with
 * plain controls. The full editor (part A, `#/jobs/:id/edit`) is linked for
 * anyone who wants the tree view.
 *
 * Nothing on these screens is a date. Editing durations and links needs
 * signal (CONTRACTS offline rule), so the controls go read-only offline.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Job, PhotoCategory, Requirement, Stage, Step, StepLink } from '../domain/types';
import type { ApprovalPath, JobKind } from '../domain/types';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import NotFound from './NotFound';
import './templates.css';

// ---------------------------------------------------------------------------
// Shared words
// ---------------------------------------------------------------------------

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface TemplateShape {
  stages: Stage[];
  steps: Step[];
  links: StepLink[];
  requirements: Requirement[];
  categories: PhotoCategory[];
}

/** "8 stages, 29 steps, 25 needs, 13 photo sets" (design: "4 stages, checklist only"). */
export function countWords(job: Job, shape: TemplateShape): string {
  if (job.kind === 'design') return `${plural(shape.stages.length, 'stage')}, checklist only`;
  const parts = [plural(shape.stages.length, 'stage'), plural(shape.steps.length, 'step')];
  if (shape.requirements.length) parts.push(plural(shape.requirements.length, 'need'));
  if (shape.categories.length) parts.push(plural(shape.categories.length, 'photo set'));
  return parts.join(', ');
}

function useShape(jobId: string): TemplateShape {
  return useQuery<TemplateShape>(
    (api) => ({
      stages: api.listStages(jobId).slice().sort((a, b) => a.order - b.order),
      steps: api.listSteps(jobId),
      links: api.listStepLinks(jobId),
      requirements: api.listRequirements(jobId),
      categories: api.listPhotoCategories(jobId),
    }),
    [jobId],
  );
}

const KIND_WORDS: Record<JobKind, string> = { build: 'Build', design: 'Design' };

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export default function Templates() {
  const api = useApi();
  const navigate = useNavigate();
  const { role, side, offline } = useSession();
  const templates = useQuery((api) => api.listTemplates(), []);
  const jobs = useQuery((api) => api.listJobs(), []);
  const [form, setForm] = useState<'none' | 'new' | 'from-job'>('none');
  const isAdmin = role === 'admin';

  return (
    <main className="page templates" data-testid="templates">
      <PageHeader
        title="Templates and new job"
        meta={`${plural(templates.length, 'template')} on ${side.name}`}
        actions={
          <Link to="/jobs/new" className="btn btn--primary btn--desktop" data-testid="templates-new-job">
            New job
          </Link>
        }
      />
      <p className="templates__intro">
        A template is a program with no dates: stages, steps and how long each takes, what each step waits for and needs, and the photo sets
        an inspection wants. Starting a job from one copies all of that and runs the dates forward from the day you pick.
      </p>

      {isAdmin && (
        <div className="templates__form-actions" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
          <button type="button" className="btn btn--desktop" data-testid="template-new" aria-pressed={form === 'new'} onClick={() => setForm(form === 'new' ? 'none' : 'new')}>
            New template
          </button>
          <button
            type="button"
            className="btn btn--desktop"
            data-testid="template-save-from-job"
            aria-pressed={form === 'from-job'}
            disabled={jobs.length === 0}
            onClick={() => setForm(form === 'from-job' ? 'none' : 'from-job')}
          >
            Save this job as a template
          </button>
        </div>
      )}

      {form === 'new' && (
        <NewTemplateForm
          onDone={(id) => {
            setForm('none');
            if (id) navigate(`/templates/${id}`);
          }}
        />
      )}
      {form === 'from-job' && (
        <SaveFromJobForm
          jobs={jobs}
          offline={offline}
          onDone={() => setForm('none')}
          onSave={(jobId, name) => {
            api.saveJobAsTemplate(jobId, name);
            setForm('none');
          }}
        />
      )}

      {templates.length === 0 ? (
        <div className="templates__empty" data-testid="templates-empty">
          <p>No templates yet. Build the duplex template first.</p>
          {isAdmin && <p>Or save a job that is running well: its program becomes the template, dates left behind.</p>}
        </div>
      ) : (
        <ul className="templates__list">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} />
          ))}
        </ul>
      )}
    </main>
  );
}

function TemplateRow({ template }: { template: Job }) {
  const shape = useShape(template.id);
  return (
    <li className="templates__row" data-testid={`template-${template.id}`}>
      <div className="templates__row-main">
        <Link to={`/templates/${template.id}`} className="templates__name" data-testid={`template-open-${template.id}`}>
          {template.name}
        </Link>
        <span className="templates__kind">
          {KIND_WORDS[template.kind]}
          {template.path ? `, ${template.path}` : ''}
        </span>
        <p className="templates__counts" data-testid={`template-counts-${template.id}`}>
          {countWords(template, shape)}
        </p>
        {shape.stages.length > 0 && (
          <ol className="templates__sequence" aria-label="Stages in order">
            {shape.stages.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ol>
        )}
      </div>
      <div className="templates__row-actions">
        <Link to={`/jobs/new?template=${template.id}`} className="btn btn--desktop" data-testid={`template-use-${template.id}`}>
          Use for a new job
        </Link>
      </div>
    </li>
  );
}

function NewTemplateForm({ onDone }: { onDone: (id?: string) => void }) {
  const api = useApi();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<JobKind>('build');
  const [path, setPath] = useState<ApprovalPath>('DA');
  const ready = name.trim().length > 0;
  return (
    <form
      className="templates__form"
      data-testid="template-new-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const t = api.addJob({ name: name.trim(), kind, path, isTemplate: true });
        onDone(t.id);
      }}
    >
      <h2 className="templates__form-title">New template</h2>
      <div className="templates__field">
        <label htmlFor="template-new-name">Name</label>
        <input id="template-new-name" className="templates__input" value={name} data-testid="template-new-name" onChange={(e) => setName(e.target.value)} placeholder="Townhouse pair" />
      </div>
      <div className="templates__field">
        <span className="templates__field-label" id="template-new-kind-label">
          Kind
        </span>
        <div className="templates__picker" role="group" aria-labelledby="template-new-kind-label">
          {(['build', 'design'] as JobKind[]).map((k) => (
            <button key={k} type="button" className="templates__pick" aria-pressed={kind === k} data-testid={`template-new-kind-${k}`} onClick={() => setKind(k)}>
              {KIND_WORDS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="templates__field">
        <span className="templates__field-label" id="template-new-path-label">
          Approval path
        </span>
        <div className="templates__picker" role="group" aria-labelledby="template-new-path-label">
          {(['DA', 'CDC'] as ApprovalPath[]).map((p) => (
            <button key={p} type="button" className="templates__pick" aria-pressed={path === p} data-testid={`template-new-path-${p}`} onClick={() => setPath(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <p className="templates__note">
        {kind === 'design'
          ? `A design template starts with the standard ${path} checklist stages. Add stages on the next screen.`
          : 'A build template starts empty apart from a General photo set. Add stages and steps on the next screen, or open a finished job and save it as a template instead.'}
      </p>
      <div className="templates__form-actions">
        <button type="submit" className="btn btn--primary" data-testid="template-new-save" disabled={!ready}>
          Create template
        </button>
        <button type="button" className="btn" data-testid="template-new-cancel" onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SaveFromJobForm({ jobs, offline, onDone, onSave }: { jobs: Job[]; offline: boolean; onDone: () => void; onSave: (jobId: string, name: string) => void }) {
  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? '');
  const [name, setName] = useState('');
  const job = jobs.find((j) => j.id === jobId);
  const suggested = job ? `${job.name} program` : '';
  const finalName = (name.trim() || suggested).trim();
  const ready = !!job && finalName.length > 0 && !offline;
  return (
    <form
      className="templates__form"
      data-testid="template-from-job-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSave(jobId, finalName);
      }}
    >
      <h2 className="templates__form-title">Save a job as a template</h2>
      <div className="templates__field">
        <span className="templates__field-label" id="template-from-job-label">
          Which job
        </span>
        <div className="templates__picker" role="group" aria-labelledby="template-from-job-label">
          {jobs.map((j) => (
            <button key={j.id} type="button" className="templates__pick" aria-pressed={j.id === jobId} data-testid={`template-from-job-${j.id}`} onClick={() => setJobId(j.id)}>
              {j.name}
            </button>
          ))}
        </div>
      </div>
      <div className="templates__field">
        <label htmlFor="template-from-job-name">Template name</label>
        <input id="template-from-job-name" className="templates__input" value={name} data-testid="template-from-job-name" placeholder={suggested} onChange={(e) => setName(e.target.value)} />
      </div>
      <p className="templates__note">
        Copies the stages, steps, links, needs and photo sets. Dates, ticks, items, photos and notes stay with the job.
        {offline ? ' Needs signal.' : ''}
      </p>
      <div className="templates__form-actions">
        <button type="submit" className="btn btn--primary" data-testid="template-from-job-save" disabled={!ready}>
          Save as template
        </button>
        <button type="button" className="btn" data-testid="template-from-job-cancel" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Detail: the sequence opened out, editable in place
// ---------------------------------------------------------------------------

export function TemplateDetail() {
  const { id = '' } = useParams();
  const api = useApi();
  const layout = useLayout();
  const { role, offline } = useSession();
  const template = useQuery((api) => api.getJob(id), [id]);
  const shape = useShape(id);
  const canEdit = role === 'admin' && !offline;
  const [newStage, setNewStage] = useState('');

  if (!template || !template.isTemplate) return <NotFound />;

  const stepsByStage = new Map<string, Step[]>();
  for (const s of shape.steps) {
    if (!stepsByStage.has(s.stageId)) stepsByStage.set(s.stageId, []);
    stepsByStage.get(s.stageId)!.push(s);
  }
  const stepName = new Map(shape.steps.map((s) => [s.id, s.name]));

  return (
    <main className="page template" data-testid="template">
      <PageHeader
        title={template.name}
        back={{ to: '/templates', label: 'Templates' }}
        meta={`${KIND_WORDS[template.kind]} template${template.path ? `, ${template.path}` : ''}. ${countWords(template, shape)}. No dates.`}
        actions={
          <div className="template__meta-actions">
            <Link to={`/jobs/new?template=${template.id}`} className="btn btn--primary btn--desktop" data-testid="template-use">
              Use for a new job
            </Link>
            {template.kind === 'build' && layout === 'desktop' && (
              <Link to={`/jobs/${template.id}/edit`} className="btn btn--desktop" data-testid="template-editor">
                Open in the program editor
              </Link>
            )}
          </div>
        }
      />
      {role === 'admin' && offline && (
        <p className="template__offline" data-testid="template-offline">
          No signal: durations and links need signal, so this template is read-only for now.
        </p>
      )}
      {template.kind === 'design' && (
        <p className="templates__intro">A design template is a checklist: stages only, ticked by hand on the job. No steps, no Gantt.</p>
      )}

      {shape.stages.length === 0 && (
        <p className="template__empty" data-testid="template-empty">
          No stages yet. Add the first one below.
        </p>
      )}

      {shape.stages.map((stage, i) => (
        <StageSection
          key={stage.id}
          index={i + 1}
          stage={stage}
          template={template}
          steps={stepsByStage.get(stage.id) ?? []}
          allSteps={shape.steps}
          stepName={stepName}
          links={shape.links}
          requirements={shape.requirements}
          categories={shape.categories.filter((c) => c.stageId === stage.id)}
          canEdit={canEdit}
          layout={layout}
        />
      ))}

      {template.kind === 'build' && shape.categories.some((c) => c.stageId === null) && (
        <section className="template__stage" aria-label="Job-wide photo sets">
          <div className="template__stage-head">
            <span className="template__stage-name">Any stage</span>
            <span className="template__stage-words">photo sets that are not tied to a stage</span>
          </div>
          <Categories categories={shape.categories.filter((c) => c.stageId === null)} jobId={template.id} stageId={null} canEdit={canEdit} holdPoint={false} />
        </section>
      )}

      {canEdit && (
        <form
          className="template__add-stage"
          data-testid="template-add-stage"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newStage.trim();
            if (!name) return;
            api.addStage({ jobId: template.id, name });
            setNewStage('');
          }}
        >
          <label htmlFor="template-add-stage-name" className="templates__field-label">
            Add a stage
          </label>
          <input id="template-add-stage-name" className="templates__input" value={newStage} data-testid="template-add-stage-name" placeholder="Landscaping" onChange={(e) => setNewStage(e.target.value)} />
          <button type="submit" className="btn btn--desktop" data-testid="template-add-stage-save" disabled={!newStage.trim()}>
            Add stage
          </button>
        </form>
      )}
    </main>
  );
}

interface StageProps {
  index: number;
  stage: Stage;
  template: Job;
  steps: Step[];
  allSteps: Step[];
  stepName: Map<string, string>;
  links: StepLink[];
  requirements: Requirement[];
  categories: PhotoCategory[];
  canEdit: boolean;
  layout: 'phone' | 'desktop';
}

function StageSection({ index, stage, template, steps, allSteps, stepName, links, requirements, categories, canEdit, layout }: StageProps) {
  const api = useApi();
  const [name, setName] = useState(stage.name);
  const [adding, setAdding] = useState({ name: '', days: 5 });
  const days = steps.reduce((n, s) => n + s.durationDays, 0);
  const holdPoint = steps.some((s) => s.isHoldPoint);
  const words = template.kind === 'design' ? 'checklist stage' : `${plural(steps.length, 'step')}, ${plural(days, 'working day')}${holdPoint ? ', hold point' : ''}`;

  return (
    <section className="template__stage" data-testid={`template-stage-${stage.id}`} aria-label={stage.name}>
      <div className="template__stage-head">
        <span className="template__stage-num" aria-hidden="true">
          {index}
        </span>
        <span className="template__stage-name">
          {canEdit ? (
            <input
              aria-label="Stage name"
              value={name}
              data-testid={`template-stage-name-${stage.id}`}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const v = name.trim();
                if (v && v !== stage.name) api.updateStage(stage.id, { name: v });
                else setName(stage.name);
              }}
            />
          ) : (
            stage.name
          )}
        </span>
        <span className="template__stage-words">{words}</span>
        {canEdit && (
          <span className="template__stage-tools">
            <button type="button" className="template__small" data-testid={`template-stage-delete-${stage.id}`} onClick={() => api.deleteStage(stage.id)}>
              Delete stage
            </button>
          </span>
        )}
      </div>

      {template.kind === 'build' && (
        <>
          {steps.length > 0 && layout === 'desktop' && (
            <div className="template__step-head" aria-hidden="true">
              <span>Step</span>
              <span>Working days</span>
              <span>Waits for</span>
              <span>Needs</span>
              <span>Hold point</span>
              <span />
            </div>
          )}
          <ul className="template__steps">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                allSteps={allSteps}
                stepName={stepName}
                links={links.filter((l) => l.stepId === step.id)}
                requirements={requirements.filter((r) => r.stepId === step.id)}
                canEdit={canEdit}
              />
            ))}
          </ul>
          {canEdit && (
            <form
              className="template__add-step"
              data-testid={`template-add-step-${stage.id}`}
              onSubmit={(e) => {
                e.preventDefault();
                const n = adding.name.trim();
                if (!n) return;
                const last = steps[steps.length - 1];
                api.addStep({ jobId: template.id, stageId: stage.id, name: n, durationDays: Math.max(1, adding.days), waitsForStepIds: last ? [last.id] : [] });
                setAdding({ name: '', days: 5 });
              }}
            >
              <input type="text" className="templates__input" aria-label="New step" placeholder="Add a step" value={adding.name} data-testid={`template-add-step-name-${stage.id}`} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
              <span className="template__days">
                <input type="number" min={1} aria-label="Working days" value={adding.days} data-testid={`template-add-step-days-${stage.id}`} onChange={(e) => setAdding({ ...adding, days: Number(e.target.value) })} />
                <span className="template__days-unit">days</span>
              </span>
              <button type="submit" className="btn btn--desktop" data-testid={`template-add-step-save-${stage.id}`} disabled={!adding.name.trim()}>
                Add step
              </button>
              {steps.length > 0 && <span className="template__stage-words">waits for {steps[steps.length - 1].name}</span>}
            </form>
          )}
          <Categories categories={categories} jobId={template.id} stageId={stage.id} canEdit={canEdit} holdPoint={holdPoint} />
        </>
      )}
    </section>
  );
}

const REQ_KINDS: Record<Requirement['kind'], string> = { trade: 'trade', material: 'material' };

function StepRow({ step, allSteps, stepName, links, requirements, canEdit }: { step: Step; allSteps: Step[]; stepName: Map<string, string>; links: StepLink[]; requirements: Requirement[]; canEdit: boolean }) {
  const api = useApi();
  const [name, setName] = useState(step.name);
  const [days, setDays] = useState(String(step.durationDays));
  const [req, setReq] = useState<{ kind: Requirement['kind']; name: string; lead: string }>({ kind: 'trade', name: '', lead: '2' });
  const [addingReq, setAddingReq] = useState(false);
  const waitsFor = links.map((l) => ({ id: l.id, name: stepName.get(l.waitsForStepId) ?? '?' }));
  const others = allSteps.filter((s) => s.id !== step.id && !links.some((l) => l.waitsForStepId === s.id));

  const commitDays = () => {
    const n = Math.max(1, Math.round(Number(days) || step.durationDays));
    if (n !== step.durationDays) api.updateStep(step.id, { durationDays: n });
    setDays(String(n));
  };

  return (
    <li className="template__step" data-testid={`template-step-${step.id}`}>
      <span className="template__step-name">
        {canEdit ? (
          <input
            aria-label="Step name"
            value={name}
            data-testid={`template-step-name-${step.id}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const v = name.trim();
              if (v && v !== step.name) api.updateStep(step.id, { name: v });
              else setName(step.name);
            }}
          />
        ) : (
          <span className="template__text">{step.name}</span>
        )}
      </span>
      <span className="template__days" data-testid={`template-step-days-${step.id}`}>
        {canEdit ? (
          <input type="number" min={1} aria-label="Working days" value={days} onChange={(e) => setDays(e.target.value)} onBlur={commitDays} onKeyDown={(e) => e.key === 'Enter' && commitDays()} />
        ) : (
          <span className="display">{step.durationDays}</span>
        )}
        <span className="template__days-unit">{step.durationDays === 1 ? 'day' : 'days'}</span>
      </span>
      <span className="template__step-sub">
        <span data-testid={`template-step-waits-${step.id}`}>
          <span className="template__phone-label">Waits for </span>
          {waitsFor.length === 0 && !canEdit && <span className="template__stage-words">nothing</span>}
          {waitsFor.map((w) => (
            <span key={w.id} className="template__chip">
              {w.name}
              {canEdit && (
                <button type="button" className="template__x" aria-label={`Stop waiting for ${w.name}`} onClick={() => api.removeStepLink(w.id)}>
                  &times;
                </button>
              )}
            </span>
          ))}{' '}
          {canEdit && others.length > 0 && (
            <select
              className="template__inline-add"
              aria-label="Add a step this waits for"
              value=""
              data-testid={`template-step-add-wait-${step.id}`}
              onChange={(e) => e.target.value && api.addStepLink(step.id, e.target.value)}
            >
              <option value="">+ waits for</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </span>
        <span data-testid={`template-step-needs-${step.id}`}>
          <span className="template__phone-label">Needs </span>
          {requirements.length === 0 && !canEdit && <span className="template__stage-words">nothing to book or order</span>}
          {requirements.map((r) => (
            <span key={r.id} className="template__chip template__chip--need" title={`${REQ_KINDS[r.kind]}, ${plural(r.leadTimeWeeks, 'week')} lead`}>
              {r.name}, {r.leadTimeWeeks} wk
              {canEdit && (
                <button type="button" className="template__x" aria-label={`Remove ${r.name}`} onClick={() => api.removeRequirement(r.id)}>
                  &times;
                </button>
              )}
            </span>
          ))}{' '}
          {canEdit && !addingReq && (
            <button type="button" className="template__x template__x--add" data-testid={`template-step-need-toggle-${step.id}`} onClick={() => setAddingReq(true)}>
              + need
            </button>
          )}
          {canEdit && addingReq && (
            <form
              className="template__inline-add"
              onSubmit={(e) => {
                e.preventDefault();
                const n = req.name.trim();
                if (!n) return;
                api.addRequirement({ stepId: step.id, kind: req.kind, name: n, leadTimeWeeks: Math.max(0, Math.round(Number(req.lead) || 0)), tradeType: req.kind === 'trade' ? n : undefined });
                setReq({ kind: 'trade', name: '', lead: '2' });
                setAddingReq(false);
              }}
            >
              <select aria-label="Need kind" value={req.kind} onChange={(e) => setReq({ ...req, kind: e.target.value as Requirement['kind'] })}>
                <option value="trade">trade</option>
                <option value="material">material</option>
              </select>
              <input type="text" aria-label="Need" placeholder="+ need" value={req.name} data-testid={`template-step-add-need-${step.id}`} onChange={(e) => setReq({ ...req, name: e.target.value })} />
              <input type="number" min={0} aria-label="Lead time in weeks" value={req.lead} onChange={(e) => setReq({ ...req, lead: e.target.value })} />
              <span className="template__days-unit">wk</span>
              <button type="submit" className="template__small" disabled={!req.name.trim()}>
                Add
              </button>
              <button type="button" className="template__x" aria-label="Cancel" onClick={() => setAddingReq(false)}>
                &times;
              </button>
            </form>
          )}
        </span>
        <label className="template__hold">
          <input type="checkbox" checked={step.isHoldPoint} disabled={!canEdit} data-testid={`template-step-hold-${step.id}`} onChange={(e) => api.updateStep(step.id, { isHoldPoint: e.target.checked })} />
          {step.isHoldPoint ? 'hold point' : canEdit ? 'hold point' : 'no'}
        </label>
        <span>
          {canEdit && (
            <button type="button" className="template__small" data-testid={`template-step-delete-${step.id}`} onClick={() => api.deleteStep(step.id)}>
              Delete
            </button>
          )}
        </span>
      </span>
    </li>
  );
}

function Categories({ categories, jobId, stageId, canEdit, holdPoint }: { categories: PhotoCategory[]; jobId: string; stageId: string | null; canEdit: boolean; holdPoint: boolean }) {
  const api = useApi();
  const [name, setName] = useState('');
  if (categories.length === 0 && !canEdit) return null;
  return (
    <div className="template__cats" data-testid={`template-cats-${stageId ?? 'general'}`}>
      <p className="template__cats-title">
        Photo sets{holdPoint ? ', ticked ones must have a photo before the hold point' : stageId ? '' : ''}
      </p>
      {categories.length > 0 && (
        <ul>
          {categories.map((c) => (
            <li key={c.id} className="template__cat" data-testid={`template-cat-${c.id}`}>
              {c.name}
              {stageId && (
                <label>
                  <input type="checkbox" checked={c.requiredForHoldPoint} disabled={!canEdit} onChange={(e) => api.updatePhotoCategory(c.id, { requiredForHoldPoint: e.target.checked })} />
                  required
                </label>
              )}
              {canEdit && (
                <button type="button" className="template__x" aria-label={`Remove ${c.name}`} onClick={() => api.deletePhotoCategory(c.id)}>
                  &times;
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          className="template__inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            api.addPhotoCategory({ jobId, stageId, name: n, requiredForHoldPoint: false });
            setName('');
          }}
        >
          <input type="text" aria-label="New photo set" placeholder="+ photo set" value={name} data-testid={`template-add-cat-${stageId ?? 'general'}`} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="template__small" disabled={!name.trim()}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}
