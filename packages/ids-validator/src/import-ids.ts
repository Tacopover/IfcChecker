import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type { UnsupportedConstruct } from "./parse-ids.js";
import type {
  ConditionDraft,
  ImportedRuleSource,
  PassThrough,
  RuleDraft,
  ValueDraft,
} from "./rule-draft.js";
import { patternValueDraft } from "./rule-draft.js";

/** A specification kept out of the rule list because its applicability cannot be represented. */
export interface RefusedSpecification {
  name: string;
  /** Why it was refused, in the source document's own vocabulary. */
  reasons: UnsupportedConstruct[];
  /** The whole specification verbatim, so re-exporting hands it back untouched. */
  passThrough: PassThrough;
}

export interface IdsImportResult {
  /** Specifications the builder can show and edit. */
  rules: RuleDraft[];
  refused: RefusedSpecification[];
  /** `<info><title>`, or `null` when the document has none. */
  title: string | null;
  /** `<info>` children other than title and date, verbatim. */
  extraInfo: string[];
}

/**
 * Namespace prefixes are kept, unlike in `parse-ids`: anything we cannot represent is re-emitted
 * from this tree verbatim, and an `<xs:restriction>` rewritten as `<restriction>` would land in the
 * IDS namespace and change meaning. Tag values stay strings so `"1.50"` survives as written.
 */
const importParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  parseTagValue: false,
  preserveOrder: true,
});

const fragmentWriter = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  format: true,
  indentBy: "  ",
  suppressEmptyNode: true,
});

const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";

interface OrderedNode {
  [key: string]: unknown;
}

function rawTagOf(node: OrderedNode): string | null {
  for (const key of Object.keys(node)) {
    if (key !== ATTRIBUTES_KEY) return key;
  }
  return null;
}

function tagOf(node: OrderedNode): string | null {
  const raw = rawTagOf(node);
  return raw === null ? null : raw.slice(raw.indexOf(":") + 1);
}

/** Children of whatever element this node is — each ordered node holds exactly one. */
function childrenOf(node: OrderedNode): OrderedNode[] {
  const raw = rawTagOf(node);
  const value = raw === null ? undefined : node[raw];
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
}

function attributesOf(node: OrderedNode): Record<string, string> {
  const raw = node[ATTRIBUTES_KEY];
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, string>;
}

/** Element children in document order, with whitespace text nodes left out. */
function elementsOf(nodes: OrderedNode[]): OrderedNode[] {
  return nodes.filter((node) => {
    const tag = tagOf(node);
    return tag !== null && tag !== TEXT_KEY;
  });
}

function findChild(nodes: OrderedNode[], tag: string): OrderedNode | null {
  return nodes.find((node) => tagOf(node) === tag) ?? null;
}

function descend(nodes: OrderedNode[], tag: string): OrderedNode[] {
  const node = findChild(nodes, tag);
  return node ? childrenOf(node) : [];
}

function textOf(nodes: OrderedNode[]): string {
  for (const node of nodes) {
    if (TEXT_KEY in node) return String(node[TEXT_KEY]);
  }
  return "";
}

/** `null` when the `<simpleValue>` element is absent; `""` when present but empty. */
function readSimpleValue(nodes: OrderedNode[]): string | null {
  const node = findChild(nodes, "simpleValue");
  return node ? textOf(childrenOf(node)) : null;
}

function serialize(node: OrderedNode): string {
  return fragmentWriter.build([node]).trim();
}

function attributeOrNull(node: OrderedNode, name: string): string | null {
  const value = attributesOf(node)[`@_${name}`];
  return value === undefined ? null : String(value);
}

/** Attributes with the parser's prefix stripped, so they can be written straight back out. */
function plainAttributes(node: OrderedNode | null, except: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  if (!node) return out;
  for (const [key, value] of Object.entries(attributesOf(node))) {
    const name = key.startsWith("@_") ? key.slice(2) : key;
    if (!except.includes(name)) out[name] = String(value);
  }
  return out;
}

let nextId = 0;

/** Ids only have to be unique within an import; the builder re-keys nothing on them. */
function draftId(prefix: string): string {
  nextId += 1;
  return `${prefix}${nextId}`;
}

