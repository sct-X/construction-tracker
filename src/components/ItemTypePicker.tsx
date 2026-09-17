/**
 * The item type picker: nine buttons, never a dropdown, so it works in gloves
 * and reads at a glance which kind of thing this is. The chosen one fills
 * steel so it reads without colour. Test ids `item-type-<type>`.
 *
 *   [Trade to book] [Material to order] [Decision] [Consultant report]
 *   [Council request] [Inspection] [Defect] [Condition of consent] [Reminder]
 */
import type { ItemType } from '../domain/types';
import { ITEM_TYPE_LABELS } from '../domain/types';
import './itemTypePicker.css';

export const ITEM_TYPES: ItemType[] = Object.keys(ITEM_TYPE_LABELS) as ItemType[];

interface Props {
  value: ItemType;
  onChange: (type: ItemType) => void;
  label?: string;
  testPrefix?: string;
}

export function ItemTypePicker({ value, onChange, label = 'Type', testPrefix = 'item-type' }: Props) {
  return (
    <div className="typepick" role="radiogroup" aria-label={label}>
      {ITEM_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          className={`typepick__btn${value === t ? ' typepick__btn--chosen' : ''}`}
          onClick={() => onChange(t)}
          data-testid={`${testPrefix}-${t}`}
        >
          {ITEM_TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  );
}
