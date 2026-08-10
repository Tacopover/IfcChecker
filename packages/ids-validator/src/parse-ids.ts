import { XMLParser } from "fast-xml-parser";
import { isNormalizableEntityType } from "@ifc-qa/shared-types";

/** One edge of a numeric range. `inclusive` separates `minInclusive` from `minExclusive`. */
export interface ParsedBound {
  value: number;
  inclusive: boolean;
}

export type ParsedRestriction =
  | { kind: "exact"; value: string }
  | { kind: "enum"; values: string[] }
  | { kind: "pattern"; source: string; regex: RegExp }
  | { kind: "bounds"; min: ParsedBound | null; max: ParsedBound | null };

export type FacetCardinality = "required" | "optional" | "prohibited";

export interface ParsedAttributeFacet {
  kind: "attribute";
  name: string;
  restriction: ParsedRestriction | null;
  cardinality: FacetCardinality;
}

export interface ParsedPropertyFacet {
  kind: "property";
  propertySet: string;
  baseName: string;
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

export type ParsedRequirementFacet =
  | ParsedAttributeFacet
  | ParsedPropertyFacet
  | ParsedClassificationFacet
  | ParsedMaterialFacet;

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
  applicabilityEntityNames: string[];
  requirements: ParsedRequirementFacet[];
  /** Reported rather than logged, so a caller can show the user what was dropped. */
  unsupported: UnsupportedConstruct[];
  /** True when nothing deciding *which* elements are selected was dropped. */
  applicabilityComplete: boolean;
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
 */
export function isEvaluable(specification: ParsedSpecification): boolean {
  if (!specification.applicabilityComplete) return false;
  if (specification.applicabilityEntityNames.length === 0) return false;
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

/**
 * The restriction under one of a facet's parameters, named because a facet may carry several: a
 * `<classification>` constrains its `<system>` and its `<value>` independently, and each is an
 * `idsValue` in its own right.
 */
function parseRestriction(
  facetChildren: OrderedNode[],
  parameter: string,
  unsupported: UnsupportedConstruct[]
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
      section: "requirements",
      construct: `xs:${tag}`,
      description: `Constrains the value with xs:${tag}, which cannot be represented.`,
    });
  }

  const patternNode = nodesNamed(restrictionChildren, "pattern")[0];
  if (patternNode) return patternRestriction(String(attributesOf(patternNode)["@_value"] ?? ""));

  const bounds = readBounds(restrictionChildren);
  if (bounds) {
    // XSD would intersect the two, and a dropped enumeration is a constraint we stop enforcing.
    // No file in the conformance suite writes both, so this is reported rather than implemented.
    if (nodesNamed(restrictionChildren, "enumeration").length > 0) {
      unsupported.push({
        section: "requirements",
        construct: "xs:enumeration",
        description: "Combines an enumeration with a numeric range; only the range is checked.",
      });
    }
    return bounds;
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
  const applicabilityEntityNames = readApplicability(
    descend(specChildren, "applicability"),
    unsupported
  );
  const requirements = readRequirements(descend(specChildren, "requirements"), unsupported);

  return {
    name,
    cardinality: readSpecificationCardinality(applicabilityNode),
    applicabilityEntityNames,
    requirements,
    unsupported,
    applicabilityComplete: !unsupported.some((entry) => entry.section === "applicability"),
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
 * Entity names, plus a report of everything else that narrowed the selection. IDS also selects by
 * attribute, property, classification and material value; those decide which elements a rule is
 * about, so dropping one quietly changes what the rule means.
 */
function readApplicability(
  applicability: OrderedNode[],
  unsupported: UnsupportedConstruct[]
): string[] {
  const entityNames: string[] = [];

  for (const node of applicability) {
    const tag = tagOf(node);
    if (tag === null || tag === TEXT_KEY) continue;

    if (tag !== "entity") {
      unsupported.push({
        section: "applicability",
        construct: tag,
        description: `Selects elements by <${tag}>, which cannot be represented.`,
      });
      continue;
    }

    const children = childrenOf(node, "entity");
    const names = readEntityNames(descend(children, "name"));
    if (names === null) {
      unsupported.push({
        section: "applicability",
        construct: "entity/name",
        description: "Gives its entity types as a pattern rather than plain names.",
      });
      continue;
    }
    entityNames.push(...names);

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

    if (children.some((child) => tagOf(child) === "predefinedType")) {
      unsupported.push({
        section: "applicability",
        construct: "entity/predefinedType",
        description: `Narrows <${names.join(", ")}> to one predefined type, which cannot be represented.`,
      });
    }
  }

  return entityNames;
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
      tag !== "material"
    ) {
      unsupported.push({
        section: "requirements",
        construct: tag,
        description: `Requires <${tag}>, which cannot be represented, so it is not checked.`,
      });
      continue;
    }

    if (tag === "classification") {
      requirements.push(parseClassificationFacet(node, unsupported));
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
        description: `Names its <${tag}> with a pattern or list rather than a plain name, so it is not checked.`,
      });
  }

  return requirements;
}

function parseAttributeFacet(
  node: OrderedNode,
  unsupported: UnsupportedConstruct[]
): ParsedAttributeFacet | null {
  const children = childrenOf(node, "attribute");
  const name = readSimpleValue(descend(children, "name"));
  if (name === null) return null;
  return {
    kind: "attribute",
    name,
    restriction: parseRestriction(children, "value", unsupported),
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
  unsupported: UnsupportedConstruct[]
): ParsedClassificationFacet {
  const children = childrenOf(node, "classification");
  return {
    kind: "classification",
    system: parseRestriction(children, "system", unsupported),
    value: parseRestriction(children, "value", unsupported),
    cardinality: readCardinality(node),
  };
}

function parsePropertyFacet(
  node: OrderedNode,
  unsupported: UnsupportedConstruct[]
): ParsedPropertyFacet | null {
  const children = childrenOf(node, "property");
  const propertySet = readSimpleValue(descend(children, "propertySet"));
  const baseName = readSimpleValue(descend(children, "baseName"));
  if (propertySet === null || baseName === null) return null;
  return {
    kind: "property",
    propertySet,
    baseName,
    dataType: attributesOf(node)["@_dataType"] ?? null,
    restriction: parseRestriction(children, "value", unsupported),
    cardinality: readCardinality(node),
  };
}
