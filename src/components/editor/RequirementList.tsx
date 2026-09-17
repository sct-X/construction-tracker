/**
 * "Needs": what a step needs before it can start, a trade to book or a
 * material to order, each with its lead time in calendar weeks. The lead
 * time is what turns a step's date into an act-by date (rule 1), so it sits
 * beside the name, not behind a toggle.
 */
import type { Requirement, RequirementKind } from '../../domain/types';

interface Props {
  requirements: Requirement[];
  disabled?: boolean;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<Pick<Requirement, 'kind' | 'name' | 'leadTimeWeeks' | 'tradeType'>>) => void;
  onRemove: (id: string) => void;
}

const KINDS: { key: RequirementKind; label: string }[] = [
  { key: 'trade', label: 'Trade' },
  { key: 'material', label: 'Material' },
];

export function RequirementList({ requirements, disabled, onAdd, onChange, onRemove }: Props) {
  return (
    <div className="ed__section" data-testid="editor-requirements">
      <div className="ed__section-title">
        <span>Needs, with lead time in weeks</span>
        <button type="button" className="ed__link" disabled={disabled} data-testid="editor-requirement-add" onClick={onAdd}>
          Add a need
        </button>
      </div>
      {requirements.length === 0 ? (
        <p className="ed__empty">Nothing to book or order first.</p>
      ) : (
        <ul className="ed__list">
          {requirements.map((r) => (
            <li key={r.id} className="ed__item ed__item--need" data-testid={`editor-requirement-${r.id}`}>
              <select
                className="ed__input"
                aria-label="Trade or material"
                value={r.kind}
                disabled={disabled}
                data-testid={`editor-requirement-kind-${r.id}`}
                onChange={(e) => {
                  const kind = e.target.value as RequirementKind;
                  onChange(r.id, { kind, tradeType: kind === 'trade' ? r.name : undefined });
                }}
              >
                {KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                className="ed__input"
                aria-label="Name"
                value={r.name}
                disabled={disabled}
                data-testid={`editor-requirement-name-${r.id}`}
                onChange={(e) => onChange(r.id, { name: e.target.value, tradeType: r.kind === 'trade' ? e.target.value : r.tradeType })}
              />
              <input
                className="ed__input"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label="Lead time, weeks"
                value={r.leadTimeWeeks}
                disabled={disabled}
                data-testid={`editor-requirement-lead-${r.id}`}
                onChange={(e) => onChange(r.id, { leadTimeWeeks: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              />
              <button type="button" className="ed__link" disabled={disabled} data-testid={`editor-requirement-remove-${r.id}`} onClick={() => onRemove(r.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
