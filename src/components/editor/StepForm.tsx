/**
 * The side panel for one step: name, stage, duration in working days,
 * planned start (planned end derives, rule 3: nothing moves a planned date
 * but a hand), what it waits for, hold point, needs, and the stage's photo
 * sets. Every change goes to the draft at once and the Gantt and the finish
 * preview follow it; nothing is written until Save.
 *
 * A stage-level job's placeholder step is the stage itself, so the name
 * field renames both and the title says "whole stage".
 */
import type { ProgramDraft } from '../../data/api';
import type { StepForecast } from '../../domain/forecast';
import { formatShort, stepEnd } from '../../domain/dates';
import type { PhotoCategory, Requirement, Step, StepLink } from '../../domain/types';
import { lateText } from '../gantt/Gantt';
import { CategoryList } from './CategoryList';
import { ConfirmDelete } from './ConfirmDelete';
import { LinkPicker } from './LinkPicker';
import { RequirementList } from './RequirementList';
import './editor.css';

export interface StepFormProps {
  step: Step;
  draft: ProgramDraft;
  /** The forecast for this step over the draft (undefined on a template). */
  forecast?: StepForecast;
  /** Build jobs carry planned dates; templates do not. */
  dated: boolean;
  /** Open items on the step, named in the delete question. */
  itemCount: number;
  disabled?: boolean;
  onChange: (patch: Partial<Pick<Step, 'name' | 'stageId' | 'durationDays' | 'plannedStart' | 'isHoldPoint' | 'tradeType'>>) => void;
  onLinkAdd: (waitsForStepId: string) => void;
  onLinkRemove: (link: StepLink) => void;
  onRequirementAdd: () => void;
  onRequirementChange: (id: string, patch: Partial<Pick<Requirement, 'kind' | 'name' | 'leadTimeWeeks' | 'tradeType'>>) => void;
  onRequirementRemove: (id: string) => void;
  onCategoryAdd: () => void;
  onCategoryChange: (id: string, patch: Partial<Pick<PhotoCategory, 'name' | 'requiredForHoldPoint'>>) => void;
  onCategoryRemove: (id: string) => void;
  onDelete: () => void;
}

export function StepForm(p: StepFormProps) {
  const { step, draft, forecast, dated, disabled } = p;
  const stage = draft.stages.find((s) => s.id === step.stageId);
  const stages = [...draft.stages].sort((a, b) => a.order - b.order);
  const requirements = draft.requirements.filter((r) => r.stepId === step.id);
  const categories = (draft.photoCategories ?? []).filter((c) => c.stageId === step.stageId).sort((a, b) => a.order - b.order);
  const stageHasHoldPoint = draft.steps.some((s) => s.stageId === step.stageId && s.isHoldPoint);
  const plannedEnd = step.plannedStart ? stepEnd(step.plannedStart, step.durationDays) : undefined;
  const whole = !!step.isPlaceholder;
  const days = (n: number) => `${n} working day${n === 1 ? '' : 's'}`;

  const deleteQuestion = whole
    ? `Delete ${stage?.name ?? step.name}? The whole stage goes, and ${p.itemCount === 0 ? 'nothing is on it' : `${p.itemCount} item${p.itemCount === 1 ? '' : 's'} on it lose their step`}.`
    : `Delete ${step.name}? ${p.itemCount === 0 ? 'Nothing is on it' : `${p.itemCount} item${p.itemCount === 1 ? '' : 's'} on it lose their step`}, and links to it go too.`;

  return (
    <div className="ed" data-testid="editor-panel" data-kind={whole ? 'stage-step' : 'step'}>
      <div>
        <p className="ed__kicker">{whole ? 'Whole stage' : `Step in ${stage?.name ?? 'the program'}`}</p>
        <h2 className="ed__title">{(whole ? stage?.name : step.name) || 'Unnamed step'}</h2>
      </div>

      <div className="ed__field">
        <label htmlFor="editor-name">{whole ? 'Stage name' : 'Step name'}</label>
        <input id="editor-name" className="ed__input" value={whole ? (stage?.name ?? '') : step.name} disabled={disabled} data-testid="editor-name" onChange={(e) => p.onChange({ name: e.target.value })} />
      </div>

      {!whole && (
        <div className="ed__field">
          <label htmlFor="editor-step-stage">Stage</label>
          <select id="editor-step-stage" className="ed__input" value={step.stageId} disabled={disabled} data-testid="editor-step-stage" onChange={(e) => p.onChange({ stageId: e.target.value })}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ed__row">
        <div className="ed__field ed__field--short">
          <label htmlFor="editor-duration">Working days</label>
          <input
            id="editor-duration"
            className="ed__input ed__input--num"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={step.durationDays}
            disabled={disabled}
            data-testid="editor-duration"
            onChange={(e) => p.onChange({ durationDays: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
          />
        </div>
        {dated && (
          <div className="ed__field">
            <label htmlFor="editor-planned-start">Planned start</label>
            <input
              id="editor-planned-start"
              className="ed__input"
              type="date"
              value={step.plannedStart ?? ''}
              disabled={disabled}
              data-testid="editor-planned-start"
              onChange={(e) => p.onChange({ plannedStart: e.target.value || undefined })}
            />
          </div>
        )}
      </div>

      {dated ? (
        <div className="ed__derived" data-testid="editor-derived">
          <span>
            Planned <strong>{step.plannedStart ? `${formatShort(step.plannedStart)} to ${formatShort(plannedEnd!)}` : 'no date yet'}</strong>, {days(step.durationDays)}
          </span>
          {forecast && (
            <span>
              Forecast <strong>{`${formatShort(forecast.forecastStart)} to ${formatShort(forecast.forecastEnd)}`}</strong>
              {forecast.lateDays > 0 ? `, ${lateText(forecast.lateDays)}` : ', on plan'}
            </span>
          )}
        </div>
      ) : (
        <p className="ed__hint">{days(step.durationDays)}. Templates carry no dates; a new job runs them forward from its start.</p>
      )}

      <label className="ed__check">
        <input type="checkbox" checked={step.isHoldPoint} disabled={disabled} data-testid="editor-holdpoint" onChange={(e) => p.onChange({ isHoldPoint: e.target.checked })} />
        Hold point: the certifier inspects before work goes on
      </label>

      <div className="ed__field">
        <label htmlFor="editor-trade">Trade on site, for the look-ahead</label>
        <input id="editor-trade" className="ed__input" value={step.tradeType ?? ''} placeholder="Roof plumber" disabled={disabled} data-testid="editor-trade" onChange={(e) => p.onChange({ tradeType: e.target.value || undefined })} />
      </div>

      <LinkPicker step={step} steps={draft.steps} stages={draft.stages} links={draft.links} disabled={disabled} onAdd={p.onLinkAdd} onRemove={p.onLinkRemove} />

      <RequirementList requirements={requirements} disabled={disabled} onAdd={p.onRequirementAdd} onChange={p.onRequirementChange} onRemove={p.onRequirementRemove} />

      <CategoryList
        stageName={stage?.name ?? 'this stage'}
        categories={categories}
        hasHoldPoint={stageHasHoldPoint}
        disabled={disabled}
        onAdd={p.onCategoryAdd}
        onChange={p.onCategoryChange}
        onRemove={p.onCategoryRemove}
      />

      <div className="ed__section">
        <ConfirmDelete label={whole ? 'Delete stage' : 'Delete step'} question={deleteQuestion} disabled={disabled} onConfirm={p.onDelete} />
      </div>
    </div>
  );
}
