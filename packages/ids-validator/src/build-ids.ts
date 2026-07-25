import type { ParsedRestriction } from "./parse-ids.js";
import type { ConditionDraft, RuleDraft } from "./rule-draft.js";
import {
  BUILDER_PROPERTY_DATA_TYPE,
  cardinalityForCondition,
  restrictionForCondition,
} from "./rule-draft.js";

export interface IdsDocumentInfo {
  title?: string;
  date?: string;
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
  const cardinality =
    cardinalityForCondition(condition) === "prohibited" ? ` cardinality="prohibited"` : "";

  if (condition.kind === "attribute") {
    return [
      `      <attribute${cardinality}>`,
      `        <name><simpleValue>${escapeXml(condition.name)}</simpleValue></name>${restriction}`,
      `      </attribute>`,
    ].join("\n");
  }

  return [
    `      <property dataType="${BUILDER_PROPERTY_DATA_TYPE}"${cardinality}>`,
    `        <propertySet><simpleValue>${escapeXml(condition.propertySet ?? "")}</simpleValue></propertySet>`,
    `        <baseName><simpleValue>${escapeXml(condition.name)}</simpleValue></baseName>${restriction}`,
    `      </property>`,
  ].join("\n");
}

function specificationXml(rule: RuleDraft): string {
  const entities = rule.entityTypes
    .map(
      (entityType) =>
        `        <entity><name><simpleValue>${escapeXml(entityType.toUpperCase())}</simpleValue></name></entity>`
    )
    .join("\n");

  return [
    `    <specification name="${escapeXml(rule.name)}" ifcVersion="IFC4">`,
    `      <applicability minOccurs="1" maxOccurs="unbounded">`,
    ...(entities ? [entities] : []),
    `      </applicability>`,
    `      <requirements>`,
    ...rule.conditions.map(facetXml),
    `      </requirements>`,
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
    `  </info>`,
    `  <specifications>`,
    ...rules.map(specificationXml),
    `  </specifications>`,
    `</ids>`,
  ].join("\n");
}
