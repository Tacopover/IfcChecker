import { XMLParser } from "fast-xml-parser";

/**
 * Structural conformance to `ids.xsd` 1.0.0 — element order and cardinality, required elements and
 * attributes, and the enumerated attribute values.
 *
 * Not a full XSD validation: it does not check data types, the `xs:` restriction grammar, or
 * whether an entity name is a real IFC class. It exists because reproducing a real file and being
 * valid are different claims, and only the first was ever tested — which is how an applicability
 * carrying two `<entity>` elements shipped. No real file has that shape, so no round-trip could
 * catch it.
 */
export function idsSchemaViolations(idsXml: string): string[] {
  let root: OrderedNode[];
  try {
    root = shapeParser.parse(idsXml) as OrderedNode[];
  } catch (error) {
    return [`document is not well-formed XML: ${error instanceof Error ? error.message : error}`];
  }

  const ids = elementsOf(root).find((node) => tagOf(node) === "ids");
  if (!ids) return ["<ids> root element is missing"];

  const violations: string[] = [];
  const children = elementsOf(childrenOf(ids));

  checkSequence(children, "<ids>", IDS_CHILDREN, violations);
  const info = children.find((node) => tagOf(node) === "info");
  if (info) checkSequence(elementsOf(childrenOf(info)), "<info>", INFO_CHILDREN, violations);

  const specifications = children.find((node) => tagOf(node) === "specifications");
  const specs = specifications ? elementsOf(childrenOf(specifications)) : [];
  if (specifications && specs.length === 0) {
    violations.push("<specifications> holds no <specification>, but at least one is required");
  }

  for (const spec of specs) {
    if (tagOf(spec) !== "specification") {
      violations.push(`<specifications> holds <${tagOf(spec)}>, which is not allowed there`);
      continue;
    }
    checkSpecification(spec, violations);
  }
  return violations;
}

const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";

interface OrderedNode {
  [key: string]: unknown;
}

const shapeParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  preserveOrder: true,
});

function tagOf(node: OrderedNode): string | null {
  for (const key of Object.keys(node)) {
    if (key !== ATTRIBUTES_KEY) return key;
  }
  return null;
}

function childrenOf(node: OrderedNode): OrderedNode[] {
  const tag = tagOf(node);
  const value = tag === null ? undefined : node[tag];
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
}

function attributesOf(node: OrderedNode): Record<string, string> {
  const raw = node[ATTRIBUTES_KEY];
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, string>;
}

function elementsOf(nodes: OrderedNode[]): OrderedNode[] {
  return nodes.filter((node) => {
    const tag = tagOf(node);
    return tag !== null && tag !== TEXT_KEY;
  });
}

/** One entry per element an `xs:sequence` allows, in the order the schema declares them. */
interface SequenceEntry {
  tag: string;
  required?: boolean;
  repeatable?: boolean;
}

const IDS_CHILDREN: SequenceEntry[] = [
  { tag: "info", required: true },
  { tag: "specifications", required: true },
];

const INFO_CHILDREN: SequenceEntry[] = [
  { tag: "title", required: true },
  { tag: "copyright" },
  { tag: "version" },
  { tag: "description" },
  { tag: "author" },
  { tag: "date" },
  { tag: "purpose" },
  { tag: "milestone" },
];

// The one place the multi-entity bug lived: `entity` is not repeatable here.
const APPLICABILITY_CHILDREN: SequenceEntry[] = [
  { tag: "entity" },
  { tag: "partOf", repeatable: true },
  { tag: "classification", repeatable: true },
  { tag: "attribute", repeatable: true },
  { tag: "property", repeatable: true },
  { tag: "material", repeatable: true },
];

const FACET_CHILDREN: Record<string, SequenceEntry[]> = {
  entity: [{ tag: "name", required: true }, { tag: "predefinedType" }],
  partOf: [{ tag: "entity", required: true }],
  classification: [{ tag: "value" }, { tag: "system", required: true }],
  attribute: [{ tag: "name", required: true }, { tag: "value" }],
  property: [
    { tag: "propertySet", required: true },
    { tag: "baseName", required: true },
    { tag: "value" },
  ],
  material: [{ tag: "value" }],
};

const IFC_VERSIONS = ["IFC2X3", "IFC4", "IFC4X3_ADD2"];
const RELATIONS = [
  "IFCRELAGGREGATES",
  "IFCRELASSIGNSTOGROUP",
  "IFCRELCONTAINEDINSPATIALSTRUCTURE",
  "IFCRELNESTS",
  "IFCRELVOIDSELEMENT IFCRELFILLSELEMENT",
];
/** `partOf` has no `optional`: the schema says being part of something is not worth half-asking. */
const CARDINALITIES: Record<string, string[]> = {
  partOf: ["required", "prohibited"],
  classification: ["required", "prohibited", "optional"],
  attribute: ["required", "prohibited", "optional"],
  property: ["required", "prohibited", "optional"],
  material: ["required", "prohibited", "optional"],
};

