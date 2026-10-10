/**
 * Setup: templates. Each template's program opens in the same editor as a
 * job's, without dates (rule 8). A new template can be made by copying a
 * build job's program (core save_as_template).
 */
import { useMemo, useState } from 'react';
import { type Change, type DashboardApi, type JobListRow, type SideFilter, type TemplateRow } from '@ct/core';
import { useData, useSideQuery } from '../data/DataContext';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { SetupFrame } from '../setup/SetupFrame';
import { canSave, previewProblem, usePreview, type SetupCall } from '../setup/preview';
import { checkName } from '../setup/validate';
import { templateCountWords } from './SetupNewJob';
import { plural } from '../ui/itemWords';

interface TemplatesData {
  templates: TemplateRow[];
  builds: JobListRow[];
}

export async function loadTemplates(api: DashboardApi, filter: SideFilter): Promise<TemplatesData> {
  const [templates, jobs] = await Promise.all([api.listTemplates(filter), api.listJobs(filter)]);
  return { templates, builds: jobs.builds };
}

export function SetupTemplatesScreen() {
  const q = useSideQuery(loadTemplates);
  const { sides, sideId } = useData();
  const [fromJob, setFromJob] = useState(false);
  const sideName = sides.find((s) => s.id === sideId)?.name;
  const meta = q.status === 'ready' ? `${q.data.templates.length ? plural(q.data.templates.length, 'template') : 'No templates'}${sideName ? ` on ${sideName}` : ''}` : null;
  const canCopy = q.status === 'ready' && q.data.builds.length > 0;
  return (
    <SetupFrame
      title="Templates"
      meta={meta}
      className="su-tpl"
      actions={
        <>
          {canCopy && (
            <button type="button" className="btn btn--desktop" aria-pressed={fromJob} data-testid="fromjob-open" onClick={() => setFromJob((v) => !v)}>
              Save job as template
            </button>
          )}
          <a className={fromJob ? 'btn btn--desktop' : 'btn btn--primary btn--desktop'} href={href('/setup')} data-testid="templates-new-job">
            New job
          </a>
        </>
      }
    >
      {q.status === 'loading' && <LoadingRows rows={3} label="Loading templates" />}
      {q.status === 'error' && <LoadError what="the templates" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && (
        <>
          {fromJob && <FromJob builds={q.data.builds} onCancel={() => setFromJob(false)} />}
          <TemplatesList templates={q.data.templates} />
        </>
      )}
    </SetupFrame>
  );
}

/** v1 templates list: each row is its name, kind, counts and the stage sequence, like a table of contents. */
function TemplatesList({ templates }: { templates: TemplateRow[] }) {
  if (!templates.length) return <p className="empty-line">No templates yet. Save a running job as one.</p>;
  return (
    <ul className="su-tpl__list" data-testid="templates">
      {templates.map((t) => (
        <li key={t.jobId} className="su-tpl__row" data-testid={`template-${t.jobId}`}>
          <div className="su-tpl__main">
            <a className="su-tpl__name" href={href(`/setup/templates/${encodeURIComponent(t.jobId)}`)}>
              {t.name}
            </a>
            <span className="su-tpl__kind">{[t.kind === 'build' ? 'Build' : 'Design', t.path].filter(Boolean).join(', ')}</span>
            <p className="su-tpl__counts">{templateCountWords(t)}</p>
            {t.stageNames?.length > 0 && (
              <ol className="su-tpl__seq" aria-label="Stages in order">
                {t.stageNames.map((n, i) => (
                  <li key={`${i}-${n}`}>
                    <span className="su-tpl__seq-n" aria-hidden="true">
                      {i + 1}
                    </span>
                    {n}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="su-tpl__actions">
            <a className="btn btn--desktop" href={href(`/setup/templates/${encodeURIComponent(t.jobId)}`)}>
              Edit<span className="sr-only"> the program of {t.name}</span>
            </a>
            {t.kind === 'build' && (
              <a className="btn btn--desktop" href={href(`/setup?template=${encodeURIComponent(t.jobId)}`)}>
                Use for a new job<span className="sr-only">: {t.name}</span>
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function FromJob({ builds, onCancel }: { builds: JobListRow[]; onCancel: () => void }) {
  const { api, refresh } = useData();
  const [jobId, setJobId] = useState(builds[0]?.jobId ?? '');
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const nameError = checkName(name, 'template');
  const call = useMemo<SetupCall | null>(() => (jobId && !nameError ? { op: 'save_as_template', args: { job: jobId, name: name.trim() } } : null), [jobId, name, nameError]);
  const preview = usePreview(call);
  const problem = previewProblem(preview);
  const counts = preview.status === 'ready' && preview.preview.result.kind === 'proposal' ? countInserts(preview.preview.result.changes) : null;

  async function create() {
    setTouched(true);
    if (!call || !canSave(preview)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await api.applySetup(call.op, call.args);
      if (!r.ok) return setSaveError(r.reason);
      const id = r.result.changes.find((c) => c.kind === 'insert' && c.table === 'job')?.rowId;
      refresh();
      if (id) window.location.hash = href(`/setup/templates/${encodeURIComponent(id)}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="plate su-form-plate su-fromjob"
      noValidate
      aria-labelledby="fromjob-h"
      data-testid="fromjob"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <h2 id="fromjob-h" className="su-form-plate__title">
        Save a job as a template
      </h2>
      <div className="su-field">
        <span className="su-label" id="fj-job-label">
          Copy the program of
        </span>
        <div className="seg su-seg--wrap" role="group" aria-labelledby="fj-job-label">
          {builds.map((b) => (
            <button key={b.jobId} type="button" className="seg__btn" aria-pressed={b.jobId === jobId} data-testid={`fj-job-${b.jobId}`} onClick={() => setJobId(b.jobId)}>
              {b.name}
            </button>
          ))}
        </div>
      </div>
      <div className={touched && nameError ? 'su-field has-error' : 'su-field'}>
        <label className="su-label" htmlFor="fj-name">
          Template name
        </label>
        <input id="fj-name" className="input input--desktop" type="text" value={name} placeholder="Duplex, two storey" onChange={(e) => setName(e.target.value)} />
        {touched && nameError && (
          <span className="su-error" role="alert">
            {nameError}
          </span>
        )}
      </div>
      <div aria-live="polite">
        {problem && (
          <p className="su-error" role="alert">
            {problem}
          </p>
        )}
        {counts ? (
          <p className="su-hint" data-testid="fromjob-preview">
            {plural(counts.stage, 'stage')}, {plural(counts.step, 'step')}, {plural(counts.step_link, 'link')}, {plural(counts.requirement, 'need')} and{' '}
            {plural(counts.photo_category, 'photo category', 'photo categories')}. No dates.
          </p>
        ) : (
          <p className="su-hint">Dates, progress and items stay with the job.</p>
        )}
      </div>
      <div className="su-actions">
        <button type="submit" className="btn btn--primary btn--desktop" disabled={saving || (touched && !canSave(preview))} data-testid="fromjob-create">
          {saving ? 'Saving…' : 'Save as template'}
        </button>
        <button type="button" className="btn btn--desktop" onClick={onCancel}>
          Cancel
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

function countInserts(changes: Change[]): Record<'stage' | 'step' | 'step_link' | 'requirement' | 'photo_category', number> {
  const n = { stage: 0, step: 0, step_link: 0, requirement: 0, photo_category: 0 };
  for (const c of changes) if (c.kind === 'insert' && c.table in n) n[c.table as keyof typeof n] += 1;
  return n;
}
