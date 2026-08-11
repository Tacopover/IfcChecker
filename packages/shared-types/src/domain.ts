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

/**
 * One classification reference an element carries, resolved to the strings IDS compares.
 *
 * `system` is the name of the `IfcClassification` at the root of the reference chain, not of the
 * reference itself — a nested `IfcClassificationReference` names its parent through
 * `ReferencedSource`, and the system is only found by walking to the top.
 *
 * `identifications` is the leaf's own `Identification` followed by each ancestor's, root-ward.
 * IDS matches a classification value against *any* of them, which is what "a full classification
 * matches its subreferences" means: a rule asking for `EF_25_10` is satisfied by an element
 * classified `EF_25_10_25`, because the shorter code is the longer one's parent in the file.
 */
export const ClassificationReferenceSchema = z.object({
  system: z.string().nullable(),
  identifications: z.array(z.string()),
});
export type ClassificationReference = z.infer<typeof ClassificationReferenceSchema>;

/**
 * One whole this element is a part of, and the relationship that makes it one.
 *
 * `relation` is the IFC relationship entity's own name rather than a normalized category, because
 * IDS distinguishes aggregation from nesting — and ifc-lite's relationship graph deliberately
 * files both under one edge type, so a checker reading that would approve a nested element
 * against an `IFCRELAGGREGATES` rule.
 *
 * Ancestors are included, but only through chains of a **single** relation: a beam contained in a
 * space that is aggregated into a building is not part of that building by aggregation, and the
 * suite states that document as one that must fail.
 */
export const PartOfRelationSchema = z.object({
  relation: z.string(),
  ifcType: z.string(),
  predefinedType: z.string().nullable(),
});
export type PartOfRelation = z.infer<typeof PartOfRelationSchema>;

export const NormalizedElementSchema = z.object({
  globalId: z.string(),
  ifcType: z.string(),
  predefinedType: z.string().nullable(),
  name: z.string().nullable(),
  attributes: z.record(z.string(), NormalizedValueSchema),
  propertySets: z.record(z.string(), z.record(z.string(), NormalizedValueSchema)),
  /**
   * Every classification reference on the element, occurrence and type alike.
   *
   * Optional because an element carrying none and a caller that never collected any are the same
   * thing to every reader — a required classification facet fails either way. Both adapters always
   * state it, so the engines stay comparable.
   */
  classifications: z.array(ClassificationReferenceSchema).optional(),
  /**
   * Every string a material facet may match: the names and categories of the element's materials,
   * of the layer/profile/constituent sets holding them, and of each member within those sets. IDS
   * gives a material facet one parameter, so which of them a match came from never matters — a
   * flat list says exactly what can be checked and nothing more.
   *
   * `null` when the element has no material association at all, which is a different thing from
   * an association naming nothing: an empty material facet asks only whether the element *has* a
   * material, so `null` fails it and `[]` passes it while still failing any value check.
   */
  materials: z.array(z.string()).nullable().optional(),
  /**
   * Every whole the element is a part of, direct and ancestral. Empty for an element that is part
   * of nothing — including the container of everything else, which is why "the container itself"
   * fails a containment facet.
   */
  partOf: z.array(PartOfRelationSchema).optional(),
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
