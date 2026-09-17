/**
 * The photo category picker: a ledger of tall buttons, never a dropdown,
 * because Alec is wearing gloves half the time (UI_PLAN 3.15, wireframe).
 *
 *   Windows installed                          none yet
 *   Needed for the frame inspection
 *   Roof complete                                     6
 *                                                photos
 *
 * Each row: the name, the "needed for" words when a hold point wants it, and
 * the uploaded count in the display face on the right (queued photos are
 * named separately, since they do not count yet). The chosen row fills steel
 * so it reads without colour. Test ids `<testPrefix>-<categoryId>`, default
 * `upload-category-<id>`.
 */
import type { PhotoCategory } from '../domain/types';
import './categoryPicker.css';

export interface CategoryPickerProps {
  categories: PhotoCategory[];
  /** Uploaded photos per category id. */
  counts: Record<string, number>;
  /** Photos still in the phone's queue per category id. */
  queued?: Record<string, number>;
  value: string | null;
  onChange: (categoryId: string) => void;
  /** Words for a required category, e.g. "Needed for the frame inspection". */
  neededWords?: (category: PhotoCategory) => string | undefined;
  testPrefix?: string;
  label?: string;
}

export function CategoryPicker({ categories, counts, queued = {}, value, onChange, neededWords, testPrefix = 'upload-category', label = 'Category' }: CategoryPickerProps) {
  return (
    <div className="catpick" role="radiogroup" aria-label={label}>
      {categories.map((c) => {
        const n = counts[c.id] ?? 0;
        const q = queued[c.id] ?? 0;
        const chosen = value === c.id;
        const needed = c.requiredForHoldPoint ? (neededWords?.(c) ?? 'Needed for an inspection') : undefined;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            className={`catpick__row${chosen ? ' catpick__row--chosen' : ''}`}
            onClick={() => onChange(c.id)}
            data-testid={`${testPrefix}-${c.id}`}
          >
            <span className="catpick__words">
              <span className="catpick__name">{c.name}</span>
              {needed && <span className="catpick__needed">{needed}</span>}
              {q > 0 && (
                <span className="catpick__queued">
                  {q} waiting to send
                </span>
              )}
            </span>
            <span className="catpick__count">
              {n === 0 ? (
                <span className="catpick__none">none yet</span>
              ) : (
                <>
                  <span className="catpick__figure display">{n}</span>
                  <span className="catpick__unit">{n === 1 ? 'photo' : 'photos'}</span>
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
