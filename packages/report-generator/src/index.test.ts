import { describe, expect, it } from "vitest";
import { generatePdfReport, generateExcelReport } from "./index.js";
import type { RunReportData } from "./index.js";

const fixture: RunReportData = {
  runId: "11111111-1111-1111-1111-111111111111",
  ruleSetName: "Company Naming Standard v3",
  engine: "ifc-lite",
  generatedAt: "2026-07-17T00:00:00.000Z",
  results: [
    {
      id: "r1",
      fileJobId: "fj1",
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      elementName: "Wall-1",
      elementTag: "W-001",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
      fileName: "model-b.ifc",
    },
    {
      id: "r2",
      fileJobId: "fj1",
      elementGlobalId: "g2",
      elementType: "IFCDOOR",
      elementName: "Door-1",
      elementTag: null,
      ruleId: "naming-prefix",
      severity: "warning",
      message: "Door name missing suffix",
      fileName: "model-a.ifc",
    },
  ],
};

describe("@ifc-qa/report-generator public API", () => {
  it("generates a non-empty PDF buffer via the package barrel", async () => {
    const pdf = await generatePdfReport(fixture);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("generates a non-empty Excel buffer via the package barrel", async () => {
    const excel = await generateExcelReport(fixture);
    expect(Buffer.isBuffer(excel)).toBe(true);
    expect(excel.length).toBeGreaterThan(0);
  });
});
