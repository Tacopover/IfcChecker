import { XMLParser } from "fast-xml-parser";
import { isNormalizableEntityType } from "@ifc-qa/shared-types";

/** One edge of a numeric range. `inclusive` separates `minInclusive` from `minExclusive`. */
export interface ParsedBound {
  value: number;
  inclusive: boolean;
}

/**
 * How many characters a value may hold. `exact` is `xs:length`, which XSD lets an author state
 * beside `xs:minLength` and `xs:maxLength`, so all three edges are kept rather than folded into one.
 */
export interface ParsedLength {
  exact: number | null;
  min: number | null;
  max: number | null;
}

export type ParsedRestriction =
  | { kind: "exact"; value: string }
  | { kind: "enum"; values: string[] }
  | { kind: "pattern"; source: string; regex: RegExp }
  | { kind: "bounds"; min: ParsedBound | null; max: ParsedBound | null }
  | ({ kind: "length" } & ParsedLength);

export type FacetCardinality = "required" | "optional" | "prohibited";

/**
 * An attribute the element must carry.
 *
 * `name` is a restriction rather than a plain name because `ids.xsd` types it as an `idsValue`, so
 * a facet may name the attributes it is about with an `xs:pattern` or an `xs:enumeration`. A facet
 * naming several is one requirement over all of them, not several requirements.
 */
export interface ParsedAttributeFacet {
  kind: "attribute";
  name: ParsedRestriction;
  restriction: ParsedRestriction | null;
  cardinality: FacetCardinality;
}

/**
 * A property the element must carry, in a property set it must have.
 *
 * Both names are restrictions, for the same reason an attribute's is: `ids.xsd` types
 * `<propertySet>` and `<baseName>` as `idsValue`, and the conformance suite writes each of them as
 * a pattern. Two independent restrictions rather than one, because a facet may pattern-match the
 * set and name the property exactly, or the other way round.
 */
export interface ParsedPropertyFacet {
  kind: "property";
  propertySet: ParsedRestriction;
  baseName: ParsedRestriction;
  dataType: string | null;
  restriction: ParsedRestriction | null;
  cardinality: FacetCardinality;
}

/**
 * A classification the element must carry.
 *
 * Both parameters are restrictions rather than plain names, because IDS lets an author constrain
 * either — `system` by a pattern is how the conformance suite writes "any system at all". Both are
 * nullable: `value` is optional in the schema, and a `<system>` written without a `<simpleValue>`
 * states no system, which makes the facet a check that the element is classified at all.
 */
export interface ParsedClassificationFacet {
  kind: "classification";
  system: ParsedRestriction | null;
  value: ParsedRestriction | null;
  cardinality: FacetCardinality;
}

/**
 * A material the element must be made of.
 *
 * One parameter, and it is optional: a `<material>` stating no value asks only whether the element
 * has a material at all.
 */
export interface ParsedMaterialFacet {
  kind: "material";
  value: ParsedRestriction | null;
  cardinality: FacetCardinality;
}

/**
 * A whole the element must be a part of.
 *
 * `relations` is the set of IFC relationship names the facet accepts, empty meaning any of them.
 * It is a set rather than a single name because `ids.xsd` gives the `relations` enumeration a
 * member that is itself two names separated by a space —
 * `"IFCRELVOIDSELEMENT IFCRELFILLSELEMENT"` — one value meaning either.
 *
 * The nested `<entity>` is matched by name and optionally by predefined type, both as restrictions
 * because the suite writes an "any whole at all" check as a `.*` pattern on the name.
 */
export interface ParsedPartOfFacet {
  kind: "partOf";
  relations: string[];
  entityName: ParsedRestriction | null;
  predefinedType: ParsedRestriction | null;
  cardinality: FacetCardinality;
}

/**
 * The IFC class the element must be, and optionally the predefined type it must carry.
 *
 * Both parameters are restrictions rather than plain names: the suite writes an entity name as a
 * `<simpleValue>`, as an `xs:enumeration` and as an `xs:pattern`, and does the same for the
 * predefined type. That is the one place a requirement differs from an applicability, which must
 * be able to *list* the classes it selects and so refuses a pattern.
 *
 * There is no cardinality here. `ids.xsd` gives `entityType` none, because "this element must be
 * one of these classes" is not a statement that can be waived or forbidden.
 */
