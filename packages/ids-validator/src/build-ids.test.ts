import { describe, expect, it } from "vitest";
import { buildIdsXml } from "./build-ids.js";
import { parseIdsXml } from "./parse-ids.js";
import type { ParsedRequirementFacet, ParsedRestriction, ParsedSpecification } from "./parse-ids.js";

/**
 * The restriction on a facet that reads one value slot.
 *
 * `ParsedRequirementFacet` is a union, and a classification constrains two parameters rather than
 * one — every case here parses an attribute or a property, so narrowing loudly beats casting.
 */
function slotRestriction(facet: ParsedRequirementFacet): ParsedRestriction | null {
  if (facet.kind !== "attribute" && facet.kind !== "property") {
    throw new Error(`expected a slot facet, got ${facet.kind}`);
  }
  return facet.restriction;
}

import type { ConditionDraft, ConditionOperator, RuleDraft } from "./rule-draft.js";
import { cardinalityForOperator, compileDraft, valueDraftForOperator } from "./rule-draft.js";

/**
 * A condition written the way the builder's rows are: an operator plus whatever it needs. The two
 * fields it sets are derived by the same functions the page uses, so these cases stay a test of
 * what the exporter writes rather than of how the draft happens to be shaped.
 */
function condition(
  overrides: Partial<ConditionDraft> & {
    operator?: ConditionOperator;
    text?: string;
    values?: string[];
  } = {}
): ConditionDraft {
  const { operator = "exists", text = "", values = [], ...rest } = overrides;
  return {
    id: "c1",
    kind: "attribute",
    propertySet: null,
    name: "Name",
    value: valueDraftForOperator(operator, text, values),
    cardinality: cardinalityForOperator(operator),
    ...rest,
  };
}

/** RegExp instances never compare equal, so compare their sources instead. */
function comparable(specifications: ParsedSpecification[]): unknown {
  return JSON.parse(
    JSON.stringify(specifications, (_key, value) =>
      value instanceof RegExp ? { __regexSource: value.source } : value
    )
  );
}

const DRAFTS: RuleDraft[] = [
  {
    id: "r1",
    name: 'Every element carries a "tag" & is <named>',
    entityTypes: ["IfcElement"],
    conditions: [
      condition({ id: "c1", name: "Tag", operator: "exists" }),
      condition({ id: "c2", name: "Name", operator: "matches", text: "W-\\d+" }),
      condition({ id: "c3", name: "Description", operator: "notExists" }),
    ],
  },
  {
    id: "r2",
    name: "Ducts carry a system code",
    entityTypes: ["IfcDuctSegment", "IfcDuctFitting"],
    conditions: [
      condition({
        id: "c4",
        kind: "property",
        propertySet: "MEP_Data",
        name: "SystemAbbreviation",
        operator: "oneOf",
        values: ["SA", "RA", 'E"A'],
      }),
      // A property before an attribute, so document order is actually exercised.
      condition({ id: "c5", name: "Tag", operator: "equals", text: "D-1 & D-2" }),
      condition({
        id: "c6",
        kind: "property",
        propertySet: "MEP_Data",
        name: "SystemName",
        operator: "contains",
        text: "A.B(C)",
      }),
      condition({ id: "c7", name: "Name", operator: "startsWith", text: "<pre>" }),
      condition({ id: "c8", name: "Name", operator: "endsWith", text: "-01" }),
      condition({
        id: "c9",
        kind: "property",
        propertySet: "MEP_Data",
        name: "Legacy",
        operator: "notExists",
      }),
    ],
  },
];

