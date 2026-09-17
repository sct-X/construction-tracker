/**
 * The side panel for one stage: its name, where it sits in the order (move
 * up, move down: the keyboard equivalent of a drag), its photo sets, a way
 * to add a step to it, and delete. Design jobs get the bare form: the
 * stages are a checklist, so name and order are all there is.
 */
import type { ProgramDraft } from '../../data/api';
import type { PhotoCategory, Stage } from '../../domain/types';
import { CategoryList } from './CategoryList';
import { ConfirmDelete } from './ConfirmDelete';
import './editor.css';

export interface StageFormProps {
  stage: Stage;
  draft: ProgramDraft;
  /** Design jobs: name and order only. */
  bare: boolean;
  disabled?: boolean;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onAddStep: () => void;
  onCategoryAdd: () => void;
  onCategoryChange: (id: string, patch: Partial<Pick<PhotoCategory, 'name' | 'requiredForHoldPoint'>>) => void;
  onCategoryRemove: (id: string) => void;
  onDelete: () => void;
}

export function StageForm(p: StageFormProps) {
  const { stage, draft, bare, disabled } = p;
  const ordered = [...draft.stages].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((s) => s.id === stage.id);
  const steps = draft.steps.filter((s) => s.stageId === stage.id);
  const realSteps = steps.filter((s) => !s.isPlaceholder);
  const categories = (draft.photoCategories ?? []).filter((c) => c.stageId === stage.id).sort((a, b) => a.order - b.order);
  const hasHoldPoint = steps.some((s) => s.isHoldPoint);
  const count = realSteps.length;
  const question = bare
    ? `Delete ${stage.name}?`
    : `Delete ${stage.name}${count ? ` and its ${count} step${count === 1 ? '' : 's'}` : ''}? ${categories.length ? 'Its photo sets go too.' : 'It has no photo sets.'}`;

  return (
    <div className="ed" data-testid="editor-panel" data-kind="stage">
      <div>
        <p className="ed__kicker">
          Stage {index + 1} of {ordered.length}
        </p>
        <h2 className="ed__title">{stage.name || 'Unnamed stage'}</h2>
      </div>

      <div className="ed__field">
        <label htmlFor="editor-name">Stage name</label>
        <input id="editor-name" className="ed__input" value={stage.name} disabled={disabled} data-testid="editor-name" onChange={(e) => p.onRename(e.target.value)} />
      </div>

      <div className="ed__field">
        <span className="ed__label">Order</span>
        <div className="ed__actions">
          <button type="button" className="btn btn--desktop" disabled={disabled || index <= 0} data-testid="editor-move-up" onClick={() => p.onMove(-1)}>
            Move up
          </button>
          <button type="button" className="btn btn--desktop" disabled={disabled || index >= ordered.length - 1} data-testid="editor-move-down" onClick={() => p.onMove(1)}>
            Move down
          </button>
        </div>
      </div>

      {!bare && (
        <div className="ed__section">
          <div className="ed__section-title">
            <span>{count === 0 ? 'No steps yet' : `${count} step${count === 1 ? '' : 's'}`}</span>
            <button type="button" className="ed__link" disabled={disabled} data-testid="editor-add-step" onClick={p.onAddStep}>
              Add a step
            </button>
          </div>
          {count > 0 && (
            <ul className="ed__list">
              {[...realSteps]
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <li key={s.id} className="ed__item">
                    <span className="ed__item-name">{s.name}</span>
                    <span className="ed__item-sub">{s.durationDays} days</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {!bare && (
        <CategoryList
          stageName={stage.name}
          categories={categories}
          hasHoldPoint={hasHoldPoint}
          disabled={disabled}
          onAdd={p.onCategoryAdd}
          onChange={p.onCategoryChange}
          onRemove={p.onCategoryRemove}
        />
      )}

      <div className="ed__section">
        <ConfirmDelete label="Delete stage" question={question} disabled={disabled} onConfirm={p.onDelete} />
      </div>
    </div>
  );
}
