import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { IssueRow } from "../components/IssueTable.js";
import { elementLabel } from "../components/issueFilter.js";
import type { SpecificationSummary } from "../local/parseAndValidate.js";

// The join between "the user clicked a result on the Validate page" and "the
// viewer isolates the right elements in the right file". Kept as plain data
// plus pure functions, the same reason bounds/camera are: the interesting
// question ("what should the viewer end up looking at") is answerable without
// a router, a canvas, or a loaded model.

/**
 * What a click on the Validate page hands to the viewer. `rows` are always
 * violations of the SAME file (`modelKey`) — a specification whose failures
 * span several files is narrowed to its first file's rows by
 * `buildSpecificationFocusRequest`, with the remainder counted in
 * `otherFileCount` rather than dropped silently.
 */
export interface ViewerFocusRequest {
  modelKey: string;
  fileName: string;
  label: string;
  rows: IssueRow[];
  /** Failing elements the request left out because they live in a different file. */
  otherFileCount: number;
}

export function buildElementFocusRequest(row: IssueRow): ViewerFocusRequest {
  return {
    modelKey: row.modelKey,
    fileName: row.fileName,
    label: elementLabel(row),
    rows: [row],
    otherFileCount: 0,
  };
}

/**
 * Null when the specification has nothing to focus (every element passed) —
 * the caller should not offer "View in 3D" for a clean specification at all,
 * but this stays defensive rather than isolating an empty set silently.
 */
export function buildSpecificationFocusRequest(summary: SpecificationSummary): ViewerFocusRequest | null {
  const [first] = summary.violations;
  if (!first) return null;

  const rows = summary.violations.filter((row) => row.modelKey === first.modelKey);
  return {
    modelKey: first.modelKey,
    fileName: first.fileName,
    label: summary.name,
    rows,
    otherFileCount: summary.violations.length - rows.length,
  };
}

export interface ResolvedFocus {
  /** Express ids the request's rows resolved to, in row order. */
  expressIds: number[];
  /** Rows whose GlobalId matched no element in the given model at all — should not normally happen. */
  unmatchedRows: IssueRow[];
}

/** Joins a focus request's rows (keyed by GlobalId) onto a model's elements (keyed by expressId). */
export function resolveFocusElements(
  request: ViewerFocusRequest,
  elements: readonly NormalizedElement[]
): ResolvedFocus {
  const expressIdByGlobalId = new Map(elements.map((element) => [element.globalId, element.expressId]));
  const expressIds: number[] = [];
  const unmatchedRows: IssueRow[] = [];

  for (const row of request.rows) {
    const expressId = expressIdByGlobalId.get(row.elementGlobalId);
    if (expressId === undefined) unmatchedRows.push(row);
    else expressIds.push(expressId);
  }

  return { expressIds, unmatchedRows };
}
