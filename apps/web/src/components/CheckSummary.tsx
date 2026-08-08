import { Fragment, useState, type ReactNode } from "react";
import type { SpecificationSummary } from "../local/parseAndValidate.js";
import { IssueTable, type IssueRow } from "./IssueTable";

type SpecStatus = "failed" | "passed" | "not-applied" | "not-checked";

function statusOf(summary: SpecificationSummary): SpecStatus {
  // Ordered by how much the counts can be trusted: an unchecked specification has no counts at
  // all, so it can never be mistaken for one that ran and matched nothing.
  if (!summary.checked) return "not-checked";
  if (summary.applicableCount === 0) return "not-applied";
  return summary.failedCount > 0 ? "failed" : "passed";
}

const STATUS_LABEL: Record<SpecStatus, string> = {
  failed: "failing",
  passed: "passed",
  "not-applied": "matched nothing",
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
                    {/* Nothing was measured, so a zero here would be a claim we cannot make. */}
                    <td className="num">{status === "not-checked" ? "—" : summary.applicableCount}</td>
                    <td className="num">{status === "not-checked" ? "—" : summary.passedCount}</td>
                    <td className="num">{status === "not-checked" ? "—" : summary.failedCount}</td>
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

                  {status === "not-checked" && (
                    <tr className="spec-not-checked">
                      <td colSpan={5}>
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

                  {status === "not-applied" && (
                    <tr className="spec-not-applied">
                      <td colSpan={5}>
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
                      <td colSpan={5}>
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
