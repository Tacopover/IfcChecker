import { IFC_ENTITY_PARENTS } from "./ifc-entity-table.generated.js";

/**
 * The one part of the schema no parse ever turns into elements.
 *
 * Geometry is 96% of a real IFC file by instance count — 662,632 of 691,277 in
 * the 37 MB reference model — and normalizing it took that model's parse from
 * 1.6 s to 20.5 s. Everything else in the schema is affordable: relationships,
 * type objects, materials, actors and presentation resources together come to
 * ~28k instances there, and cost ~1 s.
 *
 * So this is a cost boundary, not a statement about what IDS may ask for. An
 * applicability naming something under here is refused rather than evaluated,
 * because a rule that silently matches nothing reports the model clean.
 */
export const IFC_UNPARSED_SUBTREE_ROOT = "IFCREPRESENTATIONITEM";

const PARENT_BY_UPPER = new Map<string, string | null>();
for (const [name, parent] of Object.entries(IFC_ENTITY_PARENTS)) {
  PARENT_BY_UPPER.set(name.toUpperCase(), parent === null ? null : parent.toUpperCase());
}

function isUnder(upper: string, rootUpper: string): boolean {
  let cursor: string | null | undefined = upper;
  while (cursor) {
    if (cursor === rootUpper) return true;
    cursor = PARENT_BY_UPPER.get(cursor);
  }
  return false;
}

// Flattened once at load: both the parsers' inner loop and every applicability
// check ask this per entity, so it has to be a single Map hit.
const NORMALIZABLE_BY_UPPER = new Map<string, boolean>();
for (const upper of PARENT_BY_UPPER.keys()) {
  NORMALIZABLE_BY_UPPER.set(upper, !isUnder(upper, IFC_UNPARSED_SUBTREE_ROOT));
}

/**
 * Whether a parse will ever produce something for this entity type.
 *
 * A type outside both schemas answers `true`: it may well be a real entity from
 * a newer schema, and `unrecognizedTypes` is what reports it. Only the geometry
 * subtree is a definite no.
 */
export function isNormalizableEntityType(typeName: string): boolean {
  return NORMALIZABLE_BY_UPPER.get(typeName.trim().toUpperCase()) ?? true;
}

/**
 * The branch of `IfcRoot` whose GlobalId both engines can read.
 *
 * `IfcRoot` gives a GlobalId to relationships and property sets as well, but
 * @ifc-lite/parser only indexes the attribute for object definitions — its
 * `getGlobalId` returns nothing for an IfcRelAggregates or an IfcPropertySet,
 * and on the columnar path the raw attributes are not there to re-read either.
 * web-ifc has all of them.
 *
 * So the boundary is drawn by the schema rather than by whichever engine is
 * loaded: everything here keeps its real GlobalId, everything else takes the
 * STEP line number in both engines. The same rule set has to reach the same
 * verdict on either parser, which matters more than the identity of a
 * relationship nobody reads.
 */
const GLOBAL_ID_SUBTREE_ROOT = "IFCOBJECTDEFINITION";

const CARRIES_GLOBAL_ID_BY_UPPER = new Map<string, boolean>();
for (const upper of PARENT_BY_UPPER.keys()) {
  CARRIES_GLOBAL_ID_BY_UPPER.set(upper, isUnder(upper, GLOBAL_ID_SUBTREE_ROOT));
}

/** Whether both engines can be relied on for this type's GlobalId. */
export function carriesReadableGlobalId(typeName: string): boolean {
  return CARRIES_GLOBAL_ID_BY_UPPER.get(typeName.trim().toUpperCase()) ?? false;
}
