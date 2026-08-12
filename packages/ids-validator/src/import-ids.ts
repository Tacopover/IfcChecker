import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type { UnsupportedConstruct } from "./parse-ids.js";
import type {
  ApplicabilityFacetDraft,
  BoundDraft,
  ClassificationFacetDraft,
  ConditionDraft,
  ConditionalCardinality,
  EntityFacetDraft,
  FacetDraft,
  ImportedRuleSource,
  LengthDraft,
  MaterialFacetDraft,
  PartOfFacetDraft,
  PassThrough,
  RuleDraft,
  SimpleCardinality,
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
  const { entityTypes, asEnumeration, applicabilityFacets } = readApplicability(
    applicabilityNode,
    reasons
  );

  // A rule may name no type and still select something, because `ids.xsd` makes `<entity>`
  // minOccurs="0" — "every element carrying this property" is a whole applicability on its own.
  if (reasons.length > 0 || (entityTypes.length === 0 && applicabilityFacets.length === 0)) {
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
  const conditions: FacetDraft[] = [];
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

  rules.push({
    id: draftId("r"),
    name,
    entityTypes,
    // Absent rather than empty for the rule that states none, so a file whose applicability is an
    // entity list alone produces exactly the draft it always did.
    ...(applicabilityFacets.length > 0 ? { applicabilityFacets } : {}),
    conditions,
    imported,
  });
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
 * What the applicability selects by: the entity names it lists, and every other facet beside them.
 * A facet that cannot be shown is a reason, and one reason refuses the whole specification — a
 * rule displaying only part of what decides its subject is a rule the user cannot see the meaning
 * of.
 */
function readApplicability(
  applicabilityNode: OrderedNode | null,
  reasons: UnsupportedConstruct[]
): { entityTypes: string[]; asEnumeration: boolean; applicabilityFacets: ApplicabilityFacetDraft[] } {
  const entityTypes: string[] = [];
  const applicabilityFacets: ApplicabilityFacetDraft[] = [];
  let asEnumeration = false;
  if (!applicabilityNode) return { entityTypes, asEnumeration, applicabilityFacets };

  for (const node of elementsOf(childrenOf(applicabilityNode))) {
    const tag = tagOf(node);

    if (tag !== "entity") {
      const facet = readApplicabilityFacet(node, tag);
      if ("refused" in facet) {
        reasons.push({
          section: "applicability",
          construct: tag ?? "unknown",
          description: facet.refused,
        });
      } else {
        applicabilityFacets.push(facet);
      }
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

  return { entityTypes, asEnumeration, applicabilityFacets };
}

/**
 * One facet standing beside the `<entity>` in an applicability, or the reason it cannot be shown.
 *
 * The same readers the requirements side uses, told which side they are on. What differs is the
 * attributes: `applicabilityType` references the base facet types, so `cardinality`,
 * `instructions` and `uri` are all refused here rather than read. Nothing else differs, because
 * "the element carries this property" is the same statement wherever it stands.
 */
function readApplicabilityFacet(
  node: OrderedNode,
  tag: string | null
): ApplicabilityFacetDraft | FacetRefusal {
  switch (tag) {
    case "attribute":
    case "property":
      return readSlotFacet(node, tag, "applicability");
    case "classification":
      return readClassificationFacet(node, "applicability");
    case "material":
      return readMaterialFacet(node, "applicability");
    case "partOf":
      return readPartOfFacet(node, "applicability");
    default:
      return refused(`Selects elements by <${tag}>, which the builder cannot show.`);
  }
}

/**
 * Attributes a facet may carry and still be fully representable.
 *
 * `uri` is on the property and not on the attribute because that is what `ids.xsd` says: it gives
 * `uri` to classification, property and material alone. Allowing it on an attribute would import a
 * document the schema does not describe and export it again unchanged.
 */
const FACET_ATTRIBUTES: Record<string, string[]> = {
  attribute: ["@_cardinality", "@_instructions"],
  property: ["@_cardinality", "@_dataType", "@_uri", "@_instructions"],
  classification: ["@_cardinality", "@_uri", "@_instructions"],
  partOf: ["@_cardinality", "@_relation", "@_instructions"],
  material: ["@_cardinality", "@_uri", "@_instructions"],
  // No cardinality: ids.xsd gives the requirements-side entity none, and says why in a comment —
  // the list of IFC classes is finite and mandated, so a prohibited form would be superfluous.
  entity: ["@_instructions"],
};

/**
 * The same, for a facet standing in an `<applicability>` — and it is much shorter.
 *
 * `applicabilityType` references `attributeType`, `propertyType`, `classificationType`,
 * `materialType` and `partOfType` directly, and it is `requirementsType` that extends each of them
 * with `cardinality`, `instructions` and (on three) `uri`. So only what the base type declares may
 * appear here: `dataType` on a property, `relation` on a partOf, and nothing else at all. Over the
 * 7,784-file corpus no applicability facet carries anything else, so this costs nothing and keeps
 * a `cardinality="prohibited"` from silently inverting which elements a rule is about.
 */
const APPLICABILITY_FACET_ATTRIBUTES: Record<string, string[]> = {
  attribute: [],
  property: ["@_dataType"],
  classification: [],
  partOf: ["@_relation"],
  material: [],
};

/** What an `entityType` element holds, wherever `ids.xsd` nests one. */
const ENTITY_CHILDREN = ["name", "predefinedType"];

/** Child elements a facet may carry and still be fully representable. */
const FACET_CHILDREN: Record<string, string[]> = {
  attribute: ["name", "value"],
  property: ["propertySet", "baseName", "value"],
  classification: ["value", "system"],
  partOf: ["entity"],
  material: ["value"],
  entity: ENTITY_CHILDREN,
};

/**
 * What a draft of IDS carried and 1.0 does not, keyed by the facet that carries it.
 *
 * These are the one group of refusals that is final. A 1.0 `<property>` names its field with
 * `<baseName>` and types it with `dataType`; `<name>` and `measure` are the 0.9-era spellings, and
 * the corpus holds 13 facets still using them, all in one file. Keeping those verbatim is the
 * correct and permanent answer for them, so the reason says so rather than implying that a control
 * for them is on its way.
 */
const PRE_1_0_ATTRIBUTES: Record<string, string[]> = { property: ["@_measure"] };
const PRE_1_0_CHILDREN: Record<string, string[]> = { property: ["name"] };

/** The reason a construct is kept, saying outright when no version of the builder will show it. */
function refuseConstruct(construct: string, permanent: boolean): FacetRefusal {
  return refused(
    permanent
      ? `Carries ${construct}, which IDS 1.0 does not have. It is kept exactly as written, on purpose.`
      : `Carries ${construct}, which the builder cannot show.`
  );
}

/**
 * Whether the source states one of the three cardinalities `ids.xsd` gives an attribute or a
 * property.
 *
 * Whether a facet must be there and what it may say are two separate questions in IDS, so all three
 * are read whatever value stands beside them — including `prohibited` with a value, which says
 * "must not be Steel" rather than "must not be present at all". Anything outside the three is a
 * file the schema does not allow, and importing it would mean choosing a cardinality for the author.
 */
function isConditionalCardinality(value: string): value is ConditionalCardinality {
  return value === "required" || value === "optional" || value === "prohibited";
}

/**
 * Whether the source states one of the two cardinalities `ids.xsd` gives a `partOf`.
 *
 * `simpleCardinality` has no `optional`, so a `cardinality="optional"` on a partOf is a document
 * the schema does not describe. Reading it as one of the other two would answer a question the
 * author did not ask.
 */
function isSimpleCardinality(value: string): value is SimpleCardinality {
  return value === "required" || value === "prohibited";
}

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

/**
 * The parts every facet carries, once the attributes and children it may hold are checked against
 * what `ids.xsd` gives its own kind.
 *
 * `stated` is the raw `cardinality` attribute rather than a value of either enumeration: the two
 * alphabets differ per facet — `partOf` has no `optional` — so each reader below checks it against
 * its own.
 */
interface FacetShell {
  id: string;
  instructions: string | null;
  explicitCardinality: boolean;
  stated: string | null;
}

/**
 * Which half of the specification a facet stands in.
 *
 * The elements a facet holds are the same on both sides; only the attributes differ, which is why
 * one reader serves both. An applicability facet's `stated` is always `null` and its `instructions`
 * always absent, because `APPLICABILITY_FACET_ATTRIBUTES` refuses either before this is reached.
 */
type FacetSide = "requirements" | "applicability";

function readFacetShell(node: OrderedNode, tag: string, side: FacetSide): FacetShell | FacetRefusal {
  const allowed =
    side === "requirements" ? FACET_ATTRIBUTES[tag] : APPLICABILITY_FACET_ATTRIBUTES[tag];
  const unknownAttribute = Object.keys(attributesOf(node)).find((key) => !allowed.includes(key));
  if (unknownAttribute !== undefined) {
    return refuseConstruct(
      unknownAttribute.replace(/^@_/, ""),
      PRE_1_0_ATTRIBUTES[tag]?.includes(unknownAttribute) ?? false
    );
  }

  const unknownChild = elementsOf(childrenOf(node)).find(
    (child) => !FACET_CHILDREN[tag].includes(tagOf(child) ?? "")
  );
  if (unknownChild !== undefined) {
    const child = tagOf(unknownChild) ?? "";
    return refuseConstruct(`<${child}>`, PRE_1_0_CHILDREN[tag]?.includes(child) ?? false);
  }

  const stated = attributeOrNull(node, "cardinality");
  return {
    id: draftId("c"),
    instructions: attributeOrNull(node, "instructions"),
    explicitCardinality: stated !== null,
    stated,
  };
}

function readFacet(node: OrderedNode): FacetDraft | FacetRefusal {
  const tag = tagOf(node);
  switch (tag) {
    case "attribute":
    case "property":
      return readSlotFacet(node, tag);
    case "classification":
      return readClassificationFacet(node);
    case "partOf":
      return readPartOfFacet(node);
    case "material":
      return readMaterialFacet(node);
    case "entity":
      return readEntityFacet(node);
    default:
      return refused(`The builder cannot show a <${tag ?? "this facet"}> requirement.`);
  }
}

/**
 * The two parameters an `entityType` element states, wherever `ids.xsd` nests one.
 *
 * `<name>` is mandatory and the drafts that hold one type it as a plain `ValueDraft`, so a nameless
 * entity is kept verbatim rather than imported as an entity that requires nothing.
 */
function readNestedEntity(
  entityNode: OrderedNode,
  subject: string
): { name: ValueDraft; predefinedType: ValueDraft | null } | FacetRefusal {
  const children = childrenOf(entityNode);
  const unknownChild = elementsOf(children).find(
    (child) => !ENTITY_CHILDREN.includes(tagOf(child) ?? "")
  );
  if (unknownChild !== undefined) {
    return refused(`${subject} carries <${tagOf(unknownChild)}>, which the builder cannot show.`);
  }

  const name = readValueDraft(children, "name");
  if ("refused" in name) return name;
  if (name.value === null) {
    return refused(`${subject} names no IFC class, so what it requires is unknown.`);
  }

  const predefinedType = readValueDraft(children, "predefinedType");
  if ("refused" in predefinedType) return predefinedType;

  return { name: name.value, predefinedType: predefinedType.value };
}

/**
 * The IFC class the element must be.
 *
 * The one facet with no cardinality at all, so `readFacetShell` refuses a `cardinality` attribute
 * here through the same unknown-attribute check that catches a `uri` on an attribute.
 */
function readEntityFacet(node: OrderedNode): EntityFacetDraft | FacetRefusal {
  const shell = readFacetShell(node, "entity", "requirements");
  if ("refused" in shell) return shell;

  const entity = readNestedEntity(node, "This entity requirement");
  if ("refused" in entity) return entity;

  return {
    id: shell.id,
    kind: "entity",
    name: entity.name,
    predefinedType: entity.predefinedType,
    instructions: shell.instructions,
  };
}

/**
 * A material requirement. `<value>` is optional, and a facet without one asks only whether the
 * element is made of anything at all — which is a real check, not an empty one.
 */
function readMaterialFacet(
  node: OrderedNode,
  side: FacetSide = "requirements"
): MaterialFacetDraft | FacetRefusal {
  const shell = readFacetShell(node, "material", side);
  if ("refused" in shell) return shell;
  if (shell.stated !== null && !isConditionalCardinality(shell.stated)) {
    return refused(`Is cardinality="${shell.stated}", which ids.xsd does not give this facet.`);
  }

  const value = readValueDraft(childrenOf(node));
  if ("refused" in value) return value;

  return {
    id: shell.id,
    kind: "material",
    value: value.value,
    uri: attributeOrNull(node, "uri"),
    cardinality: shell.stated ?? "required",
    explicitCardinality: shell.explicitCardinality,
    instructions: shell.instructions,
  };
}

function readPartOfFacet(
  node: OrderedNode,
  side: FacetSide = "requirements"
): PartOfFacetDraft | FacetRefusal {
  const shell = readFacetShell(node, "partOf", side);
  if ("refused" in shell) return shell;
  if (shell.stated !== null && !isSimpleCardinality(shell.stated)) {
    return refused(`Is cardinality="${shell.stated}", which ids.xsd does not give this facet.`);
  }

  const entityNode = findChild(childrenOf(node), "entity");
  if (!entityNode) {
    return refused("States no <entity>, so the whole it must be part of is unknown.");
  }
  const entity = readNestedEntity(entityNode, "The whole it must be part of");
  if ("refused" in entity) return entity;

  return {
    id: shell.id,
    kind: "partOf",
    // The source attribute verbatim: one member of the schema's enumeration is two relationship
    // names in a single value, so splitting here would leave the exporter guessing how to join
    // them back. `compileFacet` splits.
    relation: attributeOrNull(node, "relation"),
    entityName: entity.name,
    predefinedType: entity.predefinedType,
    cardinality: shell.stated ?? "required",
    explicitCardinality: shell.explicitCardinality,
    instructions: shell.instructions,
  };
}

/** The two facets that name one value slot on the element and constrain what it holds. */
function readSlotFacet(
  node: OrderedNode,
  tag: "attribute" | "property",
  side: FacetSide = "requirements"
): ConditionDraft | FacetRefusal {
  const shell = readFacetShell(node, tag, side);
  if ("refused" in shell) return shell;
  if (shell.stated !== null && !isConditionalCardinality(shell.stated)) {
    return refused(`Is cardinality="${shell.stated}", which ids.xsd does not give this facet.`);
  }

  const children = childrenOf(node);
  const value = readValueDraft(children);
  if ("refused" in value) return value;

  const common = {
    id: shell.id,
    value: value.value,
    cardinality: shell.stated ?? "required",
    explicitCardinality: shell.explicitCardinality,
    instructions: shell.instructions,
  };

  if (tag === "attribute") {
    const name = readValueDraft(children, "name");
    if ("refused" in name) return name;
    if (name.value === null) {
      return refused("Names no attribute, so what it requires is unknown.");
    }
    return { ...common, kind: "attribute", propertySet: null, name: name.value };
  }

  // `ids.xsd` makes both mandatory, so a property missing one is a document the schema does not
  // describe. The draft cannot state none, and inventing one would author the rule.
  const propertySet = readValueDraft(children, "propertySet");
  if ("refused" in propertySet) return propertySet;
  const name = readValueDraft(children, "baseName");
  if ("refused" in name) return name;
  if (propertySet.value === null || name.value === null) {
    return refused("Names no property set or no property, so what it requires is unknown.");
  }

  return {
    ...common,
    kind: "property",
    propertySet: propertySet.value,
    name: name.value,
    dataType: attributeOrNull(node, "dataType"),
    uri: attributeOrNull(node, "uri"),
  };
}

function readClassificationFacet(
  node: OrderedNode,
  side: FacetSide = "requirements"
): ClassificationFacetDraft | FacetRefusal {
  const shell = readFacetShell(node, "classification", side);
  if ("refused" in shell) return shell;
  if (shell.stated !== null && !isConditionalCardinality(shell.stated)) {
    return refused(`Is cardinality="${shell.stated}", which ids.xsd does not give this facet.`);
  }

  const children = childrenOf(node);
  const value = readValueDraft(children);
  if ("refused" in value) return value;

  // `ids.xsd` makes <system> mandatory, so a classification without one is a document the schema
  // does not describe. A draft cannot state none, and inventing one would author the rule.
  const system = readValueDraft(children, "system");
  if ("refused" in system) return system;
  if (system.value === null) {
    return refused("States no <system>, so the classification system it requires is unknown.");
  }

  return {
    id: shell.id,
    kind: "classification",
    system: system.value,
    value: value.value,
    uri: attributeOrNull(node, "uri"),
    cardinality: shell.stated ?? "required",
    explicitCardinality: shell.explicitCardinality,
    instructions: shell.instructions,
  };
}

/** The four bound facets, paired with the edge each one sets. */
const BOUND_FACETS = [
  { tag: "minInclusive", edge: "min", inclusive: true },
  { tag: "minExclusive", edge: "min", inclusive: false },
  { tag: "maxInclusive", edge: "max", inclusive: true },
  { tag: "maxExclusive", edge: "max", inclusive: false },
] as const;

/** The three length facets, paired with the edge each one sets. */
const LENGTH_FACETS = [
  { tag: "length", edge: "exact" },
  { tag: "minLength", edge: "min" },
  { tag: "maxLength", edge: "max" },
] as const;

/**
 * The XSD facets a `ValueDraft` can carry. Unlike the validator, this list excludes `annotation`:
 * the validator can ignore prose, but an import that dropped an author's documentation and handed
 * the file back without it would be destroying their work.
 */
const RESTRICTION_FACETS_READ = [
  "pattern",
  "enumeration",
  ...BOUND_FACETS.map((facet) => facet.tag),
  ...LENGTH_FACETS.map((facet) => facet.tag),
];

/**
 * Why a restriction could not be read, named by the one thing that stopped it.
 *
 * One sentence for all of them said "such as a range or a length", and over the 7,784-file corpus
 * that was wrong about 8 of the facets it refused: two carry an `xs:annotation`, one an
 * `xs:double` base, and the rest two `xs:pattern` children. Each of those is a different piece of
 * work, and the message is what tells the user which one their file is waiting on.
 *
 * Both halves of that sentence are gone — ranges and lengths are read now.
 */
function refuseRestrictionFacet(tag: string): FacetRefusal {
  if (tag === "annotation") {
    return refused("Documents its value with an <xs:annotation>, which the builder cannot show.");
  }
  return refused(`Restricts its value with <xs:${tag}>, which the builder cannot show.`);
}

/**
 * The value under one of a facet's parameters, or the reason it cannot be shown. `null` is "the
 * parameter is absent", which for `<value>` means no restriction at all.
 *
 * Named because a facet may state several: a classification constrains its `<system>` and its
 * `<value>` independently, and each is an `idsValue` in its own right.
 */
function readValueDraft(
  facetChildren: OrderedNode[],
  parameter = "value"
): { value: ValueDraft | null } | FacetRefusal {
  const valueNode = findChild(facetChildren, parameter);
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

  const base = attributeOrNull(only, "base");
  const patterns = children.filter((child) => tagOf(child) === "pattern");
  const enumerations = children.filter((child) => tagOf(child) === "enumeration");
  const bounds = children.filter((child) =>
    BOUND_FACETS.some((facet) => facet.tag === tagOf(child))
  );
  const lengths = children.filter((child) =>
    LENGTH_FACETS.some((facet) => facet.tag === tagOf(child))
  );

  // XSD would intersect two families, and a `ValueDraft` states one thing. Dropping either half
  // would export a rule that checks less than the file asks for.
  const families = [patterns.length, enumerations.length, bounds.length, lengths.length].filter(
    (count) => count > 0
  );
  if (families.length !== 1 || patterns.length > 1) {
    return refused("Combines several restrictions on one value, which the builder cannot show.");
  }

  // A range keeps whatever base the author wrote, right down to a capitalised `xs:Decimal`.
  if (bounds.length > 0) return readBoundsDraft(base ?? "xs:double", bounds);

  // A pattern, an enumeration and a length are all string constructs, so anything left here is
  // based on a type we would retype on the way back out.
  if (base !== null && base.slice(base.indexOf(":") + 1) !== "string") {
    return refused(`Restricts its value with base="${base}", which the builder cannot reproduce.`);
  }

  if (patterns.length === 1) {
    return { value: patternValueDraft(attributeOrNull(patterns[0], "value") ?? "") };
  }
  if (lengths.length > 0) return readLengthDraft(lengths);
  return {
    value: {
      kind: "enum",
      values: enumerations.map((child) => attributeOrNull(child, "value") ?? ""),
    },
  };
}

/**
 * The numeric range a restriction states, with each edge's literal kept as written.
 *
 * Two children setting the same edge — `minInclusive` beside `minExclusive`, or the same tag twice
 * — refuse rather than resolve. A `ValueDraft` holds one bound per edge, so keeping the first would
 * export the file with the other constraint quietly removed.
 *
 * An edge whose value is not a number refuses too, the same rule `readLengthDraft` applies. A
 * restriction whose only bound is unreadable compiles to `{min: null, max: null}`, and
 * `withinBounds` answers **true** to every number — so importing one would turn a malformed file
 * into a rule that passes every element, while `parseIdsXml` reads the same file as an empty
 * enumeration that fails every element. Refusing keeps the two readers agreeing, and keeps a bounds
 * draft always stating at least one edge the validator can compare.
 */
function readBoundsDraft(
  base: string,
  boundNodes: OrderedNode[]
): { value: ValueDraft } | FacetRefusal {
  const edges: { min: BoundDraft | null; max: BoundDraft | null } = { min: null, max: null };

  for (const node of boundNodes) {
    const facet = BOUND_FACETS.find((candidate) => candidate.tag === tagOf(node));
    if (!facet) continue;
    if (edges[facet.edge] !== null) {
      const edge = facet.edge === "min" ? "lower" : "upper";
      return refused(`States its ${edge} bound twice, so the builder cannot show it as one range.`);
    }
    const value = attributeOrNull(node, "value") ?? "";
    if (value.trim() === "" || !Number.isFinite(Number(value))) {
      return refused(`Gives <xs:${facet.tag}> the value "${value}", which is not a number.`);
    }
    edges[facet.edge] = { value, inclusive: facet.inclusive };
  }

  return { value: { kind: "bounds", base, ...edges } };
}

/**
 * The character counts a restriction states, each kept as the author wrote it.
 *
 * Stricter than `readBoundsDraft` about a value it cannot read, and deliberately: a length stating
 * no readable edge compiles to a restriction that admits everything, so importing one would turn a
 * malformed file into a rule that passes every element. Keeping it verbatim says so instead.
 */
function readLengthDraft(lengthNodes: OrderedNode[]): { value: ValueDraft } | FacetRefusal {
  const edges: LengthDraft = { exact: null, min: null, max: null };

  for (const node of lengthNodes) {
    const facet = LENGTH_FACETS.find((candidate) => candidate.tag === tagOf(node));
    if (!facet) continue;
    if (edges[facet.edge] !== null) {
      return refused(`States <xs:${facet.tag}> twice, so the builder cannot show it as one length.`);
    }
    const count = attributeOrNull(node, "value") ?? "";
    if (!/^\d+$/.test(count.trim())) {
      return refused(`Gives <xs:${facet.tag}> the value "${count}", which is not a character count.`);
    }
    edges[facet.edge] = count;
  }

  return { value: { kind: "length", ...edges } };
}
