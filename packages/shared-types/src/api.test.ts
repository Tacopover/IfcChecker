import { describe, expect, it } from "vitest";
import {
  CreateRunResponseSchema,
  RunStatusResponseSchema,
  RunResultsResponseSchema,
  RuleSetSummarySchema,
} from "./api.js";

describe("CreateRunResponseSchema", () => {
  it("accepts a run id plus its file job ids", () => {
    const parsed = CreateRunResponseSchema.parse({
      runId: "r1",
      fileJobIds: ["f1", "f2"],
    });
    expect(parsed.fileJobIds).toHaveLength(2);
  });
});

describe("RunStatusResponseSchema", () => {
  it("accepts per-file status with nullable timing/error", () => {
    const parsed = RunStatusResponseSchema.parse({
      runId: "r1",
      status: "running",
      fileJobs: [
        {
          id: "f1",
          fileName: "model-a.ifc",
          status: "succeeded",
          engine: "web-ifc",
          parseMs: 842,
          errorMessage: null,
        },
        {
          id: "f2",
          fileName: "model-b.ifc",
          status: "failed",
          engine: "ifc-lite",
          parseMs: null,
          errorMessage: "unexpected EOF",
        },
      ],
    });
    expect(parsed.fileJobs[1].errorMessage).toBe("unexpected EOF");
  });
});

describe("RunResultsResponseSchema", () => {
  it("accepts results tagged with the source file name", () => {
    const parsed = RunResultsResponseSchema.parse({
      runId: "r1",
      results: [
        {
          id: "e1",
          fileJobId: "f1",
          elementGlobalId: "g1",
          elementType: "IFCWALL",
          ruleId: "naming-prefix",
          severity: "error",
          message: "bad name",
          fileName: "model-a.ifc",
        },
      ],
    });
    expect(parsed.results[0].fileName).toBe("model-a.ifc");
  });
});

describe("RuleSetSummarySchema", () => {
  it("accepts an uploaded rule set summary", () => {
    const parsed = RuleSetSummarySchema.parse({
      id: "rs1",
      name: "Company Naming Standard v3",
      uploadedAt: "2026-07-17T00:00:00.000Z",
    });
    expect(parsed.name).toContain("Naming Standard");
  });
});
