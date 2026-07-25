import type {
  FacetCardinality,
  ParsedRequirementFacet,
  ParsedRestriction,
  ParsedSpecification,
} from "./parse-ids.js";
import { patternRestriction } from "./parse-ids.js";

export type ConditionOperator =
  | "exists"
  | "equals"
  | "oneOf"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "notExists";

export interface ConditionDraft {
  id: string;
  kind: "attribute" | "property";
  propertySet: string | null; // required when kind === "property"
  name: string;
  operator: ConditionOperator;
  values: string[]; // used by oneOf
  text: string; // used by equals/contains/startsWith/endsWith/matches
}

export interface RuleDraft {
  id: string;
  name: string;
  entityTypes: string[];
  conditions: ConditionDraft[];
}

/** Every property facet we emit is a plain label; richer data types are out of scope for the builder. */
export const BUILDER_PROPERTY_DATA_TYPE = "IFCLABEL";

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cardinalityForCondition(condition: ConditionDraft): FacetCardinality {
  return condition.operator === "notExists" ? "prohibited" : "required";
}

export function restrictionForCondition(condition: ConditionDraft): ParsedRestriction | null {
  switch (condition.operator) {
    case "equals":
      return { kind: "exact", value: condition.text };
    case "oneOf":
      return { kind: "enum", values: [...condition.values] };
    // The user's text is literal here, so it must be escaped before it becomes a pattern —
    // otherwise "A.B" or "(" would over-match or produce an invalid expression.
    case "contains":
      return patternRestriction(`.*${escapeRegExp(condition.text)}.*`);
    case "startsWith":
      return patternRestriction(`${escapeRegExp(condition.text)}.*`);
    case "endsWith":
      return patternRestriction(`.*${escapeRegExp(condition.text)}`);
    case "matches":
      return patternRestriction(condition.text);
    default:
      return null;
  }
}

function compileCondition(condition: ConditionDraft): ParsedRequirementFacet {
  const restriction = restrictionForCondition(condition);
  const cardinality = cardinalityForCondition(condition);

  if (condition.kind === "attribute") {
    return { kind: "attribute", name: condition.name, restriction, cardinality };
  }

  return {
    kind: "property",
    propertySet: condition.propertySet ?? "",
    baseName: condition.name,
    dataType: BUILDER_PROPERTY_DATA_TYPE,
    restriction,
    cardinality,
  };
}

/**
 * In-memory equivalent of `parseIdsXml(buildIdsXml(rules))`, so the live preview never has to
 * serialise and re-parse per keystroke. The round-trip test keeps the two in step.
 */
export function compileDraft(rules: RuleDraft[]): ParsedSpecification[] {
  return rules.map((rule) => ({
    name: rule.name,
    applicabilityEntityNames: rule.entityTypes.map((entityType) => entityType.toUpperCase()),
    requirements: rule.conditions.map(compileCondition),
  }));
}
