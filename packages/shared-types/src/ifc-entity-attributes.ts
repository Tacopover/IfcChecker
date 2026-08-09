import { IFC_SIMPLE_ATTRIBUTE_NAMES } from "./ifc-entity-table.generated.js";

const NONE: readonly string[] = [];

/**
 * The attributes of this entity type that hold a value a rule can be compared
 * against, rather than a reference to another entity or an aggregate of them.
 *
 * Both parsers hand a reference back as a bare number, indistinguishable from a
 * real numeric attribute, so the schema has to draw this line — otherwise a
 * rule checking `HasProperties` would compare against an express id and a rule
 * checking an object-valued attribute could pass on a coincidence.
 *
 * `GlobalId`, `Name` and `PredefinedType` are not here: they have their own
 * fields on `NormalizedElement`, and `readAttributeValue` reads those first.
 *
 * An unknown type answers with an empty list. That is not a silent drop —
 * `unrecognizedTypes` reports the type itself.
 */
export function simpleAttributeNamesFor(typeName: string): readonly string[] {
  return IFC_SIMPLE_ATTRIBUTE_NAMES[typeName.trim().toUpperCase()] ?? NONE;
}