export interface ParsedEntityFacet {
  kind: "entity";
  name: ParsedRestriction;
  predefinedType: ParsedRestriction | null;
}

export type ParsedRequirementFacet =
  | ParsedAttributeFacet
  | ParsedPropertyFacet
  | ParsedClassificationFacet
  | ParsedMaterialFacet
  | ParsedPartOfFacet
  | ParsedEntityFacet;

/**
 * A facet standing in an `<applicability>`, which narrows the elements the rule is about.
 *
 * The same five shapes a requirement holds, minus `entity` — that one is `ParsedApplicability`'s
 * name list, because it is the only facet whose selection can be enumerated rather than tested.
 *
 * Their `cardinality` is always `required`, and that is not a default this parser chose.
 * `applicabilityType` references `attributeType`, `propertyType`, `classificationType`,
 * `materialType` and `partOfType` directly; it is `requirementsType` that extends each of them with
 * a `cardinality` attribute. A facet stating one inside an applicability is a document `ids.xsd`
 * does not describe.
 */
export type ParsedApplicabilityFacet =
  | ParsedAttributeFacet
  | ParsedPropertyFacet
  | ParsedClassificationFacet
  | ParsedMaterialFacet
  | ParsedPartOfFacet;

/**
 * Which elements a specification is about.
 *
 * A predicate rather than a list, because `ids.xsd` makes `<entity>` `minOccurs="0"`: an
 * applicability may hold nothing but a `<property>`, and then there is no set of class names to
 * start from — the rule reaches every entity in scope that carries the property. `entityNames` is
 * `null` for exactly that case, and distinguishing it from an `<entity>` that lists nothing is what
 * keeps "selects everything with this property" apart from "selects nothing".
 *
 * The name list stays a field rather than being derived back out of the facets: it is what the
 * builder's type chips, the explorer rail and the exporter all read, and only the enumerable value
 * shapes could ever be recovered from a predicate.
 *
 * Every facet must hold, together with the name list. IDS states no `or` anywhere.
 */
export interface ParsedApplicability {
  entityNames: string[] | null;
  /**
   * The `<entity><predefinedType>` the applicability states, or `null` when it states none.
   *
   * A field of its own rather than a facet, for the reason `entityNames` is one: it belongs to the
   * `<entity>`, which is the only facet whose selection the builder enumerates rather than tests.
   * It narrows that list rather than standing beside it, so an applicability naming no class and a
   * predefined type is a document `ids.xsd` does not describe.
   */
  entityPredefinedType: ParsedRestriction | null;
  facets: ParsedApplicabilityFacet[];
}

/** Something the source document asked for that this parser cannot represent. */
export interface UnsupportedConstruct {
  section: "applicability" | "requirements";
  /** The construct in the source document's own vocabulary, e.g. `classification`. */
  construct: string;
  /** What it costs, phrased for whoever has to decide whether the result is still usable. */
  description: string;
}

/**
 * How many elements a specification's applicability is allowed to select.
 *
 * `<applicability minOccurs maxOccurs>`, and `ids.xsd` inherits XML Schema's
 * `occurs` group, where **`minOccurs` defaults to 1**. So the plain
 * `<applicability maxOccurs="unbounded">` every rule in the wild is written
 * with is *required*: a model in which nothing matches fails the specification.
 * That is the opposite of what an empty violation list looks like.
 *
 * - `required` — at least one element must match (the default).
 * - `optional` — `minOccurs="0"`; nothing needs to match, matches are checked.
 * - `prohibited` — `minOccurs="0" maxOccurs="0"`; nothing may match, and the
 *   specification carries no requirements. One that does is invalid.
 */
export type SpecificationCardinality = "required" | "optional" | "prohibited";

export interface ParsedSpecification {
  name: string;
  cardinality: SpecificationCardinality;
  applicability: ParsedApplicability;
  requirements: ParsedRequirementFacet[];
  /** Reported rather than logged, so a caller can show the user what was dropped. */
  unsupported: UnsupportedConstruct[];
  /** True when nothing deciding *which* elements are selected was dropped. */
  applicabilityComplete: boolean;
  /** `<specification identifier>`, `ids.xsd`'s free-form machine-readable attribute. See `orGroupIdOf`. */
  identifier: string | null;
}

