/**
 * v1 FilterSelect: a filter as one dropdown, the first option meaning
 * "everything". The label is for screen readers unless `labelShown`; the
 * select itself says what it holds ("All stages", "All jobs"). Draws with the
 * `.filterbar` / `.filter` / `.filter__select` primitives in base.css.
 *
 *   <FilterSelect label="Stage" value={stage} onChange={setStage} testId="photos-stage"
 *     options={[{ value: '', label: 'All stages' }, ...]} />
 */
import type { ReactNode } from 'react';

export interface FilterOption {
  value: string;
  label: string;
  /** Options with the same group sit under one <optgroup>. */
  group?: string;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  testId,
  labelShown,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  testId?: string;
  labelShown?: boolean;
}) {
  const parts: ReactNode[] = [];
  let i = 0;
  while (i < options.length) {
    const g = options[i]!.group;
    if (!g) {
      const o = options[i]!;
      parts.push(
        <option key={o.value || '__all'} value={o.value}>
          {o.label}
        </option>,
      );
      i++;
      continue;
    }
    const run: FilterOption[] = [];
    while (i < options.length && options[i]!.group === g) run.push(options[i++]!);
    parts.push(
      <optgroup key={`g-${g}`} label={g}>
        {run.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </optgroup>,
    );
  }
  return (
    <label className="filter">
      <span className={labelShown ? 'filter__label' : 'sr-only'}>{label}</span>
      <select className="input filter__select" value={value} data-testid={testId} onChange={(e) => onChange(e.target.value)}>
        {parts}
      </select>
    </label>
  );
}
