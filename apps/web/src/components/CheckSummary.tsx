import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { REQUIRED_CARDINALITY_EMPTY_MESSAGE } from "@ifc-qa/ids-validator";
import type { SpecificationSummary } from "../local/parseAndValidate.js";
import { GlobalIssueFilters } from "./GlobalIssueFilters";
import {
  EMPTY_ISSUE_FILTER,
  filterIssueRows,
  isIssueFilterActive,
  type IssueFilter,
} from "./issueFilter";
import { IssueTable, type IssueRow } from "./IssueTable";

type SpecStatus = "failed" | "passed" | "not-applied" | "not-checked";

// A required specification with nothing to match it is, structurally, the same "matched nothing"
// case as an optional one — the model just doesn't have that kind of element. Not a failure.
function isEmptyRequiredMatch(summary: SpecificationSummary): boolean {
  return summary.cardinalityFailure === REQUIRED_CARDINALITY_EMPTY_MESSAGE;
}

// A prohibited specification that matched elements already reads as "failing" in the status badge
// and lists every match in the issue table below — this message would only repeat that in prose.
function isProhibitedMatchFailure(summary: SpecificationSummary): boolean {
  return summary.cardinalityFailure !== null && summary.cardinalityFailure.startsWith("Nothing may match");
}

function statusOf(summary: SpecificationSummary): SpecStatus {
  // Ordered by how much the counts can be trusted: an unchecked specification has no counts at
  // all, so it can never be mistaken for one that ran and matched nothing.
  if (!summary.checked) return "not-checked";
  if (isEmptyRequiredMatch(summary)) return "not-applied";
  // A prohibited specification that matched elements, or one paired with requirements it
  // can't also state, is a real failure independent of any element's own pass/fail.
  if (summary.cardinalityFailure !== null) return "failed";
  if (summary.applicableCount === 0) return "not-applied";
  return summary.failedCount > 0 ? "failed" : "passed";
}

const STATUS_LABEL: Record<SpecStatus, string> = {
  failed: "failing",
  passed: "passed",
  "not-applied": "no matching elements found",
  "not-checked": "not checked",
};

/** Losses that weakened a specification that did run, as opposed to ones that stopped it. */
function droppedRequirements(summary: SpecificationSummary) {
  return summary.unsupported.filter((entry) => entry.section === "requirements");
}

/**
 * Which half of a refused specification stopped it. An unreadable applicability comes first
 * because it decides the subject: once we cannot say which elements a rule is about, what it
 * asks of them no longer matters.
 */
function refusalCause(summary: SpecificationSummary): "applicability" | "requirements" {
  return summary.unsupported.some((entry) => entry.section === "applicability")
    ? "applicability"
    : "requirements";
}

// The first failing specification opens by itself: a summary that shows only counts leaves the
// user one click away from every answer, and the first problem is the one they came to read.
function initiallyExpanded(summaries: SpecificationSummary[]): Set<number> {
  const first = summaries.findIndex((summary) => summary.violations.length > 0);
  return first === -1 ? new Set() : new Set([first]);
}

export interface CheckSummaryProps {
  summaries: SpecificationSummary[];
  onSelectElement?: (row: IssueRow) => void;
  selectedElementId?: string | null;
  /** Handed to the issue table, which opens it under the element it describes. */
  renderDetails?: (row: IssueRow) => ReactNode;
  /** Renders a per-row "View in 3D" action, handed straight to the issue table. */
  onViewElementIn3D?: (row: IssueRow) => void;
  /** Renders a "View in 3D" action on a specification's own header, isolating every failing element it lists. */
  onViewSpecificationIn3D?: (summary: SpecificationSummary) => void;
  /**
   * Called with `summaries`, each specification's violations swapped for whichever of them
   * currently survive the filters above the results and then that specification's own filter,
   * whenever any of those change. A specification's own filter outlives the table it was typed
   * into, so collapsing one narrows this exactly as much as leaving it open did.
   */
  onFilteredSummariesChange?: (filtered: SpecificationSummary[]) => void;
}