export function idsXmlToDrafts(idsXml: string): IdsImportResult {
  const root = descend(importParser.parse(idsXml) as OrderedNode[], "ids");

  const info = descend(root, "info");
  const title = readInfoText(info, "title");
  const extraInfo = elementsOf(info)
    .filter((node) => tagOf(node) !== "title" && tagOf(node) !== "date")
    .map(serialize);

  const rules: RuleDraft[] = [];
  const refused: RefusedSpecification[] = [];

  for (const node of elementsOf(descend(root, "specifications"))) {
    if (tagOf(node) !== "specification") continue;
    readSpecification(node, rules, refused);
  }

  return { rules, refused, title, extraInfo };
}

function readInfoText(info: OrderedNode[], tag: string): string | null {
  const node = findChild(info, tag);
  return node ? textOf(childrenOf(node)) : null;
}

function readSpecification(
  node: OrderedNode,
  rules: RuleDraft[],
  refused: RefusedSpecification[]
): void {
  const name = attributeOrNull(node, "name") ?? "";
  const children = childrenOf(node);
  const applicabilityNode = findChild(children, "applicability");

  const reasons: UnsupportedConstruct[] = [];
  const { entityTypes, asEnumeration } = readApplicability(applicabilityNode, reasons);

  if (reasons.length > 0 || entityTypes.length === 0) {
    if (entityTypes.length === 0 && reasons.length === 0) {
      reasons.push({
        section: "applicability",
        construct: "applicability",
        description: "Selects no elements at all, so there is nothing to show or edit.",
      });
    }
    refused.push({
      name,
      reasons,
      passThrough: { afterIndex: rules.length, construct: "specification", xml: serialize(node) },
    });
    return;
  }

  const requirementsNode = findChild(children, "requirements");
  const conditions: ConditionDraft[] = [];
  const passThrough: PassThrough[] = [];

  for (const facetNode of elementsOf(requirementsNode ? childrenOf(requirementsNode) : [])) {
    const read = readFacet(facetNode);
    if ("refused" in read) {
      passThrough.push({
        afterIndex: conditions.length,
        construct: tagOf(facetNode) ?? "requirement",
        reason: read.refused,
        xml: serialize(facetNode),
      });
    } else {
      conditions.push(read);
    }
  }

  const imported: ImportedRuleSource = {
    attributes: plainAttributes(node, ["name"]),
    applicabilityAttributes: plainAttributes(applicabilityNode),
    entityNamesAsEnumeration: asEnumeration,
    requirementsAttributes: requirementsNode ? plainAttributes(requirementsNode) : null,
    passThrough,
  };

  rules.push({ id: draftId("r"), name, entityTypes, conditions, imported });
}

/**
 * The IFC class names a `<name>` lists, or `null` when they cannot be listed and edited as a set.
 * `ids.xsd` allows one `<entity>` per applicability, so an enumeration here is how a multi-type
 * rule is written — reading it is what lets those rules be imported at all.
 *
 * Stricter than the validator's reader: anything the exporter would not reproduce exactly, such as
 * an annotation or a non-string base, refuses the specification rather than rewriting the author's
 * document behind their back.
 */
function readEntityNames(
  nameChildren: OrderedNode[]
): { names: string[]; asEnumeration: boolean } | null {
  const simpleValue = readSimpleValue(nameChildren);
  if (simpleValue !== null) return { names: [simpleValue], asEnumeration: false };

  const restrictionNode = findChild(nameChildren, "restriction");
  if (!restrictionNode) return null;

  const base = attributeOrNull(restrictionNode, "base");
  if (base !== null && base.slice(base.indexOf(":") + 1) !== "string") return null;

  const children = elementsOf(childrenOf(restrictionNode));
  if (children.some((child) => tagOf(child) !== "enumeration")) return null;
  if (children.length === 0) return null;

  return {
    names: children.map((child) => attributeOrNull(child, "value") ?? ""),
    asEnumeration: true,
  };
}

/**
 * Entity names, or a reason the specification cannot be shown. IDS also selects by attribute,
 * property, classification and material value; those decide *which* elements the rule is about,
 * so a rule displaying only part of them would be a rule the user cannot see the meaning of.
 */