/**
 * Prefix that marks a `<specification identifier>` value as this tool's own OR-group link,
 * rather than a third party's own machine identifier. `ids.xsd` documents `identifier` as
 * free-form and not guaranteed unique, so a value is only ever read as a group key when it
 * carries this exact prefix — every other identifier, including a plain one this tool wrote
 * before this feature existed, is left alone.
 */
export const OR_GROUP_IDENTIFIER_PREFIX = "ifcqa:or:";

/**
 * The OR-group id an `identifier` states, or `null` when it does not state one.
 *
 * Two or more specifications that return the same id here are meant to be read as one rule
 * that passes an element if any member does — see `validateBySpecificationGrouped`. A group
 * of one (the id's only remaining member, after the others were deleted) is not an error: it
 * is read as an ordinary, ungrouped specification.
 */
export function orGroupIdOf(identifier: string | null | undefined): string | null {
  if (!identifier || !identifier.startsWith(OR_GROUP_IDENTIFIER_PREFIX)) return null;
  const id = identifier.slice(OR_GROUP_IDENTIFIER_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

/**
 * Whether the specification can be judged against a model at all.
 *
 * An applicability we only partly understood selects a different set of elements than the source
 * asked for, and `matchesApplicability` over an empty name list matches *nothing* — so running one
 * anyway produces zero violations and reports a clean model for a rule that was never applied.
 * Callers must report these instead of evaluating them.
 *
 * The same trap sits on the requirements side: a specification whose every requirement we had to
 * drop still selects elements, finds nothing wrong with them, and passes. "All pass" would be a
 * verdict on nothing that was checked, so it is refused too.
 *
 * An applicability stating nothing at all — no `<entity>` and no facet — is refused rather than
 * read as "every element in the model". `ids.xsd` allows the shape, and a whole-model rule may well
 * be what its author meant, but nothing in the corpus or the conformance suite writes one, so
 * running it would be acting on a guess about an empty element.
 */
export function isEvaluable(specification: ParsedSpecification): boolean {
  if (!specification.applicabilityComplete) return false;
  const { entityNames, facets } = specification.applicability;
  if (entityNames !== null && entityNames.length === 0) return false;
  if (entityNames === null && facets.length === 0) return false;
  if (specification.requirements.length > 0) return true;
  return !specification.unsupported.some((entry) => entry.section === "requirements");
}

// Ordered mode is what lets requirements keep their document order: an <attribute> written after a
// <property> parses back into the same slot, which is what the build/compile round-trip relies on.
interface OrderedNode {
  [key: string]: unknown;
}

const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // Off, matching import-ids.ts and ids-schema-shape.ts. On, fast-xml-parser
  // coerced <simpleValue>42.0</simpleValue> to the number 42, and the author's
  // literal was gone by the time anything compared it — so a rule saying an
  // integer attribute must equal "42.0" passed against a stored 42, which IDS
  // says is exactly what must not happen.
  parseTagValue: false,
  preserveOrder: true,
});

/** A pattern a user typed can be invalid; it must fail every element rather than crash the parse. */
const NEVER_MATCHES = /(?!)/;

export function compilePattern(source: string): RegExp {
  try {
    return new RegExp(`^(?:${source})$`);
  } catch {
    return NEVER_MATCHES;
  }
}

export function patternRestriction(source: string): ParsedRestriction {
  return { kind: "pattern", source, regex: compilePattern(source) };
}

function tagOf(node: OrderedNode): string | null {
  for (const key of Object.keys(node)) {
    if (key !== ATTRIBUTES_KEY) return key;
  }
  return null;
}

function childrenOf(node: OrderedNode, tag: string): OrderedNode[] {
  const value = node[tag];
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
}

function attributesOf(node: OrderedNode): Record<string, string> {
  const raw = node[ATTRIBUTES_KEY];
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, string>;
}

function nodesNamed(nodes: OrderedNode[], tag: string): OrderedNode[] {
  return nodes.filter((node) => tagOf(node) === tag);
}

/** Element tags in document order, with whitespace text nodes left out. */
function tagsOf(nodes: OrderedNode[]): string[] {
  return nodes
    .map(tagOf)
    .filter((tag): tag is string => tag !== null && tag !== TEXT_KEY);
}

