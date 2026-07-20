import { describe, expect, it } from "vitest";
import { sortResults } from "./sort-results.js";

describe("sortResults", () => {
  it("sorts by file name, then errors before warnings, then element type", () => {
    const unsorted = [
      {
        id: "r1",
        fileJobId: "fj1",
        elementGlobalId: "g1",
        elementType: "IFCWALL",
        ruleId: "naming-prefix",
        severity: "error" as const,
        message: "Name must start with 'W-'",
        fileName: "model-b.ifc",
      },
      {
        id: "r2",
        fileJobId: "fj1",
        elementGlobalId: "g2",
        elementType: "IFCDOOR",
        ruleId: "naming-prefix",
        severity: "warning" as const,
        message: "Door name missing suffix",
        fileName: "model-a.ifc",
      },
      {
        id: "r3",
        fileJobId: "fj2",
        elementGlobalId: "g3",
        elementType: "IFCWALL",
        ruleId: "fire-rating-required",
        severity: "error" as const,
        message: "Missing FireRating property",
        fileName: "model-a.ifc",
      },
    ];

    const sorted = sortResults(unsorted);

    expect(sorted.map((r) => r.id)).toEqual(["r3", "r2", "r1"]);
  });
});
