import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { idsXmlToDrafts } from "./import-ids.js";
import type { IdsImportResult } from "./import-ids.js";
import type { ConditionDraft, FacetDraft, RuleDraft } from "./rule-draft.js";
import { friendlyReadingOf, isConditionFacet } from "./rule-draft.js";

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

function onlyFacet(xml: string): FacetDraft {
  const rule = onlyRule(idsXmlToDrafts(xml));
  expect(rule.imported?.passThrough).toEqual([]);
  expect(rule.conditions).toHaveLength(1);
  return rule.conditions[0];
}

function onlyCondition(xml: string): ConditionDraft {
  const facet = onlyFacet(xml);
  // The two kinds a condition row can edit. An assertion rather than a cast, so a reader that
  // starts handing back another kind here fails loudly instead of being cast into shape.
  if (!isConditionFacet(facet)) throw new Error(`imported a <${facet.kind}>, which it should not`);
  return facet;
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

  it("reads a numeric range, keeping each edge as the author wrote it", () => {
    expect(
      attributeValue(
        `<value><xs:restriction base="xs:double"><xs:minInclusive value="0" /><xs:maxExclusive value="1.50" /></xs:restriction></value>`
      ).value
    ).toEqual({
      kind: "bounds",
      base: "xs:double",
      // "1.50" rather than 1.5: the draft holds the literal, so the export is the file that came in.
      min: { value: "0", inclusive: true },
      max: { value: "1.50", inclusive: false },
    });
  });

  // 63 ranges in the corpus are xs:double, 4 xs:integer, and 6 use a capitalised spelling no XSD
  // type has. Assuming one would hand 8 authors back a file they did not write.
  it("carries whatever base the range was written with", () => {
    const value = attributeValue(
      `<value><xs:restriction base="xs:Decimal"><xs:minInclusive value="1" /></xs:restriction></value>`
    ).value;

    expect(value).toMatchObject({ kind: "bounds", base: "xs:Decimal" });
  });

  it("reads a length, keeping each count as the author wrote it", () => {
    expect(
      attributeValue(
        `<value><xs:restriction base="xs:string"><xs:minLength value="2" /><xs:maxLength value="03" /></xs:restriction></value>`
      ).value
    ).toEqual({ kind: "length", exact: null, min: "2", max: "03" });
  });

  it("reads an exact length beside the two bounds, because XSD allows all three", () => {
    expect(
      attributeValue(
        `<value><xs:restriction base="xs:string"><xs:length value="2" /></xs:restriction></value>`
      ).value
    ).toEqual({ kind: "length", exact: "2", min: null, max: null });
  });

  // Prose that constrains nothing, and so reaches no compiled requirement. It is still the sentence
  // saying why the rule is there, and an import that dropped it would hand back a poorer file.
  it("carries the author's instructions on either kind of facet", () => {
    expect(
      onlyCondition(
        withRequirements(
          `<attribute instructions="Ask the architect."><name><simpleValue>Name</simpleValue></name></attribute>`
        )
      ).instructions
    ).toBe("Ask the architect.");
    expect(
      onlyCondition(
        withRequirements(
          `<property instructions="From the wall schedule."><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`
        )
      ).instructions
    ).toBe("From the wall schedule.");
  });

  it("carries a property uri, and states nothing where the source stated nothing", () => {
    const withUri = onlyCondition(
      withRequirements(
        `<property uri="https://example.org/rule"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`
      )
    );
    const without = onlyCondition(
      withRequirements(
        `<property><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`
      )
    );

    expect(withUri).toMatchObject({ kind: "property", uri: "https://example.org/rule" });
    expect(without).toMatchObject({ kind: "property", uri: null, instructions: null });
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

    expect(typed).toMatchObject({ kind: "property", dataType: "IFCREAL" });
    expect(untyped).toMatchObject({ kind: "property", dataType: null });
  });
});