/** Children of the first `<tag>` among `nodes`, or `[]` when there is none. */
function descend(nodes: OrderedNode[], tag: string): OrderedNode[] {
  const node = nodes.find((candidate) => tagOf(candidate) === tag);
  return node ? childrenOf(node, tag) : [];
}

function textOf(nodes: OrderedNode[]): string {
  for (const node of nodes) {
    if (TEXT_KEY in node) return String(node[TEXT_KEY]);
  }
  return "";
}

/** `null` when the `<simpleValue>` element is absent; `""` when it is present but empty. */
function readSimpleValue(nodes: OrderedNode[]): string | null {
  const node = nodes.find((candidate) => tagOf(candidate) === "simpleValue");
  return node ? textOf(childrenOf(node, "simpleValue")) : null;
}

function readCardinality(node: OrderedNode): FacetCardinality {
  const cardinality = attributesOf(node)["@_cardinality"];
  if (cardinality === "prohibited") return "prohibited";
  if (cardinality === "optional") return "optional";
  return "required";
}

/** The XSD facets a `ParsedRestriction` can carry; `annotation` is prose we can lose safely. */
const RESTRICTION_FACETS_READ = [
  "pattern",
  "enumeration",
  "annotation",
  "minInclusive",
  "maxInclusive",
  "minExclusive",
  "maxExclusive",
  "length",
  "minLength",
  "maxLength",
];

/** The four bound facets, paired with the edge each one sets. */
const BOUND_FACETS = [
  { tag: "minInclusive", edge: "min", inclusive: true },
  { tag: "minExclusive", edge: "min", inclusive: false },
  { tag: "maxInclusive", edge: "max", inclusive: true },
  { tag: "maxExclusive", edge: "max", inclusive: false },
] as const;

/**
 * The numeric range a restriction states, or `null` when it states none.
 *
 * A bound whose `value` is not a number leaves the edge unset rather than becoming `NaN`, which
 * every comparison would answer `false` to — a malformed bound would then reject silently instead
 * of being reported as the unreadable facet it is.
 */
function readBounds(restrictionChildren: OrderedNode[]): ParsedRestriction | null {
  let min: ParsedBound | null = null;
  let max: ParsedBound | null = null;

  for (const { tag, edge, inclusive } of BOUND_FACETS) {
    const node = nodesNamed(restrictionChildren, tag)[0];
    if (!node) continue;
    const raw = String(attributesOf(node)["@_value"] ?? "").trim();
    if (raw === "" || !Number.isFinite(Number(raw))) continue;
    const bound: ParsedBound = { value: Number(raw), inclusive };
    if (edge === "min") min = bound;
    else max = bound;
  }

  return min === null && max === null ? null : { kind: "bounds", min, max };
}

/** The three length facets, paired with the edge each one sets. */
const LENGTH_FACETS = [
  { tag: "length", edge: "exact" },
  { tag: "minLength", edge: "min" },
  { tag: "maxLength", edge: "max" },
] as const;

/**
 * How long the value may be, or `null` when the restriction says nothing about its length.
 *
 * A facet whose `value` is not a whole count leaves its edge unset, the same rule `readBounds`
 * applies: a `NaN` edge answers `false` to every comparison and would reject silently rather than
 * being reported as the unreadable facet it is.
 */
function readLength(restrictionChildren: OrderedNode[]): ParsedRestriction | null {
  const edges: ParsedLength = { exact: null, min: null, max: null };

  for (const { tag, edge } of LENGTH_FACETS) {
    const node = nodesNamed(restrictionChildren, tag)[0];
    if (!node) continue;
    const raw = String(attributesOf(node)["@_value"] ?? "").trim();
    const count = Number(raw);
    if (raw === "" || !Number.isInteger(count) || count < 0) continue;
    edges[edge] = count;
  }

  return edges.exact === null && edges.min === null && edges.max === null
    ? null
    : { kind: "length", ...edges };
}

