import type { RuleSetSummary, RunResultsResponse, RunStatusResponse } from "@ifc-qa/shared-types";
import type { RunListResponse } from "../../api/types";

export const ruleSetFixtures: RuleSetSummary[] = [
  { id: "rs-1", name: "Company Naming Standard v3", uploadedAt: "2026-07-01T00:00:00.000Z" },
  { id: "rs-2", name: "MEP Fire Rating Rules", uploadedAt: "2026-07-10T00:00:00.000Z" },
];

export const runningStatusResponse: RunStatusResponse = {
  runId: "run-1",
  status: "running",
  fileJobs: [
    { id: "f1", fileName: "model-a.ifc", status: "running", engine: "web-ifc", parseMs: null, errorMessage: null },
    { id: "f2", fileName: "model-b.ifc", status: "queued", engine: "web-ifc", parseMs: null, errorMessage: null },
  ],
};

export const completedStatusResponse: RunStatusResponse = {
  runId: "run-1",
  status: "completed",
  fileJobs: [
    { id: "f1", fileName: "model-a.ifc", status: "succeeded", engine: "web-ifc", parseMs: 842, errorMessage: null },
    { id: "f2", fileName: "model-b.ifc", status: "failed", engine: "web-ifc", parseMs: null, errorMessage: "unexpected EOF" },
  ],
};

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

export const runListFixture: RunListResponse = {
  runs: [
    { id: "run-1", status: "completed", engine: "web-ifc", ruleSetId: "rs-1", createdAt: "2026-07-15T09:00:00.000Z", fileCount: 2 },
    { id: "run-2", status: "running", engine: "ifc-lite", ruleSetId: "rs-2", createdAt: "2026-07-16T09:00:00.000Z", fileCount: 5 },
  ],
};
