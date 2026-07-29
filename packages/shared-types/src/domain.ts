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
  // The STEP line number, which is a property of the file rather than of
  // whichever engine read it — measured identical across both adapters. It is
  // what every mesh is keyed by, so it is the only join from an element record
  // to its geometry.
  expressId: z.number(),
  ifcType: z.string(),
  predefinedType: z.string().nullable(),
  name: z.string().nullable(),
  attributes: z.record(z.string(), PropertyValueSchema),
  propertySets: z.record(z.string(), z.record(z.string(), PropertyValueSchema)),
});
export type NormalizedElement = z.infer<typeof NormalizedElementSchema>;

export interface ModelStructureNode {
  expressId: number;
  ifcType: string;
  name: string | null;
  /**
   * Express ids of the physical elements directly contained in this node,
   * grouped by IFC type and sorted ascending within each group. Counts alone
   * describe a model but cannot be browsed: a viewer tree has to expand a
   * storey down to the elements themselves. Sorted because the two engines
   * discover containment in different orders, and they have to agree
   * element-for-element rather than merely in aggregate.
   */
  elementIdsByType: Record<string, number[]>;
  children: ModelStructureNode[];
}

export const ModelStructureNodeSchema: z.ZodType<ModelStructureNode> = z.lazy(() =>
  z.object({
    expressId: z.number(),
    ifcType: z.string(),
    name: z.string().nullable(),
    elementIdsByType: z.record(z.string(), z.array(z.number())),
    children: z.array(ModelStructureNodeSchema),
  })
);

/** Per-type tallies, the shape this node used to carry directly. */
export function elementCountsOf(node: ModelStructureNode): Record<string, number> {
  return Object.fromEntries(
    Object.entries(node.elementIdsByType).map(([ifcType, ids]) => [ifcType, ids.length])
  );
}

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
