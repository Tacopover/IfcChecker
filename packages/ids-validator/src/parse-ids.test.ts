import { describe, expect, it } from "vitest";
import { isEvaluable, parseIdsXml } from "./parse-ids.js";

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
    expect(spec.applicabilityEntityNames).toEqual(["IFCWALL"]);
    expect(spec.requirements).toEqual([
      {
        kind: "attribute",
        name: "Name",
        restriction: { kind: "pattern", source: "W-\\d+", regex: expect.any(RegExp) },
        cardinality: "required",
      },
      {
        kind: "property",
        propertySet: "Pset_WallCommon",
        baseName: "FireRating",
        dataType: "IFCLABEL",
        restriction: null,
        cardinality: "required",
      },
    ]);
  });

  it("anchors a parsed pattern so it must match the whole value", () => {
    const [spec] = parseIdsXml(SAMPLE_IDS);
    const restriction = spec.requirements[0].restriction;
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

    expect(spec.requirements[0].restriction).toEqual({ kind: "exact", value: "W-1" });
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

    expect(spec.requirements[0].restriction).toEqual({ kind: "enum", values: ["SA", "RA"] });
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

    expect(spec.requirements.map((facet) => facet.cardinality)).toEqual([
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
    const restriction = spec.requirements[0].restriction;
    if (restriction?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(restriction.source).toBe("(");
    expect(restriction.regex.test("(")).toBe(false);
  });

  it("reports an unrecognized requirement facet instead of dropping it silently", () => {
    const xmlWithClassification = SAMPLE_IDS.replace(
      "</requirements>",
      "<classification><value><simpleValue>Foo</simpleValue></value></classification></requirements>"
    );

    const [spec] = parseIdsXml(xmlWithClassification);

    expect(spec.requirements).toHaveLength(2);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "requirements", construct: "classification" })
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

    expect(spec.applicabilityEntityNames).toEqual(["IFCWALL"]);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "material" })
    );
    // "Walls made of concrete" is not "walls" — the kept entity name is not the whole story.
    expect(spec.applicabilityComplete).toBe(false);
    expect(isEvaluable(spec)).toBe(false);
  });

  it("treats an entity name given as a restriction as an applicability it cannot read", () => {
    const xml = SAMPLE_IDS.replace(
      "<name><simpleValue>IFCWALL</simpleValue></name>",
      `<name><xs:restriction base="xs:string"><xs:pattern value="IFCWALL.*" /></xs:restriction></name>`
    );

    const [spec] = parseIdsXml(xml);

    expect(spec.applicabilityEntityNames).toEqual([]);
    expect(spec.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "entity/name" })
    );
    expect(isEvaluable(spec)).toBe(false);
  });

  it("reports a predefinedType it cannot honour rather than widening the rule in silence", () => {
    const xml = SAMPLE_IDS.replace(
      "<name><simpleValue>IFCWALL</simpleValue></name>",
      "<name><simpleValue>IFCWALL</simpleValue></name><predefinedType><simpleValue>PARTITIONING</simpleValue></predefinedType>"
    );

    const [spec] = parseIdsXml(xml);

    expect(spec.applicabilityEntityNames).toEqual(["IFCWALL"]);
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

    expect(spec.requirements[0].restriction).toEqual({
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

    expect(spec.requirements[0].cardinality).toBe("optional");
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

    expect(spec.requirements[0].restriction).toEqual({
      kind: "bounds",
      min: { value: 0, inclusive: true },
      max: { value: 10.5, inclusive: false },
    });
  });

  it("reads a one-sided range", () => {
    expect(boundsAttribute(`<xs:minExclusive value="-3" />`).requirements[0].restriction).toEqual({
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
    expect(spec.requirements[0].restriction).toEqual({
      kind: "bounds",
      min: null,
      max: { value: 10, inclusive: true },
    });
  });

  it("reports an enumeration it cannot intersect with the range", () => {
    const spec = boundsAttribute(
      `<xs:minInclusive value="0" /><xs:enumeration value="5" />`
    );
    expect(spec.requirements[0].restriction).toMatchObject({ kind: "bounds" });
    expect(spec.unsupported).toEqual([
      expect.objectContaining({ construct: "xs:enumeration", section: "requirements" }),
    ]);
  });
});
