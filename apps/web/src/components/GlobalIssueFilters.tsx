import type { IssueFilter } from "./issueFilter";

export interface GlobalIssueFiltersProps {
  value: IssueFilter;
  onChange: (value: IssueFilter) => void;
  /** Clears this bar and every per-specification filter under it, which is why it isn't local. */
  onClear: () => void;
  canClear: boolean;
}

/** The bar above every specification. The per-specification bars live inside IssueTable. */
export function GlobalIssueFilters({ value, onChange, onClear, canClear }: GlobalIssueFiltersProps) {
  function set(field: keyof IssueFilter, fieldValue: string) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <div role="group" aria-label="Filter all results" className="issue-filters global-filters">
      {/* Said in the bar itself: the two levels look alike, and a reviewer who reads this one as
          "filters the specification I have open" would misread every count on the page. */}
      <div className="filters-head">
        <h3>Filter all results</h3>
        <p>
          Applies to every specification below, open or collapsed. Open one to narrow its own
          issues further.
        </p>
      </div>
      <label>
        Element
        <input
          type="text"
          aria-label="Filter all results by element name or GlobalId"
          value={value.element}
          onChange={(e) => set("element", e.target.value)}
        />
      </label>
      <label>
        File
        <input
          type="text"
          aria-label="Filter all results by file name"
          value={value.fileName}
          onChange={(e) => set("fileName", e.target.value)}
        />
      </label>
      <label>
        Element type
        <input
          type="text"
          aria-label="Filter all results by element type"
          value={value.elementType}
          onChange={(e) => set("elementType", e.target.value)}
        />
      </label>
      <label>
        Specification
        <input
          type="text"
          aria-label="Filter all results by specification"
          value={value.ruleId}
          onChange={(e) => set("ruleId", e.target.value)}
        />
      </label>
      <label>
        Severity
        <select
          aria-label="Filter all results by severity"
          value={value.severity}
          onChange={(e) => set("severity", e.target.value)}
        >
          <option value="">All</option>
          <option value="error">error</option>
          <option value="warning">warning</option>
        </select>
      </label>
      <button type="button" className="ghost-btn" disabled={!canClear} onClick={onClear}>
        Clear all filters
      </button>
    </div>
  );
}