/**
 * The restriction under one of a facet's parameters, named because a facet may carry several: a
 * `<classification>` constrains its `<system>` and its `<value>` independently, and each is an
 * `idsValue` in its own right.
 *
 * `section` is which half of the specification the facet stands in, and it is not cosmetic: a
 * restriction we could not fully read weakens a requirement, but *changes the selection* when it
 * stands in an applicability. Only the second makes `applicabilityComplete` false, and reporting it
 * under the wrong section would run a rule whose subject we half-read.
 */
function parseRestriction(
  facetChildren: OrderedNode[],
  parameter: string,
  unsupported: UnsupportedConstruct[],
  section: UnsupportedConstruct["section"] = "requirements"
): ParsedRestriction | null {
  const valueNode = facetChildren.find((candidate) => tagOf(candidate) === parameter);
  if (!valueNode) return null;
  const valueChildren = childrenOf(valueNode, parameter);

  const simpleValue = readSimpleValue(valueChildren);
  if (simpleValue !== null) return { kind: "exact", value: simpleValue };

  const restrictionNode = valueChildren.find((candidate) => tagOf(candidate) === "restriction");
  if (!restrictionNode) return null;
  const restrictionChildren = childrenOf(restrictionNode, "restriction");

  for (const tag of new Set(tagsOf(restrictionChildren))) {
    if (RESTRICTION_FACETS_READ.includes(tag)) continue;
    unsupported.push({
      section,
      construct: `xs:${tag}`,
      description: `Constrains the value with xs:${tag}, which cannot be represented.`,
    });
  }

  // Several `<xs:pattern>` in one restriction step are a **disjunction**, not an intersection —
  // XSD 1.0 §4.3.4, and the suite's own `regex_patterns_work_in_OR` cases. Reading only the first
  // was a rule that under-matched and reported a clean verdict. Joined rather than tested one by
  // one because a disjunction of anchored patterns is one anchored pattern: `|` binds loosest
  // inside the group `compilePattern` wraps them in.
  const patternNodes = nodesNamed(restrictionChildren, "pattern");
  if (patternNodes.length > 0) {
    return patternRestriction(
      patternNodes.map((node) => String(attributesOf(node)["@_value"] ?? "")).join("|")
    );
  }

  const bounds = readBounds(restrictionChildren);
  if (bounds) {
    // XSD would intersect the two, and a dropped enumeration is a constraint we stop enforcing.
    // No file in the conformance suite writes both, so this is reported rather than implemented.
    if (nodesNamed(restrictionChildren, "enumeration").length > 0) {
      unsupported.push({
        section,
        construct: "xs:enumeration",
        description: "Combines an enumeration with a numeric range; only the range is checked.",
      });
    }
    return bounds;
  }

  const length = readLength(restrictionChildren);
  if (length) {
    // Same rule as the range above: XSD would intersect the two, and a dropped enumeration is a
    // constraint we stop enforcing.
    if (nodesNamed(restrictionChildren, "enumeration").length > 0) {
      unsupported.push({
        section,
        construct: "xs:enumeration",
        description: "Combines an enumeration with a length; only the length is checked.",
      });
    }
    return length;
  }

  // A restriction built only from facets we cannot read leaves no permitted values, so every
  // element fails it loudly. That is the right direction to be wrong in, and it is reported above.
  return {
    kind: "enum",
    values: nodesNamed(restrictionChildren, "enumeration").map((node) =>
      String(attributesOf(node)["@_value"] ?? "")
    ),
  };
}

export function parseIdsXml(idsXml: string): ParsedSpecification[] {
  const root = xmlParser.parse(idsXml) as OrderedNode[];
  const specifications = descend(descend(root, "ids"), "specifications");
  return nodesNamed(specifications, "specification").map((node) => parseSpecification(node));
}

function parseSpecification(specNode: OrderedNode): ParsedSpecification {
  const name = String(attributesOf(specNode)["@_name"] ?? "");
  const specChildren = childrenOf(specNode, "specification");
  const unsupported: UnsupportedConstruct[] = [];

  const applicabilityNode = specChildren.find((node) => tagOf(node) === "applicability");
  const applicability = readApplicability(descend(specChildren, "applicability"), unsupported);
  const requirements = readRequirements(descend(specChildren, "requirements"), unsupported);
  const identifierRaw = attributesOf(specNode)["@_identifier"];

  return {
    name,
    cardinality: readSpecificationCardinality(applicabilityNode),
    applicability,
    requirements,
    unsupported,
    applicabilityComplete: !unsupported.some((entry) => entry.section === "applicability"),
    identifier: identifierRaw == null ? null : String(identifierRaw),
  };
}

