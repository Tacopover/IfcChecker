import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { idsXmlToDrafts } from "./import-ids.js";
import type { IdsImportResult } from "./import-ids.js";
import type { ConditionDraft, RuleDraft } from "./rule-draft.js";
import { friendlyReadingOf } from "./rule-draft.js";

function document(specifications: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
    `  <info><title>T</title></info>`,
    `  <specifications>${specifications}</specifications>`,
    `</ids>`,
  ].join("\n");
}

/** One specification selecting IfcWall, so tests can vary only the requirements. */
function withRequirements(requirements: string): string {
  return document(`
    <specification name="S" ifcVersion="IFC4">
      <applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
      <requirements>${requirements}</requirements>
    </specification>`);
}

function onlyRule(result: IdsImportResult): RuleDraft {
  expect(result.refused).toEqual([]);
  expect(result.rules).toHaveLength(1);
  return result.rules[0];
}

function onlyCondition(xml: string): ConditionDraft {
  const rule = onlyRule(idsXmlToDrafts(xml));
  expect(rule.imported?.passThrough).toEqual([]);
  expect(rule.conditions).toHaveLength(1);
  return rule.conditions[0];
}

const MIXED = readFileSync(new URL("../fixtures/ids/mixed-fidelity.ids", import.meta.url), "utf8");

describe("idsXmlToDrafts applicability", () => {
  it("reads plain entity names into a rule", () => {
    const result = idsXmlToDrafts(
      document(`
        <specification name="Walls and slabs" ifcVersion="IFC4">
          <applicability>
            <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
            <entity><name><simpleValue>IFCSLAB</simpleValue></name></entity>
          </applicability>
        </specification>`)
    );

    const rule = onlyRule(result);
    expect(rule.name).toBe("Walls and slabs");
    expect(rule.entityTypes).toEqual(["IFCWALL", "IFCSLAB"]);
  });

  it.each([
    [
      "a facet other than entity",
      `<classification><system><simpleValue>NL/SfB</simpleValue></system></classification>`,
      "classification",
    ],
    [
      "entity names given as a pattern",
      `<entity><name><xs:restriction base="xs:string"><xs:pattern value="IFC.*" /></xs:restriction></name></entity>`,
      "entity/name",
    ],
    [
      "a predefined type narrowing the entity",
      `<entity><name><simpleValue>IFCWALL</simpleValue></name><predefinedType><simpleValue>SOLIDWALL</simpleValue></predefinedType></entity>`,
      "entity/predefinedType",
    ],
    ["an applicability that selects nothing", ``, "applicability"],
  ])("refuses a specification whose applicability uses %s", (_label, applicability, construct) => {
    const result = idsXmlToDrafts(
      document(
        `<specification name="S" ifcVersion="IFC4"><applicability>${applicability}</applicability></specification>`
      )
    );

    expect(result.rules).toEqual([]);
    expect(result.refused.map((entry) => entry.name)).toEqual(["S"]);
    expect(result.refused[0].reasons.map((reason) => reason.construct)).toContain(construct);
  });

  it("keeps a refused specification verbatim so re-exporting hands it back", () => {
    const [refused] = idsXmlToDrafts(MIXED).refused;

    expect(refused.name).toBe("Classified elements are named");
    expect(refused.passThrough.construct).toBe("specification");
    expect(refused.passThrough.xml).toContain("<classification>");
    expect(refused.passThrough.xml).toContain("NL/SfB");
  });
});

