import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { IssueRow } from "../components/IssueTable.js";
import type { SpecificationSummary } from "../local/parseAndValidate.js";
import {
  buildElementFocusRequest,
  buildSpecificationFocusRequest,
  resolveFocusElements,
} from "./focusRequest.js";

function row(overrides: Partial<IssueRow> = {}): IssueRow {
  return {
    id: "r1",
    fileJobId: "job",
    elementGlobalId: "g1",
    elementType: "IFCWALL",
    ruleId: "Walls are named",
    severity: "error",
    message: "Name is missing",
    fileName: "arch.ifc",
    modelKey: "arch.ifc:10:1",
    elementName: "Wall A",
    elementTag: null,
    ...overrides,
  };
}

function summary(overrides: Partial<SpecificationSummary> = {}): SpecificationSummary {
  return {
    name: "Walls are named",
    checked: true,
    unsupported: [],
    applicableCount: 2,
    passedCount: 0,
    failedCount: 2,
    violations: [],
    cardinalityFailure: null,
    ...overrides,
  };
}

function element(globalId: string, expressId: number): NormalizedElement {
  return {
    globalId,
    expressId,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: null,
    attributes: {},
    propertySets: {},
  };
}

describe("buildElementFocusRequest", () => {
  it("carries exactly the one row, labelled by its element", () => {
    const request = buildElementFocusRequest(row({ elementName: "Wall A", elementGlobalId: "g1" }));
    expect(request.modelKey).toBe("arch.ifc:10:1");
    expect(request.fileName).toBe("arch.ifc");
    expect(request.rows).toHaveLength(1);
    expect(request.label).toContain("Wall A");
    expect(request.otherFileCount).toBe(0);
  });
});

describe("buildSpecificationFocusRequest", () => {
  it("returns null for a specification with nothing to focus", () => {
    expect(buildSpecificationFocusRequest(summary({ violations: [] }))).toBeNull();
  });

  it("takes every violation when they all share one file", () => {
    const request = buildSpecificationFocusRequest(
      summary({ violations: [row({ id: "a" }), row({ id: "b" })] })
    );
    expect(request?.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(request?.otherFileCount).toBe(0);
  });

  // A specification can fail elements across a federated batch; the viewer
  // shows one file at a time, so the first file's rows lead and the rest are
  // counted rather than silently dropped.
  it("narrows to the first violation's file and counts the rest", () => {
    const request = buildSpecificationFocusRequest(
      summary({
        violations: [
          row({ id: "a", modelKey: "arch.ifc:10:1", fileName: "arch.ifc" }),
          row({ id: "b", modelKey: "mep.ifc:20:1", fileName: "mep.ifc" }),
          row({ id: "c", modelKey: "arch.ifc:10:1", fileName: "arch.ifc" }),
        ],
      })
    );
    expect(request?.modelKey).toBe("arch.ifc:10:1");
    expect(request?.rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(request?.otherFileCount).toBe(1);
  });
});

describe("resolveFocusElements", () => {
  it("joins rows to express ids by GlobalId", () => {
    const request = buildElementFocusRequest(row({ elementGlobalId: "g1" }));
    const resolved = resolveFocusElements(request, [element("g1", 101), element("g2", 102)]);
    expect(resolved.expressIds).toEqual([101]);
    expect(resolved.unmatchedRows).toEqual([]);
  });

  it("reports a row whose GlobalId matches no element in the given model", () => {
    const request = buildElementFocusRequest(row({ elementGlobalId: "ghost" }));
    const resolved = resolveFocusElements(request, [element("g1", 101)]);
    expect(resolved.expressIds).toEqual([]);
    expect(resolved.unmatchedRows).toHaveLength(1);
  });
});