/**
 * The IFC class names a `<name>` selects: one `<simpleValue>`, or every member of an enumeration.
 * `null` when the names cannot be listed at all — a pattern selects an open-ended set of classes,
 * and a rule whose subject we cannot name is one we must refuse rather than guess at.
 *
 * An applicability holds a single `<entity>` per `ids.xsd`, so an enumeration here is how every
 * multi-type rule in the wild is written, and how this package writes them too.
 */
function readEntityNames(nameChildren: OrderedNode[]): string[] | null {
  const simpleValue = readSimpleValue(nameChildren);
  if (simpleValue !== null) return [simpleValue];

  const restrictionNode = nameChildren.find((node) => tagOf(node) === "restriction");
  if (!restrictionNode) return null;

  // Enumeration only: a pattern alongside it would narrow the list further, and reading just the
  // list would select classes the source excluded.
  const children = childrenOf(restrictionNode, "restriction");
  if (tagsOf(children).some((tag) => tag !== "enumeration" && tag !== "annotation")) return null;

  const enumerations = nodesNamed(children, "enumeration");
  if (enumerations.length === 0) return null;
  return enumerations.map((node) => String(attributesOf(node)["@_value"] ?? ""));
}

/**
 * The cardinality an `<applicability minOccurs maxOccurs>` states.
 *
 * Exported because the rule builder compiles drafts straight to
 * `ParsedSpecification` without serialising, and has to read the numbers the
 * same way this parser would — an imported rule carries its source's occurs
 * attributes verbatim.
 */
export function specificationCardinalityOf(
  minOccursRaw: string | undefined,
  maxOccursRaw: string | undefined
): SpecificationCardinality {
  // Absent means 1, per the XML Schema `occurs` group ids.xsd pulls in — the
  // default is "required", not "whatever happens to match".
  const minOccurs = Number(minOccursRaw ?? 1);
  const maxOccurs = maxOccursRaw === "unbounded" ? Infinity : Number(maxOccursRaw ?? 1);

  if (minOccurs === 0 && maxOccurs === 0) return "prohibited";
  return minOccurs === 0 ? "optional" : "required";
}

function readSpecificationCardinality(
  applicabilityNode: OrderedNode | undefined
): SpecificationCardinality {
  const attributes = applicabilityNode ? attributesOf(applicabilityNode) : {};
  return specificationCardinalityOf(attributes["@_minOccurs"], attributes["@_maxOccurs"]);
}

/**
 * Which elements the rule is about: the classes its `<entity>` lists, plus every other facet that
 * narrows the selection, plus a report of anything that narrowed it in a way this parser cannot
 * represent. Dropping one of those quietly changes what the rule means, so it refuses instead.
 */
function readApplicability(
  applicability: OrderedNode[],
  unsupported: UnsupportedConstruct[]
): ParsedApplicability {
  let entityNames: string[] | null = null;
  let entityPredefinedType: ParsedRestriction | null = null;
  const facets: ParsedApplicabilityFacet[] = [];

  for (const node of applicability) {
    const tag = tagOf(node);
    if (tag === null || tag === TEXT_KEY) continue;

    if (tag !== "entity") {
      const facet = readApplicabilityFacet(node, tag, unsupported);
      if (facet) facets.push(facet);
      continue;
    }

    const children = childrenOf(node, "entity");
    const names = readEntityNames(descend(children, "name"));
    if (names === null) {
      // The same two documents the importer had to tell apart: a `<name>` given as a pattern, and
      // an `<entity>` with no `<name>` at all — 8 of the 12 corpus specifications refused here
      // spell it `<n>`, so one message described a fault the file does not have.
      unsupported.push({
        section: "applicability",
        construct: "entity/name",
        description:
          children.some((child) => tagOf(child) === "name")
            ? "Gives its entity types as a pattern rather than plain names."
            : "Its <entity> states no <name>, which ids.xsd requires.",
      });
      continue;
    }
    entityNames = [...(entityNames ?? []), ...names];

    // Geometry is the one part of the schema a parse never normalizes, so a
    // rule aimed at it would select nothing and report every model clean. Said
    // out loud instead: refusing is honest, a silent pass is not.
    const unparsed = names.filter((name) => !isNormalizableEntityType(name));
    if (unparsed.length > 0) {
      unsupported.push({
        section: "applicability",
        construct: "entity/name",
        description: `Selects <${unparsed.join(", ")}>, geometry this build does not read.`,
      });
    }

    const predefinedType = parseRestriction(children, "predefinedType", unsupported, "applicability");
    if (predefinedType === null) continue;
    // `ids.xsd` allows one `<entity>`, so there is no second predefined type to intersect with the
    // first. Refused rather than overwritten: names from two elements are a union and predefined
    // types would be an intersection, and guessing which the author meant is what this parser does
    // not do.
    if (entityPredefinedType !== null) {
      unsupported.push({
        section: "applicability",
        construct: "entity/predefinedType",
        description: "States a predefined type on more than one <entity>, which the schema does not allow.",
      });
      continue;
    }
    entityPredefinedType = predefinedType;
  }

  return { entityNames, entityPredefinedType, facets };
}