function readApplicability(
  applicabilityNode: OrderedNode | null,
  reasons: UnsupportedConstruct[]
): { entityTypes: string[]; asEnumeration: boolean } {
  const entityTypes: string[] = [];
  let asEnumeration = false;
  if (!applicabilityNode) return { entityTypes, asEnumeration };

  for (const node of elementsOf(childrenOf(applicabilityNode))) {
    const tag = tagOf(node);

    if (tag !== "entity") {
      reasons.push({
        section: "applicability",
        construct: tag ?? "unknown",
        description: `Selects elements by <${tag}>, which the builder cannot show.`,
      });
      continue;
    }

    const children = childrenOf(node);
    const read = readEntityNames(descend(children, "name"));
    if (read === null) {
      reasons.push({
        section: "applicability",
        construct: "entity/name",
        description: "Gives its entity types as a pattern rather than plain names.",
      });
      continue;
    }
    entityTypes.push(...read.names);
    asEnumeration = read.asEnumeration;

    for (const child of elementsOf(children)) {
      if (tagOf(child) === "name") continue;
      reasons.push({
        section: "applicability",
        construct: `entity/${tagOf(child)}`,
        description: `Narrows <${read.names.join(", ")}> by <${tagOf(child)}>, which the builder cannot show.`,
      });
    }
  }

  return { entityTypes, asEnumeration };
}

/** Attributes a facet may carry and still be fully representable. */
const FACET_ATTRIBUTES: Record<string, string[]> = {
  attribute: ["@_cardinality"],
  property: ["@_cardinality", "@_dataType"],
};

/** Child elements a facet may carry and still be fully representable. */
const FACET_CHILDREN: Record<string, string[]> = {
  attribute: ["name", "value"],
  property: ["propertySet", "baseName", "value"],
};

/**
 * A condition the builder can display, or `null` when any part of the facet is outside its model —
 * in which case the caller keeps the whole facet verbatim rather than importing a weakened copy.
 */
/**
 * A facet the builder cannot show, and why — in the source document's own vocabulary.
 *
 * The reason is the whole point. "classification" on its own tells the user a facet was kept; it
 * does not tell them the rule they are looking at checks less than it appears to. Each refusal
 * below names the one thing that stopped it, so the message is specific rather than generic.
 */
type FacetRefusal = { refused: string };

function refused(reason: string): FacetRefusal {
  return { refused: reason };
}

function readFacet(node: OrderedNode): ConditionDraft | FacetRefusal {
  const tag = tagOf(node);
  if (tag !== "attribute" && tag !== "property") {
    return refused(`The builder can show an attribute or a property; <${tag ?? "this facet"}> is neither.`);
  }

  const unknownAttribute = Object.keys(attributesOf(node)).find(
    (key) => !FACET_ATTRIBUTES[tag].includes(key)
  );
  if (unknownAttribute !== undefined) {
    return refused(`Carries ${unknownAttribute.replace(/^@_/, "")}, which the builder cannot show.`);
  }

  const children = childrenOf(node);
  const unknownChild = elementsOf(children).find(
    (child) => !FACET_CHILDREN[tag].includes(tagOf(child) ?? "")
  );
  if (unknownChild !== undefined) {
    return refused(`Carries <${tagOf(unknownChild)}>, which the builder cannot show.`);
  }

  const cardinality = attributeOrNull(node, "cardinality");
  // "optional" has no builder equivalent, and importing it as required would export a stricter
  // file than the one that came in.
  if (cardinality !== null && cardinality !== "required" && cardinality !== "prohibited") {
    return refused(`Is cardinality="${cardinality}", which the builder has no equivalent for.`);
  }

  const value = readValueDraft(children);
  if ("refused" in value) return value;

  // The builder's prohibited row carries no value, so "must not be this value" would export as the
  // far broader "must not be present at all".
  if (cardinality === "prohibited" && value.value !== null) {
    return refused("States a prohibited value, which the builder can only express as \u201cmust not be filled in\u201d.");
  }

  const common = {
    id: draftId("c"),
    value: value.value,
    cardinality: cardinality === "prohibited" ? ("prohibited" as const) : ("required" as const),
    explicitCardinality: cardinality !== null,
  };

  if (tag === "attribute") {
    const name = readSimpleValue(descend(children, "name"));
    if (name === null) return refused("Gives its attribute name as a pattern rather than a plain name.");
    return { ...common, kind: "attribute", propertySet: null, name };
  }

  const propertySet = readSimpleValue(descend(children, "propertySet"));
  const name = readSimpleValue(descend(children, "baseName"));
  if (propertySet === null || name === null) {
    return refused("Gives its property set or property name as a pattern rather than a plain name.");
  }

  return {
    ...common,
    kind: "property",
    propertySet,
    name,
    dataType: attributeOrNull(node, "dataType"),
  };
}

