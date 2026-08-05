import { Fragment, useState, type ReactNode } from "react";
import type { SpecificationSummary } from "../local/parseAndValidate.js";
import { IssueTable, type IssueRow } from "./IssueTable";

type SpecStatus = "failed" | "passed" | "not-applied";

function statusOf(summary: SpecificationSummary): SpecStatus {
  if (summary.applicableCount === 0) return "not-applied";
  return summary.failedCount > 0 ? "failed" : "passed";
}

const STATUS_LABEL: Record<SpecStatus, string> = {
  failed: "failing",
  passed: "passed",
  "not-applied": "matched nothing",
};

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
}

export function CheckSummary({
  summaries,
  onSelectElement,
  selectedElementId,
  renderDetails,
}: CheckSummaryProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => initiallyExpanded(summaries));
  // A fresh check produces a new array; its expansion is decided from scratch rather than
  // inherited from whichever rows the previous rule set happened to have open.
  const [checked, setChecked] = useState(summaries);
  if (checked !== summaries) {
    setChecked(summaries);
    setExpanded(initiallyExpanded(summaries));
  }

  function toggle(index: number) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const failing = summaries.filter((summary) => statusOf(summary) === "failed").length;
  const inert = summaries.filter((summary) => statusOf(summary) === "not-applied").length;

  return (
    <div className="check-summary">
      <p role="status" className="summary-line" data-tone={failing > 0 ? "fail" : "pass"}>
        {summaries.length} {summaries.length === 1 ? "specification" : "specifications"} —{" "}
        {failing === 0 ? "none failing" : `${failing} failing`}
        {inert > 0 && `, ${inert} matched no elements`}
      </p>

      <div className="table-frame">
        <table className="spec-table">
          <caption>Specifications</caption>
          <thead>
            <tr>
              <th>Specification</th>
              <th className="num">Applied to</th>
              <th className="num">Passed</th>
              <th className="num">Failed</th>
              <th className="col-issues">Issues</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary, index) => {
              const status = statusOf(summary);
              const isExpanded = expanded.has(index);
              const issueCount = summary.violations.length;
              const issueNoun = issueCount === 1 ? "issue" : "issues";
              return (
                <Fragment key={`${summary.name}#${index}`}>
                  <tr className={`spec-row spec-${status}`} data-open={isExpanded}>
                    <td>
                      <span className="spec-name">{summary.name}</span>{" "}
                      <span className={`spec-status spec-status-${status}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="num">{summary.applicableCount}</td>
                    <td className="num">{summary.passedCount}</td>
                    <td className="num">{summary.failedCount}</td>
                    <td className="col-issues">
                      {issueCount > 0 ? (
                        // The visible label stays short so it can't wrap the column open; the
                        // specification's name lives in the accessible name, where a screen
                        // reader still needs it to tell two toggles apart.
                        <button
                          type="button"
                          className="ghost-btn"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Hide" : "Show"} ${issueCount} ${issueNoun} for ${summary.name}`}
                          onClick={() => toggle(index)}
                        >
                          <span className="caret" data-open={isExpanded} aria-hidden="true">
                            ▸
                          </span>
                          {issueCount} {issueNoun}
                        </button>
                      ) : (
                        <span className="dash">—</span>
                      )}
                    </td>
                  </tr>

                  {status === "not-applied" && (
                    <tr className="spec-not-applied">
                      <td colSpan={5}>
                        {/* The failure mode this whole summary exists for: an empty violation list
                            reads as a clean model, when nothing was ever checked. */}
                        <p role="alert">
                          No element matched this specification, so nothing was checked. Its
                          applicability may name a type this model doesn&apos;t use.
                        </p>
                      </td>
                    </tr>
                  )}

                  {isExpanded && (
                    <tr className="drawer-row">
                      <td colSpan={5}>
                        <IssueTable
                          results={summary.violations}
                          onSelectElement={onSelectElement}
                          selectedElementId={selectedElementId}
                          renderDetails={renderDetails}
                          hideRuleColumn
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
    </div>
  );
}