/**
 * One facet standing beside the `<entity>` in an applicability, or `null` when it says something
 * this parser cannot follow — in which case the reason it reports refuses the whole specification.
 *
 * The evaluation is the requirements-side one, unchanged: "the element carries this property" is
 * the same question whether it decides that the rule applies or that the rule is satisfied.
 * `ifctester` uses one class per facet on both sides for the same reason.
 */
function readApplicabilityFacet(
  node: OrderedNode,
  tag: string,
  unsupported: UnsupportedConstruct[]
): ParsedApplicabilityFacet | null {
  const refuse = (construct: string, description: string): null => {
    unsupported.push({ section: "applicability", construct, description });
    return null;
  };

  // `applicabilityType` references the base facet types directly; it is `requirementsType` that
  // extends each of them with a `cardinality`. So one here is a document ids.xsd does not describe,
  // and reading `prohibited` as though it were stated on a requirement would invert the selection.
  if (attributesOf(node)["@_cardinality"] !== undefined) {
    return refuse(
      `${tag}/cardinality`,
      `States a cardinality on <${tag}>, which ids.xsd gives no applicability facet.`
    );
  }

  if (tag === "attribute" || tag === "property") {
    const facet =
      tag === "attribute"
        ? parseAttributeFacet(node, unsupported, "applicability")
        : parsePropertyFacet(node, unsupported, "applicability");
    return (
      facet ??
      refuse(
        `${tag}/name`,
        `States no readable name for its <${tag}>, so which elements it selects is unknown.`
      )
    );
  }

  if (tag === "classification") return parseClassificationFacet(node, unsupported, "applicability");

  if (tag === "material") {
    return {
      kind: "material",
      value: parseRestriction(childrenOf(node, "material"), "value", unsupported, "applicability"),
      cardinality: readCardinality(node),
    };
  }

  if (tag === "partOf") return parsePartOfFacet(node, unsupported, "applicability");

  return refuse(tag, `Selects elements by <${tag}>, which cannot be represented.`);
}

function readRequirements(
  requirementNodes: OrderedNode[],
  unsupported: UnsupportedConstruct[]
): ParsedRequirementFacet[] {
  const requirements: ParsedRequirementFacet[] = [];

  for (const node of requirementNodes) {
    const tag = tagOf(node);
    if (tag === null || tag === TEXT_KEY) continue;

    if (
      tag !== "attribute" &&
      tag !== "property" &&
      tag !== "classification" &&
      tag !== "material" &&
      tag !== "partOf" &&
      tag !== "entity"
    ) {
      unsupported.push({
        section: "requirements",
        construct: tag,
        description: `Requires <${tag}>, which cannot be represented, so it is not checked.`,
      });
      continue;
    }

    if (tag === "entity") {
      const entity = parseEntityFacet(node, unsupported);
      if (entity) requirements.push(entity);
      else
        unsupported.push({
          section: "requirements",
          construct: "entity/name",
          description: "States no readable entity name, so the class it requires is unknown.",
        });
      continue;
    }

    if (tag === "classification") {
      requirements.push(parseClassificationFacet(node, unsupported));
      continue;
    }

    if (tag === "partOf") {
      requirements.push(parsePartOfFacet(node, unsupported));
      continue;
    }

    if (tag === "material") {
      requirements.push({
        kind: "material",
        value: parseRestriction(childrenOf(node, "material"), "value", unsupported),
        cardinality: readCardinality(node),
      });
      continue;
    }

    const facet =
      tag === "attribute"
        ? parseAttributeFacet(node, unsupported)
        : parsePropertyFacet(node, unsupported);

    if (facet) requirements.push(facet);
    else
      unsupported.push({
        section: "requirements",
        construct: `${tag}/name`,
        description: `States no readable name for its <${tag}>, so what it is about is unknown.`,
      });
  }

  return requirements;
}

