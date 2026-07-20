import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import type { ElementResult } from "@ifc-qa/shared-types";

type ResultRow = ElementResult & { fileName: string };

const columnHelper = createColumnHelper<ResultRow>();

const columns = [
  columnHelper.accessor("fileName", { header: "File" }),
  columnHelper.accessor("elementType", { header: "Element Type" }),
  columnHelper.accessor("ruleId", { header: "Rule" }),
  columnHelper.accessor("severity", { header: "Severity" }),
  columnHelper.accessor("message", { header: "Message" }),
];

export function IssueTable({ results }: { results: ResultRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const data = useMemo(() => results, [results]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function filterValue(columnId: string): string {
    return (table.getColumn(columnId)?.getFilterValue() as string) ?? "";
  }

  return (
    <div>
      <div role="group" aria-label="Issue filters">
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
        <label>
          Rule
          <input
            type="text"
            aria-label="Filter by rule id"
            value={filterValue("ruleId")}
            onChange={(e) => table.getColumn("ruleId")?.setFilterValue(e.target.value)}
          />
        </label>
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

      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {table.getRowModel().rows.length === 0 && <p>No issues match the current filters.</p>}
    </div>
  );
}
