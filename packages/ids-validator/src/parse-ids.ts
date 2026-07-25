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

export interface ParsedSpecification {
  name: string;
  applicabilityEntityNames: string[];
  requirements: ParsedRequirementFacet[];
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
  return attributesOf(node)["@_cardinality"] === "prohibited" ? "prohibited" : "required";
}

function parseRestriction(facetChildren: OrderedNode[]): ParsedRestriction | null {
  const valueNode = facetChildren.find((candidate) => tagOf(candidate) === "value");
  if (!valueNode) return null;
  const valueChildren = childrenOf(valueNode, "value");

  const simpleValue = readSimpleValue(valueChildren);
  if (simpleValue !== null) return { kind: "exact", value: simpleValue };

  const restrictionNode = valueChildren.find((candidate) => tagOf(candidate) === "restriction");
  if (!restrictionNode) return null;
  const restrictionChildren = childrenOf(restrictionNode, "restriction");

  const patternNode = nodesNamed(restrictionChildren, "pattern")[0];
  if (patternNode) return patternRestriction(String(attributesOf(patternNode)["@_value"] ?? ""));

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

  const applicability = descend(specChildren, "applicability");
  const applicabilityEntityNames = nodesNamed(applicability, "entity")
    .map((entity) => readSimpleValue(descend(childrenOf(entity, "entity"), "name")))
    .filter((value): value is string => value !== null);

  warnUnsupported(applicability, ["entity"], "applicability", name);

  const requirementNodes = descend(specChildren, "requirements");
  const requirements: ParsedRequirementFacet[] = [];
  for (const node of requirementNodes) {
    const tag = tagOf(node);
    if (tag === "attribute") {
      const facet = parseAttributeFacet(node);
      if (facet) requirements.push(facet);
    } else if (tag === "property") {
      const facet = parsePropertyFacet(node);
      if (facet) requirements.push(facet);
    }
  }

  warnUnsupported(requirementNodes, ["attribute", "property"], "requirement", name);

  return { name, applicabilityEntityNames, requirements };
}

function warnUnsupported(
  nodes: OrderedNode[],
  supported: string[],
  section: string,
  specName: string
): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === null || tag === TEXT_KEY || supported.includes(tag)) continue;
    console.warn(
      `ids-validator: skipping unsupported ${section} facet "<${tag}>" in specification "${specName}"`
    );
  }
}

function parseAttributeFacet(node: OrderedNode): ParsedAttributeFacet | null {
  const children = childrenOf(node, "attribute");
  const name = readSimpleValue(descend(children, "name"));
  if (name === null) return null;
  return {
    kind: "attribute",
    name,
    restriction: parseRestriction(children),
    cardinality: readCardinality(node),
  };
}

function parsePropertyFacet(node: OrderedNode): ParsedPropertyFacet | null {
  const children = childrenOf(node, "property");
  const propertySet = readSimpleValue(descend(children, "propertySet"));
  const baseName = readSimpleValue(descend(children, "baseName"));
  if (propertySet === null || baseName === null) return null;
  return {
    kind: "property",
    propertySet,
    baseName,
    dataType: attributesOf(node)["@_dataType"] ?? null,
    restriction: parseRestriction(children),
    cardinality: readCardinality(node),
  };
}