describe("buildIdsXml", () => {
  it("writes the info block, the IDS namespaces and one specification per rule", () => {
    const xml = buildIdsXml(DRAFTS, { title: "Tower-A-MEP", date: "2026-07-24" });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://standards.buildingsmart.org/IDS"');
    expect(xml).toContain('xmlns:xs="http://www.w3.org/2001/XMLSchema"');
    expect(xml).toContain("<title>Tower-A-MEP</title>");
    expect(xml).toContain("<date>2026-07-24</date>");
    expect(xml.match(/<specification /g)).toHaveLength(2);
  });

  it("defaults the title and dates the document as today", () => {
    const xml = buildIdsXml([]);
    expect(xml).toContain("<title>IDS rules</title>");
    expect(xml).toMatch(/<date>\d{4}-\d{2}-\d{2}<\/date>/);
  });

  it("XML-escapes rule names, values and enumerations", () => {
    const xml = buildIdsXml(DRAFTS);

    expect(xml).toContain('name="Every element carries a &quot;tag&quot; &amp; is &lt;named&gt;"');
    expect(xml).toContain("<simpleValue>D-1 &amp; D-2</simpleValue>");
    expect(xml).toContain('<xs:enumeration value="E&quot;A" />');
  });

  it("regex-escapes literal text before wrapping it in a pattern", () => {
    const xml = buildIdsXml(DRAFTS);

    expect(xml).toContain('<xs:pattern value=".*A\\.B\\(C\\).*" />');
    expect(xml).toContain('<xs:pattern value="&lt;pre&gt;.*" />');
    // `matches` is the one operator whose text is a pattern already.
    expect(xml).toContain('<xs:pattern value="W-\\d+" />');
  });

  it('emits cardinality="prohibited" only for notExists conditions', () => {
    const xml = buildIdsXml(DRAFTS);
    expect(xml.match(/cardinality="prohibited"/g)).toHaveLength(2);
  });

  // ids.xsd gives uri to classification, property and material alone. A uri on an attribute would
  // be a document no conforming checker reads, so the exporter writes it from the property branch.
  it("writes instructions on either kind of facet and a uri only on a property", () => {
    const xml = buildIdsXml([
      {
        id: "r1",
        name: "Carried prose",
        entityTypes: ["IfcWall"],
        conditions: [
          condition({ id: "c1", name: "Tag", instructions: "Ask the architect." }),
          condition({
            id: "c2",
            kind: "property",
            propertySet: "Pset_WallCommon",
            name: "FireRating",
            instructions: "From the wall schedule.",
            uri: "https://example.org/rule",
          }),
        ],
      },
    ]);

    expect(xml).toContain('<attribute instructions="Ask the architect.">');
    expect(xml).toContain('uri="https://example.org/rule"');
    expect(xml).toContain('instructions="From the wall schedule."');
  });

  it("states neither attribute for a condition that carries neither", () => {
    const xml = buildIdsXml(DRAFTS);

    expect(xml).not.toContain("instructions=");
    expect(xml).not.toContain("uri=");
  });

  // Cardinality and value are two separate statements in IDS, so the exporter writes each from its
  // own field. A prohibited facet keeping its value is "must not be TODO", not "must not be there".
  it("writes a cardinality and a value independently of each other", () => {
    const xml = buildIdsXml([
      {
        id: "r1",
        name: "Both halves",
        entityTypes: ["IfcWall"],
        conditions: [
          { id: "c1", kind: "attribute", propertySet: null, name: "Tag", value: null, cardinality: "optional" },
          {
            id: "c2",
            kind: "attribute",
            propertySet: null,
            name: "Description",
            value: { kind: "simple", value: "TODO" },
            cardinality: "prohibited",
          },
        ],
      },
    ]);

    expect(xml).toContain('<attribute cardinality="optional">');
    expect(xml).toContain('<attribute cardinality="prohibited">');
    expect(xml).toContain("<value><simpleValue>TODO</simpleValue></value>");
  });

  it("uppercases applicability entity names", () => {
    const xml = buildIdsXml(DRAFTS);
    expect(xml).toContain('<xs:enumeration value="IFCDUCTSEGMENT" />');
  });

  // IDS matches an entity name exactly, so a supertype the user picked has to reach the file as
  // the concrete classes it stands for. IfcElement is abstract: left as written it selects nothing.
  it("expands an authored entity type into its concrete subtypes", () => {
    const xml = buildIdsXml(DRAFTS);

    expect(xml).not.toContain("<simpleValue>IFCELEMENT</simpleValue>");
    expect(xml).not.toContain('<xs:enumeration value="IFCELEMENT" />');
    expect(xml).toContain('<xs:enumeration value="IFCWALL" />');
    expect(xml).toContain('<xs:enumeration value="IFCDOOR" />');
    // A concrete supertype names itself as well as everything below it.
    expect(xml).toContain('<xs:enumeration value="IFCDUCTSEGMENT" />');
  });

  // The builder used to declare IFCLABEL on everything it wrote. The checker enforces the declared
  // type, so on the reference model — whose NL/SfB codes are stored as IFCTEXT — that rule failed
  // all 757 elements instead of passing 668. Only the file can say which type it holds.
  it("declares no data type when none was chosen", () => {
    const xml = buildIdsXml([
      {
        id: "r",
        name: "Codes",
        entityTypes: ["IfcSanitaryTerminal"],
        conditions: [
          condition({ id: "c", kind: "property", propertySet: "ASML", name: "3.6 NL-SfB code" }),
        ],
      },
    ]);

    expect(xml).toContain("<property>");
    expect(xml).not.toContain("dataType=");
  });

  it("writes the data type a condition states", () => {
    const withType = (dataType: string | null) =>
      buildIdsXml([
        {
          id: "r",
          name: "Codes",
          entityTypes: ["IfcSanitaryTerminal"],
          conditions: [
            condition({
              id: "c",
              kind: "property",
              propertySet: "ASML",
              name: "3.6 NL-SfB code",
              dataType,
            }),
          ],
        },
      ]);

    expect(withType("IFCTEXT")).toContain('<property dataType="IFCTEXT">');
    expect(withType(null)).toContain("<property>");
  });

  it("keeps a concrete leaf type as a single simpleValue", () => {
    const xml = buildIdsXml([
      { id: "r", name: "Sanitary terminals", entityTypes: ["IfcSanitaryTerminal"], conditions: [] },
    ]);
    expect(xml).toContain("<entity><name><simpleValue>IFCSANITARYTERMINAL</simpleValue></name></entity>");
  });

  // ids.xsd allows one <entity> in an applicability, so several types are one enumeration. Emitting
  // one <entity> each produced a document no conforming checker would read.
  it("writes several entity types as a single entity facet", () => {
    const xml = buildIdsXml(DRAFTS);
    const applicability = xml.slice(xml.indexOf("Ducts carry a system code"));

    expect(applicability.match(/<entity>/g)).toHaveLength(1);
    expect(applicability).toContain('<xs:enumeration value="IFCDUCTSEGMENT" />');
    expect(applicability).toContain('<xs:enumeration value="IFCDUCTFITTING" />');
  });

  it("emits a well-formed document for an empty rule set", () => {
    expect(parseIdsXml(buildIdsXml([]))).toEqual([]);
  });
});

