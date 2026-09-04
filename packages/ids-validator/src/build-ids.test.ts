import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { buildIdsXml, infoProblems } from "./build-ids.js";
import { EVERY_FACET } from "./every-facet.fixture.js";
import { idsSchemaViolations } from "./ids-schema-shape.js";
import { parseIdsXml } from "./parse-ids.js";
import type { ParsedRequirementFacet, ParsedRestriction, ParsedSpecification } from "./parse-ids.js";
import { validateBySpecification } from "./validate-elements.js";

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

import type {
  ConditionDraft,
  ConditionOperator,
  ConditionalCardinality,
  RuleDraft,
  ValueDraft,
} from "./rule-draft.js";
import {
  compileDraft,
  plainName,
  valueDraftForOperator,
} from "./rule-draft.js";

/**
 * A condition written the way the builder's rows are: an operator plus whatever it needs. The two
 * fields it sets are derived by the same functions the page uses, so these cases stay a test of
 * what the exporter writes rather than of how the draft happens to be shaped.
 */
/**
 * Spelled out rather than derived from `Partial<ConditionDraft>`, because `name` and `propertySet`
 * are written here as the plain names a builder row states, and the draft holds a `ValueDraft`.
 */
interface ConditionOverrides {
  id?: string;
  kind?: ConditionDraft["kind"];
  name?: string;
  propertySet?: string | null;
  value?: ValueDraft | null;
  cardinality?: ConditionalCardinality;
  dataType?: string | null;
  uri?: string | null;
  instructions?: string | null;
  explicitCardinality?: boolean;
  operator?: ConditionOperator;
  text?: string;
  values?: string[];
}

