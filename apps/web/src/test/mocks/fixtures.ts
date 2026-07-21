import type { RunResultsResponse } from "@ifc-qa/shared-types";

export const runResultsFixture: RunResultsResponse = {
  runId: "run-1",
  results: [
    {
      id: "e1",
      fileJobId: "f1",
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
      fileName: "model-a.ifc",
    },
    {
      id: "e2",
      fileJobId: "f1",
      elementGlobalId: "g2",
      elementType: "IFCDOOR",
      ruleId: "fire-rating-required",
      severity: "warning",
      message: "Missing FireRating property",
      fileName: "model-a.ifc",
    },
  ],
};