describe("idsXmlToDrafts values", () => {
  /** An attribute facet on `Name` carrying whatever `<value>` the case is about. */
  function attributeValue(value: string): ConditionDraft {
    return onlyCondition(
      withRequirements(`<attribute><name><simpleValue>Name</simpleValue></name>${value}</attribute>`)
    );
  }

  it("reads a facet with no value as no restriction at all", () => {
    expect(attributeValue("")).toMatchObject({
      kind: "attribute",
      name: "Name",
      value: null,
      cardinality: "required",
    });
  });

  it("reads a simpleValue and an enumeration into the value they state", () => {
    expect(attributeValue(`<value><simpleValue>W-1</simpleValue></value>`).value).toEqual({
      kind: "simple",
      value: "W-1",
    });

    expect(
      attributeValue(
        `<value><xs:restriction base="xs:string"><xs:enumeration value="A" /><xs:enumeration value="B" /></xs:restriction></value>`
      ).value
    ).toEqual({ kind: "enum", values: ["A", "B"] });
  });

  it.each([
    [".*A\\.B.*", { kind: "affix", operator: "contains", literal: "A.B" }],
    ["W-.*", { kind: "affix", operator: "startsWith", literal: "W-" }],
    [".*-01", { kind: "affix", operator: "endsWith", literal: "-01" }],
    // Not something escapeRegExp would ever produce, so reading it as startsWith("W-") would
    // re-export the author's `W\-.*` as `W-.*` — the same matches, rewritten behind their back.
    ["W\\-.*", { kind: "pattern", source: "W\\-.*" }],
    ["W-\\d+", { kind: "pattern", source: "W-\\d+" }],
    [".*[AB].*", { kind: "pattern", source: ".*[AB].*" }],
  ])("stores the pattern %s as %o", (pattern, value) => {
    expect(
      attributeValue(
        `<value><xs:restriction base="xs:string"><xs:pattern value="${pattern}" /></xs:restriction></value>`
      ).value
    ).toEqual(value);
  });

  // What the row shows is derived from the value, so the two have to agree on a real file.
  it("reads every imported value back as the operator the file was written with", () => {
    const readings = [
      [``, "exists"],
      [`<value><simpleValue>W-1</simpleValue></value>`, "equals"],
      [
        `<value><xs:restriction base="xs:string"><xs:enumeration value="A" /></xs:restriction></value>`,
        "oneOf",
      ],
      [
        `<value><xs:restriction base="xs:string"><xs:pattern value=".*A.*" /></xs:restriction></value>`,
        "contains",
      ],
      [
        `<value><xs:restriction base="xs:string"><xs:pattern value="W-\\d+" /></xs:restriction></value>`,
        "matches",
      ],
    ] as const;

    for (const [value, operator] of readings) {
      expect(friendlyReadingOf(attributeValue(value))?.operator).toBe(operator);
    }
  });

  it("reads a prohibited facet with no value as a prohibited condition", () => {
    expect(
      onlyCondition(
        withRequirements(
          `<attribute cardinality="prohibited"><name><simpleValue>Tag</simpleValue></name></attribute>`
        )
      )
    ).toMatchObject({ cardinality: "prohibited", value: null, explicitCardinality: true });
  });

  // IDS asks "must it be there" and "what may it say" separately, so every cardinality is read
  // whatever value stands beside it. Both of these used to be kept verbatim, because the draft
  // stored one friendly operator in place of the two answers.
  it("reads an optional facet rather than choosing required or prohibited for the author", () => {
    expect(
      onlyCondition(
        withRequirements(
          `<property cardinality="optional"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`
        )
      )
    ).toMatchObject({ cardinality: "optional", value: null, explicitCardinality: true });
  });

  it("reads a prohibited facet that names the one value it forbids", () => {
    expect(
      onlyCondition(
        withRequirements(
          `<attribute cardinality="prohibited"><name><simpleValue>Tag</simpleValue></name><value><simpleValue>TODO</simpleValue></value></attribute>`
        )
      )
    ).toMatchObject({
      cardinality: "prohibited",
      value: { kind: "simple", value: "TODO" },
    });
  });

  it("carries the property data type, and its absence, rather than assuming a default", () => {
    const typed = onlyCondition(
      withRequirements(
        `<property dataType="IFCREAL"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`
      )
    );
    const untyped = onlyCondition(
      withRequirements(
        `<property><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`
      )
    );

    expect(typed.dataType).toBe("IFCREAL");
    expect(untyped.dataType).toBeNull();
  });
});

