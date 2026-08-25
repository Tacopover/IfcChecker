import { describe, expect, it } from "vitest";
import type { SpecificationSummary } from "./parseAndValidate.js";
import { buildCsv, buildRunReportData } from "./exportResults.js";

function violation(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    fileJobId: "model-a.ifc",
    fileName: "model-a.ifc",
    modelKey: "model-a.ifc#0",
    elementGlobalId: "g1",
    elementType: "IFCWALL",
    elementName: "Wall-1",
    elementTag: "W-001",
    ruleId: "naming-prefix",
    severity: "error" as const,
    message: "Name must start with 'W-'",
    ...overrides,
  };
}

function summary(overrides: Partial<SpecificationSummary> = {}): SpecificationSummary {
  return {
    name: "naming-prefix",
    checked: true,
    unsupported: [],
    applicableCount: 1,
    passedCount: 0,
    failedCount: 1,
    violations: [],
    cardinalityFailure: null,
    ...overrides,
  };
}

describe("buildRunReportData", () => {
  it("flattens every specification's violations into one list, dropping specs with none", () => {
    const summaries = [
      summary({ name: "spec-a", violations: [violation({ id: "v1" })] }),
      summary({ name: "spec-b", violations: [], applicableCount: 3, passedCount: 3, failedCount: 0 }),
      summary({ name: "spec-c", violations: [violation({ id: "v2", ruleId: "spec-c" })] }),
    ];

    const data = buildRunReportData(summaries, "rules.ids", "ifc-lite");

    expect(data.ruleSetName).toBe("rules.ids");
    expect(data.engine).toBe("ifc-lite");
    expect(data.results.map((r) => r.id)).toEqual(["v1", "v2"]);
  });

  it("stamps a fresh run id and an ISO timestamp on every call", () => {
    const data = buildRunReportData([], "rules.ids", "ifc-lite");
    expect(data.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(data.generatedAt).toISOString()).toBe(data.generatedAt);
  });
});

describe("buildCsv", () => {
  it("writes a header row and one row per violation, ordered by file then severity then type", () => {
    const data = buildRunReportData(
      [
        summary({
          violations: [
            violation({ id: "v1", fileName: "b.ifc", severity: "warning", elementType: "IFCDOOR" }),
            violation({ id: "v2", fileName: "a.ifc", severity: "error", elementType: "IFCWALL" }),
          ],
        }),
      ],
      "rules.ids",
      "ifc-lite"
    );

    const lines = buildCsv(data).split("\r\n");

    expect(lines[0]).toBe("File,Element,Element Type,Global ID,Tag,Rule,Severity,Message");
    expect(lines[1]).toContain("a.ifc");
    expect(lines[2]).toContain("b.ifc");
  });

  it("exports an empty cell for a violation whose element has no Tag attribute", () => {
    const data = buildRunReportData(
      [summary({ violations: [violation({ elementTag: null })] })],
      "rules.ids",
      "ifc-lite"
    );

    const [header, row] = buildCsv(data).split("\r\n");
    const tagColumn = header.split(",").indexOf("Tag");
    expect(row.split(",")[tagColumn]).toBe("");
  });

  it("quotes a field that holds a comma, and doubles an embedded quote", () => {
    const data = buildRunReportData(
      [summary({ violations: [violation({ message: 'Name must be "W-x", not blank' })] })],
      "rules.ids",
      "ifc-lite"
    );

    const [, row] = buildCsv(data).split("\r\n");
    expect(row).toContain('"Name must be ""W-x"", not blank"');
  });
});
