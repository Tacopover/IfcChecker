import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIdsXml } from "./build-ids.js";
import { idsSchemaViolations } from "./ids-schema-shape.js";
import type { RuleDraft } from "./rule-draft.js";

const FIXTURES = ["mixed-fidelity.ids", "naming-and-fire-rating.ids", "partly-understood.ids"];

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/ids/${name}`, import.meta.url), "utf8");
}

function document(specifications: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
    `  <info><title>T</title></info>`,
    `  <specifications>${specifications}</specifications>`,
    `</ids>`,
  ].join("\n");
}

describe("idsSchemaViolations", () => {
  it.each(FIXTURES)("accepts the %s fixture", (name) => {
    expect(idsSchemaViolations(fixture(name))).toEqual([]);
  });

  it.each([
    ["a rule with one entity type", ["IfcWall"]],
    ["a rule with several entity types", ["IfcDuctSegment", "IfcDuctFitting"]],
    ["a rule with no entity types", [] as string[]],
  ])("accepts what buildIdsXml writes for %s", (_label, entityTypes) => {
    const rules: RuleDraft[] = [{ id: "r1", name: "R", entityTypes, conditions: [] }];
    expect(idsSchemaViolations(buildIdsXml(rules))).toEqual([]);
  });

  // The bug this check exists for. Before it was fixed, buildIdsXml produced exactly this.
  it("catches two entity facets in one applicability", () => {
    const violations = idsSchemaViolations(
      document(`
        <specification name="S" ifcVersion="IFC4">
          <applicability>
            <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
            <entity><name><simpleValue>IFCSLAB</simpleValue></name></entity>
          </applicability>
        </specification>`)
    );

    expect(violations).toEqual(['<specification name="S"> applicability has more than one <entity>, but the schema allows one']);
  });

  it.each([
    [
      "a missing ifcVersion",
      `<specification name="S"><applicability /></specification>`,
      /no ifcVersion attribute/,
    ],
    [
      "an IFC version the schema does not list",
      `<specification name="S" ifcVersion="IFC4X1"><applicability /></specification>`,
      /IFC version "IFC4X1"/,
    ],
    [
      "a specification with no applicability",
      `<specification name="S" ifcVersion="IFC4"><requirements /></specification>`,
      /missing <applicability>/,
    ],
    [
      "facets out of the order the schema declares",
      `<specification name="S" ifcVersion="IFC4"><applicability>
         <property><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>
         <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
       </applicability></specification>`,
      /<entity> out of the order/,
    ],
    [
      "a classification with no system",
      `<specification name="S" ifcVersion="IFC4"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
       <requirements><classification><value><simpleValue>21</simpleValue></value></classification></requirements></specification>`,
      /missing <system>/,
    ],
    [
      "optional cardinality on a partOf, which only takes required or prohibited",
      `<specification name="S" ifcVersion="IFC4"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
       <requirements><partOf cardinality="optional"><entity><name><simpleValue>IFCSPACE</simpleValue></name></entity></partOf></requirements></specification>`,
      /<partOf> has cardinality "optional"/,
    ],
    [
      "a cardinality on an applicability facet",
      `<specification name="S" ifcVersion="IFC4"><applicability>
         <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
         <material cardinality="required" />
       </applicability></specification>`,
      /only a requirement may have/,
    ],
    [
      "a relation the schema does not list",
      `<specification name="S" ifcVersion="IFC4"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
       <requirements><partOf relation="IFCRELCONNECTS"><entity><name><simpleValue>IFCSPACE</simpleValue></name></entity></partOf></requirements></specification>`,
      /relation "IFCRELCONNECTS"/,
    ],
    [
      "a parameter holding both a simple value and a restriction",
      `<specification name="S" ifcVersion="IFC4"><applicability><entity><name>
         <simpleValue>IFCWALL</simpleValue>
         <xs:restriction base="xs:string"><xs:enumeration value="IFCSLAB" /></xs:restriction>
       </name></entity></applicability></specification>`,
      /holds 2 values, but exactly one is required/,
    ],
  ])("catches %s", (_label, specification, expected) => {
    const violations = idsSchemaViolations(document(specification));

    expect(violations.join("\n")).toMatch(expected);
  });

  it("reports a document that is not XML at all rather than throwing", () => {
    expect(idsSchemaViolations("not xml <<<")[0]).toMatch(/not well-formed|<ids> root element/);
  });

  it("reports a document with no <ids> root", () => {
    expect(idsSchemaViolations(`<?xml version="1.0"?><project />`)).toEqual([
      "<ids> root element is missing",
    ]);
  });
});