describe("idsXmlToDrafts pass-through", () => {
  it.each([
    [
      "a facet outside the builder's model",
      `<classification><value><simpleValue>21.22</simpleValue></value></classification>`,
      "classification",
    ],
    [
      "a bound the builder cannot read",
      `<property dataType="IFCREAL"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName><value><xs:restriction base="xs:double"><xs:maxInclusive value="0.24" /></xs:restriction></value></property>`,
      "property",
    ],
    [
      "a cardinality ids.xsd does not allow, rather than picking one of the three",
      `<property cardinality="mandatory"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`,
      "property",
    ],
    [
      "an author's annotation, which the builder has nowhere to show",
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:string"><xs:annotation><xs:documentation>Why.</xs:documentation></xs:annotation><xs:pattern value="D.*" /></xs:restriction></value></attribute>`,
      "attribute",
    ],
    [
      "an attribute the builder does not model",
      `<attribute instructions="Ask the architect."><name><simpleValue>Name</simpleValue></name></attribute>`,
      "attribute",
    ],
  ])("keeps %s verbatim instead of importing a weakened copy", (_label, facet, construct) => {
    const rule = onlyRule(idsXmlToDrafts(withRequirements(facet)));

    expect(rule.conditions).toEqual([]);
    expect(rule.imported?.passThrough).toHaveLength(1);
    expect(rule.imported?.passThrough[0].construct).toBe(construct);
  });

  // The tag name alone tells the user a facet was kept; it does not tell them the rule in front of
  // them checks less than it looks like it does. Each refusal names the one thing that stopped it.
  it.each([
    [
      `<classification><value><simpleValue>21.22</simpleValue></value></classification>`,
      /attribute or a property; <classification> is neither/,
    ],
    [
      `<property dataType="IFCREAL"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName><value><xs:restriction base="xs:double"><xs:maxInclusive value="0.24" /></xs:restriction></value></property>`,
      /numeric range/,
    ],
    // One sentence used to cover all of these. Over the corpus it was wrong about 8 of the facets
    // it refused, and the message is what tells the user which piece of work their file waits on.
    [
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:string"><xs:minLength value="3" /></xs:restriction></value></attribute>`,
      /length of its value/,
    ],
    [
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:string"><xs:annotation><xs:documentation>Why.</xs:documentation></xs:annotation><xs:pattern value="D.*" /></xs:restriction></value></attribute>`,
      /xs:annotation/,
    ],
    [
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:double"><xs:enumeration value="42" /></xs:restriction></value></attribute>`,
      /base="xs:double"/,
    ],
    [
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:string"><xs:pattern value="[a-z]{2}" /><xs:pattern value="[A-Z]{2}" /></xs:restriction></value></attribute>`,
      /Combines several restrictions/,
    ],
    [
      `<property cardinality="mandatory"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`,
      /ids\.xsd does not give this facet/,
    ],
    [
      `<attribute instructions="Ask the architect."><name><simpleValue>Name</simpleValue></name></attribute>`,
      /Carries instructions/,
    ],
    [
      `<attribute><name><xs:restriction base="xs:string"><xs:pattern value="Na.*" /></xs:restriction></name></attribute>`,
      /attribute name as a pattern/,
    ],
  ])("says why it kept a facet rather than only which one", (facet, expected) => {
    const rule = onlyRule(idsXmlToDrafts(withRequirements(facet)));

    expect(rule.imported?.passThrough[0].reason).toMatch(expected);
  });

  it("records how many conditions preceded each passed-through facet", () => {
    const [rule] = idsXmlToDrafts(MIXED).rules;

    expect(rule.conditions.map((condition) => condition.name)).toEqual([
      "Name",
      "Reference",
      "Status",
      "AcousticRating",
      "Description",
    ]);
    expect(rule.imported?.passThrough.map((entry) => [entry.construct, entry.afterIndex])).toEqual([
      ["classification", 3],
      ["property", 3],
      ["material", 5],
    ]);
  });
});

describe("idsXmlToDrafts document metadata", () => {
  it("carries specification, applicability and requirements attributes the builder has no field for", () => {
    const [rule] = idsXmlToDrafts(MIXED).rules;

    expect(rule.imported?.attributes).toEqual({
      identifier: "S1",
      ifcVersion: "IFC2X3 IFC4",
      description: "Spec-level prose the builder has no field for.",
      instructions: "Fill these in from the wall schedule.",
    });
    expect(rule.imported?.applicabilityAttributes).toEqual({ minOccurs: "0", maxOccurs: "unbounded" });
    expect(rule.imported?.requirementsAttributes).toEqual({
      description: "Requirement-level prose, which lives on the element itself.",
    });
  });

  it("distinguishes an applicability-only specification from one with empty requirements", () => {
    const { rules } = idsXmlToDrafts(MIXED);
    const storeys = rules.find((rule) => rule.name === "Some storey must exist");

    expect(storeys?.conditions).toEqual([]);
    expect(storeys?.imported?.requirementsAttributes).toBeNull();
  });

  it("reads the title and keeps the other info children verbatim", () => {
    const { title, extraInfo } = idsXmlToDrafts(MIXED);

    expect(title).toBe("Mixed fidelity");
    expect(extraInfo).toEqual(["<version>1.1</version>", "<author>taco@mepover.com</author>"]);
  });

  it("returns nothing for a document with no specifications", () => {
    expect(idsXmlToDrafts(document(""))).toMatchObject({ rules: [], refused: [] });
  });
});
