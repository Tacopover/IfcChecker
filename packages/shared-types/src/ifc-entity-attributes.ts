import {
  IFC_INTEGER_ATTRIBUTE_NAMES,
  IFC_SIMPLE_ATTRIBUTE_NAMES,
} from "./ifc-entity-table.generated.js";

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

/**
 * Whether the schema types this attribute as a whole number.
 *
 * Both parsers hand back `NumberOfRisers` and `RefractionIndex` as the JS number 42, and IDS says
 * a specification writing "42.0" matches the second but not the first — an integer written with a
 * decimal is not an integer. Nothing but the schema separates them.
 *
 * Matched case-insensitively on the attribute name, the same leniency
 * `readAttributeValue` applies, because hand-written IDS files are inconsistent about casing.
 */
export function isIntegerAttribute(typeName: string, attributeName: string): boolean {
  const names = IFC_INTEGER_ATTRIBUTE_NAMES[typeName.trim().toUpperCase()];
  if (names === undefined) return false;
  const wanted = attributeName.trim().toUpperCase();
  return names.some((name) => name.toUpperCase() === wanted);
}