describe("buildIdsXml / compileDraft round-trip", () => {
  it("parses the exported XML back into exactly what compileDraft produces", () => {
    const parsed = parseIdsXml(buildIdsXml(DRAFTS, { title: "Tower-A-MEP", date: "2026-07-24" }));

    expect(comparable(parsed)).toEqual(comparable(compileDraft(DRAFTS)));
  });

  it("round-trips a rule with no conditions and no entity types", () => {
    const empty: RuleDraft[] = [{ id: "r", name: "Empty", entityTypes: [], conditions: [] }];
    expect(comparable(parseIdsXml(buildIdsXml(empty)))).toEqual(comparable(compileDraft(empty)));
  });

  it("round-trips an oneOf condition with no chosen values", () => {
    const drafts: RuleDraft[] = [
      {
        id: "r",
        name: "Empty enum",
        entityTypes: ["IfcWall"],
        conditions: [condition({ operator: "oneOf", values: [] })],
      },
    ];
    expect(comparable(parseIdsXml(buildIdsXml(drafts)))).toEqual(comparable(compileDraft(drafts)));
  });

  it("keeps the compiled and exported regexes behaviourally identical", () => {
    const [exported] = parseIdsXml(buildIdsXml(DRAFTS));
    const [compiled] = compileDraft(DRAFTS);
    const exportedFacet = exported.requirements[1];
    const compiledFacet = compiled.requirements[1];

    const exportedRestriction = slotRestriction(exportedFacet);
    const compiledRestriction = slotRestriction(compiledFacet);
    if (exportedRestriction?.kind !== "pattern") throw new Error("expected a pattern");
    if (compiledRestriction?.kind !== "pattern") throw new Error("expected a pattern");
    expect(exportedRestriction.regex.source).toBe(compiledRestriction.regex.source);
    expect(exportedRestriction.regex.test("W-12")).toBe(true);
  });
});
