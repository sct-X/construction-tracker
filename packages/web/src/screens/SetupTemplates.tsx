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
  return (
    <SetupFrame title="Templates" sub="A template is a program with no dates. A new job copies its stages, steps, links, needs and photo categories.">
      {q.status === 'loading' && <LoadingRows rows={3} label="Loading templates" />}
      {q.status === 'error' && <LoadError what="the templates" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <TemplatesBody data={q.data} />}
    </SetupFrame>
  );
}

function TemplatesBody({ data }: { data: TemplatesData }) {
  return (
    <>
      {data.templates.length ? (
        <table className="su-table" data-testid="templates">
          <thead>
            <tr>
              <th scope="col">Template</th>
              <th scope="col">Stages</th>
              <th scope="col">Steps</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.templates.map((t) => (
              <tr key={t.jobId} data-testid={`template-${t.jobId}`}>
                <th scope="row" className="su-strong">
                  {t.name}
                </th>
                <td>{t.stages}</td>
                <td>{t.steps}</td>
                <td className="su-right">
                  <span className="su-row-actions">
                    <a className="btn su-link-btn" href={href(`/setup/templates/${encodeURIComponent(t.jobId)}`)}>
                      Edit the program<span className="sr-only"> of {t.name}</span>
                    </a>
                    <a className="btn su-link-btn" href={href(`/setup?template=${encodeURIComponent(t.jobId)}`)}>
                      Start a job from {t.name}
                    </a>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">No templates yet. Build the duplex template first, or copy a job's program below.</p>
      )}
      <FromJob builds={data.builds} />
    </>
  );
}

function FromJob({ builds }: { builds: JobListRow[] }) {
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

  if (!builds.length) return null;

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
      className="block su-panel su-fromjob"
      noValidate
      aria-labelledby="fromjob-h"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <h2 id="fromjob-h" className="su-panel-h">
        Make a template from a job's program
      </h2>
      <p className="su-muted">Copies the stages, steps, links, needs and photo categories. Dates, progress and items stay with the job.</p>
      <div className="su-row2">
        <div className="su-field">
          <label htmlFor="fj-job">Copy the program of</label>
          <select id="fj-job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            {builds.map((b) => (
              <option key={b.jobId} value={b.jobId}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className={touched && nameError ? 'su-field has-error' : 'su-field'}>
          <label htmlFor="fj-name">Template name</label>
          <input id="fj-name" type="text" value={name} placeholder="Duplex, two storey" onChange={(e) => setName(e.target.value)} />
          {touched && nameError && (
            <span className="su-error" role="alert">
              {nameError}
            </span>
          )}
        </div>
      </div>
      <div aria-live="polite">
        {problem && (
          <p className="su-error" role="alert">
            {problem}
          </p>
        )}
        {counts && (
          <p className="su-fromjob-what" data-testid="fromjob-preview">
            {plural(counts.stage, 'stage')}, {plural(counts.step, 'step')}, {plural(counts.step_link, 'link')}, {plural(counts.requirement, 'need')} and{' '}
            {plural(counts.photo_category, 'photo category', 'photo categories')}. No dates.
          </p>
        )}
      </div>
      <div className="su-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || (touched && !canSave(preview))} data-testid="fromjob-create">
          {saving ? 'Making it…' : 'Make the template'}
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
