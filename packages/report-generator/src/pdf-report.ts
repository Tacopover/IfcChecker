import PDFDocument from "pdfkit";
import { buffer } from "node:stream/consumers";
import type { Severity } from "@ifc-qa/shared-types";
import type { RunReportData } from "./types.js";
import { sortResults } from "./sort-results.js";

const SEVERITY_COLORS: Record<Severity, string> = {
  error: "#B00020",
  warning: "#8A6D00",
};

export async function generatePdfReport(data: RunReportData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });

  doc.fontSize(18).text("IFC QA Report", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Run ID: ${data.runId}`);
  doc.text(`Rule Set: ${data.ruleSetName}`);
  doc.text(`Engine: ${data.engine}`);
  doc.text(`Generated At: ${data.generatedAt}`);
  doc.moveDown(1);

  const sorted = sortResults(data.results);
  const headerRow = ["File", "Element Type", "Global ID", "Rule", "Severity", "Message"].map(
    (text) => ({
      text,
      font: { family: "Helvetica-Bold" },
      backgroundColor: "#eeeeee",
    })
  );
  const dataRows = sorted.map((result) => [
    { text: result.fileName },
    { text: result.elementType },
    { text: result.elementGlobalId },
    { text: result.ruleId },
    { text: result.severity, textColor: SEVERITY_COLORS[result.severity] },
    { text: result.message },
  ]);

  doc.table({
    columnStyles: [90, 70, 110, 90, 60, "*"],
    defaultStyle: { padding: 4, border: 1, borderColor: "#cccccc" },
    data: [headerRow, ...dataRows],
  });

  const pdfBuffer = buffer(doc);
  doc.end();
  return pdfBuffer;
}
