import type {
  FacetCardinality,
  ParsedBound,
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

/**
 * The cardinalities `ids.xsd` gives an attribute or a property (`conditionalCardinality`).
 *
 * Separate from the value: IDS treats "must it be there" and "what may it say" as orthogonal, so a
 * facet can be `prohibited` *with* a value — "must not be Steel". The old `operator` field
 * conflated the two, which is why the importer had to pass those facets through.
 */
export type ConditionalCardinality = "required" | "optional" | "prohibited";

/** What `ids.xsd` gives `partOf` — `simpleCardinality`, which has no `optional`. */
export type SimpleCardinality = "required" | "prohibited";

/** One edge of a numeric range, holding the author's literal so `"1.50"` re-exports as written. */
export interface BoundDraft {
  value: string;
  inclusive: boolean;
}

/** The friendly operators that are a pattern underneath. */
export type AffixOperator = "contains" | "startsWith" | "endsWith";

/**
 * What a facet parameter may say — the draft form of `idsValue`.
 *
 * `affix` is the one variant with no counterpart in `ids.xsd`, and it is what keeps the friendly
 * operators a shortcut layer rather than the storage. "contains X" is a pattern once it reaches a
 * file, but it is *authored* as an operator and a literal, and storing it that way is what lets the
 * operator stay on screen while the box beside it is still empty. It compiles to a pattern and is
 * written to XML as nothing else.
 *
 * The compiled source is rebuilt from the literal rather than carried, which is safe because
 * `affixReadingOf` only reads a literal back out when re-escaping it reproduces the source exactly.
 *
 * `bounds` carries its own `base` because a range is the one value whose base is not a string, and
 * real files do not agree on which type it is: over the corpus, 63 ranges are written `xs:double`,
 * 4 `xs:integer`, and 6 with a capitalised spelling `xs:Decimal` or `xs:Integer` that no XSD type
 * has. Assuming `xs:double` would hand 8 authors back a file they did not write.
 */
export type ValueDraft =
  | { kind: "simple"; value: string }
  | { kind: "enum"; values: string[] }
  | { kind: "pattern"; source: string }
  | { kind: "affix"; operator: AffixOperator; literal: string }
  | { kind: "bounds"; base: string; min: BoundDraft | null; max: BoundDraft | null };

/**
 * What every facet in `<requirements>` carries. `instructions` is the only field `ids.xsd` gives
 * all six — everything else, including `cardinality` and `uri`, belongs to some of them and not
 * others, and the variants below state which.
 */
interface FacetDraftCommon {
  id: string;
  /**
   * The author's prose for whoever runs the check. It constrains nothing, so it never reaches the
   * compiled requirement; losing it would still be losing the sentence that says why the rule is
   * there.
   */
  instructions?: string | null;
  /**
   * Whether the source wrote `cardinality` out. IDS defaults it to `required`, so this changes no
   * meaning — but a file the user only opened should come back out as it went in.
   */
  explicitCardinality?: boolean;
}

export interface AttributeFacetDraft extends FacetDraftCommon {
  kind: "attribute";
  /** Always `null`. Present so the two editable kinds share one shape for the builder's rows. */
  propertySet: null;
  name: string;
  /** What the value must be, or `null` for no restriction at all — "whatever it says is fine". */
  value: ValueDraft | null;
  cardinality: ConditionalCardinality;
}

export interface PropertyFacetDraft extends FacetDraftCommon {
  kind: "property";
  propertySet: string | null;
  name: string;
  value: ValueDraft | null;
  cardinality: ConditionalCardinality;
  /**
   * The IFC data type the property must be stored as, e.g. `IFCTEXT`. `null` declares none, which
   * IDS reads as "do not check the stored type"; `undefined` means nothing was chosen and
   * `BUILDER_PROPERTY_DATA_TYPE` applies. An imported condition always states one of the first two,
   * so an omission in the source comes back out as an omission.
   */
  dataType?: string | null;
  /** A reference to whatever defines this requirement outside the file. */
  uri?: string | null;
}

/**
 * The IFC class the element must be.
 *
 * No cardinality: `ids.xsd` gives the requirements-side entity none, and says why in a comment —
 * the list of classes is finite and mandated by IFC, so a prohibited form would be superfluous.
 */
export interface EntityFacetDraft extends FacetDraftCommon {
  kind: "entity";
  name: ValueDraft;
  predefinedType: ValueDraft | null;
}

export interface ClassificationFacetDraft extends FacetDraftCommon {
  kind: "classification";
  /**
   * Required, unlike the parsed form's nullable `system`. `ids.xsd` makes `<system>` a mandatory
   * element whose content must be one `<simpleValue>` or one `<xs:restriction>`, so a draft that
   * could state none would export a document no conforming checker reads.
   */
  system: ValueDraft;
  value: ValueDraft | null;
  uri?: string | null;
  cardinality: ConditionalCardinality;
}

export interface MaterialFacetDraft extends FacetDraftCommon {
  kind: "material";
  /** `null` asks only whether the element has a material at all. */
  value: ValueDraft | null;
  uri?: string | null;
  cardinality: ConditionalCardinality;
}

/**
 * A whole the element must be a part of.
 *
 * `relation` holds the source attribute verbatim rather than a split list, because one member of
 * the schema's enumeration is two relationship names in a single value —
 * `"IFCRELVOIDSELEMENT IFCRELFILLSELEMENT"`. Splitting on storage would leave the exporter guessing
 * how to join them back. `compileFacet` splits; `build-ids` writes what the author wrote.
 */
export interface PartOfFacetDraft extends FacetDraftCommon {
  kind: "partOf";
  relation: string | null;
  entityName: ValueDraft;
  predefinedType: ValueDraft | null;
  /** `ids.xsd` gives partOf `simpleCardinality` — two values, not the conditional three. */
  cardinality: SimpleCardinality;
}

/** Every facet `ids.xsd` allows in `<requirements>`. */
export type FacetDraft =
  | AttributeFacetDraft
  | PropertyFacetDraft
  | EntityFacetDraft
  | ClassificationFacetDraft
  | MaterialFacetDraft
  | PartOfFacetDraft;

/**
 * The two facets the builder's rows can edit, and the two the importer produces.
 *
 * A separate name rather than a comment, because it is what the whole authoring UI is typed
 * against: a row shows a field and an operator, and neither exists on a material or a partOf.
 */
export type ConditionDraft = AttributeFacetDraft | PropertyFacetDraft;

/** Whether this facet is one of the two a condition row can show. */
export function isConditionFacet(facet: FacetDraft): facet is ConditionDraft {
  return facet.kind === "attribute" || facet.kind === "property";
}

/** Source XML we cannot represent, re-emitted verbatim so importing a file never destroys it. */
export interface PassThrough {
  /** How many representable siblings precede it, so document order survives a round trip. */
  afterIndex: number;
  /** The construct in the source document's own vocabulary, e.g. `classification`. */
  construct: string;
  /**
   * Why the builder could not show it, one specific sentence. Absent on a whole specification
   * kept verbatim, where the reasons are carried per construct on `RefusedSpecification`.
   *
   * The tag name alone tells the user a facet was kept; it does not tell them the rule in front of
   * them checks less than it looks like it does.
   */
  reason?: string;
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
  /**
   * Every facet the rule requires, in document order.
   *
   * Widened to all six ahead of the importer, which still keeps the other four verbatim. What that
   * buys is that `compileFacet` and `build-ids` are already total over them: when the importer
   * starts reading a `<material>`, nothing downstream has to be taught what one is.
   */
  conditions: FacetDraft[];
  imported?: ImportedRuleSource;
}

/**
 * The data type a property facet declares when the builder has none to state.
 *
 * `null` means the `dataType` attribute is omitted, which IDS reads as "do not check the stored
 * type". Declaring one the model does not hold fails every element, and the builder used to
 * declare `IFCLABEL` on everything it wrote: on the reference 37 MB model, whose NL/SfB codes are
 * stored as `IFCTEXT`, that turned 668 passing elements into 757 failing ones. A type is only
 * honest when it comes from the file, so the builder states one only where the model reports it.
 */
export const BUILDER_PROPERTY_DATA_TYPE: string | null = null;

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

const ANY = ".*";

/** The regex an affix operator stands for. The literal is escaped, so "A.B" cannot over-match. */
export function affixPatternSource(operator: AffixOperator, literal: string): string {
  const escaped = escapeRegExp(literal);
  if (operator === "contains") return `${ANY}${escaped}${ANY}`;
  if (operator === "startsWith") return `${escaped}${ANY}`;
  return `${ANY}${escaped}`;
}

/** The literal `escapeRegExp` was given, or `null` when the body is not an escaped literal. */
function unescapeRegExp(body: string): string | null {
  const literal = body.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
  return escapeRegExp(literal) === body ? literal : null;
}

/**
 * The affix operator a pattern was written as, or `null` when it was not written as one.
 *
 * Only claims a source that `affixPatternSource` would reproduce character for character, so
 * reading a file and writing it back cannot change the author's regex. Anything else stays a
 * pattern, which is stored verbatim.
 */
export function affixReadingOf(
  source: string
): { operator: AffixOperator; literal: string } | null {
  const attempts: [AffixOperator, string][] = [
    ["contains", source.startsWith(ANY) && source.endsWith(ANY) ? source.slice(2, -2) : ""],
    ["startsWith", source.endsWith(ANY) ? source.slice(0, -2) : ""],
    ["endsWith", source.startsWith(ANY) ? source.slice(2) : ""],
  ];

  for (const [operator, body] of attempts) {
    if (body === "") continue;
    const literal = unescapeRegExp(body);
    if (literal !== null) return { operator, literal };
  }
  return null;
}

/** A pattern read from a file, as the operator it was written as where that is what it says. */
export function patternValueDraft(source: string): ValueDraft {
  const affix = affixReadingOf(source);
  return affix ? { kind: "affix", ...affix } : { kind: "pattern", source };
}

/**
 * A bound the validator can compare, or `null` for an edge it cannot.
 *
 * A non-numeric edge is dropped rather than becoming `NaN`, which answers `false` to every
 * comparison and would reject silently. `parseRestriction` applies the same rule to a file.
 */
function compileBound(bound: BoundDraft | null): ParsedBound | null {
  if (bound === null) return null;
  const value = Number(bound.value);
  if (bound.value.trim() === "" || !Number.isFinite(value)) return null;
  return { value, inclusive: bound.inclusive };
}

/** What the validator checks this value against. Total: every `ValueDraft` compiles. */
export function compileValue(value: ValueDraft): ParsedRestriction;
export function compileValue(value: ValueDraft | null): ParsedRestriction | null;
export function compileValue(value: ValueDraft | null): ParsedRestriction | null {
  if (value === null) return null;
  switch (value.kind) {
    case "simple":
      return { kind: "exact", value: value.value };
    case "enum":
      return { kind: "enum", values: [...value.values] };
    case "pattern":
      return patternRestriction(value.source);
    case "affix":
      return patternRestriction(affixPatternSource(value.operator, value.literal));
    case "bounds": {
      const min = compileBound(value.min);
      const max = compileBound(value.max);
      return { kind: "bounds", min, max };
    }
  }
}

/** How a condition reads as one of the eight friendly operators, with the text or values it needs. */
export interface FriendlyReading {
  operator: ConditionOperator;
  /** The literal in the text box. Empty for operators that need none. */
  text: string;
  /** The ticked values. Empty for operators that need none. */
  values: string[];
}

/**
 * The friendly reading of a condition, or `null` when no operator states what it says.
 *
 * `null` is not a fault — it is the honest answer for the things the eight operators cannot
 * express: a numeric range, an optional facet, and a prohibited value ("must not be Steel", which
 * `notExists` would widen into "must not be present at all"). The row shows those rather than
 * mislabelling them.
 */
export function friendlyReadingOf(condition: ConditionDraft): FriendlyReading | null {
  const none = { text: "", values: [] };

  if (condition.cardinality === "prohibited") {
    return condition.value === null ? { operator: "notExists", ...none } : null;
  }
  if (condition.cardinality === "optional") return null;
  if (condition.value === null) return { operator: "exists", ...none };

  switch (condition.value.kind) {
    case "simple":
      return { operator: "equals", text: condition.value.value, values: [] };
    case "enum":
      return { operator: "oneOf", text: "", values: [...condition.value.values] };
    case "affix":
      return { operator: condition.value.operator, text: condition.value.literal, values: [] };
    case "pattern":
      return { operator: "matches", text: condition.value.source, values: [] };
    case "bounds":
      return null;
  }
}

/** The value an operator states, given whatever text and ticked values the row is holding. */
export function valueDraftForOperator(
  operator: ConditionOperator,
  text: string,
  values: string[]
): ValueDraft | null {
  switch (operator) {
    case "exists":
    case "notExists":
      return null;
    case "equals":
      return { kind: "simple", value: text };
    case "oneOf":
      return { kind: "enum", values: [...values] };
    case "matches":
      return { kind: "pattern", source: text };
    default:
      return { kind: "affix", operator, literal: text };
  }
}

export function cardinalityForOperator(operator: ConditionOperator): ConditionalCardinality {
  return operator === "notExists" ? "prohibited" : "required";
}

/**
 * What the validator checks a facet against. Total over all six kinds, and it throws nothing.
 *
 * Nothing about *how the file was written* survives the crossing: `explicitCardinality`, the
 * author's literal `"1.50"`, the base a range was written with, the prose in `instructions`. The
 * draft carries those so the exporter can hand the file back; the validator has no use for them,
 * and a compile that let them through would be the draft model leaking into the engine.
 */
export function compileFacet(facet: FacetDraft): ParsedRequirementFacet {
  switch (facet.kind) {
    case "attribute":
      return {
        kind: "attribute",
        name: facet.name,
        restriction: compileValue(facet.value),
        cardinality: facet.cardinality satisfies FacetCardinality,
      };
    case "property":
      return {
        kind: "property",
        propertySet: facet.propertySet ?? "",
        baseName: facet.name,
        dataType: facet.dataType === undefined ? BUILDER_PROPERTY_DATA_TYPE : facet.dataType,
        restriction: compileValue(facet.value),
        cardinality: facet.cardinality,
      };
    case "entity":
      return {
        kind: "entity",
        name: compileValue(facet.name),
        predefinedType: compileValue(facet.predefinedType),
      };
    case "classification":
      return {
        kind: "classification",
        system: compileValue(facet.system),
        value: compileValue(facet.value),
        cardinality: facet.cardinality,
      };
    case "material":
      return {
        kind: "material",
        value: compileValue(facet.value),
        cardinality: facet.cardinality,
      };
    case "partOf":
      return {
        kind: "partOf",
        // An absent attribute accepts any relationship, which is not the same as an empty list of
        // accepted ones — `parseIdsXml` reads it the same way, and both mean "any" as `[]`.
        relations: facet.relation === null ? [] : facet.relation.trim().split(/\s+/).filter(Boolean),
        entityName: compileValue(facet.entityName),
        predefinedType: compileValue(facet.predefinedType),
        cardinality: facet.cardinality,
      };
  }
}

/**
 * In-memory equivalent of `parseIdsXml(buildIdsXml(rules))`, so the live preview never has to
 * serialise and re-parse per keystroke. The round-trip test keeps the two in step.
 *
 * Imported rules are the one place the two can differ: a passed-through facet is reported here
 * under the importer's own label, and `parseIdsXml` may describe the same XML differently.
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
    requirements: rule.conditions.map(compileFacet),
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