export function CheckSummary({
  summaries,
  onSelectElement,
  selectedElementId,
  renderDetails,
  onViewElementIn3D,
  onViewSpecificationIn3D,
  onFilteredSummariesChange,
}: CheckSummaryProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => initiallyExpanded(summaries));
  // A fresh check produces a new array; its expansion is decided from scratch rather than
  // inherited from whichever rows the previous rule set happened to have open.
  const [checked, setChecked] = useState(summaries);
  // Keyed by specification index, and deliberately outliving the table it was typed into: a
  // filter the user set and then collapsed still narrows that specification everywhere, an
  // export included, so the row it belongs to has to say so rather than read as unfiltered.
  const [specFilters, setSpecFilters] = useState<Map<number, IssueFilter>>(new Map());
  // Applies to every specification at once, above whatever each one narrows further.
  const [globalFilter, setGlobalFilter] = useState<IssueFilter>(EMPTY_ISSUE_FILTER);
  if (checked !== summaries) {
    setChecked(summaries);
    setExpanded(initiallyExpanded(summaries));
    setSpecFilters(new Map());
    setGlobalFilter(EMPTY_ISSUE_FILTER);
  }

  function changeSpecFilter(index: number, next: IssueFilter) {
    setSpecFilters((previous) => {
      const updated = new Map(previous);
      // An emptied filter is no filter: keeping the entry would go on counting this
      // specification as narrowed for the rest of the page.
      if (isIssueFilterActive(next)) updated.set(index, next);
      else updated.delete(index);
      return updated;
    });
  }

  function clearAllFilters() {
    setGlobalFilter(EMPTY_ISSUE_FILTER);
    setSpecFilters(new Map());
  }

  const filterActive = isIssueFilterActive(globalFilter);

  // Memoized on the filter itself rather than rebuilt per render: each open IssueTable takes its
  // slice as a prop, and a fresh array every render would restart the table's own memoization.
  const scoped = useMemo(
    () =>
      summaries.map((summary) => ({
        ...summary,
        violations: filterIssueRows(summary.violations, globalFilter),
      })),
    [summaries, globalFilter]
  );

  function toggle(index: number) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const filteredSummaries = useMemo(
    () =>
      scoped.map((summary, index) => {
        const specFilter = specFilters.get(index);
        return specFilter
          ? { ...summary, violations: filterIssueRows(summary.violations, specFilter) }
          : summary;
      }),
    [scoped, specFilters]
  );

  // Carries the index into `summaries`, so expansion state and the filter map stay keyed by a
  // specification's real position while the global filter hides rows around it. Only the global
  // filter hides a row: a specification emptied by its own filter has to stay on screen, or the
  // filter that emptied it would be unreachable.
  const visible = scoped
    .map((summary, index) => ({ summary, index }))
    .filter((entry) => !filterActive || entry.summary.violations.length > 0);

  useEffect(() => {
    onFilteredSummariesChange?.(filteredSummaries);
    // onFilteredSummariesChange isn't in the dependency list: the caller passes a plain state
    // setter, but even a stable one shouldn't matter here — this only needs to refire when the
    // filtered data itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSummaries]);

  const totalIssues = summaries.reduce((total, summary) => total + summary.violations.length, 0);
  const shownIssues = filteredSummaries.reduce((total, summary) => total + summary.violations.length, 0);
  const narrowedSpecs = specFilters.size;

  const failing = summaries.filter((summary) => statusOf(summary) === "failed").length;
  const inert = summaries.filter((summary) => statusOf(summary) === "not-applied").length;
  const unchecked = summaries.filter((summary) => statusOf(summary) === "not-checked").length;

  return (
    <div className="check-summary">
      {/* A run with unchecked specifications is incomplete, not clean, so it must not read green. */}
      <p role="status" className="summary-line" data-tone={failing + unchecked > 0 ? "fail" : "pass"}>
        {summaries.length} {summaries.length === 1 ? "specification" : "specifications"} —{" "}
        {failing === 0 ? "none failing" : `${failing} failing`}
        {unchecked > 0 && `, ${unchecked} not checked`}
        {inert > 0 && `, ${inert} matched no elements`}
      </p>

      {/* Above the per-specification tables, and applied before them: this narrows every
          specification at once, each open issue table then narrows its own rows further. */}
      <GlobalIssueFilters
        value={globalFilter}
        onChange={setGlobalFilter}
        onClear={clearAllFilters}
        canClear={filterActive || narrowedSpecs > 0}
      />

      {(filterActive || narrowedSpecs > 0) && (
        <p role="status" className="filter-line">
          {filterActive && (
            <>
              Showing {shownIssues} of {totalIssues} {totalIssues === 1 ? "issue" : "issues"} in{" "}
              {visible.length} of {summaries.length}{" "}
              {summaries.length === 1 ? "specification" : "specifications"}.
            </>
          )}
          {/* The whole point of a filter that survives collapsing: it goes on narrowing an
              export from a row that no longer shows a filter bar, so it is named here too. */}
          {narrowedSpecs > 0 && (
            <>
              {" "}
              {narrowedSpecs === 1
                ? "1 specification also has its own filter"
                : `${narrowedSpecs} specifications also have their own filter`}{" "}
              active, collapsed ones included.
            </>
          )}
        </p>
      )}

      {filterActive && visible.length === 0 ? (
        <p className="empty-note">No issues match the current filters.</p>
      ) : (
        <div className="table-frame">
          <table className="spec-table">
            <caption>Specifications</caption>
            <thead>
              <tr>
                <th>Specification</th>
                <th className="num">Applied to</th>
                <th className="num">Passed</th>
                <th className="num">Failed</th>
                <th className="num">Success</th>
                <th className="col-issues">Issues</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ summary, index }) => {
                const status = statusOf(summary);
                const isExpanded = expanded.has(index);
                const issueCount = summary.violations.length;
                const shownCount = filteredSummaries[index].violations.length;
                const specFiltered = specFilters.has(index);
                const issueNoun = issueCount === 1 ? "issue" : "issues";
                // "3 of 12 issues" is the collapsed row's only chance to say that this
                // specification is still narrowed by a filter the user can no longer see.
                const issueLabel = specFiltered
                  ? `${shownCount} of ${issueCount} ${issueNoun}`
                  : `${issueCount} ${issueNoun}`;
                return (
                  <Fragment key={`${summary.name}#${index}`}>
                    <tr className={`spec-row spec-${status}`} data-open={isExpanded}>
                      <td>
                        <span className="spec-name">{summary.name}</span>{" "}
                        <span className={`spec-status spec-status-${status}`}>
                          {STATUS_LABEL[status]}
                        </span>{" "}
                        {specFiltered && <span className="spec-filtered">filtered</span>}
                      </td>
                      {/* Nothing was measured, so a zero here would be a claim we cannot make. */}
                      <td className="num">{status === "not-checked" ? "—" : summary.applicableCount}</td>
                      <td className="num">{status === "not-checked" ? "—" : summary.passedCount}</td>
                      <td className="num">{status === "not-checked" ? "—" : summary.failedCount}</td>
                      <td className="num">
                        {status === "not-checked" || summary.applicableCount === 0
                          ? "—"
                          : `${Math.round((summary.passedCount / summary.applicableCount) * 100)}%`}
                      </td>
                      <td className="col-issues">
                        {issueCount > 0 ? (
                          <>
                            {/* The visible label stays short so it can't wrap the column open; the
                                specification's name lives in the accessible name, where a screen
                                reader still needs it to tell two toggles apart. */}
                            <button
                              type="button"
                              className="ghost-btn"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? "Hide" : "Show"} ${issueLabel} for ${summary.name}`}
                              onClick={() => toggle(index)}
                            >
                              <span className="caret" data-open={isExpanded} aria-hidden="true">
                                ▸
                              </span>
                              {issueLabel}
                            </button>
                            {onViewSpecificationIn3D && (
                              <button
                                type="button"
                                className="ghost-btn view-in-3d"
                                onClick={() => onViewSpecificationIn3D(summary)}
                              >
                                View in 3D
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="dash">—</span>
                        )}
                      </td>
                    </tr>

                    {status === "not-checked" && (
                      <tr className="spec-not-checked">
                        <td colSpan={6}>
                          {/* The worst failure mode there is, and it arrives from two directions: a
                              rule whose elements we cannot select matches nothing, and a rule whose
                              every requirement we had to drop finds nothing wrong. Both report a
                              clean model for a check that never happened, so both say which it was. */}
                          <p role="alert">
                            {refusalCause(summary) === "applicability"
                              ? "This specification was not run: it selects elements in a way this checker cannot represent, so any result would have been a false pass."
                              : "This specification was not run: every requirement it states is one this checker cannot represent, so a pass would have meant nothing was checked."}
                          </p>
                          <ul className="unsupported-list">
                            {summary.unsupported
                              .filter((entry) => entry.section === refusalCause(summary))
                              .map((entry, position) => (
                                <li key={`${entry.construct}#${position}`}>
                                  <code>{entry.construct}</code> — {entry.description}
                                </li>
                              ))}
                          </ul>
                        </td>
                      </tr>
                    )}

                    {summary.cardinalityFailure !== null &&
                      !isEmptyRequiredMatch(summary) &&
                      !isProhibitedMatchFailure(summary) && (
                      <tr className="spec-cardinality">
                        <td colSpan={6}>
                          {/* Failed as a whole, with no failing element to show for it — so the
                              reason has to be stated, or the row reads as an empty accusation. */}
                          <p role="alert">{summary.cardinalityFailure}</p>
                        </td>
                      </tr>
                    )}

                    {status === "not-applied" && !isEmptyRequiredMatch(summary) && (
                      <tr className="spec-not-applied">
                        <td colSpan={6}>
                          {/* Ran, but selected nothing — a real measurement, unlike "not checked". */}
                          <p role="alert">
                            No element matched this specification, so nothing was checked. Its
                            applicability may name a type this model doesn&apos;t use.
                          </p>
                        </td>
                      </tr>
                    )}

                    {status !== "not-checked" && droppedRequirements(summary).length > 0 && (
                      <tr className="spec-partial">
                        <td colSpan={6}>
                          {/* Ran, but against fewer requirements than the author wrote — so a pass
                              here is weaker than the source asked for, and says so. */}
                          <p role="alert">
                            Checked against fewer requirements than this specification states, so a
                            pass here is weaker than its author intended.
                          </p>
                          <ul className="unsupported-list">
                            {droppedRequirements(summary).map((entry, position) => (
                              <li key={`${entry.construct}#${position}`}>
                                <code>{entry.construct}</code> — {entry.description}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}

                    {isExpanded && (
                      <tr className="drawer-row">
                        <td colSpan={6}>
                          <IssueTable
                            results={summary.violations}
                            onSelectElement={onSelectElement}
                            selectedElementId={selectedElementId}
                            onViewElementIn3D={onViewElementIn3D}
                            renderDetails={renderDetails}
                            hideRuleColumn
                            filter={specFilters.get(index) ?? EMPTY_ISSUE_FILTER}
                            onFilterChange={(next) => changeSpecFilter(index, next)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
