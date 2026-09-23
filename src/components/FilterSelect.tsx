/**
 * A filter as a dropdown: one label, one <select>, the first option meaning
 * "everything". Every filtered screen (waiting on, photos, activity) uses this, so a filter looks and works the same wherever it sits.
 *
 *   <FilterSelect label="Job" value={job ?? ''} onChange={...} testId="waiting-filter-job"
 *     options={[{ value: '', label: 'All jobs' }, ...jobs.map(...)]} />
 */
import './filterSelect.css';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  testId?: string;
  /** Show the label beside the select rather than only to screen readers. */
  labelShown?: boolean;
  className?: string;
}

export function FilterSelect({ label, value, options, onChange, testId, labelShown, className }: FilterSelectProps) {
  return (
    <label className={['filter', className ?? ''].filter(Boolean).join(' ')}>
      <span className={labelShown ? 'filter__label' : 'sr-only'}>{label}</span>
      <select className="input filter__select" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} aria-label={labelShown ? undefined : label}>
        {options.map((o) => (
          <option key={o.value} value={o.value} data-testid={testId ? `${testId}-${o.value || 'all'}` : undefined}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A row of filters, wrapping on a narrow screen. */
export function FilterBar({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="filterbar" data-testid={testId}>
      {children}
    </div>
  );
}
