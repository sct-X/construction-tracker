/**
 * Screen 20: the program editor (UI_PLAN 3.20). Desktop only, admin and
 * partners. The Gantt is the picture: a bar is a button that opens the step
 * in the side panel, and the chart redraws from the draft as it is edited.
 * Stages sit in a row above the chart: pick one to rename it, move it, set
 * its photo sets or add a step to it. The footer is the one bold thing on
 * the screen, a dark bar that keeps the forecast finish in view, before and
 * after ("Fri 26 Feb 2027 -> Fri 5 Mar 2027, +7 days"), so Dominic sees what
 * an edit costs before he saves it.
 *
 * Nothing is written until Save; Save turns the draft into the API's own
 * calls (each logs its activity line) and the forecast is real from then on.
 * Planned dates never move on their own (rule 3): the planned start is a
 * field, and planned end follows it over working days.
 *
 * Stage-level jobs edit their placeholder steps as stages. Design jobs edit
 * the checklist stages only (name, order). Templates get the same editor with
 * no dates and no finish. On a phone the screen is one sentence and a link
 * to the read-only program.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ProgramDraft } from '../data/api';
import { useApi, useQuery, useSession } from '../data/context';
import type { PhotoCategory, Requirement, Stage, Step, StepLink } from '../domain/types';
import { StageForm } from '../components/editor/StageForm';
import { StepForm } from '../components/editor/StepForm';
import { applyProgramDraft, diffProgram, draftId, isDraftId, makeStage, makeStep, readProgram, withPlannedEnd } from '../components/editor/programDraft';
import { Gantt } from '../components/gantt/Gantt';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import NotFound from './NotFound';
import './programEditor.css';

type Selection = { kind: 'step'; id: string } | { kind: 'stage'; id: string } | null;

/** The seed's convention for a stage-level job's one step: "Frame, whole stage". */
function placeholderName(stageName: string): string {
  return `${stageName}, whole stage`;
}

