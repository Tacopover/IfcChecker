import { XMLParser } from "fast-xml-parser";

export type ParsedRestriction =
  | { kind: "exact"; value: string }
  | { kind: "enum"; values: string[] }
  | { kind: "pattern"; source: string; regex: RegExp };

export type FacetCardinality = "required" | "prohibited";

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

export type ParsedRequirementFacet = ParsedAttributeFacet | ParsedPropertyFacet;

/** Something the source document asked for that this parser cannot represent. */
export interface UnsupportedConstruct {
  section: "applicability" | "requirements";
  /** The construct in the source document's own vocabulary, e.g. `classification`. */
  construct: string;
  /** What it costs, phrased for whoever has to decide whether the result is still usable. */
  description: string;
}

export interface ParsedSpecification {
  name: string;
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
 */
export function isEvaluable(specification: ParsedSpecification): boolean {
  return specification.applicabilityComplete && specification.applicabilityEntityNames.length > 0;
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
  parseTagValue: true,
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

function readCardinality(
  node: OrderedNode,
  tag: string,
  unsupported: UnsupportedConstruct[]
): FacetCardinality {
  const cardinality = attributesOf(node)["@_cardinality"];
  if (cardinality === "prohibited") return "prohibited";
  // Reading optional as required is the safe direction — it over-reports rather than under-reports —
  // but it produces failures the source would have allowed, so the user has to be told.
  if (cardinality === "optional") {
    unsupported.push({
      section: "requirements",
      construct: "cardinality=optional",
      description: `<${tag}> is optional, but is checked as required — expect failures the original would have allowed.`,
    });
  }
  return "required";
}

/** The XSD facets a `ParsedRestriction` can carry; `annotation` is prose we can lose safely. */
const RESTRICTION_FACETS_READ = ["pattern", "enumeration", "annotation"];

function parseRestriction(
  facetChildren: OrderedNode[],
  unsupported: UnsupportedConstruct[]
): ParsedRestriction | null {
  const valueNode = facetChildren.find((candidate) => tagOf(candidate) === "value");
  if (!valueNode) return null;
  const valueChildren = childrenOf(valueNode, "value");

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

  // A restriction built only from bounds we cannot read leaves no permitted values, so every
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

  const applicabilityEntityNames = readApplicability(
    descend(specChildren, "applicability"),
    unsupported
  );
  const requirements = readRequirements(descend(specChildren, "requirements"), unsupported);

  return {
    name,
    applicabilityEntityNames,
    requirements,
    unsupported,
    applicabilityComplete: !unsupported.some((entry) => entry.section === "applicability"),
  };
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
    const entityName = readSimpleValue(descend(children, "name"));
    if (entityName === null) {
      unsupported.push({
        section: "applicability",
        construct: "entity/name",
        description: "Gives its entity types as a pattern or list rather than plain names.",
      });
      continue;
    }
    entityNames.push(entityName);

    if (children.some((child) => tagOf(child) === "predefinedType")) {
      unsupported.push({
        section: "applicability",
        construct: "entity/predefinedType",
        description: `Narrows <${entityName}> to one predefined type, which cannot be represented.`,
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

    if (tag !== "attribute" && tag !== "property") {
      unsupported.push({
        section: "requirements",
        construct: tag,
        description: `Requires <${tag}>, which cannot be represented, so it is not checked.`,
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
    restriction: parseRestriction(children, unsupported),
    cardinality: readCardinality(node, "attribute", unsupported),
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
    restriction: parseRestriction(children, unsupported),
    cardinality: readCardinality(node, "property", unsupported),
  };
}
