import type { SpecificationSummary } from "../local/parseAndValidate.js";
import type { IssueRow } from "../components/IssueTable";
import { statusOf } from "../components/CheckSummary";
import type { FocusMode } from "./focusRequest.js";

// The Validate page's results, narrowed to what the 3D page can act on. Not the
// same component as CheckSummary and deliberately so: that one is a full-width
// table with filters, pagination and exports, and none of it survives a 20rem
// rail. What is left is the part the viewer needs — which rule failed, which
// elements failed it, and a way to put those elements on screen.

export interface ViewerResultsRailProps {
  results: SpecificationSummary[] | null;
  /** Which specification's element list is open. One at a time: opening one shows it in 3D. */
  openIndex: number | null;
  onToggleSpec: (index: number) => void;
  /** The specification currently isolated or highlighted in the view, if any. */
  activeIndex: number | null;
  focusMode: FocusMode;
  onApplyMode: (index: number, mode: FocusMode) => void;
  selectedRowId: string | null;
  onSelectRow: (row: IssueRow) => void;
}

function countLabel(summary: SpecificationSummary): { text: string; tone: string } {
  const status = statusOf(summary);
  if (status === "failed") {
    const failing = summary.violations.length;
    return failing > 0
      ? { text: `${failing} failing`, tone: "fail" }
      : { text: "rule failed", tone: "fail" };
  }
  if (status === "passed") return { text: `${summary.applicableCount} passed`, tone: "pass" };
  if (status === "not-applied") return { text: "no matches", tone: "none" };
  return { text: "not checked", tone: "none" };
}

export function ViewerResultsRail({
  results,
  openIndex,
  onToggleSpec,
  activeIndex,
  focusMode,
  onApplyMode,
  selectedRowId,
  onSelectRow,
}: ViewerResultsRailProps) {
  if (!results) {
    return (
      <p className="viewer-empty">
        No check has been run yet. Load an IFC file and a rule set on the Validate page, and the
        failing elements show up here.
      </p>
    );
  }

  return (
    <div className="viewer-results">
      {results.map((summary, index) => {
        const { text, tone } = countLabel(summary);
        const canFocus = summary.violations.length > 0;
        const open = openIndex === index;

        return (
          <div className="viewer-spec" key={`${summary.name}-${index}`}>
            <button
              type="button"
              className="viewer-spec-head"
              title={summary.name}
              aria-expanded={canFocus ? open : undefined}
              disabled={!canFocus}
              onClick={() => onToggleSpec(index)}
            >
              <span className="viewer-spec-dot" data-tone={tone} aria-hidden="true" />
              <span>
                <span className="viewer-spec-name">{summary.name}</span>
                <span className="viewer-spec-meta">
                  {summary.applicableCount} applicable element{summary.applicableCount === 1 ? "" : "s"}
                </span>
              </span>
              <span className="viewer-spec-count" data-tone={tone}>
                {text}
              </span>
            </button>

            {open && canFocus && (
              <>
                <div className="viewer-spec-modes">
                  {(["isolate", "highlight"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className="viewer-mini"
                      aria-pressed={activeIndex === index && focusMode === mode}
                      onClick={() => onApplyMode(index, mode)}
                    >
                      {mode === "isolate" ? "Isolate" : "Highlight"}
                    </button>
                  ))}
                </div>

                <ul className="viewer-spec-rows">
                  {summary.violations.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        data-selected={row.id === selectedRowId ? "" : undefined}
                        title={`${row.elementName ?? "(unnamed)"} — ${row.elementGlobalId}\n${row.message}`}
                        onClick={() => onSelectRow(row)}
                      >
                        <span className="viewer-row-name">{row.elementName ?? "(unnamed)"}</span>
                        <span className="viewer-row-gid">{row.elementGlobalId}</span>
                        <span className="viewer-row-message">{row.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
