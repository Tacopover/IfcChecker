import { describe, expect, it } from "vitest";
import { Workbook } from "exceljs";
import { generateExcelReport } from "./excel-report.js";
import type { RunReportData } from "./types.js";

const fixture: RunReportData = {
  runId: "11111111-1111-1111-1111-111111111111",
  ruleSetName: "Company Naming Standard v3",
  engine: "web-ifc",
  generatedAt: "2026-07-17T00:00:00.000Z",
  results: [
    {
      id: "r1",
      fileJobId: "fj1",
      elementGlobalId: "g1",
      elementType: "IFCWALL",
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
      ruleId: "naming-prefix",
      severity: "warning",
      message: "Door name missing suffix",
      fileName: "model-a.ifc",
    },
    {
      id: "r3",
      fileJobId: "fj2",
      elementGlobalId: "g3",
      elementType: "IFCWALL",
      ruleId: "fire-rating-required",
      severity: "error",
      message: "Missing FireRating property",
      fileName: "model-a.ifc",
    },
  ],
};

describe("generateExcelReport", () => {
  it("returns a buffer that round-trips through exceljs with sorted rows", async () => {
    const result = await generateExcelReport(fixture);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const workbook = new Workbook();
    // see the cast note in excel-report.ts: exceljs's own .d.ts shadows the real Buffer type
    await workbook.xlsx.load(result as unknown as ArrayBuffer);

    const resultsSheet = workbook.getWorksheet("Results");
    if (!resultsSheet) throw new Error("Results worksheet missing");

    expect(resultsSheet.rowCount).toBe(4); // 1 header + 3 data rows

    // Row 2: model-a.ifc / IFCWALL / error (sorted before model-a's warning)
    const row2 = resultsSheet.getRow(2);
    expect(row2.getCell(1).value).toBe("model-a.ifc");
    expect(row2.getCell(2).value).toBe("IFCWALL");
    expect(row2.getCell(5).value).toBe("error");
    expect(row2.getCell(6).value).toBe("Missing FireRating property");

    // Row 3: model-a.ifc / IFCDOOR / warning
    const row3 = resultsSheet.getRow(3);
    expect(row3.getCell(1).value).toBe("model-a.ifc");
    expect(row3.getCell(5).value).toBe("warning");

    // Row 4: model-b.ifc / IFCWALL / error
    const row4 = resultsSheet.getRow(4);
    expect(row4.getCell(1).value).toBe("model-b.ifc");
    expect(row4.getCell(5).value).toBe("error");
  });
});
