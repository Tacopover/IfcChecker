import { carriesReadableGlobalId } from "@ifc-qa/shared-types";

/**
 * A stable identifier for any entity, rooted or not.
 *
 * Most of what an IDS applicability can name has no GlobalId to give: only
 * `IfcRoot` subtypes declare one, so `IfcMaterial`, `IfcPerson`,
 * `IfcClassification` and the presentation resources have none at all. They
 * still have to be identifiable, or two violations on two different materials
 * become indistinguishable in the results table.
 *
 * The STEP line number is the file's own identity for them, and both engines
 * report the same one because it is written in the file. It is prefixed so a
 * synthetic id can never be mistaken for a real GlobalId — those are 22
 * characters of base64 and never start with `#`.
 *
 * Relationships and property sets take the synthetic id too even though they do
 * declare a GlobalId: see `carriesReadableGlobalId` for why that is decided by
 * the schema rather than by whichever engine parsed the file.
 */
export function identifyEntity(ifcType: string, globalId: unknown, expressId: number): string {
  if (!carriesReadableGlobalId(ifcType)) return `#${expressId}`;
  return typeof globalId === "string" && globalId !== "" ? globalId : `#${expressId}`;
}
