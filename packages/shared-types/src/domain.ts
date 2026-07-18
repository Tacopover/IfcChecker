import { z } from "zod";

export const PropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type PropertyValue = z.infer<typeof PropertyValueSchema>;

export const NormalizedElementSchema = z.object({
  globalId: z.string(),
  ifcType: z.string(),
  predefinedType: z.string().nullable(),
  name: z.string().nullable(),
  attributes: z.record(z.string(), PropertyValueSchema),
  propertySets: z.record(z.string(), z.record(z.string(), PropertyValueSchema)),
});
export type NormalizedElement = z.infer<typeof NormalizedElementSchema>;

export const EngineIdSchema = z.enum(["web-ifc", "ifc-lite"]);
export type EngineId = z.infer<typeof EngineIdSchema>;

export const FileJobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export type FileJobStatus = z.infer<typeof FileJobStatusSchema>;

export const RunStatusSchema = z.enum(["queued", "running", "completed"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const SeveritySchema = z.enum(["error", "warning"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ElementResultSchema = z.object({
  id: z.string(),
  fileJobId: z.string(),
  elementGlobalId: z.string(),
  elementType: z.string(),
  ruleId: z.string(),
  severity: SeveritySchema,
  message: z.string(),
});
export type ElementResult = z.infer<typeof ElementResultSchema>;
