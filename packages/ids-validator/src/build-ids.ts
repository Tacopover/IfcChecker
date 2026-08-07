import type { ParsedRestriction } from "./parse-ids.js";
import type { ConditionDraft, PassThrough, RuleDraft } from "./rule-draft.js";
import {
  BUILDER_PROPERTY_DATA_TYPE,
  cardinalityForCondition,
  restrictionForCondition,
} from "./rule-draft.js";

export interface IdsDocumentInfo {
  title?: string;
  date?: string;
  /** `<info>` children an import could not represent, re-emitted after the date. */
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

function restrictionXml(restriction: ParsedRestriction | null): string {
  if (!restriction) return "";
  if (restriction.kind === "exact") {
    return `\n        <value><simpleValue>${escapeXml(restriction.value)}</simpleValue></value>`;
  }
  const body =
    restriction.kind === "enum"
      ? restriction.values
          .map((value) => `\n            <xs:enumeration value="${escapeXml(value)}" />`)
          .join("")
      : `\n            <xs:pattern value="${escapeXml(restriction.source)}" />`;
  return `\n        <value>\n          <xs:restriction base="xs:string">${body}\n          </xs:restriction>\n        </value>`;
}

function facetXml(condition: ConditionDraft): string {
  const restriction = restrictionXml(restrictionForCondition(condition));
  const value = cardinalityForCondition(condition);
  // `required` is the IDS default, so it is written out only for a file that wrote it out itself.
  const cardinality =
    value === "prohibited" || condition.explicitCardinality ? ` cardinality="${value}"` : "";

  if (condition.kind === "attribute") {
    return [
      `      <attribute${cardinality}>`,
      `        <name><simpleValue>${escapeXml(condition.name)}</simpleValue></name>${restriction}`,
      `      </attribute>`,
    ].join("\n");
  }

  // `undefined` is a builder-authored condition; `null` is an import whose source omitted the
  // attribute, and re-adding a default there would retype a property the file left untyped.
  const dataType =
    condition.dataType === undefined ? BUILDER_PROPERTY_DATA_TYPE : condition.dataType;
  const dataTypeAttribute = dataType === null ? "" : ` dataType="${escapeXml(dataType)}"`;

  return [
    `      <property${dataTypeAttribute}${cardinality}>`,
    `        <propertySet><simpleValue>${escapeXml(condition.propertySet ?? "")}</simpleValue></propertySet>`,
    `        <baseName><simpleValue>${escapeXml(condition.name)}</simpleValue></baseName>${restriction}`,
    `      </property>`,
  ].join("\n");
}

function attributeXml(name: string, value: string | null | undefined): string {
  return value === null || value === undefined ? "" : ` ${name}="${escapeXml(value)}"`;
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

function specificationXml(rule: RuleDraft): string {
  const source = rule.imported;
  const entities = rule.entityTypes.map(
    (entityType) =>
      `        <entity><name><simpleValue>${escapeXml(entityType.toUpperCase())}</simpleValue></name></entity>`
  );

  const specAttributes = source
    ? attributeXml("name", rule.name) + attributesXml(source.attributes)
    : `${attributeXml("name", rule.name)} ifcVersion="IFC4"`;

  const applicabilityAttributes = source
    ? attributesXml(source.applicabilityAttributes)
    : ` minOccurs="1" maxOccurs="unbounded"`;

  const facets = interleave(rule.conditions.map(facetXml), source?.passThrough ?? [], "      ");
  // A source with no <requirements> at all is an applicability-only rule, and inventing an empty
  // element for it would turn "these elements must exist" into something the schema reads differently.
  const requirements =
    source && source.requirementsAttributes === null && facets.length === 0
      ? []
      : [
          `      <requirements${attributesXml(source?.requirementsAttributes ?? {})}>`,
          ...facets,
          `      </requirements>`,
        ];

  return [
    `    <specification${specAttributes}>`,
    `      <applicability${applicabilityAttributes}>`,
    ...entities,
    `      </applicability>`,
    ...requirements,
    `    </specification>`,
  ].join("\n");
}

export function buildIdsXml(rules: RuleDraft[], info: IdsDocumentInfo = {}): string {
  const title = info.title ?? "IDS rules";
  const date = info.date ?? new Date().toISOString().slice(0, 10);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ids xmlns="http://standards.buildingsmart.org/IDS"`,
    `     xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
    `  <info>`,
    `    <title>${escapeXml(title)}</title>`,
    `    <date>${escapeXml(date)}</date>`,
    ...(info.extraInfo ?? []).map((xml) => indent(xml, "    ")),
    `  </info>`,
    `  <specifications>`,
    ...interleave(rules.map(specificationXml), info.untouched ?? [], "    "),
    `  </specifications>`,
    `</ids>`,
  ].join("\n");
}