describe("idsXmlToDrafts classification", () => {
  it("reads both parameters, each as the value the file states", () => {
    expect(
      onlyFacet(
        withRequirements(
          `<classification><value><xs:restriction base="xs:string"><xs:pattern value="21\\.\\d+" /></xs:restriction></value><system><simpleValue>NL/SfB</simpleValue></system></classification>`
        )
      )
    ).toMatchObject({
      kind: "classification",
      system: { kind: "simple", value: "NL/SfB" },
      value: { kind: "pattern", source: "21\\.\\d+" },
    });
  });

  // <value> is optional: "must be classified in this system, whatever the code says".
  it("reads a classification that names only its system", () => {
    expect(
      onlyFacet(
        withRequirements(
          `<classification><system><simpleValue>Uniclass</simpleValue></system></classification>`
        )
      )
    ).toMatchObject({ kind: "classification", value: null, cardinality: "required" });
  });

  it("carries the cardinality, the uri and the instructions the source states", () => {
    expect(
      onlyFacet(
        withRequirements(
          `<classification cardinality="optional" uri="https://example.org/nlsfb" instructions="Ask the architect."><system><simpleValue>NL/SfB</simpleValue></system></classification>`
        )
      )
    ).toMatchObject({
      kind: "classification",
      cardinality: "optional",
      explicitCardinality: true,
      uri: "https://example.org/nlsfb",
      instructions: "Ask the architect.",
    });
  });
});

describe("idsXmlToDrafts material", () => {
  it("reads the material it names, with the uri and cardinality beside it", () => {
    expect(
      onlyFacet(
        withRequirements(
          `<material cardinality="prohibited" uri="https://example.org/materials"><value><simpleValue>Asbestos</simpleValue></value></material>`
        )
      )
    ).toMatchObject({
      kind: "material",
      value: { kind: "simple", value: "Asbestos" },
      uri: "https://example.org/materials",
      cardinality: "prohibited",
      explicitCardinality: true,
    });
  });

  // <value> is optional, and a material facet without one is a real check — "must be made of
  // something" — rather than an empty one.
  it("reads a material facet that names no material at all", () => {
    expect(onlyFacet(withRequirements(`<material />`))).toMatchObject({
      kind: "material",
      value: null,
      cardinality: "required",
      explicitCardinality: false,
    });
  });
});

describe("idsXmlToDrafts partOf", () => {
  it("reads the nested entity and keeps the relation attribute as written", () => {
    expect(
      onlyFacet(
        withRequirements(
          `<partOf relation="IFCRELAGGREGATES"><entity><name><simpleValue>IFCBUILDINGSTOREY</simpleValue></name></entity></partOf>`
        )
      )
    ).toMatchObject({
      kind: "partOf",
      relation: "IFCRELAGGREGATES",
      entityName: { kind: "simple", value: "IFCBUILDINGSTOREY" },
      predefinedType: null,
      cardinality: "required",
    });
  });

  // One member of the schema's relations enumeration is two names in a single attribute value, so
  // the draft keeps the attribute rather than a split list. compileFacet splits.
  it("keeps a two-name relation as the one attribute the author wrote", () => {
    expect(
      onlyFacet(
        withRequirements(
          `<partOf relation="IFCRELVOIDSELEMENT IFCRELFILLSELEMENT"><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></partOf>`
        )
      )
    ).toMatchObject({ kind: "partOf", relation: "IFCRELVOIDSELEMENT IFCRELFILLSELEMENT" });
  });

  it("reads the whole's predefined type, and a relation the source omitted as none", () => {
    expect(
      onlyFacet(
        withRequirements(
          `<partOf><entity><name><simpleValue>IFCSPACE</simpleValue></name><predefinedType><simpleValue>INTERNAL</simpleValue></predefinedType></entity></partOf>`
        )
      )
    ).toMatchObject({
      kind: "partOf",
      relation: null,
      predefinedType: { kind: "simple", value: "INTERNAL" },
    });
  });

  // simpleCardinality has no `optional`, so reading it as one of the other two would answer a
  // question the author never asked.
  it.each(["prohibited", "optional"])("handles cardinality=%s the way ids.xsd defines it", (stated) => {
    const xml = withRequirements(
      `<partOf cardinality="${stated}"><entity><name><simpleValue>IFCSPACE</simpleValue></name></entity></partOf>`
    );

    if (stated === "prohibited") {
      expect(onlyFacet(xml)).toMatchObject({ kind: "partOf", cardinality: "prohibited" });
      return;
    }
    const rule = onlyRule(idsXmlToDrafts(xml));
    expect(rule.conditions).toEqual([]);
    expect(rule.imported?.passThrough[0].reason).toMatch(/ids\.xsd does not give this facet/);
  });
});

