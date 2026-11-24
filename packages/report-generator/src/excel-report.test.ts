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
    {
      id: "r3",
      fileJobId: "fj2",
      elementGlobalId: "g3",
      elementType: "IFCWALL",
      elementName: "Wall-2",
      elementTag: "W-002",
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

    expect(result.length).toBeGreaterThan(0);

    const workbook = new Workbook();
    // exceljs's own .d.ts declares a top-level `Buffer extends ArrayBuffer {}` that shadows Node's
    // real Buffer, so load()'s parameter type rejects a plain Uint8Array without this cast.
    await workbook.xlsx.load(Buffer.from(result) as unknown as ArrayBuffer);

    const resultsSheet = workbook.getWorksheet("Results");
    if (!resultsSheet) throw new Error("Results worksheet missing");

    expect(resultsSheet.rowCount).toBe(4); // 1 header + 3 data rows

    // Row 2: model-a.ifc / IFCWALL / error (sorted before model-a's warning)
    const row2 = resultsSheet.getRow(2);
    expect(row2.getCell(1).value).toBe("model-a.ifc");
    expect(row2.getCell(2).value).toBe("Wall-2");
    expect(row2.getCell(3).value).toBe("IFCWALL");
    expect(row2.getCell(5).value).toBe("W-002");
    expect(row2.getCell(7).value).toBe("error");
    expect(row2.getCell(8).value).toBe("Missing FireRating property");

    // Row 3: model-a.ifc / IFCDOOR / warning, with no Tag attribute on the element
    const row3 = resultsSheet.getRow(3);
    expect(row3.getCell(1).value).toBe("model-a.ifc");
    expect(row3.getCell(5).value).toBeNull();
    expect(row3.getCell(7).value).toBe("warning");

    // Row 4: model-b.ifc / IFCWALL / error
    const row4 = resultsSheet.getRow(4);
    expect(row4.getCell(1).value).toBe("model-b.ifc");
    expect(row4.getCell(7).value).toBe("error");
  });

  it("writes the run details and violation count on the Summary sheet", async () => {
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(await generateExcelReport(fixture)) as unknown as ArrayBuffer);

    const summary = workbook.getWorksheet("Summary");
    if (!summary) throw new Error("Summary worksheet missing");
    const values = new Map<unknown, unknown>();
    summary.eachRow((row) => values.set(row.getCell(1).value, row.getCell(2).value));

    expect(values.get("Rule Set")).toBe("Company Naming Standard v3");
    expect(values.get("Violations")).toBe("3");
    expect(values.get("Result Sheets")).toBe("1");
  });

  it("continues on further Results sheets, header repeated, once a sheet is full", async () => {
    const workbook = new Workbook();
    const result = await generateExcelReport(fixture, { maxRowsPerSheet: 2 });
    await workbook.xlsx.load(Buffer.from(result) as unknown as ArrayBuffer);

    const first = workbook.getWorksheet("Results");
    const second = workbook.getWorksheet("Results 2");
    if (!first || !second) throw new Error("Results sheets missing");

    expect(first.rowCount).toBe(3); // header + 2 rows
    expect(second.rowCount).toBe(2); // header + the 1 remaining row
    expect(second.getRow(1).getCell(1).value).toBe("File");
    expect(second.getRow(2).getCell(1).value).toBe("model-b.ifc"); // third in sort order
  });

  it("keeps characters that need escaping, drops ones XML cannot carry", async () => {
    const tricky: RunReportData = {
      ...fixture,
      results: [
        {
          ...(fixture.results[0] as RunReportData["results"][number]),
          elementName: ' A & <B> "C" \u0001\u0000x ',
          message: "m".repeat(40_000),
        },
      ],
    };
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(await generateExcelReport(tricky)) as unknown as ArrayBuffer);

    const row = workbook.getWorksheet("Results")?.getRow(2);
    expect(row?.getCell(2).value).toBe(' A & <B> "C" x ');
    expect((row?.getCell(8).value as string).length).toBe(32_767);
  });

  it("writes a header-only Results sheet when there are no violations", async () => {
    const workbook = new Workbook();
    const empty = await generateExcelReport({ ...fixture, results: [] });
    await workbook.xlsx.load(Buffer.from(empty) as unknown as ArrayBuffer);

    expect(workbook.getWorksheet("Results")?.rowCount).toBe(1);
  });
});
