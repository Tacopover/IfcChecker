import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type { ParsedRestriction, UnsupportedConstruct } from "./parse-ids.js";
import { patternRestriction } from "./parse-ids.js";
import type {
  ConditionDraft,
  ConditionOperator,
  ImportedRuleSource,
  PassThrough,
  RuleDraft,
} from "./rule-draft.js";
import { escapeRegExp } from "./rule-draft.js";

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

  const restriction = readRestriction(children);
  if (restriction === UNREADABLE) {
    return refused("Restricts its value in a way the builder cannot show, such as a range or a length.");
  }

  const operator = readOperator(restriction, cardinality === "prohibited");
  if (!operator) {
    return refused("States a prohibited value, which the builder can only express as \u201cmust not be filled in\u201d.");
  }

  const explicitCardinality = cardinality !== null;

  if (tag === "attribute") {
    const name = readSimpleValue(descend(children, "name"));
    if (name === null) return refused("Gives its attribute name as a pattern rather than a plain name.");
    return {
      id: draftId("c"),
      kind: "attribute",
      propertySet: null,
      name,
      explicitCardinality,
      ...operator,
    };
  }

  const propertySet = readSimpleValue(descend(children, "propertySet"));
  const name = readSimpleValue(descend(children, "baseName"));
  if (propertySet === null || name === null) {
    return refused("Gives its property set or property name as a pattern rather than a plain name.");
  }

  return {
    id: draftId("c"),
    kind: "property",
    propertySet,
    name,
    dataType: attributeOrNull(node, "dataType"),
    explicitCardinality,
    ...operator,
  };
}

/** Distinguishes "no restriction" from "a restriction we cannot represent". */
const UNREADABLE = Symbol("unreadable restriction");

/**
 * The XSD facets a `ParsedRestriction` can carry. Unlike the validator, this list excludes
 * `annotation`: the validator can ignore prose, but an import that dropped an author's
 * documentation and handed the file back without it would be destroying their work.
 */
const RESTRICTION_FACETS_READ = ["pattern", "enumeration"];

function readRestriction(
  facetChildren: OrderedNode[]
): ParsedRestriction | null | typeof UNREADABLE {
  const valueNode = findChild(facetChildren, "value");
  if (!valueNode) return null;

  const valueChildren = elementsOf(childrenOf(valueNode));
  if (valueChildren.length !== 1) return UNREADABLE;
  const [only] = valueChildren;

  if (tagOf(only) === "simpleValue") {
    return { kind: "exact", value: textOf(childrenOf(only)) };
  }
  if (tagOf(only) !== "restriction") return UNREADABLE;

  // Re-exporting under a different base would retype the value, so only the one we emit is safe.
  const base = attributeOrNull(only, "base");
  if (base !== null && base.slice(base.indexOf(":") + 1) !== "string") return UNREADABLE;

  const children = elementsOf(childrenOf(only));
  if (children.some((child) => !RESTRICTION_FACETS_READ.includes(tagOf(child) ?? ""))) {
    return UNREADABLE;
  }

  const patterns = children.filter((child) => tagOf(child) === "pattern");
  const enumerations = children.filter((child) => tagOf(child) === "enumeration");

  if (patterns.length === 1 && enumerations.length === 0) {
    return patternRestriction(attributeOrNull(patterns[0], "value") ?? "");
  }
  if (enumerations.length > 0 && patterns.length === 0) {
    return {
      kind: "enum",
      values: enumerations.map((child) => attributeOrNull(child, "value") ?? ""),
    };
  }
  return UNREADABLE;
}

type OperatorFields = Pick<ConditionDraft, "operator" | "values" | "text">;

function readOperator(
  restriction: ParsedRestriction | null,
  prohibited: boolean
): OperatorFields | null {
  if (prohibited) {
    // The builder's notExists carries no value, so "must not be this value" would export as the
    // far broader "must not be present at all".
    return restriction ? null : { operator: "notExists", values: [], text: "" };
  }
  if (!restriction) return { operator: "exists", values: [], text: "" };
  if (restriction.kind === "exact") return { operator: "equals", values: [], text: restriction.value };
  if (restriction.kind === "enum") return { operator: "oneOf", values: restriction.values, text: "" };
  // No draft operator states a numeric range, so a rule carrying one is passed through verbatim.
  // `readRestriction` refuses bounds before they reach here; this keeps that true if it stops.
  if (restriction.kind === "bounds") return null;

  const affix = readAffixPattern(restriction.source);
  return affix ?? { operator: "matches", values: [], text: restriction.source };
}

const ANY = ".*";

/**
 * `contains`/`startsWith`/`endsWith` if the pattern is exactly what those operators would build,
 * so re-exporting reproduces the source character for character. Anything else stays a `matches`
 * pattern, which is already stored verbatim.
 */
function readAffixPattern(source: string): OperatorFields | null {
  const attempts: [ConditionOperator, string][] = [
    ["contains", source.startsWith(ANY) && source.endsWith(ANY) ? source.slice(2, -2) : ""],
    ["startsWith", source.endsWith(ANY) ? source.slice(0, -2) : ""],
    ["endsWith", source.startsWith(ANY) ? source.slice(2) : ""],
  ];

  for (const [operator, body] of attempts) {
    if (body === "") continue;
    const literal = unescapeRegExp(body);
    if (literal !== null) return { operator, values: [], text: literal };
  }
  return null;
}

/** The literal `escapeRegExp` was given, or `null` when the body is not an escaped literal. */
function unescapeRegExp(body: string): string | null {
  const literal = body.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
  return escapeRegExp(literal) === body ? literal : null;
}