/**
 * `null` when the `<name>` states nothing readable, which leaves the required class unknown.
 *
 * Unlike an applicability entity, a pattern is fully understood here: a requirement asks whether
 * *this* element's class matches, so an open-ended set of classes is a question that can be
 * answered. An applicability has to enumerate the elements it selects, which a pattern prevents.
 */
function parseEntityFacet(
  node: OrderedNode,
  unsupported: UnsupportedConstruct[]
): ParsedEntityFacet | null {
  const children = childrenOf(node, "entity");
  const name = parseRestriction(children, "name", unsupported);
  if (name === null) return null;
  return {
    kind: "entity",
    name,
    predefinedType: parseRestriction(children, "predefinedType", unsupported),
  };
}

function parseAttributeFacet(
  node: OrderedNode,
  unsupported: UnsupportedConstruct[],
  section: UnsupportedConstruct["section"] = "requirements"
): ParsedAttributeFacet | null {
  const children = childrenOf(node, "attribute");
  const name = parseRestriction(children, "name", unsupported, section);
  if (name === null) return null;
  return {
    kind: "attribute",
    name,
    restriction: parseRestriction(children, "value", unsupported, section),
    cardinality: readCardinality(node),
  };
}

/**
 * The `relation` attribute splits on whitespace, because one member of the schema's enumeration is
 * two relationship names in a single value. An absent attribute states no constraint at all, which
 * is not the same as an empty list of accepted relations — hence `[]` meaning "any".
 */
function parsePartOfFacet(
  node: OrderedNode,
  unsupported: UnsupportedConstruct[],
  section: UnsupportedConstruct["section"] = "requirements"
): ParsedPartOfFacet {
  const children = childrenOf(node, "partOf");
  const entityChildren = descend(children, "entity");
  const relation = attributesOf(node)["@_relation"];

  return {
    kind: "partOf",
    relations: relation === undefined ? [] : relation.trim().split(/\s+/).filter(Boolean),
    entityName: parseRestriction(entityChildren, "name", unsupported, section),
    predefinedType: parseRestriction(entityChildren, "predefinedType", unsupported, section),
    cardinality: readCardinality(node),
  };
}

/**
 * Never `null`: unlike an attribute or a property, a classification facet names nothing that could
 * be unreadable. Both of its parameters are optional, and a facet stating neither is the schema's
 * own way of asking "is this element classified at all".
 */
function parseClassificationFacet(
  node: OrderedNode,
  unsupported: UnsupportedConstruct[],
  section: UnsupportedConstruct["section"] = "requirements"
): ParsedClassificationFacet {
  const children = childrenOf(node, "classification");
  return {
    kind: "classification",
    system: parseRestriction(children, "system", unsupported, section),
    value: parseRestriction(children, "value", unsupported, section),
    cardinality: readCardinality(node),
  };
}

function parsePropertyFacet(
  node: OrderedNode,
  unsupported: UnsupportedConstruct[],
  section: UnsupportedConstruct["section"] = "requirements"
): ParsedPropertyFacet | null {
  const children = childrenOf(node, "property");
  const propertySet = parseRestriction(children, "propertySet", unsupported, section);
  const baseName = parseRestriction(children, "baseName", unsupported, section);
  if (propertySet === null || baseName === null) return null;
  return {
    kind: "property",
    propertySet,
    baseName,
    dataType: attributesOf(node)["@_dataType"] ?? null,
    restriction: parseRestriction(children, "value", unsupported, section),
    cardinality: readCardinality(node),
  };
}