function condition(overrides: ConditionOverrides = {}): ConditionDraft {
  const {
    operator = "exists",
    text = "",
    values = [],
    name = "Name",
    propertySet = null,
    ...rest
  } = overrides;
  return {
    id: "c1",
    kind: "attribute",
    value: valueDraftForOperator(operator, text, values),
    cardinality: "required",
    ...rest,
    name: plainName(name),
    propertySet: propertySet === null ? null : plainName(propertySet),
    // `kind` widens back to the union through the spread, and a partial of a discriminated union
    // cannot narrow it again. Asserted here so the call sites stay one line each.
  } as ConditionDraft;
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
      condition({ id: "c3", name: "Description", cardinality: "prohibited" }),
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
        cardinality: "prohibited",
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

  describe("specification cardinality", () => {
    function makeElement(overrides: Partial<NormalizedElement>): NormalizedElement {
      return {
        globalId: "g1",
        expressId: 1,
        ifcType: "IFCBUILDINGELEMENTPROXY",
        predefinedType: null,
        name: null,
        attributes: {},
        propertySets: {},
        ...overrides,
      };
    }

    it("writes the exporter's old default — minOccurs=1 maxOccurs=unbounded — when unstated", () => {
      const xml = buildIdsXml([{ id: "r1", name: "Rule", entityTypes: ["IfcWall"], conditions: [] }]);
      expect(xml).toContain('<applicability minOccurs="1" maxOccurs="unbounded">');
    });

    it('writes minOccurs="0" maxOccurs="0" for a prohibited rule', () => {
      const xml = buildIdsXml([
        {
          id: "r1",
          name: "No proxies",
          entityTypes: ["IfcBuildingElementProxy"],
          conditions: [],
          cardinality: "prohibited",
        },
      ]);
      expect(xml).toContain('<applicability minOccurs="0" maxOccurs="0">');
    });

    it('writes minOccurs="0" maxOccurs="unbounded" for an optional rule', () => {
      const xml = buildIdsXml([
        { id: "r1", name: "Rule", entityTypes: ["IfcWall"], conditions: [], cardinality: "optional" },
      ]);
      expect(xml).toContain('<applicability minOccurs="0" maxOccurs="unbounded">');
    });

    it("a prohibited rule's exported XML fails the real checker when the type is present, and passes when it is not", () => {
      const xml = buildIdsXml([
        {
          id: "r1",
          name: "No proxies",
          entityTypes: ["IfcBuildingElementProxy"],
          conditions: [],
          cardinality: "prohibited",
        },
      ]);

      const [withProxy] = validateBySpecification([makeElement({ globalId: "proxy-1" })], xml);
      expect(withProxy.cardinalityFailure).toMatch(/Nothing may match/);

      const [withoutProxy] = validateBySpecification(
        [makeElement({ globalId: "wall-1", ifcType: "IFCWALL" })],
        xml
      );
      expect(withoutProxy.cardinalityFailure).toBeNull();
    });
  });

  describe("case-insensitive comparisons", () => {
    function makeElement(overrides: Partial<NormalizedElement>): NormalizedElement {
      return {
        globalId: "g1",
        expressId: 1,
        ifcType: "IFCWALL",
        predefinedType: null,
        name: null,
        attributes: {},
        propertySets: {},
        ...overrides,
      };
    }

    // XSD's `xs:enumeration`/`<simpleValue>` are exact-match by definition — there is no
    // case-insensitive flag in ids.xsd — so "ignore case" has to become a different, still valid
    // restriction rather than a hidden checker-only relaxation, or the exported file would say one
    // thing and this app's own preview would check another.
    it("writes equals as a pattern, not a simpleValue, once case-insensitive is set", () => {
      const xml = buildIdsXml([
        {
          id: "r1",
          name: "Storey named GF",
          entityTypes: ["IfcBuildingStorey"],
          conditions: [
            condition({
              id: "c1",
              name: "Name",
              value: { kind: "simple", value: "GF", caseInsensitive: true },
            }),
          ],
        },
      ]);

      expect(xml).not.toContain("<simpleValue>GF</simpleValue>");
      expect(xml).toContain('<xs:pattern value="[Gg][Ff]" />');
      expect(idsSchemaViolations(xml)).toEqual([]);
    });

    it("writes oneOf as one pattern per value, each folded", () => {
      const xml = buildIdsXml([
        {
          id: "r1",
          name: "Storey named from a list",
          entityTypes: ["IfcBuildingStorey"],
          conditions: [
            condition({
              id: "c1",
              name: "Name",
              value: { kind: "enum", values: ["Ground Floor", "First Floor"], caseInsensitive: true },
            }),
          ],
        },
      ]);

      expect(xml).not.toContain("<xs:enumeration");
      expect(xml.match(/<xs:pattern/g)).toHaveLength(2);
      expect(idsSchemaViolations(xml)).toEqual([]);
    });

    // The exported XML, checked by the real validator, is what actually matters — proof the
    // toggle changes what gets flagged, not just what the XML happens to say.
    it("an exported case-insensitive rule matches regardless of the stored casing, and still rejects a real mismatch", () => {
      const xml = buildIdsXml([
        {
          id: "r1",
          name: "Storeys are named from the approved list",
          entityTypes: ["IfcBuildingStorey"],
          conditions: [
            condition({
              id: "c1",
              name: "Name",
              value: { kind: "enum", values: ["Ground Floor", "Level 1"], caseInsensitive: true },
            }),
          ],
        },
      ]);

      const [shouty] = validateBySpecification(
        [makeElement({ ifcType: "IFCBUILDINGSTOREY", name: "GROUND FLOOR" })],
        xml
      );
      expect(shouty.passedCount).toBe(1);
      expect(shouty.failedCount).toBe(0);

      const [mismatch] = validateBySpecification(
        [makeElement({ ifcType: "IFCBUILDINGSTOREY", name: "Level 2" })],
        xml
      );
      expect(mismatch.passedCount).toBe(0);
      expect(mismatch.failedCount).toBe(1);
    });

    it("leaves equals/oneOf unchanged when the flag is off", () => {
      const xml = buildIdsXml(DRAFTS);
      expect(xml).toContain("<simpleValue>D-1 &amp; D-2</simpleValue>");
      expect(xml).toContain('<xs:enumeration value="SA" />');
    });
  });

  // `ids.xsd` fixes the order of the eight children, so they are written at their index rather than
  // in the order the caller happens to state them.
  it("writes every info child the schema names, in the order the schema fixes", () => {
    // A rule, because `<specifications>` requires at least one and the check below is a full one.
    const xml = buildIdsXml(DRAFTS, {
      milestone: "Design",
      title: "Tower-A",
      author: "taco@mepover.com",
      copyright: "MEPover",
      purpose: "Handover",
      version: "1.2",
      description: "What the model must carry",
      date: "2026-08-16",
    });

    const tags = [...xml.matchAll(/<(\w+)>[^<]*<\/\1>/g)].map((match) => match[1]);
    expect(tags.slice(0, 8)).toEqual([
      "title",
      "copyright",
      "version",
      "description",
      "author",
      "date",
      "purpose",
      "milestone",
    ]);
    expect(idsSchemaViolations(xml)).toEqual([]);
  });

  // `minOccurs="0"` on seven of them, so a cleared box writes no element rather than an empty one.
  // `<title>` is the exception the schema makes, and one corpus file states an empty one.
  it("omits an empty optional child and still writes an empty title", () => {
    const xml = buildIdsXml([], { title: "", copyright: "", author: null, version: "1.0" });

    expect(xml).toContain("<title></title>");
    expect(xml).not.toContain("<copyright>");
    expect(xml).not.toContain("<author>");
    expect(xml).toContain("<version>1.0</version>");
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

  it('emits cardinality="prohibited" only for the conditions that state it', () => {
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
          {
            id: "c1",
            kind: "attribute",
            propertySet: null,
            name: plainName("Tag"),
            value: null,
            cardinality: "optional",
          },
          {
            id: "c2",
            kind: "attribute",
            propertySet: null,
            name: plainName("Description"),
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

  // `entityTypes` is the literal, final list by the time it reaches the exporter — expansion is a
  // builder UI action, not a compile step. IfcElement is abstract and selects nothing left as
  // written, but the exporter states the document exactly as the rule holds it either way.
  it("writes an authored entity type exactly as the rule holds it, with no expansion", () => {
    const xml = buildIdsXml(DRAFTS);

    expect(xml).toContain("<simpleValue>IFCELEMENT</simpleValue>");
    expect(xml).not.toContain('<xs:enumeration value="IFCWALL" />');
    expect(xml).not.toContain('<xs:enumeration value="IFCDOOR" />');
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

  // The one-line form has to give way, because `<name>` is mandatory and `<predefinedType>` follows
  // it — the two cannot share a line and stay in the order `ids.xsd` fixes.
  it("writes an entity predefinedType beside the one name it narrows", () => {
    const xml = buildIdsXml([
      {
        id: "r",
        name: "Sanitary terminals",
        entityTypes: ["IfcSanitaryTerminal"],
        entityPredefinedType: { kind: "simple", value: "BATH" },
        conditions: [],
      },
    ]);

    expect(xml).toContain("<name><simpleValue>IFCSANITARYTERMINAL</simpleValue></name>");
    expect(xml).toContain("<predefinedType><simpleValue>BATH</simpleValue></predefinedType>");
    expect(parseIdsXml(xml)[0].applicability.entityPredefinedType).toEqual({
      kind: "exact",
      value: "BATH",
    });
    expect(idsSchemaViolations(xml)).toEqual([]);
  });

  // No `<entity>` is written for a rule naming no type, so there is nowhere for this to go and
  // carrying it would export a document that says less than the draft holds.
  it("drops it with the names it narrows when the rule states no type", () => {
    const xml = buildIdsXml([
      {
        id: "r",
        name: "Anything with a code",
        entityTypes: [],
        entityPredefinedType: { kind: "simple", value: "BATH" },
        applicabilityFacets: [
          {
            id: "a1",
            kind: "material",
            value: { kind: "simple", value: "Concrete" },
            cardinality: "required",
          },
        ],
        conditions: [],
      },
    ]);

    expect(xml).not.toContain("<predefinedType>");
    expect(parseIdsXml(xml)[0].applicability.entityPredefinedType).toBeNull();
  });

  it("emits a well-formed document for an empty rule set", () => {
    expect(parseIdsXml(buildIdsXml([]))).toEqual([]);
  });
});

// `ids.xsd` narrows two of the eight beyond `xs:string`, and neither can be fixed up for the
// author. The exporter writes what it is given, so this is what stops a half-typed address from
// becoming a document no conforming checker reads.
describe("infoProblems", () => {
  it("accepts a complete, well-formed info block", () => {
    expect(
      infoProblems({ title: "Tower-A", author: "taco@mepover.com", date: "2026-08-16" })
    ).toEqual([]);
  });

  it("names an author that is not an email address, which the schema patterns", () => {
    expect(infoProblems({ author: "Taco" })).toEqual([expect.stringMatching(/Author/)]);
    expect(infoProblems({ author: "taco@mepover" })).toEqual([expect.stringMatching(/Author/)]);
    // As loose as the pattern in the file, deliberately: tightening it would reject a document
    // `ids.xsd` accepts.
    expect(infoProblems({ author: "a b@c.d" })).toEqual([]);
  });

  it("names a date that is not an xs:date, and accepts the offset form the corpus writes", () => {
    expect(infoProblems({ date: "16-08-2026" })).toEqual([expect.stringMatching(/Date/)]);
    expect(infoProblems({ date: "2022-11-16+01:00" })).toEqual([]);
  });

  it("names an empty title, which the schema requires on every document", () => {
    expect(infoProblems({ title: "  " })).toEqual([expect.stringMatching(/Title/)]);
    // Absent is not empty: `buildIdsXml` supplies its own default for a document being authored.
    expect(infoProblems({})).toEqual([]);
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

  // The importer reads two of the six kinds and keeps the rest verbatim, so nothing here is
  // reachable from a file yet. That is the point: the exporter and the compile are total over all
  // six before the importer starts producing them, which is what makes reading them additive.
  it("writes and compiles all six facet kinds, and the two agree", () => {
    const parsed = parseIdsXml(buildIdsXml(EVERY_FACET));

    expect(comparable(parsed)).toEqual(comparable(compileDraft(EVERY_FACET)));
    expect(parsed[0].requirements.map((facet) => facet.kind)).toEqual([
      "attribute",
      "property",
      "entity",
      "classification",
      "material",
      "partOf",
    ]);
  });

  // One member of the schema's relations enumeration is two names in a single attribute value.
  it("splits a two-name relation on the way in and writes it back as one attribute", () => {
    const [compiled] = compileDraft(EVERY_FACET);
    const partOf = compiled.requirements[5];
    if (partOf.kind !== "partOf") throw new Error("expected a partOf facet");

    expect(partOf.relations).toEqual(["IFCRELVOIDSELEMENT", "IFCRELFILLSELEMENT"]);
    expect(buildIdsXml(EVERY_FACET)).toContain(
      'relation="IFCRELVOIDSELEMENT IFCRELFILLSELEMENT"'
    );
  });

  // A length is reachable only from an imported file, so the exporter has to write it back with
  // every count the source stated — `03` included, which a count read through a number would lose.
  it("writes a length back with each count as the draft holds it", () => {
    const drafts: RuleDraft[] = [
      {
        id: "r",
        name: "Length",
        entityTypes: ["IfcWall"],
        conditions: [
          {
            id: "c1",
            kind: "attribute",
            propertySet: null,
            name: plainName("Name"),
            value: { kind: "length", exact: null, min: "2", max: "03" },
            cardinality: "required",
          },
        ],
      },
    ];
    const xml = buildIdsXml(drafts);

    expect(xml).toContain('<xs:restriction base="xs:string">');
    expect(xml).toContain('<xs:minLength value="2" />');
    expect(xml).toContain('<xs:maxLength value="03" />');
    expect(comparable(parseIdsXml(xml))).toEqual(comparable(compileDraft(drafts)));
  });

  // `ids.xsd` fixes `<xs:annotation>` as the restriction's **first** child, so it cannot be
  // appended to the facets the way every other part of a restriction is built.
  it("writes an annotation before the facets it documents, and leaves the compiled rule alone", () => {
    const annotated = (value: ValueDraft): RuleDraft[] => [
      {
        id: "r",
        name: "Annotated",
        entityTypes: ["IfcWall"],
        conditions: [
          {
            id: "c1",
            kind: "attribute",
            propertySet: null,
            name: plainName("Name"),
            value,
            cardinality: "required",
          },
        ],
      },
    ];

    const drafts = annotated({ kind: "enum", values: ["60"], annotation: "Minutes of fire rating" });
    const xml = buildIdsXml(drafts);

    expect(xml).toContain(
      `<xs:restriction base="xs:string">\n            <xs:annotation><xs:documentation>Minutes of fire rating</xs:documentation></xs:annotation>\n            <xs:enumeration value="60" />`
    );
    // Prose constrains nothing, so the validator's reading of the file is the same either way.
    expect(comparable(parseIdsXml(xml))).toEqual(comparable(compileDraft(drafts)));
    expect(comparable(parseIdsXml(xml))).toEqual(
      comparable(compileDraft(annotated({ kind: "enum", values: ["60"] })))
    );
    expect(idsSchemaViolations(xml)).toEqual([]);
  });

  // Absent and empty are different, the way they are on every `<info>` child: a document stating an
  // empty `<xs:documentation>` gets an empty one back rather than losing the element.
  it("writes an empty documentation for an empty annotation, and none for an absent one", () => {
    const value = (annotation?: string): ValueDraft =>
      annotation === undefined
        ? { kind: "pattern", sources: ["D.*"] }
        : { kind: "pattern", sources: ["D.*"], annotation };
    const rule = (annotation?: string): RuleDraft[] => [
      {
        id: "r",
        name: "Annotated",
        entityTypes: ["IfcWall"],
        conditions: [
          {
            id: "c1",
            kind: "attribute",
            propertySet: null,
            name: plainName("Name"),
            value: value(annotation),
            cardinality: "required",
          },
        ],
      },
    ];

    expect(buildIdsXml(rule(""))).toContain(
      `<xs:annotation><xs:documentation></xs:documentation></xs:annotation>`
    );
    expect(buildIdsXml(rule())).not.toContain("xs:annotation");
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
