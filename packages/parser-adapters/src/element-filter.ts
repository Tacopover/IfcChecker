import {
  IFC_ENTITY_PARENTS,
  IFC_RECOGNISED_ENTITY_NAMES,
  isNormalizableEntityType,
} from "@ifc-qa/shared-types";

/**
 * What a parser should do with an entity type it found in a file.
 *
 * - `element` — a thing a reviewer checks. Goes in the element list the
 *   Validate page and the explorer rail are built around.
 * - `auxiliary` — normalized too, but kept out of that list: type objects,
 *   relationships, the spatial backbone, materials, actors, presentation
 *   resources. An IDS applicability may name any of these, and a rule whose
 *   target never became an element used to report the model clean.
 * - `ignored` — geometry, and only geometry. See `IFC_UNPARSED_SUBTREE_ROOT`
 *   for why that one subtree pays for itself and nothing else does.
 * - `unrecognized` — a type no schema this build carries declares. It may well
 *   be a real element from a newer schema or a vendor extension, so it must be
 *   reported rather than silently dropped: a hand-written allowlist swallowed
 *   most of an MEP model for months precisely because nothing said so.
 */
export type EntityTypeVerdict = "element" | "auxiliary" | "ignored" | "unrecognized";

// STEP files spell type names in upper case; the schema table is PascalCase.
const PARENT_BY_UPPER = new Map<string, string | null>();
for (const [name, parent] of Object.entries(IFC_ENTITY_PARENTS)) {
  PARENT_BY_UPPER.set(name.toUpperCase(), parent === null ? null : parent.toUpperCase());
}

const RECOGNIZED = new Set(IFC_RECOGNISED_ENTITY_NAMES);

// Everything with a physical presence a rule can be written against. Spaces and
// spatial zones are in because a room is a thing users check; they are not
// IfcElement subtypes, so they need naming.
const KEPT_ROOTS = ["IFCELEMENT", "IFCSPACE", "IFCSPATIALZONE"];

// Openings, voids and projections are modifiers of other elements' geometry,
// not elements in their own right — and they sit *under* IfcElement, so
// keeping them out of the reviewer's list takes an explicit rule.
const AUXILIARY_SUBTREES = ["IFCFEATUREELEMENT"];

// None of these are under a kept root today, so this list is belt-and-braces:
// it pins the decision in one readable place and survives a schema that
// re-parents something. IfcProject/Site/Building/BuildingStorey already drive
// the separate model-structure tree; ports are connection points, not parts.
const AUXILIARY_TYPES = new Set([
  "IFCANNOTATION",
  "IFCGRID",
  "IFCPORT",
  "IFCDISTRIBUTIONPORT",
  "IFCPROJECT",
  "IFCSITE",
  "IFCBUILDING",
  "IFCBUILDINGSTOREY",
]);

function isUnder(upper: string, rootUpper: string): boolean {
  let cursor: string | null | undefined = upper;
  while (cursor) {
    if (cursor === rootUpper) return true;
    cursor = PARENT_BY_UPPER.get(cursor);
  }
  return false;
}

function decide(upper: string): EntityTypeVerdict {
  if (!PARENT_BY_UPPER.has(upper)) return RECOGNIZED.has(upper) ? "ignored" : "unrecognized";
  if (!isNormalizableEntityType(upper)) return "ignored";
  if (AUXILIARY_TYPES.has(upper)) return "auxiliary";
  if (AUXILIARY_SUBTREES.some((root) => isUnder(upper, root))) return "auxiliary";
  return KEPT_ROOTS.some((root) => isUnder(upper, root)) ? "element" : "auxiliary";
}

// Both schemas together are ~1050 names, so classifying them once at load keeps
// the parsers' inner loop a single Map hit no matter how large the file.
const VERDICT_BY_UPPER = new Map<string, EntityTypeVerdict>();
for (const upper of PARENT_BY_UPPER.keys()) VERDICT_BY_UPPER.set(upper, decide(upper));

export function classifyEntityType(typeName: string): EntityTypeVerdict {
  const upper = typeName.trim().toUpperCase();
  return VERDICT_BY_UPPER.get(upper) ?? (RECOGNIZED.has(upper) ? "ignored" : "unrecognized");
}

export function isPhysicalElementType(typeName: string): boolean {
  return classifyEntityType(typeName) === "element";
}

/**
 * One line per parse naming the types that were dropped without being
 * understood. `console.warn`, not `console.error`: it is a gap in this build's
 * schema tables, not a failure of the parse — but it must be audible somewhere,
 * because a silent version of exactly this went unnoticed for months.
 */
export function warnAboutUnrecognizedTypes(unrecognized: ReadonlyArray<{ ifcType: string; count: number }>): void {
  if (unrecognized.length === 0) return;
  const listed = unrecognized.map((entry) => `${entry.ifcType} (${entry.count})`).join(", ");
  console.warn(
    `[parser-adapters] ${unrecognized.length} entity type(s) in this file are not in the IFC4/IFC2X3 schema tables and were skipped: ${listed}`
  );
}

/** Every type name this build would keep, upper-case. Exported for tests and diagnostics. */
export const PHYSICAL_ELEMENT_TYPE_NAMES: ReadonlySet<string> = new Set(
  [...VERDICT_BY_UPPER].filter(([, verdict]) => verdict === "element").map(([upper]) => upper)
);
