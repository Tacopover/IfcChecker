import { z } from "zod";
import { EngineIdSchema } from "./domain.js";

export const PARSE_JOB_QUEUE_NAME = "parse-file-job";

export const ParseJobPayloadSchema = z.object({
  fileJobId: z.string(),
  runId: z.string(),
  engine: EngineIdSchema,
  filePath: z.string(),
  ruleSetId: z.string(),
});
export type ParseJobPayload = z.infer<typeof ParseJobPayloadSchema>;

export const ParseJobResultSchema = z.object({
  fileJobId: z.string(),
  status: z.enum(["succeeded", "failed"]),
  parseMs: z.number(),
  elementCount: z.number(),
  errorMessage: z.string().nullable(),
});
export type ParseJobResult = z.infer<typeof ParseJobResultSchema>;
