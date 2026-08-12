import { describe, expect, it } from "vitest";
import { isEvaluable, parseIdsXml } from "./parse-ids.js";
import type { ParsedRequirementFacet, ParsedRestriction } from "./parse-ids.js";

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


const SAMPLE_IDS = `<?xml version="1.0" encoding="utf-8"?>
<ids xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd" xmlns="http://standards.buildingsmart.org/IDS">
  <info>
    <title>Sample</title>
  </info>
  <specifications>
    <specification name="Wall naming and fire rating" ifcVersion="IFC2X3 IFC4">
      <applicability maxOccurs="unbounded">
        <entity>
          <name><simpleValue>IFCWALL</simpleValue></name>
        </entity>
      </applicability>
      <requirements>
        <attribute>
          <name><simpleValue>Name</simpleValue></name>
          <value>
            <xs:restriction base="xs:string">
              <xs:pattern value="W-\\d+" />
            </xs:restriction>
          </value>
        </attribute>
        <property dataType="IFCLABEL">
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>FireRating</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

function specificationXml(requirements: string): string {
  return `<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <specifications>
    <specification name="S">
      <applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
      <requirements>${requirements}</requirements>
    </specification>
  </specifications>
</ids>`;
}

describe("parseIdsXml", () => {
  it("extracts a specification's name, applicability, and requirement facets from a single-occurrence document", () => {
    const specifications = parseIdsXml(SAMPLE_IDS);

    expect(specifications).toHaveLength(1);
    const [spec] = specifications;
    expect(spec.name).toBe("Wall naming and fire rating");
    expect(spec.applicability.entityNames).toEqual(["IFCWALL"]);
    expect(spec.requirements).toEqual([
      {
        kind: "attribute",
        name: { kind: "exact", value: "Name" },
        restriction: { kind: "pattern", source: "W-\\d+", regex: expect.any(RegExp) },
        cardinality: "required",
      },
      {
        kind: "property",
        propertySet: { kind: "exact", value: "Pset_WallCommon" },
        baseName: { kind: "exact", value: "FireRating" },
        dataType: "IFCLABEL",
        restriction: null,
        cardinality: "required",
      },
    ]);
  });

  it("anchors a parsed pattern so it must match the whole value", () => {
    const [spec] = parseIdsXml(SAMPLE_IDS);
    const restriction = slotRestriction(spec.requirements[0]);
    if (restriction?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(restriction.regex.test("W-12")).toBe(true);
    expect(restriction.regex.test("xW-12x")).toBe(false);
  });

  it("reads <value><simpleValue> as an exact restriction", () => {
    const [spec] = parseIdsXml(
      specificationXml(
        `<attribute><name><simpleValue>Name</simpleValue></name><value><simpleValue>W-1</simpleValue></value></attribute>`
      )
    );

    expect(slotRestriction(spec.requirements[0])).toEqual({ kind: "exact", value: "W-1" });
  });

  it("reads an xs:enumeration list as an enum restriction, on a property facet too", () => {
    const [spec] = parseIdsXml(
      specificationXml(
        `<property dataType="IFCLABEL">
           <propertySet><simpleValue>MEP_Data</simpleValue></propertySet>
           <baseName><simpleValue>SystemAbbreviation</simpleValue></baseName>
           <value><xs:restriction base="xs:string">
             <xs:enumeration value="SA" /><xs:enumeration value="RA" />
           </xs:restriction></value>
         </property>`
      )
    );

    expect(slotRestriction(spec.requirements[0])).toEqual({ kind: "enum", values: ["SA", "RA"] });
  });

  it('reads cardinality="prohibited" and defaults to required when the attribute is absent', () => {
    const [spec] = parseIdsXml(
      specificationXml(
        `<attribute cardinality="prohibited"><name><simpleValue>Tag</simpleValue></name></attribute>
         <property dataType="IFCLABEL" cardinality="prohibited">
           <propertySet><simpleValue>P</simpleValue></propertySet>
           <baseName><simpleValue>B</simpleValue></baseName>
         </property>
         <attribute><name><simpleValue>Name</simpleValue></name></attribute>`
      )
    );

    // "cardinality" in facet, because an entity requirement is the one facet ids.xsd gives none.
    expect(
      spec.requirements.map((facet) => ("cardinality" in facet ? facet.cardinality : null))
    ).toEqual([
      "prohibited",
      "prohibited",
      "required",
    ]);
  });

  it("keeps requirements in document order rather than grouping attributes before properties", () => {
    const [spec] = parseIdsXml(
      specificationXml(
        `<property dataType="IFCLABEL">
           <propertySet><simpleValue>P</simpleValue></propertySet>
           <baseName><simpleValue>B</simpleValue></baseName>
         </property>
         <attribute><name><simpleValue>Name</simpleValue></name></attribute>`
      )
    );

    expect(spec.requirements.map((facet) => facet.kind)).toEqual(["property", "attribute"]);
  });

  it("returns an empty pattern-restriction regex that never matches for an unparseable pattern", () => {
    const [spec] = parseIdsXml(
      specificationXml(
        `<attribute><name><simpleValue>Name</simpleValue></name><value><xs:restriction base="xs:string"><xs:pattern value="(" /></xs:restriction></value></attribute>`
      )
    );
    const restriction = slotRestriction(spec.requirements[0]);
    if (restriction?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(restriction.source).toBe("(");
    expect(restriction.regex.test("(")).toBe(false);
  });

  it("reports an unrecognized requirement facet instead of dropping it silently", () => {
    // A facet name from no version of the schema this build knows. The six IDS 1.0 facets are
    // deliberately not used here: each becomes readable as it lands, and a test written against
    // one would then be asserting the opposite of what it was for. This is the pass-through
    // safety net doing the job it exists for.
    const xmlWithFutureFacet = SAMPLE_IDS.replace(
      "</requirements>",
      "<zone><value><simpleValue>Foo</simpleValue></value></zone></requirements>"
    );

    const [spec] = parseIdsXml(xmlWithFutureFacet);

    expect(spec.requirements).toHaveLength(2);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "requirements", construct: "zone" })
    );
    // The rule still selects the elements its author meant, so it can be run — just weakened.
    expect(spec.applicabilityComplete).toBe(true);
    expect(isEvaluable(spec)).toBe(true);
  });

  it("reports an unrecognized applicability facet and marks the applicability incomplete", () => {
    const xmlWithMaterial = SAMPLE_IDS.replace(
      "</applicability>",
      "<material><value><simpleValue>Concrete</simpleValue></value></material></applicability>"
    );

    const [spec] = parseIdsXml(xmlWithMaterial);

    expect(spec.applicability.entityNames).toEqual(["IFCWALL"]);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "material" })
    );
    // "Walls made of concrete" is not "walls" — the kept entity name is not the whole story.
    expect(spec.applicabilityComplete).toBe(false);
    expect(isEvaluable(spec)).toBe(false);
  });

  // `ids.xsd` makes <entity> minOccurs="0", so "no entity element" and "an entity element naming
  // nothing" are different documents. The first admits every class and leaves the selection to the
  // facets beside it; running the second would check the whole model against a rule about nothing.
  it("refuses an applicability that states nothing at all", () => {
    const xml = SAMPLE_IDS.replace(
      /<applicability maxOccurs="unbounded">[\s\S]*?<\/applicability>/,
      `<applicability maxOccurs="unbounded"></applicability>`
    );

    const [spec] = parseIdsXml(xml);

    expect(spec.applicability).toEqual({ entityNames: null, facets: [] });
    expect(spec.applicabilityComplete).toBe(true);
    expect(isEvaluable(spec)).toBe(false);
  });

  it("treats an entity name given as a restriction as an applicability it cannot read", () => {
    const xml = SAMPLE_IDS.replace(
      "<name><simpleValue>IFCWALL</simpleValue></name>",
      `<name><xs:restriction base="xs:string"><xs:pattern value="IFCWALL.*" /></xs:restriction></name>`
    );

    const [spec] = parseIdsXml(xml);

    expect(spec.applicability.entityNames).toEqual(null);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "entity/name" })
    );
    expect(isEvaluable(spec)).toBe(false);
  });

  // An applicability has to enumerate the classes it selects, so a pattern there is refused. A
  // requirement only asks about the element in hand, so the same construct is fully understood —
  // and `ids.xsd` types all three of these names as `idsValue`, exactly like a value.
  it("reads an attribute name given as a restriction, unlike an applicability entity name", () => {
    const [spec] = parseIdsXml(
      specificationXml(`<attribute>
        <name><xs:restriction base="xs:string"><xs:pattern value=".*Name.*" /></xs:restriction></name>
      </attribute>`)
    );

    const [facet] = spec.requirements;
    expect(facet.kind === "attribute" && facet.name).toEqual(
      expect.objectContaining({ kind: "pattern", source: ".*Name.*" })
    );
    expect(spec.unsupported).toEqual([]);
    expect(isEvaluable(spec)).toBe(true);
  });

  it("reads a property set and a base name given as restrictions", () => {
    const [spec] = parseIdsXml(
      specificationXml(`<property>
        <propertySet><xs:restriction base="xs:string"><xs:pattern value="Foo_.*" /></xs:restriction></propertySet>
        <baseName><xs:restriction base="xs:string"><xs:enumeration value="A" /><xs:enumeration value="B" /></xs:restriction></baseName>
      </property>`)
    );

    const [facet] = spec.requirements;
    if (facet.kind !== "property") throw new Error("expected a property facet");
    expect(facet.propertySet).toEqual(expect.objectContaining({ kind: "pattern", source: "Foo_.*" }));
    expect(facet.baseName).toEqual({ kind: "enum", values: ["A", "B"] });
    expect(spec.unsupported).toEqual([]);
    expect(isEvaluable(spec)).toBe(true);
  });

  it("refuses a property that states no readable property set", () => {
    const [spec] = parseIdsXml(
      specificationXml(`<property>
        <propertySet />
        <baseName><simpleValue>FireRating</simpleValue></baseName>
      </property>`)
    );

    expect(spec.requirements).toEqual([]);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "requirements", construct: "property/name" })
    );
    expect(isEvaluable(spec)).toBe(false);
  });

  it("reports a predefinedType it cannot honour rather than widening the rule in silence", () => {
    const xml = SAMPLE_IDS.replace(
      "<name><simpleValue>IFCWALL</simpleValue></name>",
      "<name><simpleValue>IFCWALL</simpleValue></name><predefinedType><simpleValue>PARTITIONING</simpleValue></predefinedType>"
    );

    const [spec] = parseIdsXml(xml);

    expect(spec.applicability.entityNames).toEqual(["IFCWALL"]);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "entity/predefinedType" })
    );
    expect(isEvaluable(spec)).toBe(false);
  });

  it("reads a numeric bound on a property rather than reporting it unsupported", () => {
    const [spec] = parseIdsXml(
      specificationXml(`<property dataType="IFCREAL">
        <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
        <baseName><simpleValue>ThermalTransmittance</simpleValue></baseName>
        <value><xs:restriction base="xs:double"><xs:maxInclusive value="0.24" /></xs:restriction></value>
      </property>`)
    );

    expect(slotRestriction(spec.requirements[0])).toEqual({
      kind: "bounds",
      min: null,
      max: { value: 0.24, inclusive: true },
    });
    expect(spec.unsupported).toEqual([]);
    expect(isEvaluable(spec)).toBe(true);
  });

  it("reads an optional requirement as optional rather than downgrading it", () => {
    const [spec] = parseIdsXml(
      specificationXml(`<attribute cardinality="optional">
        <name><simpleValue>Description</simpleValue></name>
      </attribute>`)
    );

    const [facet] = spec.requirements;
    expect("cardinality" in facet && facet.cardinality).toBe("optional");
    expect(spec.unsupported).toEqual([]);
  });

  it("reports a specification with no applicability at all as unevaluable", () => {
    const [spec] = parseIdsXml(`<ids xmlns="http://standards.buildingsmart.org/IDS">
      <specifications>
        <specification name="S">
          <applicability />
          <requirements />
        </specification>
      </specifications>
    </ids>`);

    expect(spec.applicabilityComplete).toBe(true);
    expect(isEvaluable(spec)).toBe(false);
  });

  it("returns an empty list for a document with no specifications", () => {
    expect(parseIdsXml("<ids><specifications></specifications></ids>")).toEqual([]);
  });
});

describe("parseIdsXml — a requirement-side entity", () => {
  it("reads the name and the predefined type, and gives the facet no cardinality", () => {
    const [spec] = parseIdsXml(
      specificationXml(`<entity>
        <name><simpleValue>IFCWALL</simpleValue></name>
        <predefinedType><simpleValue>SOLIDWALL</simpleValue></predefinedType>
      </entity>`)
    );

    expect(spec.requirements).toEqual([
      {
        kind: "entity",
        name: { kind: "exact", value: "IFCWALL" },
        predefinedType: { kind: "exact", value: "SOLIDWALL" },
      },
    ]);
    expect(spec.unsupported).toEqual([]);
    expect(isEvaluable(spec)).toBe(true);
  });

  // A pattern names an open-ended set of classes, which an applicability cannot enumerate and so
  // refuses. A requirement only ever asks about the element in hand, so it is fully understood.
  it("reads a name given as a pattern, unlike an applicability entity", () => {
    const [spec] = parseIdsXml(
      specificationXml(`<entity>
        <name><xs:restriction base="xs:string"><xs:pattern value="IFC.*TYPE" /></xs:restriction></name>
      </entity>`)
    );

    const [facet] = spec.requirements;
    expect(facet.kind).toBe("entity");
    expect(facet.kind === "entity" && facet.name.kind).toBe("pattern");
    expect(spec.unsupported).toEqual([]);
    expect(isEvaluable(spec)).toBe(true);
  });

  it("refuses the specification when the entity states no readable name", () => {
    const [spec] = parseIdsXml(specificationXml(`<entity><name /></entity>`));

    expect(spec.requirements).toEqual([]);
    expect(spec.unsupported).toEqual([
      {
        section: "requirements",
        construct: "entity/name",
        description: "States no readable entity name, so the class it requires is unknown.",
      },
    ]);
    expect(isEvaluable(spec)).toBe(false);
  });
});

describe("parseIdsXml — numeric bounds", () => {
  const boundsAttribute = (facets: string) =>
    parseIdsXml(
      specificationXml(
        `<attribute><name><simpleValue>RefractionIndex</simpleValue></name>
           <value><xs:restriction base="xs:double">${facets}</xs:restriction></value>
         </attribute>`
      )
    )[0];

  it("reads the four bound facets, keeping inclusive apart from exclusive", () => {
    const spec = boundsAttribute(
      `<xs:minInclusive value="0" /><xs:maxExclusive value="10.5" />`
    );

    expect(slotRestriction(spec.requirements[0])).toEqual({
      kind: "bounds",
      min: { value: 0, inclusive: true },
      max: { value: 10.5, inclusive: false },
    });
  });

  it("reads a one-sided range", () => {
    expect(slotRestriction(boundsAttribute(`<xs:minExclusive value="-3" />`).requirements[0])).toEqual({
      kind: "bounds",
      min: { value: -3, inclusive: false },
      max: null,
    });
  });

  // Bounds used to land in RESTRICTION_FACETS_READ's blind spot, and the empty enumeration left
  // behind failed every element. That was deliberate, but it is a wrong answer either way.
  it("no longer reports a bound as an unsupported construct", () => {
    const spec = boundsAttribute(`<xs:minInclusive value="0" /><xs:maxInclusive value="10" />`);
    expect(spec.unsupported).toEqual([]);
  });

  // NaN would answer false to every comparison, so the edge is dropped and the facet reported
  // rather than silently rejecting everything.
  it("leaves an edge unset when its value is not a number", () => {
    const spec = boundsAttribute(`<xs:minInclusive value="abc" /><xs:maxInclusive value="10" />`);
    expect(slotRestriction(spec.requirements[0])).toEqual({
      kind: "bounds",
      min: null,
      max: { value: 10, inclusive: true },
    });
  });

  it("reports an enumeration it cannot intersect with the range", () => {
    const spec = boundsAttribute(
      `<xs:minInclusive value="0" /><xs:enumeration value="5" />`
    );
    expect(slotRestriction(spec.requirements[0])).toMatchObject({ kind: "bounds" });
    expect(spec.unsupported).toEqual([
      expect.objectContaining({ construct: "xs:enumeration", section: "requirements" }),
    ]);
  });
});

describe("parseIdsXml — length", () => {
  const lengthAttribute = (facets: string) =>
    parseIdsXml(
      specificationXml(
        `<attribute><name><simpleValue>Name</simpleValue></name>
           <value><xs:restriction base="xs:string">${facets}</xs:restriction></value>
         </attribute>`
      )
    )[0];

  it("reads the three length facets", () => {
    expect(slotRestriction(lengthAttribute(`<xs:length value="2" />`).requirements[0])).toEqual({
      kind: "length",
      exact: 2,
      min: null,
      max: null,
    });
    const range = lengthAttribute(`<xs:minLength value="2" /><xs:maxLength value="3" />`);
    expect(slotRestriction(range.requirements[0])).toEqual({
      kind: "length",
      exact: null,
      min: 2,
      max: 3,
    });
  });

  // A length used to land in RESTRICTION_FACETS_READ's blind spot, and the empty enumeration left
  // behind failed every element — which happened to agree with the suite's three `fail-` cases.
  it("no longer reports a length as an unsupported construct", () => {
    expect(lengthAttribute(`<xs:minLength value="2" />`).unsupported).toEqual([]);
  });

  // Same rule as a bound whose value is not a number: the edge is dropped rather than becoming a
  // comparison that answers false to everything.
  it("leaves an edge unset when its value is not a whole count", () => {
    expect(
      slotRestriction(lengthAttribute(`<xs:minLength value="two" /><xs:maxLength value="3" />`).requirements[0])
    ).toEqual({ kind: "length", exact: null, min: null, max: 3 });
  });

  it("reports an enumeration it cannot intersect with the length", () => {
    const spec = lengthAttribute(`<xs:minLength value="2" /><xs:enumeration value="AB" />`);
    expect(slotRestriction(spec.requirements[0])).toMatchObject({ kind: "length" });
    expect(spec.unsupported).toEqual([
      expect.objectContaining({ construct: "xs:enumeration", section: "requirements" }),
    ]);
  });
});
