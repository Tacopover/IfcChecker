import type {
  BoundDraft,
  FacetDraft,
  PassThrough,
  RuleDraft,
  ValueDraft,
} from "./rule-draft.js";
import {
  BUILDER_PROPERTY_DATA_TYPE,
  affixPatternSource,
  applicabilityEntityNamesOf,
  plainName,
} from "./rule-draft.js";

/**
 * Everything `ids.xsd` puts in `<info>`, which is who wrote the document and what it is for.
 *
 * `title` is the one the schema makes mandatory; the other seven are `minOccurs="0"` and an empty
 * one writes no element at all. **No corpus file writes an empty one** — 7,784 have an `<info>`,
 * 7,452 of them state all eight children, and the only empty element in any of them is one
 * `<title>` — so "empty means absent" costs nothing and keeps a cleared field from exporting a
 * `<copyright></copyright>` nobody typed.
 *
 * Two carry a constraint the exporter cannot fix up for the author: `<author>` must match
 * `[^@]+@[^\.]+\..+` and `<date>` must be an `xs:date`. `infoProblems` names both rather than
 * letting a half-typed address become a document no conforming checker reads.
 */
export interface IdsDocumentInfo {
  title?: string;
  /** `null` as well as absent, so the importer's own shape can be spread in without mapping. */
  date?: string | null;
  copyright?: string | null;
  version?: string | null;
  description?: string | null;
  author?: string | null;
  purpose?: string | null;
  milestone?: string | null;
  /** `<info>` children an import could not represent, re-emitted in schema order. */
  extraInfo?: string[];
  /** Whole specifications an import refused, re-emitted verbatim at their original positions. */
  untouched?: PassThrough[];
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);
}

/** Every `ValueDraft` but the one that needs no `<xs:restriction>` around it. */
type RestrictionDraft = Exclude<ValueDraft, { kind: "simple" }>;

/** The base an `<xs:restriction>` states and the facets inside it, each line already indented. */
function restrictionPartsOf(
  value: RestrictionDraft,
  itemIndent: string
): { base: string; body: string } {
  switch (value.kind) {
    case "enum":
      return {
        base: "xs:string",
        body: value.values
          .map((entry) => `\n${itemIndent}<xs:enumeration value="${escapeXml(entry)}" />`)
          .join(""),
      };
    case "pattern":
      return {
        base: "xs:string",
        body: `\n${itemIndent}<xs:pattern value="${escapeXml(value.source)}" />`,
      };
    case "affix":
      return {
        base: "xs:string",
        body: `\n${itemIndent}<xs:pattern value="${escapeXml(affixPatternSource(value.operator, value.literal))}" />`,
      };
    // A range is the one value whose base is not a string, so it carries its own.
    case "bounds": {
      const edges: Array<[string, BoundDraft] | null> = [
        value.min && [`min${value.min.inclusive ? "Inclusive" : "Exclusive"}`, value.min],
        value.max && [`max${value.max.inclusive ? "Inclusive" : "Exclusive"}`, value.max],
      ];
      return {
        base: escapeXml(value.base),
        body: edges
          .map((edge) => (edge ? `\n${itemIndent}<xs:${edge[0]} value="${escapeXml(edge[1].value)}" />` : ""))
          .join(""),
      };
    }
    // A length counts characters, so its base is the string base every other text restriction has.
    case "length": {
      const edges: Array<[string, string | null]> = [
        ["length", value.exact],
        ["minLength", value.min],
        ["maxLength", value.max],
      ];
      return {
        base: "xs:string",
        body: edges
          .map(([tag, count]) =>
            count === null ? "" : `\n${itemIndent}<xs:${tag} value="${escapeXml(count)}" />`
          )
          .join(""),
      };
    }
  }
}

/**
 * One `idsValue` under the tag that holds it — `<value>`, but also `<name>`, `<system>` and
 * `<predefinedType>`, which the schema types identically.
 *
 * Written from the draft rather than from the compiled restriction. The draft holds what the author
 * wrote — a bound's `"1.50"`, a pattern's exact source — and compiling first would round those
 * through a `number` and a `RegExp` and hand back a document that differs from the one that came in.
 */
