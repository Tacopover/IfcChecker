import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { ElementResult } from "@ifc-qa/shared-types";
import {
  elementLabel,
  EMPTY_ISSUE_FILTER,
  filterIssueRows,
  type IssueFilter,
} from "./issueFilter";

export interface IssueRow extends ElementResult {
  fileName: string;
  modelKey: string;
  elementName: string | null;
  elementTag: string | null;
}

const columnHelper = createColumnHelper<IssueRow>();

// A run can produce thousands of violations across a large batch; rendering
// every row into the DOM unconditionally risks a slow/janky table at that
// scale, so results are paginated instead.
const PAGE_SIZE = 25;

// The table lays out fixed (see .issue-table in styles.css) so the message column
// keeps a readable measure instead of being squeezed by whatever the identifier
// columns happen to contain. Header and body cells take the same class, which is
// what keeps a heading over its own values.
const COLUMN_CLASS: Record<string, string> = {
  element: "col-element",
  elementType: "col-type",
  fileName: "col-file",
  ruleId: "col-rule",
  message: "col-message",
};

export interface IssueTableProps {
  results: IssueRow[];
  onSelectElement?: (row: IssueRow) => void;
  selectedElementId?: string | null;
  /** Renders a "View in 3D" action per row when set — navigates to the viewer, isolated on this one element. */
  onViewElementIn3D?: (row: IssueRow) => void;
  /** Set when the table already sits under one specification, where a Rule column repeats a constant. */
  hideRuleColumn?: boolean;
  /**
   * Rendered in a row directly beneath the selected element, which is where the
   * answer to "what is wrong with this one" belongs — the table owns the
   * placement, the caller owns what goes in it.
   */
  renderDetails?: (row: IssueRow) => ReactNode;
  /**
   * The table's own filter, lifted. A caller passes this pair to keep the filter alive while the
   * table is unmounted — collapsing a specification must not quietly widen what gets exported —
   * and to be able to clear it from outside. Left out, the table keeps its filter itself.
   */
  filter?: IssueFilter;
  onFilterChange?: (filter: IssueFilter) => void;
}

export function IssueTable({
  results,
  onSelectElement,
  selectedElementId,
  onViewElementIn3D,
  hideRuleColumn = false,
  renderDetails,
  filter,
  onFilterChange,
}: IssueTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [ownFilter, setOwnFilter] = useState<IssueFilter>(EMPTY_ISSUE_FILTER);

  const activeFilter = filter ?? ownFilter;

  function setField(field: keyof IssueFilter, value: string) {
    const next = { ...activeFilter, [field]: value };
    if (onFilterChange) onFilterChange(next);
    else setOwnFilter(next);
  }

  // Filtered here rather than by react-table: the same rows have to be countable by a caller
  // whose table isn't mounted, so one predicate (see issueFilter.ts) decides it for both.
  const data = useMemo(() => filterIssueRows(results, activeFilter), [results, activeFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor(elementLabel, {
        id: "element",
        header: "Element",
        cell: (context) => {
          const row = context.row.original;
          const identity = (
            <>
              <span className="element-name">{row.elementName ?? "(unnamed)"}</span>
              <span className="element-gid">{row.elementGlobalId}</span>
            </>
          );
          return (
            <span className="element-cell-group">
              {onSelectElement ? (
                <button
                  type="button"
                  className="element-cell link"
                  aria-pressed={selectedElementId === row.id}
                  onClick={() => onSelectElement(row)}
                >
                  {identity}
                </button>
              ) : (
                <span className="element-cell">{identity}</span>
              )}
              {onViewElementIn3D && (
                <button
                  type="button"
                  className="ghost-btn view-in-3d"
                  onClick={() => onViewElementIn3D(row)}
                >
                  View in 3D
                </button>
              )}
            </span>
          );
        },
      }),
      columnHelper.accessor("elementType", {
        header: "Type",
        cell: (context) => <span className="mono-tag">{context.getValue()}</span>,
      }),
      columnHelper.accessor("fileName", { header: "File" }),
      columnHelper.accessor("ruleId", { header: "Rule" }),
      columnHelper.accessor("message", { header: "Message" }),
    ],
    [onSelectElement, selectedElementId, onViewElementIn3D]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility: { ruleId: !hideRuleColumn } },
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="issue-table">
      <div role="group" aria-label="Issue filters" className="issue-filters">
        <div className="filters-head">
          <h4>Filter this specification</h4>
          <p>Narrows only the issues listed here, on top of the filters above the results.</p>
        </div>
        <label>
          Element
          <input
            type="text"
            aria-label="Filter by element name or GlobalId"
            value={activeFilter.element}
            onChange={(e) => setField("element", e.target.value)}
          />
        </label>
        <label>
          File
          <input
            type="text"
            aria-label="Filter by file name"
            value={activeFilter.fileName}
            onChange={(e) => setField("fileName", e.target.value)}
          />
        </label>
        <label>
          Element type
          <input
            type="text"
            aria-label="Filter by element type"
            value={activeFilter.elementType}
            onChange={(e) => setField("elementType", e.target.value)}
          />
        </label>
        {!hideRuleColumn && (
          <label>
            Rule
            <input
              type="text"
              aria-label="Filter by rule id"
              value={activeFilter.ruleId}
              onChange={(e) => setField("ruleId", e.target.value)}
            />
          </label>
        )}
      </div>

      {rows.length > 0 && (
        <div className="table-frame">
          <table>
            <colgroup>
              {table.getVisibleLeafColumns().map((column) => (
                <col key={column.id} className={COLUMN_CLASS[column.id]} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className={COLUMN_CLASS[header.column.id]}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={header.column.getToggleSortingHandler()}
                          disabled={!header.column.getCanSort()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="sort-mark" aria-hidden="true">
                            {{ asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? ""}
                          </span>
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = selectedElementId === row.original.id;
                return (
                  <Fragment key={row.id}>
                    <tr className={isSelected ? "row-selected" : undefined}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={COLUMN_CLASS[cell.column.id]}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isSelected && renderDetails && (
                      <tr className="details-row">
                        <td colSpan={row.getVisibleCells().length}>
                          {renderDetails(row.original)}
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

      {rows.length === 0 && (
        <p className="empty-note">
          {results.length === 0
            ? "Every element this rule applied to passed."
            : "No issues match the current filters."}
        </p>
      )}

      {table.getPageCount() > 1 && (
        <div className="pager">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous page
          </button>
          <span className="pager-state">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next page
          </button>
        </div>
      )}
    </div>
  );
}
