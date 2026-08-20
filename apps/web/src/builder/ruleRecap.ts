import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ApplicabilityFacetDraft, FacetDraft, RuleDraft } from "@ifc-qa/ids-validator";
import { collapsibleEntityGroupsFor, plainNameOf } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { evaluateRuleDraft } from "./evaluateDraft.js";

export interface RuleRecap {
  /** The rule's applies-to types, folded into one collapsible group name where possible. */
  typeLabel: string;
  /** Elements the applies-to selection covers before narrowing — `source.total`. */
  typeCount: number;
  /** Plain English for the first applicability facet, with the current match count. `null` when
   *  the rule states none. */
  narrowing: string | null;
  /** How many more applicability facets exist beyond the one `narrowing` describes. */
  extraNarrowing: number;
  /** Plain English for the first condition. `null` when the rule states none yet. */
  requirement: string | null;
  /** How many more conditions exist beyond the one `requirement` describes. */
  extraRequirements: number;
}

function describeApplicability(facet: ApplicabilityFacetDraft): string | null {
  switch (facet.kind) {
    case "classification": {
      const system = plainNameOf(facet.system);
      if (system === null) return null;
      const value = plainNameOf(facet.value);
      return value ? `classified in ${system} as ${value}` : `classified in ${system}`;
    }
    case "material": {
      const value = plainNameOf(facet.value);
      return value ? `made of ${value}` : "made of a material";
    }
    case "partOf": {
      const entityName = plainNameOf(facet.entityName);
      return entityName ? `part of a whole classed ${entityName}` : "part of a whole";
    }
    case "property":
    case "attribute": {
      const name = plainNameOf(facet.name);
      return name ? `stating a ${name}` : null;
    }
  }
}

function describeCondition(facet: FacetDraft): string | null {
  switch (facet.kind) {
    case "property":
    case "attribute": {
      const name = plainNameOf(facet.name);
      if (name === null) return null;
      const propertySet = facet.kind === "property" ? plainNameOf(facet.propertySet) : null;
      const verb = facet.cardinality === "prohibited" ? "must not state" : "must state";
      return `${verb} a ${name}${propertySet ? ` in ${propertySet}` : ""}`;
    }
    case "classification": {
      const system = plainNameOf(facet.system);
      return system ? `must be classified in ${system}` : null;
    }
    case "material":
      return "must be made of a material";
    case "partOf":
      return "must be part of a whole";
    case "entity": {
      const name = plainNameOf(facet.name);
      return name ? `must be a ${name}` : null;
    }
  }
}

/**
 * The Review step's plain-English recap, e.g. "Every **Wall** (148 in multi-storey.ifc), classified
 * in Uniformat as B2010 (62 match), must state a Fire Rating in Pset_WallCommon." Composing
 * arbitrary N-facet English is out of scope — this summarizes the *first* applicability facet and
 * the *first* condition, and reports how many more there are, which is enough to recognize the
 * rule without attempting general natural-language generation.
 */
export function ruleRecap(
  draft: RuleDraft,
  source: FieldsForResult,
  elements: NormalizedElement[]
): RuleRecap {
  const groups = collapsibleEntityGroupsFor(draft.entityTypes);
  const singleGroup = groups.length === 1 && groups[0].types.length === draft.entityTypes.length ? groups[0] : null;
  const typeLabel =
    singleGroup?.name ??
    (draft.entityTypes.length === 1
      ? draft.entityTypes[0]
      : draft.entityTypes.length === 0
        ? "nothing yet"
        : `${draft.entityTypes.length} types`);

  const facets = draft.applicabilityFacets ?? [];
  const firstNarrowing = facets.length > 0 ? describeApplicability(facets[0]) : null;
  const { matched } = evaluateRuleDraft(draft, elements);

  const firstRequirement = draft.conditions.length > 0 ? describeCondition(draft.conditions[0]) : null;

  return {
    typeLabel,
    typeCount: source.total,
    narrowing: firstNarrowing ? `${firstNarrowing} (${matched} match)` : null,
    extraNarrowing: Math.max(facets.length - 1, 0),
    requirement: firstRequirement,
    extraRequirements: Math.max(draft.conditions.length - 1, 0),
  };
}
