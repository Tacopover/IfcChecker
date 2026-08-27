import type { EngineId, Severity } from "@ifc-qa/shared-types";
import type { RunReportData } from "@ifc-qa/report-generator/browser";
import type { SpecificationSummary } from "./parseAndValidate.js";

/**
 * One flat row per violation, across every specification — what a reviewer takes off the page
 * to file elsewhere. Passed/unchecked specifications contribute nothing: there is no row to
 * write for an element that had nothing wrong with it.
 */
export function buildRunReportData(
  summaries: SpecificationSummary[],
  ruleSetName: string,
  engine: EngineId
): RunReportData {
  return {
    runId: crypto.randomUUID(),
    ruleSetName,
    engine,
    generatedAt: new Date().toISOString(),
    results: summaries.flatMap((summary) => summary.violations),
  };
}

const CSV_HEADER = [
  "File",
  "Element",
  "Element Type",
  "Global ID",
  "Tag",
  "Rule",
  "Severity",
  "Message",
];

// RFC 4180: a field holding a comma, quote, or line break is wrapped in quotes, with any quote
// inside it doubled.
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1 };

// Mirrors @ifc-qa/report-generator's sortResults ordering (file, then severity — error before
// warning, then element type). Reimplemented here, rather than imported, so a CSV export — which
// needs no library — doesn't pull exceljs into the same bundle chunk as this module; the Excel
// path below loads that package on demand instead.
function sortForExport(results: RunReportData["results"]): RunReportData["results"] {
  return [...results].sort((a, b) => {
    if (a.fileName !== b.fileName) return a.fileName.localeCompare(b.fileName);
    if (a.severity !== b.severity) return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return a.elementType.localeCompare(b.elementType);
  });
}

export function buildCsv(data: RunReportData): string {
  const rows = sortForExport(data.results).map((result) => [
    result.fileName,
    result.elementName ?? "",
    result.elementType,
    result.elementGlobalId,
    result.elementTag ?? "",
    result.ruleId,
    result.severity,
    result.message,
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");
}

function downloadFileName(ruleSetName: string, extension: string): string {
  const base = ruleSetName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-") || "ifc-qa-report";
  return `${base}-report.${extension}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportResultsAsCsv(
  summaries: SpecificationSummary[],
  ruleSetName: string,
  engine: EngineId
): void {
  const data = buildRunReportData(summaries, ruleSetName, engine);
  const csv = buildCsv(data);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), downloadFileName(ruleSetName, "csv"));
}

export async function exportResultsAsExcel(
  summaries: SpecificationSummary[],
  ruleSetName: string,
  engine: EngineId
): Promise<void> {
  const data = buildRunReportData(summaries, ruleSetName, engine);
  // Loaded on demand: exceljs is a large dependency, and bundling it into the main chunk would
  // cost every visitor its weight even if they never export.
  const { generateExcelReport } = await import("@ifc-qa/report-generator/browser");
  const workbook = await generateExcelReport(data);
  // generateExcelReport's declared return type is Node's Buffer, whose ArrayBufferLike backing
  // store isn't assignable to the DOM Blob constructor's stricter BlobPart — wrapping it in a
  // plain Uint8Array satisfies that without copying anything but a view.
  downloadBlob(
    new Blob([new Uint8Array(workbook)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    downloadFileName(ruleSetName, "xlsx")
  );
}

export async function exportResultsAsBcf(
  summaries: SpecificationSummary[],
  ruleSetName: string,
  engine: EngineId
): Promise<void> {
  const data = buildRunReportData(summaries, ruleSetName, engine);
  // Loaded on demand, same as the Excel path: fflate and fast-xml-parser have no place in the
  // main chunk for a visitor who never clicks this button.
  const { generateBcfReport } = await import("@ifc-qa/report-generator/browser");
  const zip = generateBcfReport(data);
  // fflate types zipSync's return as Uint8Array<ArrayBufferLike>, whose backing store isn't
  // narrowed to plain ArrayBuffer — the same mismatch generateExcelReport's Buffer return hits
  // against Blob's stricter BlobPart, fixed the same way.
  downloadBlob(
    new Blob([new Uint8Array(zip)], { type: "application/zip" }),
    downloadFileName(ruleSetName, "bcf")
  );
}