function idsValueXml(tag: string, value: ValueDraft | null, indent = "        "): string {
  if (value === null) return "";
  if (value.kind === "simple") {
    return `\n${indent}<${tag}><simpleValue>${escapeXml(value.value)}</simpleValue></${tag}>`;
  }
  const itemIndent = `${indent}    `;
  const { base, body } = restrictionPartsOf(value, itemIndent);
  // First, because `ids.xsd` fixes `<xs:annotation>` as the restriction's first child — it cannot
  // be appended to the facets. `undefined` writes nothing; `""` writes an empty documentation,
  // which is what a document stating one gets back.
  const annotation =
    value.annotation === undefined
      ? ""
      : `\n${itemIndent}<xs:annotation><xs:documentation>${escapeXml(value.annotation)}</xs:documentation></xs:annotation>`;
  return (
    `\n${indent}<${tag}>` +
    `\n${indent}  <xs:restriction base="${base}">${annotation}${body}` +
    `\n${indent}  </xs:restriction>` +
    `\n${indent}</${tag}>`
  );
}

/**
 * `required` is the IDS default, so it is written out only where it is not the default or for a
 * file that wrote it out itself. The requirements-side `<entity>` has none at all.
 */
function cardinalityXml(facet: Exclude<FacetDraft, { kind: "entity" }>): string {
  const value = facet.cardinality;
  return value !== "required" || facet.explicitCardinality ? ` cardinality="${value}"` : "";
}

/**
 * One facet, in either half of the specification. Total over all six kinds `ids.xsd` allows.
 *
 * `where` decides three attributes and the indentation, and nothing else. `applicabilityType`
 * references the base facet types; it is `requirementsType` that extends each of them with
 * `cardinality`, `instructions` and — on three of them — `uri`. Writing one of those into an
 * applicability produces a document no conforming checker reads, so an applicability facet draft
 * never holds one and this never emits one. `relation` and `dataType` belong to the base types and
 * are written on both sides.
 */
function facetXml(facet: FacetDraft, where: FacetSide = "requirements"): string {
  const inRequirements = where === "requirements";
  const indent = inRequirements ? "      " : "        ";
  const valueIndent = `${indent}  `;
  const instructions = inRequirements ? attributeXml("instructions", facet.instructions) : "";
  const cardinality = (kept: Exclude<FacetDraft, { kind: "entity" }>) =>
    inRequirements ? cardinalityXml(kept) : "";
  const uri = (value: string | null | undefined) =>
    inRequirements ? attributeXml("uri", value) : "";

  switch (facet.kind) {
    // No `uri` on an attribute: ids.xsd gives it to classification, property and material alone,
    // and emitting one here would produce a document no conforming checker reads.
    case "attribute":
      return (
        `${indent}<attribute${cardinality(facet)}${instructions}>` +
        idsValueXml("name", facet.name, valueIndent) +
        idsValueXml("value", facet.value, valueIndent) +
        `\n${indent}</attribute>`
      );

    case "property": {
      // `undefined` is a builder-authored condition; `null` is an import whose source omitted the
      // attribute, and re-adding a default there would retype a property the file left untyped.
      const dataType = facet.dataType === undefined ? BUILDER_PROPERTY_DATA_TYPE : facet.dataType;
      const dataTypeAttribute = dataType === null ? "" : ` dataType="${escapeXml(dataType)}"`;
      return (
        `${indent}<property${dataTypeAttribute}${uri(facet.uri)}${cardinality(facet)}${instructions}>` +
        // `<propertySet>` is mandatory, so a rule stating none writes an empty one rather than
        // omitting the element and producing a document no conforming reader accepts.
        idsValueXml("propertySet", facet.propertySet ?? plainName(""), valueIndent) +
        idsValueXml("baseName", facet.name, valueIndent) +
        idsValueXml("value", facet.value, valueIndent) +
        `\n${indent}</property>`
      );
    }

    case "entity":
      return (
        `${indent}<entity${instructions}>` +
        idsValueXml("name", facet.name, valueIndent) +
        idsValueXml("predefinedType", facet.predefinedType, valueIndent) +
        `\n${indent}</entity>`
      );

    // `<value>` before `<system>`: ids.xsd fixes that order, and a reader validating against the
    // schema rejects the pair the other way round.
    case "classification":
      return (
        `${indent}<classification${uri(facet.uri)}${cardinality(facet)}${instructions}>` +
        idsValueXml("value", facet.value, valueIndent) +
        idsValueXml("system", facet.system, valueIndent) +
        `\n${indent}</classification>`
      );

    case "material":
      return (
        `${indent}<material${uri(facet.uri)}${cardinality(facet)}${instructions}>` +
        idsValueXml("value", facet.value, valueIndent) +
        `\n${indent}</material>`
      );

    case "partOf":
      return (
        `${indent}<partOf${attributeXml("relation", facet.relation)}${cardinality(facet)}${instructions}>` +
        `\n${valueIndent}<entity>` +
        idsValueXml("name", facet.entityName, `${valueIndent}  `) +
        idsValueXml("predefinedType", facet.predefinedType, `${valueIndent}  `) +
        `\n${valueIndent}</entity>` +
        `\n${indent}</partOf>`
      );
  }
}

