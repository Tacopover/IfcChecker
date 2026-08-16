import type { ApplicabilityFacetDraft, ConditionDraft, FacetDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { dataTypeFromModel } from "./ConditionRow.js";
import { nextDraftId } from "./draftIds.js";

/**
 * What a facet of each kind says when it is first added.
 *
 * Every parameter `ids.xsd` makes mandatory is filled from the **selection**, not from a constant:
 * the first classification system the elements are classified in, the first class they are part of,
 * the first class they are. That is the rail's promise — everything offered comes from the user's
 * own file — applied to the moment the row appears rather than only to the lists behind it.
 *
 * A mandatory parameter the model cannot fill is left empty on purpose. `conditionProblem` then says
 * "Enter a value" beside the row and `exportBlockers` refuses the download, which is a visible
 * unfinished rule rather than an invented one.
 *
 * Every optional parameter starts absent, so a new facet states the least it can: a material with no
 * value asks whether the element is made of anything at all, which is the weakest true question of
 * that kind rather than a guess at which material was meant.
 */
// Narrowest first: overload resolution takes the first signature the call matches, so a caller
// naming only the two condition kinds gets the type the condition row is written against.
export function defaultFacetFor(
  kind: ConditionDraft["kind"],
  source: FieldsForResult,
  idPrefix?: string
): ConditionDraft;
export function defaultFacetFor(
  kind: ApplicabilityFacetDraft["kind"],
  source: FieldsForResult,
  idPrefix?: string
): ApplicabilityFacetDraft;
export function defaultFacetFor(
  kind: FacetDraft["kind"],
  source: FieldsForResult,
  idPrefix?: string
): FacetDraft;
export function defaultFacetFor(
  kind: FacetDraft["kind"],
  source: FieldsForResult,
  idPrefix = "c"
): FacetDraft {
  const id = nextDraftId(idPrefix);

  switch (kind) {
    case "property": {
      const set = source.propertySets[0];
      const name = set?.fields[0]?.name ?? "";
      return {
        id,
        kind,
        propertySet: set ? plainName(set.name) : null,
        name: plainName(name),
        value: null,
        cardinality: "required",
        dataType: dataTypeFromModel(source, set?.name ?? null, name),
      };
    }
    case "attribute":
      return {
        id,
        kind,
        propertySet: null,
        name: plainName(source.attributes[0]?.name ?? "Name"),
        value: null,
        cardinality: "required",
      };
    case "classification":
      return {
        id,
        kind,
        // A reference whose system the file leaves unnamed cannot be stated as one, so it is
        // skipped the same way the system select skips it.
        system: plainName(source.classifications.find((entry) => entry.system !== null)?.system ?? ""),
        value: null,
        cardinality: "required",
      };
    case "material":
      return { id, kind, value: null, cardinality: "required" };
    case "partOf":
      return {
        id,
        kind,
        relation: null,
        entityName: plainName(source.wholes[0]?.ifcType ?? ""),
        predefinedType: null,
        cardinality: "required",
      };
    case "entity":
      return {
        id,
        kind,
        // The file's own spelling, because a requirement entity name is matched exactly.
        name: plainName(source.ifcTypes[0]?.ifcType ?? ""),
        predefinedType: null,
      };
  }
}

/** The same, for the applicability side, which `ids.xsd` gives every kind but `entity`. */
export function defaultApplicabilityFacetFor(
  kind: ApplicabilityFacetDraft["kind"],
  source: FieldsForResult
): ApplicabilityFacetDraft {
  return defaultFacetFor(kind, source, "a");
}

/**
 * The one condition a brand-new rule starts with.
 *
 * A different decision from the two above: nobody picked a kind, so the rule points at whatever the
 * selection actually carries — a property where the model has property sets, an attribute where it
 * has none — and is never empty.
 */
export function defaultConditionFor(source: FieldsForResult): ConditionDraft {
  return defaultFacetFor(source.propertySets.length > 0 ? "property" : "attribute", source);
}

/** How each kind is named in the two add controls, in the order the corpus uses them. */
export const REQUIREMENT_KINDS: Array<{ id: FacetDraft["kind"]; label: string }> = [
  { id: "property", label: "Property" },
  { id: "attribute", label: "Attribute" },
  { id: "classification", label: "Classification" },
  { id: "material", label: "Material" },
  { id: "partOf", label: "Part of" },
  { id: "entity", label: "Entity" },
];

/** `entity` is absent: on that side it is the rule's own type chips. */
export const APPLICABILITY_KINDS = REQUIREMENT_KINDS.filter(
  (entry): entry is { id: ApplicabilityFacetDraft["kind"]; label: string } => entry.id !== "entity"
);