describe("idsXmlToDrafts pass-through", () => {
  it.each([
    [
      "a facet outside the builder's model",
      `<entity><name><simpleValue>IFCWALL</simpleValue></name></entity>`,
      "entity",
    ],
    // ids.xsd makes <system> mandatory, so this is a document the schema does not describe. A draft
    // cannot state none, and inventing one would author the rule on the file's behalf.
    [
      "a classification that names no system",
      `<classification><value><simpleValue>21.22</simpleValue></value></classification>`,
      "classification",
    ],
    // A length stating no readable edge compiles to a restriction that admits everything, so
    // importing one would turn a malformed file into a rule that passes every element.
    [
      "a length whose count is not a number",
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:string"><xs:minLength value="three" /></xs:restriction></value></attribute>`,
      "attribute",
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
    // ids.xsd gives uri to classification, property and material alone, so one on an attribute is
    // a document the schema does not describe.
    [
      "an attribute the builder does not model",
      `<attribute uri="https://example.org/rule"><name><simpleValue>Name</simpleValue></name></attribute>`,
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
      `<entity><name><simpleValue>IFCWALL</simpleValue></name></entity>`,
      /cannot show a <entity> requirement/,
    ],
    [
      `<classification><value><simpleValue>21.22</simpleValue></value></classification>`,
      /States no <system>/,
    ],
    // One sentence used to cover all of these. Over the corpus it was wrong about 8 of the facets
    // it refused, and the message is what tells the user which piece of work their file waits on.
    [
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:string"><xs:minLength value="three" /></xs:restriction></value></attribute>`,
      /not a character count/,
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
    // XSD intersects a range with an enumeration; a ValueDraft states one of the two, so importing
    // it would export a rule that checks less than the file asks for.
    [
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:double"><xs:minInclusive value="0" /><xs:enumeration value="1" /></xs:restriction></value></attribute>`,
      /Combines several restrictions/,
    ],
    // One bound per edge is all a draft holds, so keeping the first would drop the other silently.
    [
      `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:double"><xs:minInclusive value="0" /><xs:minExclusive value="1" /></xs:restriction></value></attribute>`,
      /lower bound twice/,
    ],
    [
      `<property cardinality="mandatory"><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>`,
      /ids\.xsd does not give this facet/,
    ],
    [
      `<attribute uri="https://example.org/rule"><name><simpleValue>Name</simpleValue></name></attribute>`,
      /Carries uri/,
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

    expect(rule.conditions.filter(isConditionFacet).map((condition) => condition.name)).toEqual([
      "Name",
      "Reference",
      "Status",
      "ThermalTransmittance",
      "AcousticRating",
      "Description",
    ]);
    // The classification and the material are read into the rule now, so they count as preceding
    // facets rather than sitting beside them. What is left verbatim is the one facet that really is
    // outside the model: a property whose baseName is a pattern.
    expect(rule.conditions.map((facet) => facet.kind)).toEqual([
      "attribute",
      "property",
      "property",
      "classification",
      "property",
      "property",
      "attribute",
      "material",
    ]);
    expect(rule.imported?.passThrough.map((entry) => [entry.construct, entry.afterIndex])).toEqual([
      ["property", 8],
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