/** Which half of a specification a facet is being written into. */
type FacetSide = "requirements" | "applicability";

function attributeXml(name: string, value: string | null | undefined): string {
  return value === null || value === undefined ? "" : ` ${name}="${escapeXml(value)}"`;
}

/**
 * What a rule states when it names no schema version.
 *
 * `ids.xsd` makes `ifcVersion` required, so there is no "state none" — this is the value the
 * exporter has always written for an authored rule, kept as the default rather than becoming a
 * choice the user has to make before their first export.
 */
export const DEFAULT_IFC_VERSION = "IFC4";

/** An attribute the schema makes optional: empty and absent both write nothing. */
function optionalAttributeXml(name: string, value: string | null | undefined): string {
  return typeof value === "string" && value !== "" ? attributeXml(name, value) : "";
}

function attributesXml(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([name, value]) => attributeXml(name, value))
    .join("");
}

/** Re-indents a verbatim fragment to sit level with the elements around it. */
function indent(xml: string, prefix: string): string {
  return xml
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

/**
 * Representable siblings interleaved with the verbatim ones, each of which records how many
 * representable siblings preceded it in the source. Leftovers land at the end, which is where a
 * pass-through whose neighbouring conditions the user has since deleted belongs.
 */
function interleave(
  representable: string[],
  passThrough: PassThrough[],
  prefix: string
): string[] {
  const out: string[] = [];
  for (let index = 0; index <= representable.length; index += 1) {
    for (const entry of passThrough) {
      const slot = Math.min(entry.afterIndex, representable.length);
      if (slot === index) out.push(indent(entry.xml, prefix));
    }
    if (index < representable.length) out.push(representable[index]);
  }
  return out;
}

/**
 * The one `<entity>` an applicability may hold. `ids.xsd` allows a single entity facet there, so
 * several types are one facet whose name is an enumeration — emitting one `<entity>` per type
 * produces a document no conforming checker will read.
 */
function entityApplicabilityXml(
  names: string[],
  asEnumeration: boolean,
  predefinedType: ValueDraft | null
): string[] {
  if (names.length === 0) return [];
  // `<name>` is mandatory and `<predefinedType>` follows it, so the one-line form only survives
  // while there is no second child to write.
  if (names.length === 1 && !asEnumeration && predefinedType === null) {
    return [`        <entity><name><simpleValue>${escapeXml(names[0])}</simpleValue></name></entity>`];
  }

  const nameXml =
    names.length === 1 && !asEnumeration
      ? [`          <name><simpleValue>${escapeXml(names[0])}</simpleValue></name>`]
      : [
          `          <name>`,
          `            <xs:restriction base="xs:string">`,
          ...names.map((name) => `              <xs:enumeration value="${escapeXml(name)}" />`),
          `            </xs:restriction>`,
          `          </name>`,
        ];

  return [
    `        <entity>`,
    ...nameXml,
    ...idsValueXml("predefinedType", predefinedType, "          ").split("\n").filter(Boolean),
    `        </entity>`,
  ];
}

function specificationXml(rule: RuleDraft): string {
  const source = rule.imported;
  const entities = entityApplicabilityXml(
    applicabilityEntityNamesOf(rule),
    source?.entityNamesAsEnumeration ?? false,
    rule.entityPredefinedType ?? null
  );
  // In the order the draft holds them, which is the order the source wrote them. `ids.xsd` fixes
  // the order of the kinds, so a file that reaches here in a different one was already invalid on
  // the way in, and reordering it would be correcting someone else's document rather than
  // reproducing it.
  const applicabilityFacets = (rule.applicabilityFacets ?? []).map((facet) =>
    facetXml(facet, "applicability")
  );

  // The five the panel edits are written from the draft; anything else the source carried follows
  // verbatim. Attribute order is not significant to a reader, so hoisting these changes no meaning.
  const specAttributes =
    attributeXml("name", rule.name) +
    attributeXml("ifcVersion", rule.ifcVersion || DEFAULT_IFC_VERSION) +
    optionalAttributeXml("identifier", rule.identifier) +
    optionalAttributeXml("description", rule.description) +
    optionalAttributeXml("instructions", rule.instructions) +
    attributesXml(source?.attributes ?? {});

  const applicabilityAttributes = source
    ? attributesXml(source.applicabilityAttributes)
    : ` minOccurs="1" maxOccurs="unbounded"`;

  const facets = interleave(
    rule.conditions.map((facet) => facetXml(facet)),
    source?.passThrough ?? [],
    "      "
  );
  // A source with no <requirements> at all is an applicability-only rule, and inventing an empty
  // element for it would turn "these elements must exist" into something the schema reads differently.
  const requirements =
    source && source.requirementsAttributes === null && facets.length === 0
      ? []
      : [
          `      <requirements${optionalAttributeXml("description", rule.requirementsDescription)}${attributesXml(source?.requirementsAttributes ?? {})}>`,
          ...facets,
          `      </requirements>`,
        ];

  return [
    `    <specification${specAttributes}>`,
    `      <applicability${applicabilityAttributes}>`,
    ...entities,
    ...applicabilityFacets,
    `      </applicability>`,
    ...requirements,
    `    </specification>`,
  ].join("\n");
}

/** `ids.xsd` fixes the order of `<info>` children, so a carried-through one cannot just be appended. */
const INFO_ORDER = [
  "title",
  "copyright",
  "version",
  "description",
  "author",
  "date",
  "purpose",
  "milestone",
];

function infoXml(info: IdsDocumentInfo, title: string, date: string, extraInfo: string[]): string[] {
  const stated: Array<[string, string | null | undefined]> = [
    ["title", title],
    ["copyright", info.copyright],
    ["version", info.version],
    ["description", info.description],
    ["author", info.author],
    ["date", date],
    ["purpose", info.purpose],
    ["milestone", info.milestone],
  ];

  const entries = [
    ...stated
      // An empty one writes no element, which is what `minOccurs="0"` is for and what a cleared box
      // means — but **not for `<title>`**, which the schema requires. One corpus file states an
      // empty title, and dropping it exported the only document this change made schema-invalid.
      // Reproducing someone else's empty title is right; `infoProblems` is what stops one being
      // authored here.
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && (entry[1] !== "" || entry[0] === "title")
      )
      .map(([tag, value]) => ({
        order: INFO_ORDER.indexOf(tag),
        xml: `    <${tag}>${escapeXml(value)}</${tag}>`,
      })),
    ...extraInfo.map((xml) => {
      const tag = /<\s*([\w:.]+)/.exec(xml)?.[1] ?? "";
      const order = INFO_ORDER.indexOf(tag.slice(tag.indexOf(":") + 1));
      return { order: order === -1 ? INFO_ORDER.length : order, xml: indent(xml, "    ") };
    }),
  ];

  return entries.sort((left, right) => left.order - right.order).map((entry) => entry.xml);
}

