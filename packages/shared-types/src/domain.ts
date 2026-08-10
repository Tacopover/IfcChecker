import { z } from "zod";

export const PropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type PropertyValue = z.infer<typeof PropertyValueSchema>;

/**
 * One attribute or property slot, with the typing IFC gives it.
 *
 * `value` is what a person reads and what a single-valued comparison uses — for the five
 * multi-valued IfcProperty subtypes it stays the parser's display string ("3000 [1000 – 5000]"),
 * so the element panel is unchanged. `values` carries the candidates behind that string, because
 * IDS passes a multi-valued property when *any* candidate matches. `dataType` is the IFC measure
 * type the file actually stored (IFCMASSMEASURE, IFCREAL), which is the only thing that can answer
 * whether a stored value is the type the specification asked for.
 */
export const NormalizedValueSchema = z.object({
  value: PropertyValueSchema,
  /** Candidates for bounded / list / table / enumerated properties. Absent for a single value. */
  values: z.array(PropertyValueSchema).optional(),
  /** Absent when the value carries no measure semantics, and for every attribute. */
  dataType: z.string().optional(),
  unit: z.string().optional(),
});
export type NormalizedValue = z.infer<typeof NormalizedValueSchema>;

/**
 * What each of the model's measure types must be multiplied by to reach the unit IDS compares in.
 *
 * IDS states every numerical measure in SI — a length is metres, whatever the file was authored in
 * — so a millimetre model carries `IFCLENGTHMEASURE: 1e-3` here. Keyed by the IFC measure type
 * because that is what a property slot's `dataType` reports.
 *
 * Only measures that actually need scaling are listed, so an absent key means a factor of 1. A
 * model that declares nothing is therefore indistinguishable from one already authored in SI,
 * which is also what IFC means by an unstated unit.
 */
export const UnitScalesSchema = z.record(z.string(), z.number());
export type UnitScales = z.infer<typeof UnitScalesSchema>;

export const NormalizedElementSchema = z.object({
  globalId: z.string(),
  ifcType: z.string(),
  predefinedType: z.string().nullable(),
  name: z.string().nullable(),
  attributes: z.record(z.string(), NormalizedValueSchema),
  propertySets: z.record(z.string(), z.record(z.string(), NormalizedValueSchema)),
});
export type NormalizedElement = z.infer<typeof NormalizedElementSchema>;

export interface ModelStructureNode {
  expressId: number;
  ifcType: string;
  name: string | null;
  elementCounts: Record<string, number>;
  children: ModelStructureNode[];
}

export const ModelStructureNodeSchema: z.ZodType<ModelStructureNode> = z.lazy(() =>
  z.object({
    expressId: z.number(),
    ifcType: z.string(),
    name: z.string().nullable(),
    elementCounts: z.record(z.string(), z.number()),
    children: z.array(ModelStructureNodeSchema),
  })
);

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
