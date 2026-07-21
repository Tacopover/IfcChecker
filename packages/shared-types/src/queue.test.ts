import { describe, expect, it } from "vitest";
import { ParseJobPayloadSchema, ParseJobResultSchema, PARSE_JOB_QUEUE_NAME } from "./queue.js";

describe("PARSE_JOB_QUEUE_NAME", () => {
  it("is a stable, non-empty string", () => {
    expect(PARSE_JOB_QUEUE_NAME).toBe("parse-file-job");
  });
});

describe("ParseJobPayloadSchema", () => {
  it("accepts a well-formed payload", () => {
    const parsed = ParseJobPayloadSchema.parse({
      fileJobId: "22222222-2222-2222-2222-222222222222",
      runId: "33333333-3333-3333-3333-333333333333",
      engine: "web-ifc",
      filePath: "runs/33333333.../model.ifc",
      ruleSetId: "44444444-4444-4444-4444-444444444444",
    });
    expect(parsed.engine).toBe("web-ifc");
  });

  it("rejects an unknown engine", () => {
    const result = ParseJobPayloadSchema.safeParse({
      fileJobId: "x",
      runId: "y",
      engine: "revit",
      filePath: "z",
      ruleSetId: "w",
    });
    expect(result.success).toBe(false);
  });
});

describe("ParseJobResultSchema", () => {
  it("accepts a failed result with an error message", () => {
    const parsed = ParseJobResultSchema.parse({
      fileJobId: "22222222-2222-2222-2222-222222222222",
      status: "failed",
      parseMs: 0,
      elementCount: 0,
      errorMessage: "corrupt IFC header",
    });
    expect(parsed.status).toBe("failed");
  });
});
