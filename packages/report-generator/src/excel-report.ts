import { Workbook } from "exceljs";
import type { RunReportData } from "./types.js";
import { sortResults } from "./sort-results.js";

const SUMMARY_SHEET_NAME = "Summary";
const RESULTS_SHEET_NAME = "Results";

export async function generateExcelReport(data: RunReportData): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = "IFC QA Tool";
  workbook.created = new Date(data.generatedAt);

  const summarySheet = workbook.addWorksheet(SUMMARY_SHEET_NAME);
  summarySheet.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Value", key: "value", width: 50 },
  ];
  summarySheet.addRows([
    { field: "Run ID", value: data.runId },
    { field: "Rule Set", value: data.ruleSetName },
    { field: "Engine", value: data.engine },
    { field: "Generated At", value: data.generatedAt },
  ]);

  const resultsSheet = workbook.addWorksheet(RESULTS_SHEET_NAME);
  resultsSheet.columns = [
    { header: "File", key: "fileName", width: 25 },
    { header: "Element Type", key: "elementType", width: 20 },
    { header: "Global ID", key: "elementGlobalId", width: 25 },
    { header: "Rule", key: "ruleId", width: 20 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Message", key: "message", width: 50 },
  ];
  resultsSheet.addRows(sortResults(data.results));

  return workbook.xlsx.writeBuffer();
}
