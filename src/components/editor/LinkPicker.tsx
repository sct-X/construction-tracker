/**
 * "Waits for": the links a step has, each removable, and a picker for another
 * step in the job. A link that would loop is refused in words, naming the
 * chain, and nothing changes.
 */
import { useState } from 'react';
import type { Stage, Step, StepLink } from '../../domain/types';
import { cyclePath, cycleWords } from './programDraft';

interface Props {
  step: Step;
  steps: Step[];
  stages: Stage[];
  links: StepLink[];
  disabled?: boolean;
  onAdd: (waitsForStepId: string) => void;
  onRemove: (link: StepLink) => void;
}

export function LinkPicker({ step, steps, stages, links, disabled, onAdd, onRemove }: Props) {
  const [pick, setPick] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const names = new Map(steps.map((s) => [s.id, s.name]));
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const mine = links.filter((l) => l.stepId === step.id);
  const linked = new Set(mine.map((l) => l.waitsForStepId));
  const candidates = steps.filter((s) => s.id !== step.id && !linked.has(s.id));
  const byStage = [...stages]
    .sort((a, b) => a.order - b.order)
    .map((st) => ({ stage: st, steps: candidates.filter((s) => s.stageId === st.id).sort((a, b) => a.order - b.order) }))
    .filter((g) => g.steps.length);

  const add = () => {
    if (!pick) return;
    const path = cyclePath(links, step.id, pick);
    if (path) {
      setRefusal(cycleWords(path, step.id, names));
      return;
    }
    setRefusal(null);
    onAdd(pick);
    setPick('');
  };

  return (
    <div className="ed__section" data-testid="editor-waits">
      <div className="ed__section-title">
        <span>Waits for</span>
      </div>
      {mine.length === 0 ? (
        <p className="ed__empty">Nothing</p>
      ) : (
        <ul className="ed__list">
          {mine.map((l) => (
            <li key={l.id} className="ed__item" data-testid={`editor-waits-${l.waitsForStepId}`}>
              <span>
                <span className="ed__item-name">{names.get(l.waitsForStepId) ?? l.waitsForStepId}</span>
                <span className="ed__item-sub"> {stageName.get(steps.find((s) => s.id === l.waitsForStepId)?.stageId ?? '') ?? ''}</span>
              </span>
              <button type="button" className="ed__link" disabled={disabled} data-testid={`editor-waits-remove-${l.waitsForStepId}`} onClick={() => onRemove(l)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ed__row">
        <div className="ed__field">
          <label htmlFor="editor-waits-pick">Also waits for</label>
          <select
            id="editor-waits-pick"
            className="ed__input"
            value={pick}
            disabled={disabled || candidates.length === 0}
            data-testid="editor-waits-pick"
            onChange={(e) => {
              setPick(e.target.value);
              setRefusal(null);
            }}
          >
            <option value="">Choose a step</option>
            {byStage.map((g) => (
              <optgroup key={g.stage.id} label={g.stage.name}>
                {g.steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn--desktop" disabled={disabled || !pick} data-testid="editor-waits-add" onClick={add}>
          Add
        </button>
      </div>
      {refusal && (
        <p className="ed__refusal" role="alert" data-testid="editor-waits-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
}