/**
 * `ids.xsd` narrows two of the eight `<info>` children beyond `xs:string`, and neither can be fixed
 * up on the author's behalf: `<author>` carries an `xs:pattern` and `<date>` is an `xs:date`.
 *
 * Transcribed from the schema rather than approximated. The pattern is deliberately as loose as the
 * one in the file — it admits addresses no mail server would — because tightening it here would
 * reject a document `ids.xsd` accepts.
 */
const AUTHOR_PATTERN = /^[^@]+@[^.]+\..+$/;
const DATE_PATTERN = /^-?\d{4}-\d{2}-\d{2}(Z|[+-]\d{2}:\d{2})?$/;

/** One line per `<info>` field that would make the document schema-invalid. Empty when it would not. */
export function infoProblems(info: IdsDocumentInfo): string[] {
  const problems: string[] = [];
  if (info.title !== undefined && info.title.trim() === "") {
    problems.push("Title — IDS requires one on every document.");
  }
  if (info.author && !AUTHOR_PATTERN.test(info.author)) {
    problems.push(`Author — IDS requires an email address, and "${info.author}" is not one.`);
  }
  if (info.date && !DATE_PATTERN.test(info.date)) {
    problems.push(`Date — IDS requires YYYY-MM-DD, and "${info.date}" is not.`);
  }
  return problems;
}

export function buildIdsXml(rules: RuleDraft[], info: IdsDocumentInfo = {}): string {
  const title = info.title ?? "IDS rules";
  const date = info.date ?? new Date().toISOString().slice(0, 10);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ids xmlns="http://standards.buildingsmart.org/IDS"`,
    `     xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
    `  <info>`,
    ...infoXml(info, title, date, info.extraInfo ?? []),
    `  </info>`,
    `  <specifications>`,
    ...interleave(rules.map(specificationXml), info.untouched ?? [], "    "),
    `  </specifications>`,
    `</ids>`,
  ].join("\n");
}
