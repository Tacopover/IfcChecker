import { z } from "zod";
import {
  EngineIdSchema,
  FileJobStatusSchema,
  RunStatusSchema,
  ElementResultSchema,
} from "./domain.js";

export const CreateRunResponseSchema = z.object({
  runId: z.string(),
  fileJobIds: z.array(z.string()),
});
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;

export const FileJobSummarySchema = z.object({
  id: z.string(),
  fileName: z.string(),
  status: FileJobStatusSchema,
  engine: EngineIdSchema,
  parseMs: z.number().nullable(),
  errorMessage: z.string().nullable(),
});
export type FileJobSummary = z.infer<typeof FileJobSummarySchema>;

export const RunStatusResponseSchema = z.object({
  runId: z.string(),
  status: RunStatusSchema,
  fileJobs: z.array(FileJobSummarySchema),
});
export type RunStatusResponse = z.infer<typeof RunStatusResponseSchema>;

export const RunResultsResponseSchema = z.object({
  runId: z.string(),
  results: z.array(ElementResultSchema.extend({ fileName: z.string() })),
});
export type RunResultsResponse = z.infer<typeof RunResultsResponseSchema>;

export const RuleSetSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  uploadedAt: z.string(),
});
export type RuleSetSummary = z.infer<typeof RuleSetSummarySchema>;