function checkSequence(
  children: OrderedNode[],
  where: string,
  allowed: SequenceEntry[],
  violations: string[]
): void {
  let position = 0;
  const seen = new Set<string>();

  for (const child of children) {
    const tag = tagOf(child) ?? "";
    const index = allowed.findIndex((entry) => entry.tag === tag);

    if (index === -1) {
      violations.push(`${where} holds <${tag}>, which is not allowed there`);
      continue;
    }
    if (index < position) {
      violations.push(`${where} has <${tag}> out of the order the schema declares`);
    } else if (index > position) {
      position = index;
    }
    if (seen.has(tag) && !allowed[index].repeatable) {
      violations.push(`${where} has more than one <${tag}>, but the schema allows one`);
    }
    seen.add(tag);
  }

  for (const entry of allowed) {
    if (entry.required && !seen.has(entry.tag)) {
      violations.push(`${where} is missing <${entry.tag}>, which is required`);
    }
  }
}

function checkSpecification(spec: OrderedNode, violations: string[]): void {
  const attributes = attributesOf(spec);
  const name = attributes["@_name"];
  const where = `<specification${name === undefined ? "" : ` name="${name}"`}>`;

  if (name === undefined) violations.push(`${where} has no name attribute, which is required`);

  const ifcVersion = attributes["@_ifcVersion"];
  if (ifcVersion === undefined) {
    violations.push(`${where} has no ifcVersion attribute, which is required`);
  } else {
    for (const token of String(ifcVersion).split(/\s+/).filter(Boolean)) {
      if (!IFC_VERSIONS.includes(token)) {
        violations.push(`${where} targets IFC version "${token}", which the schema does not list`);
      }
    }
  }

  const children = elementsOf(childrenOf(spec));
  checkSequence(
    children,
    where,
    [{ tag: "applicability", required: true }, { tag: "requirements" }],
    violations
  );

  const applicability = children.find((node) => tagOf(node) === "applicability");
  if (applicability) {
    const facets = elementsOf(childrenOf(applicability));
    checkSequence(facets, `${where} applicability`, APPLICABILITY_CHILDREN, violations);
    for (const facet of facets) checkFacet(facet, `${where} applicability`, false, violations);
  }

  const requirements = children.find((node) => tagOf(node) === "requirements");
  if (requirements) {
    // requirementsType wraps its sequence in maxOccurs="unbounded", so the facet kinds may repeat
    // as a block and only each facet's own shape is worth checking here.
    for (const facet of elementsOf(childrenOf(requirements))) {
      checkFacet(facet, `${where} requirements`, true, violations);
    }
  }
}

function checkFacet(
  facet: OrderedNode,
  where: string,
  isRequirement: boolean,
  violations: string[]
): void {
  const tag = tagOf(facet) ?? "";
  const allowed = FACET_CHILDREN[tag];
  if (!allowed) {
    violations.push(`${where} holds <${tag}>, which is not an IDS facet`);
    return;
  }

  const children = elementsOf(childrenOf(facet));
  checkSequence(children, `${where} <${tag}>`, allowed, violations);

  const attributes = attributesOf(facet);
  const relation = attributes["@_relation"];
  if (relation !== undefined && !RELATIONS.includes(String(relation))) {
    violations.push(`${where} <partOf> uses relation "${relation}", which the schema does not list`);
  }

  const cardinality = attributes["@_cardinality"];
  if (cardinality !== undefined) {
    if (!isRequirement) {
      violations.push(`${where} <${tag}> has a cardinality, which only a requirement may have`);
    } else if (!(CARDINALITIES[tag] ?? []).includes(String(cardinality))) {
      violations.push(`${where} <${tag}> has cardinality "${cardinality}", which it may not have`);
    }
  }

  // idsValue is a choice of exactly one, so a parameter with both or neither is malformed.
  for (const child of children) {
    if (!VALUE_BEARING.includes(tagOf(child) ?? "")) continue;
    const inner = elementsOf(childrenOf(child));
    const shapes = inner.filter((node) => VALUE_SHAPES.includes(tagOf(node) ?? ""));
    if (shapes.length !== 1) {
      violations.push(
        `${where} <${tag}> parameter <${tagOf(child)}> holds ${shapes.length} values, but exactly one is required`
      );
    }
  }
}

const VALUE_BEARING = ["name", "predefinedType", "value", "system", "propertySet", "baseName"];
const VALUE_SHAPES = ["simpleValue", "restriction"];