/**
 * The XSD facets a `ValueDraft` can carry. Unlike the validator, this list excludes `annotation`:
 * the validator can ignore prose, but an import that dropped an author's documentation and handed
 * the file back without it would be destroying their work.
 */
const RESTRICTION_FACETS_READ = ["pattern", "enumeration"];

const BOUND_FACETS = ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive"];
const LENGTH_FACETS = ["length", "minLength", "maxLength"];

/**
 * Why a restriction could not be read, named by the one thing that stopped it.
 *
 * One sentence for all of them said "such as a range or a length", and over the 7,784-file corpus
 * that was wrong about 8 of the facets it refused: two carry an `xs:annotation`, one an
 * `xs:double` base, and the rest two `xs:pattern` children. Each of those is a different piece of
 * work, and the message is what tells the user which one their file is waiting on.
 */
function refuseRestrictionFacet(tag: string): FacetRefusal {
  if (tag === "annotation") {
    return refused("Documents its value with an <xs:annotation>, which the builder cannot show.");
  }
  if (BOUND_FACETS.includes(tag)) {
    return refused("Restricts its value to a numeric range, which the builder cannot show.");
  }
  if (LENGTH_FACETS.includes(tag)) {
    return refused("Restricts the length of its value, which the builder cannot show.");
  }
  return refused(`Restricts its value with <xs:${tag}>, which the builder cannot show.`);
}

/** The value a facet states, or the reason it cannot be shown. `null` is "no restriction at all". */
function readValueDraft(
  facetChildren: OrderedNode[]
): { value: ValueDraft | null } | FacetRefusal {
  const valueNode = findChild(facetChildren, "value");
  if (!valueNode) return { value: null };

  const valueChildren = elementsOf(childrenOf(valueNode));
  if (valueChildren.length !== 1) {
    return refused("Gives its value more than one form, which the builder cannot show.");
  }
  const [only] = valueChildren;

  if (tagOf(only) === "simpleValue") {
    return { value: { kind: "simple", value: textOf(childrenOf(only)) } };
  }
  if (tagOf(only) !== "restriction") {
    return refused(`States its value as <${tagOf(only)}>, which the builder cannot show.`);
  }

  // What the restriction is made of, before what it is based on: a numeric range legitimately
  // carries a numeric base, so checking the base first would report the range as a bad base.
  const children = elementsOf(childrenOf(only));
  const outside = children.find((child) => !RESTRICTION_FACETS_READ.includes(tagOf(child) ?? ""));
  if (outside) return refuseRestrictionFacet(tagOf(outside) ?? "");

  // A pattern and an enumeration are string constructs, so anything left here is based on a type
  // we would retype on the way back out.
  const base = attributeOrNull(only, "base");
  if (base !== null && base.slice(base.indexOf(":") + 1) !== "string") {
    return refused(`Restricts its value with base="${base}", which the builder cannot reproduce.`);
  }

  const patterns = children.filter((child) => tagOf(child) === "pattern");
  const enumerations = children.filter((child) => tagOf(child) === "enumeration");

  if (patterns.length === 1 && enumerations.length === 0) {
    return { value: patternValueDraft(attributeOrNull(patterns[0], "value") ?? "") };
  }
  if (enumerations.length > 0 && patterns.length === 0) {
    return {
      value: {
        kind: "enum",
        values: enumerations.map((child) => attributeOrNull(child, "value") ?? ""),
      },
    };
  }
  return refused("Combines several restrictions on one value, which the builder cannot show.");
}
