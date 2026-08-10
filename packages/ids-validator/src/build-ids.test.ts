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
  if (facet.kind === "classification") throw new Error(`expected a slot facet, got ${facet.kind}`);
  return facet.restriction;
}

import type { ConditionDraft, RuleDraft } from "./rule-draft.js";
import { compileDraft } from "./rule-draft.js";

function condition(overrides: Partial<ConditionDraft> = {}): ConditionDraft {
  return {
    id: "c1",
    kind: "attribute",
    propertySet: null,
    name: "Name",
    operator: "exists",
    values: [],
    text: "",
    ...overrides,
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

  it("uppercases applicability entity names", () => {
    const xml = buildIdsXml(DRAFTS);
    expect(xml).toContain("<entity><name><simpleValue>IFCELEMENT</simpleValue></name></entity>");
    expect(xml).toContain('<xs:enumeration value="IFCDUCTSEGMENT" />');
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
