import type {
  FacetCardinality,
  ParsedRequirementFacet,
  ParsedRestriction,
  ParsedSpecification,
} from "./parse-ids.js";
import { patternRestriction, specificationCardinalityOf } from "./parse-ids.js";
import { concreteTypeNamesFor } from "./ifc-type-hierarchy.js";

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
 * silently dropping the ones we did not think of, and real files carry `identifier` and
 * `instructions` on `<specification>`, `minOccurs` on `<applicability>` and `description` on
 * `<requirements>` in places the schema barely advertises. Carried verbatim also means carried
 * when the source was wrong: an attribute `ids.xsd` does not allow goes back out as it came in.
 */
export interface ImportedRuleSource {
  /** `<specification>` attributes except `name`, which the builder owns. Includes `ifcVersion`. */
  attributes: Record<string, string>;
  /**
   * Whether the source listed its entity types as an `xs:enumeration` rather than a single
   * `<simpleValue>`. Only tells the two forms apart for a one-type rule, where both are legal and
   * mean the same thing — but rewriting one as the other is still editing the author's document.
   */
  entityNamesAsEnumeration: boolean;
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

/**
 * The entity names a rule's applicability facet states.
 *
 * IDS matches an entity name exactly and inherits nothing, so a rule the builder authors is
 * expanded: the user picks `IfcElement` from the explorer rail and the file names all 137 concrete
 * classes below it. Without that, an abstract pick selects nothing and a supertype pick quietly
 * checks less than the tree it was chosen from shows.
 *
 * Expansion is for authored rules only. An imported rule keeps the author's own list, because
 * rewriting someone else's document is the thing the import work exists not to do — and because a
 * file that names an abstract class is honestly reported as selecting nothing, which is what any
 * other conforming checker does with it.
 */
export function applicabilityEntityNamesOf(rule: RuleDraft): string[] {
  const names = rule.imported
    ? rule.entityTypes.map((entityType) => entityType.trim().toUpperCase())
    : rule.entityTypes.flatMap(concreteTypeNamesFor);
  return [...new Set(names)];
}

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
    // Authored rules are written minOccurs="1"; imported ones keep their source's occurs
    // attributes, so both read back the same way parseIdsXml would read the built XML.
    cardinality: specificationCardinalityOf(
      rule.imported?.applicabilityAttributes.minOccurs,
      rule.imported?.applicabilityAttributes.maxOccurs
    ),
    applicabilityEntityNames: applicabilityEntityNamesOf(rule),
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
