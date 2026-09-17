/**
 * A stage's photo sets: the categories Alec picks from when he uploads, each
 * with "required for hold point" (rule 6: a hold-point step in this stage
 * cannot be ticked off until every required set has an uploaded photo).
 */
import type { PhotoCategory } from '../../domain/types';

interface Props {
  stageName: string;
  categories: PhotoCategory[];
  /** Whether the stage has a hold-point step; the required tick means nothing without one, so say so. */
  hasHoldPoint: boolean;
  disabled?: boolean;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<Pick<PhotoCategory, 'name' | 'requiredForHoldPoint'>>) => void;
  onRemove: (id: string) => void;
}

export function CategoryList({ stageName, categories, hasHoldPoint, disabled, onAdd, onChange, onRemove }: Props) {
  return (
    <div className="ed__section" data-testid="editor-categories">
      <div className="ed__section-title">
        <span>Photo sets for {stageName}</span>
        <button type="button" className="ed__link" disabled={disabled} data-testid="editor-category-add" onClick={onAdd}>
          Add set
        </button>
      </div>
      {categories.length === 0 ? (
        <p className="ed__empty">No sets yet</p>
      ) : (
        <ul className="ed__list">
          {categories.map((c) => (
            <li key={c.id} className="ed__item" data-testid={`editor-category-${c.id}`}>
              <div className="ed__field">
                <input
                  className="ed__input"
                  aria-label="Photo set name"
                  value={c.name}
                  disabled={disabled}
                  data-testid={`editor-category-name-${c.id}`}
                  onChange={(e) => onChange(c.id, { name: e.target.value })}
                />
                <label className="ed__check ed__check--quiet">
                  <input
                    type="checkbox"
                    checked={c.requiredForHoldPoint}
                    disabled={disabled}
                    data-testid={`editor-category-required-${c.id}`}
                    onChange={(e) => onChange(c.id, { requiredForHoldPoint: e.target.checked })}
                  />
                  Required for hold point
                </label>
              </div>
              <button type="button" className="ed__link" disabled={disabled} data-testid={`editor-category-remove-${c.id}`} onClick={() => onRemove(c.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hasHoldPoint && categories.some((c) => c.requiredForHoldPoint) && (
        <p className="ed__hint">{stageName} has no hold point yet, so required holds nothing up.</p>
      )}
    </div>
  );
}
