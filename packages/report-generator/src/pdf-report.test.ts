import { describe, expect, it } from "vitest";
import { generatePdfReport } from "./pdf-report.js";
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

describe("generatePdfReport", () => {
  it("returns a non-empty PDF buffer", async () => {
    const result = await generatePdfReport(fixture);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