export default function ProgramEditor() {
  const { id = '' } = useParams();
  const api = useApi();
  const { today, offline } = useSession();
  const layout = useLayout();
  const job = useQuery((api) => api.getJob(id), [id]);
  const saved = useQuery((api) => readProgram(api, id), [id]);
  const items = useQuery((api) => api.listItems({ jobId: id, includeDone: true }), [id]);

  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [savedWords, setSavedWords] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const program = draft ?? saved;
  const preview = useMemo(() => (job && !job.isTemplate && job.kind === 'build' ? api.previewProgramChange(id, program) : undefined), [api, id, job, program]);
  const changes = useMemo(() => diffProgram(saved, program), [saved, program]);

  // Forget a selection that no longer exists (a deleted stage, or a reset).
  useEffect(() => {
    if (!selection) return;
    const exists = selection.kind === 'step' ? program.steps.some((s) => s.id === selection.id) : program.stages.some((s) => s.id === selection.id);
    if (!exists) setSelection(null);
  }, [selection, program]);

  // Under 1400px the panel sits below the chart: bring it into view when something is picked.
  useEffect(() => {
    if (!selection || !panelRef.current) return;
    const beside = typeof window !== 'undefined' && window.matchMedia('(min-width: 1400px)').matches;
    panelRef.current.scrollIntoView({ block: beside ? 'nearest' : 'start' });
  }, [selection]);

  if (!job) return <NotFound />;

  if (layout === 'phone') {
    return (
      <main className="page editor editor--phone" data-testid="editor" data-layout="phone">
        <PageHeader title={job.name} meta="Program editor" back={{ to: `/jobs/${job.id}/program`, label: 'Program' }} />
        <p className="page__lede" data-testid="editor-phone">
          Edit the program on a desktop.{' '}
          <Link to={`/jobs/${job.id}/program`} data-testid="editor-program-link">
            Read the program
          </Link>
        </p>
      </main>
    );
  }

  const design = job.kind === 'design';
  const dated = !job.isTemplate && !design;
  const disabled = offline;
  const stages = [...program.stages].sort((a, b) => a.order - b.order);
  const dirty = changes.length > 0;

  const update = (fn: (p: ProgramDraft) => ProgramDraft) => {
    setSavedWords(null);
    setDraft(fn(program));
  };

  // ---- stages ----
  const addStage = () => {
    const stage = makeStage(program, { sideId: job.sideId, jobId: job.id });
    update((p) => ({ ...p, stages: [...p.stages, stage] }));
    setSelection({ kind: 'stage', id: stage.id });
  };
  const renameStage = (stageId: string, name: string) =>
    update((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId ? { ...s, name } : s)),
      // A stage-level job's placeholder step is the stage: it carries the same name.
      steps: p.steps.map((s) => (s.stageId === stageId && s.isPlaceholder ? { ...s, name: placeholderName(name) } : s)),
    }));
  const moveStage = (stageId: string, direction: -1 | 1) =>
    update((p) => {
      const ordered = [...p.stages].sort((a, b) => a.order - b.order);
      const i = ordered.findIndex((s) => s.id === stageId);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= ordered.length) return p;
      const swapped = [...ordered];
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      return { ...p, stages: swapped.map((s, n) => ({ ...s, order: n + 1 })) };
    });
  const deleteStage = (stageId: string) => {
    update((p) => {
      const gone = new Set(p.steps.filter((s) => s.stageId === stageId).map((s) => s.id));
      return {
        ...p,
        stages: p.stages.filter((s) => s.id !== stageId).map((s, n) => ({ ...s, order: n + 1 })),
        steps: p.steps.filter((s) => !gone.has(s.id)),
        links: p.links.filter((l) => !gone.has(l.stepId) && !gone.has(l.waitsForStepId)),
        requirements: p.requirements.filter((r) => !gone.has(r.stepId)),
        photoCategories: (p.photoCategories ?? []).filter((c) => c.stageId !== stageId),
      };
    });
    setSelection(null);
  };

  // ---- steps ----
  const addStep = (stage: Stage) => {
    const step = makeStep(program, stage, { today, dated });
    update((p) => ({ ...p, steps: [...p.steps, step] }));
    setSelection({ kind: 'step', id: step.id });
  };
  const changeStep = (stepId: string, patch: Partial<Pick<Step, 'name' | 'stageId' | 'durationDays' | 'plannedStart' | 'isHoldPoint' | 'tradeType'>>) =>
    update((p) => {
      const step = p.steps.find((s) => s.id === stepId);
      if (!step) return p;
      const moving = patch.stageId !== undefined && patch.stageId !== step.stageId;
      const order = moving ? p.steps.filter((s) => s.stageId === patch.stageId).length + 1 : step.order;
      // A placeholder step is the stage: its name field renames the stage, and the step keeps the "whole stage" suffix.
      const renamingStage = step.isPlaceholder && patch.name !== undefined;
      const next = withPlannedEnd({ ...step, ...patch, order, name: renamingStage ? placeholderName(patch.name!) : (patch.name ?? step.name) });
      return {
        ...p,
        steps: p.steps.map((s) => (s.id === stepId ? next : s)),
        stages: renamingStage ? p.stages.map((s) => (s.id === step.stageId ? { ...s, name: patch.name! } : s)) : p.stages,
      };
    });
  const deleteStep = (step: Step) => {
    if (step.isPlaceholder) {
      deleteStage(step.stageId);
      return;
    }
    update((p) => ({
      ...p,
      steps: p.steps.filter((s) => s.id !== step.id),
      links: p.links.filter((l) => l.stepId !== step.id && l.waitsForStepId !== step.id),
      requirements: p.requirements.filter((r) => r.stepId !== step.id),
    }));
    setSelection({ kind: 'stage', id: step.stageId });
  };

  // ---- links, needs, photo sets ----
  const addLink = (stepId: string, waitsForStepId: string) => {
    const link: StepLink = { id: draftId('link'), sideId: job.sideId, jobId: job.id, stepId, waitsForStepId };
    update((p) => ({ ...p, links: [...p.links, link] }));
  };
  const removeLink = (link: StepLink) => update((p) => ({ ...p, links: p.links.filter((l) => l.id !== link.id) }));
  const addRequirement = (stepId: string) => {
    const rq: Requirement = { id: draftId('rq'), sideId: job.sideId, jobId: job.id, stepId, kind: 'trade', name: 'New need', leadTimeWeeks: 2, tradeType: 'New need' };
    update((p) => ({ ...p, requirements: [...p.requirements, rq] }));
  };
  const changeRequirement = (rqId: string, patch: Partial<Pick<Requirement, 'kind' | 'name' | 'leadTimeWeeks' | 'tradeType'>>) =>
    update((p) => ({ ...p, requirements: p.requirements.map((r) => (r.id === rqId ? { ...r, ...patch } : r)) }));
  const removeRequirement = (rqId: string) => update((p) => ({ ...p, requirements: p.requirements.filter((r) => r.id !== rqId) }));
  const addCategory = (stageId: string) => {
    const existing = (program.photoCategories ?? []).filter((c) => c.stageId === stageId);
    const cat: PhotoCategory = { id: draftId('pc'), sideId: job.sideId, jobId: job.id, stageId, name: 'New photo set', requiredForHoldPoint: false, order: existing.length + 1 };
    update((p) => ({ ...p, photoCategories: [...(p.photoCategories ?? []), cat] }));
  };
  const changeCategory = (catId: string, patch: Partial<Pick<PhotoCategory, 'name' | 'requiredForHoldPoint'>>) =>
    update((p) => ({ ...p, photoCategories: (p.photoCategories ?? []).map((c) => (c.id === catId ? { ...c, ...patch } : c)) }));
  const removeCategory = (catId: string) => update((p) => ({ ...p, photoCategories: (p.photoCategories ?? []).filter((c) => c.id !== catId) }));

  // ---- save and cancel ----
  const save = () => {
    if (!draft || !dirty) return;
    const ids = applyProgramDraft(api, job.id, saved, draft);
    setDraft(null);
    if (selection && isDraftId(selection.id)) {
      const real = ids.get(selection.id);
      setSelection(real ? { ...selection, id: real } : null);
    }
    const n = changes.length;
    setSavedWords(`Saved ${n} change${n === 1 ? '' : 's'}.`);
  };
  const cancel = () => {
    setDraft(null);
    setSavedWords(null);
    if (selection && isDraftId(selection.id)) setSelection(null);
  };

  // ---- what is selected ----
  const selectedStep = selection?.kind === 'step' ? program.steps.find((s) => s.id === selection.id) : undefined;
  const selectedStage = selection?.kind === 'stage' ? program.stages.find((s) => s.id === selection.id) : undefined;

  // What the draft would move: steps whose start changes, plus any new step.
  const savedForecast = preview ? api.getForecast(job.id) : undefined;
  const movedSteps = preview ? Object.values(preview.forecast.steps).filter((st) => savedForecast?.steps[st.stepId]?.forecastStart !== st.forecastStart).length : 0;

  return (
    <main className="page editor" data-testid="editor" data-layout="desktop" data-dirty={dirty ? 'true' : 'false'}>
      <PageHeader
        title={job.name}
        meta={job.isTemplate ? 'Template editor' : design ? 'Checklist editor' : 'Program editor'}
        back={{ to: job.isTemplate ? '/templates' : `/jobs/${job.id}/program`, label: job.isTemplate ? 'Templates' : 'Program' }}
      />

      {offline && (
        <p className="editor__offline" data-testid="editor-offline">
          No signal. Read-only until it returns.
        </p>
      )}

      <div className="editor__stages" role="group" aria-label="Stages" data-testid="editor-stages">
        {stages.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className="editor__stage"
            aria-pressed={selection?.kind === 'stage' && selection.id === s.id}
            data-testid={`editor-stage-${s.id}`}
            onClick={() => setSelection({ kind: 'stage', id: s.id })}
          >
            <span className="editor__stage-n num">{i + 1}</span>
            {s.name || 'Unnamed stage'}
          </button>
        ))}
        <button type="button" className="editor__stage editor__stage--add" disabled={disabled} data-testid="editor-add-stage" onClick={addStage}>
          Add stage
        </button>
      </div>

      <div className={`editor__cols ${design ? 'editor__cols--bare' : ''}`}>
        {!design && (
          <div className="editor__chart">
            {preview ? (
              <Gantt
                forecast={preview.forecast}
                steps={program.steps}
                today={today}
                onSelectStep={(stepId) => setSelection({ kind: 'step', id: stepId })}
                renderBar={(step, g, bar) => {
                  const selected = selection?.kind === 'step' && selection.id === step.stepId;
                  const left = g.isHoldPoint ? g.x + g.pxPerDay / 2 - 13 : g.x - 3;
                  const width = g.isHoldPoint ? 26 : g.width + 6;
                  return (
                    <span data-testid={`editor-step-${step.stepId}`} data-selected={selected ? 'true' : 'false'}>
                      {bar}
                      {selected && <span className="editor__ring" style={{ left, width }} aria-hidden="true" />}
                    </span>
                  );
                }}
              />
            ) : (
              <StepTree program={program} selection={selection} onSelect={setSelection} />
            )}
          </div>
        )}

        <aside className="editor__panel" aria-label="Edit" ref={panelRef}>
          {selectedStep ? (
            <StepForm
              key={selectedStep.id}
              step={selectedStep}
              draft={program}
              forecast={preview?.forecast.steps[selectedStep.id]}
              dated={dated}
              itemCount={items.filter((i) => i.stepId === selectedStep.id).length}
              disabled={disabled}
              onChange={(patch) => changeStep(selectedStep.id, patch)}
              onLinkAdd={(w) => addLink(selectedStep.id, w)}
              onLinkRemove={removeLink}
              onRequirementAdd={() => addRequirement(selectedStep.id)}
              onRequirementChange={changeRequirement}
              onRequirementRemove={removeRequirement}
              onCategoryAdd={() => addCategory(selectedStep.stageId)}
              onCategoryChange={changeCategory}
              onCategoryRemove={removeCategory}
              onDelete={() => deleteStep(selectedStep)}
            />
          ) : selectedStage ? (
            <StageForm
              key={selectedStage.id}
              stage={selectedStage}
              draft={program}
              bare={design}
              disabled={disabled}
              onRename={(name) => renameStage(selectedStage.id, name)}
              onMove={(dir) => moveStage(selectedStage.id, dir)}
              onAddStep={() => addStep(selectedStage)}
              onCategoryAdd={() => addCategory(selectedStage.id)}
              onCategoryChange={changeCategory}
              onCategoryRemove={removeCategory}
              onDelete={() => deleteStage(selectedStage.id)}
            />
          ) : (
            <div className="ed" data-testid="editor-panel" data-kind="none">
              <h2 className="ed__title">Nothing picked</h2>
              <p className="editor__help">{design ? 'Pick a stage above.' : job.isTemplate ? 'Pick a step from the list, or a stage above.' : 'Pick a bar on the chart, or a stage above.'}</p>
            </div>
          )}
        </aside>
      </div>

      <footer className="editor__foot glass glass--thick glass--float" data-testid="editor-foot">
        <div className="editor__finish" data-testid="editor-preview-finish" aria-live="polite">
          <span className="editor__finish-note">
            {preview ? (dirty ? (movedSteps === 0 ? 'No step dates move.' : `${movedSteps} step${movedSteps === 1 ? '' : 's'} would move.`) : 'Edit a step to see what moves.') : design ? 'A design job has no program dates.' : 'No dates on a template.'}
          </span>
        </div>
        <div className="editor__foot-actions">
          <span className="editor__changes" data-testid="editor-changes">
            {savedWords ?? (dirty ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}` : 'No unsaved changes')}
          </span>
          <button type="button" className="btn btn--glass btn--desktop editor__cancel" disabled={!dirty} data-testid="editor-cancel" onClick={cancel}>
            Discard
          </button>
          <button type="button" className="btn btn--glass-prominent btn--desktop editor__save" disabled={!dirty || disabled} data-testid="editor-save" onClick={save}>
            {disabled ? 'Needs signal' : dirty ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'}` : 'Save'}
          </button>
        </div>
      </footer>
    </main>
  );
}

/** Templates have no forecast, so no chart: the steps as a list under their stages. */
function StepTree({ program, selection, onSelect }: { program: ProgramDraft; selection: Selection; onSelect: (s: Selection) => void }) {
  const stages = [...program.stages].sort((a, b) => a.order - b.order);
  return (
    <div className="editor__tree" data-testid="editor-tree">
      {stages.map((st) => {
        const steps = program.steps.filter((s) => s.stageId === st.id).sort((a, b) => a.order - b.order);
        return (
          <section key={st.id} className="editor__tree-stage">
            <h3 className="editor__tree-title">{st.name}</h3>
            {steps.length === 0 ? (
              <p className="ed__empty">No steps yet.</p>
            ) : (
              <ul className="editor__tree-list">
                {steps.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="editor__tree-step"
                      aria-pressed={selection?.kind === 'step' && selection.id === s.id}
                      data-testid={`editor-step-${s.id}`}
                      onClick={() => onSelect({ kind: 'step', id: s.id })}
                    >
                      <span className="editor__tree-name">
                        {s.name}
                        {s.isHoldPoint && <span className="editor__tree-hold"> hold point</span>}
                      </span>
                      <span className="editor__tree-days num">{s.durationDays} days</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
