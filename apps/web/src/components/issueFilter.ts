import type { IssueRow } from "./IssueTable";

/**
 * One filter shape for both levels: the bar above every specification and the bar inside a
 * single specification's issue table filter the same fields, so a row hidden by one is hidden
 * by the other for the same reason. `ruleId` is the specification's own name — the global bar
 * labels it "Specification", the per-table bar "Rule".
 */
export interface IssueFilter {
  element: string;
  fileName: string;
  elementType: string;
  ruleId: string;
  severity: string;
}

export const EMPTY_ISSUE_FILTER: IssueFilter = {
  element: "",
  fileName: "",
  elementType: "",
  ruleId: "",
  severity: "",
};

export function isIssueFilterActive(filter: IssueFilter): boolean {
  return Object.values(filter).some((value) => value !== "");
}

/** Name and GlobalId in one searchable string: a reviewer arrives with one or the other. */
export function elementLabel(row: IssueRow): string {
  return `${row.elementName ?? ""} ${row.elementGlobalId}`.trim();
}

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function matchesIssueFilter(row: IssueRow, filter: IssueFilter): boolean {
  if (filter.element !== "" && !includes(elementLabel(row), filter.element)) return false;
  if (filter.fileName !== "" && !includes(row.fileName, filter.fileName)) return false;
  if (filter.elementType !== "" && !includes(row.elementType, filter.elementType)) return false;
  if (filter.ruleId !== "" && !includes(row.ruleId, filter.ruleId)) return false;
  // Exact, unlike the text fields: severity comes from a fixed list, so a substring match would
  // only ever be a way to select the same one value more loosely.
  if (filter.severity !== "" && row.severity !== filter.severity) return false;
  return true;
}

/**
 * Returns the same array when nothing is filtered — the row set is a prop of a table that
 * re-reports it, so a fresh array per call would be a render loop.
 */
export function filterIssueRows(rows: IssueRow[], filter: IssueFilter): IssueRow[] {
  if (!isIssueFilterActive(filter)) return rows;
  return rows.filter((row) => matchesIssueFilter(row, filter));
}
