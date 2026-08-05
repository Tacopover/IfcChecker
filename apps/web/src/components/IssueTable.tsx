import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import type { ElementResult } from "@ifc-qa/shared-types";

export interface IssueRow extends ElementResult {
  fileName: string;
  modelKey: string;
  elementName: string | null;
}

const columnHelper = createColumnHelper<IssueRow>();

/** Name and GlobalId in one searchable string: a reviewer arrives with one or the other. */
function elementLabel(row: IssueRow): string {
  return `${row.elementName ?? ""} ${row.elementGlobalId}`.trim();
}

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
  severity: "col-severity",
  message: "col-message",
};

export interface IssueTableProps {
  results: IssueRow[];
  onSelectElement?: (row: IssueRow) => void;
  selectedElementId?: string | null;
  /** Set when the table already sits under one specification, where a Rule column repeats a constant. */
  hideRuleColumn?: boolean;
}

export function IssueTable({
  results,
  onSelectElement,
  selectedElementId,
  hideRuleColumn = false,
}: IssueTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const data = useMemo(() => results, [results]);

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
          if (!onSelectElement) return <span className="element-cell">{identity}</span>;
          return (
            <button
              type="button"
              className="element-cell link"
              aria-pressed={selectedElementId === row.id}
              onClick={() => onSelectElement(row)}
            >
              {identity}
            </button>
          );
        },
      }),
      columnHelper.accessor("elementType", {
        header: "Type",
        cell: (context) => <span className="mono-tag">{context.getValue()}</span>,
      }),
      columnHelper.accessor("fileName", { header: "File" }),
      columnHelper.accessor("ruleId", { header: "Rule" }),
      columnHelper.accessor("severity", {
        header: "Severity",
        cell: (context) => (
          <span className="pill" data-severity={context.getValue()}>
            {context.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("message", { header: "Message" }),
    ],
    [onSelectElement, selectedElementId]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility: { ruleId: !hideRuleColumn } },
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function filterValue(columnId: string): string {
    return (table.getColumn(columnId)?.getFilterValue() as string) ?? "";
  }

  const rows = table.getRowModel().rows;

  return (
    <div className="issue-table">
      <div role="group" aria-label="Issue filters" className="issue-filters">
        <label>
          Element
          <input
            type="text"
            aria-label="Filter by element name or GlobalId"
            value={filterValue("element")}
            onChange={(e) => table.getColumn("element")?.setFilterValue(e.target.value)}
          />
        </label>
        <label>
          File
          <input
            type="text"
            aria-label="Filter by file name"
            value={filterValue("fileName")}
            onChange={(e) => table.getColumn("fileName")?.setFilterValue(e.target.value)}
          />
        </label>
        <label>
          Element type
          <input
            type="text"
            aria-label="Filter by element type"
            value={filterValue("elementType")}
            onChange={(e) => table.getColumn("elementType")?.setFilterValue(e.target.value)}
          />
        </label>
        {!hideRuleColumn && (
          <label>
            Rule
            <input
              type="text"
              aria-label="Filter by rule id"
              value={filterValue("ruleId")}
              onChange={(e) => table.getColumn("ruleId")?.setFilterValue(e.target.value)}
            />
          </label>
        )}
        <label>
          Severity
          <select
            aria-label="Filter by severity"
            value={filterValue("severity")}
            onChange={(e) => table.getColumn("severity")?.setFilterValue(e.target.value || undefined)}
          >
            <option value="">All</option>
            <option value="error">error</option>
            <option value="warning">warning</option>
          </select>
        </label>
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
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={selectedElementId === row.original.id ? "row-selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={COLUMN_CLASS[cell.column.id]}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
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
