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
  /**
   * Property data type, carried from an imported file. `undefined` means the builder authored this
   * condition and the default applies; `null` means the source deliberately omitted the attribute,
   * which must be re-emitted as an omission rather than as the default.
   */
  dataType?: string | null;
  /**
   * Whether the source wrote `cardinality` out. IDS defaults it to `required`, so this changes no
   * meaning — but a file the user only opened should come back out as it went in.
   */
  explicitCardinality?: boolean;
}

/** Source XML we cannot represent, re-emitted verbatim so importing a file never destroys it. */
export interface PassThrough {
  /** How many representable siblings precede it, so document order survives a round trip. */
  afterIndex: number;
  /** The construct in the source document's own vocabulary, e.g. `classification`. */
  construct: string;
  xml: string;
}

/**
 * What an imported specification said that the builder cannot show but must not lose. Absent on
 * rules authored here, where by construction there is nothing the builder cannot say.
 *
 * Attributes are carried as raw maps rather than named fields on purpose: naming them means
 * silently dropping the ones we did not think of, and real files carry `minOccurs` on
 * `<specification>` and `description` on `<requirements>` in places the schema barely advertises.
 */
export interface ImportedRuleSource {
  /** `<specification>` attributes except `name`, which the builder owns. Includes `ifcVersion`. */
  attributes: Record<string, string>;
  applicabilityAttributes: Record<string, string>;
  /** `null` when the source had no `<requirements>` element at all — an applicability-only rule. */
  requirementsAttributes: Record<string, string> | null;
  /** Requirement facets outside the builder's model, kept in their original slots. */
  passThrough: PassThrough[];
}

export interface RuleDraft {
  id: string;
  name: string;
  entityTypes: string[];
  conditions: ConditionDraft[];
  imported?: ImportedRuleSource;
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
    dataType: condition.dataType === undefined ? BUILDER_PROPERTY_DATA_TYPE : condition.dataType,
    restriction,
    cardinality,
  };
}

/**
 * In-memory equivalent of `parseIdsXml(buildIdsXml(rules))`, so the live preview never has to
 * serialise and re-parse per keystroke. The round-trip test keeps the two in step.
 *
 * Imported rules are the one place the two can differ: a passed-through facet is reported here
 * under the importer's own label, and `parseIdsXml` may describe the same XML differently — or,
 * for `cardinality="optional"`, check it as required rather than skip it. The requirements the
 * builder *can* show, and the applicability, match either way.
 */
export function compileDraft(rules: RuleDraft[]): ParsedSpecification[] {
  return rules.map((rule) => ({
    name: rule.name,
    applicabilityEntityNames: rule.entityTypes.map((entityType) => entityType.toUpperCase()),
    requirements: rule.conditions.map(compileCondition),
    // Authored rules can say nothing the builder cannot; imported ones carry what it could not read.
    unsupported: (rule.imported?.passThrough ?? []).map((entry) => ({
      section: "requirements" as const,
      construct: entry.construct,
      description: `Kept from the imported file but not shown here, so it is not checked.`,
    })),
    // Applicability we could not fully read is refused at import, never turned into a rule.
    applicabilityComplete: true,
  }));
}
