import { describe, expect, it, vi } from "vitest";
import { parseIdsXml } from "./parse-ids.js";

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

  it("skips an unrecognized requirement facet and logs a warning instead of throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const xmlWithClassification = SAMPLE_IDS.replace(
      "</requirements>",
      "<classification><value><simpleValue>Foo</simpleValue></value></classification></requirements>"
    );

    const specifications = parseIdsXml(xmlWithClassification);

    expect(specifications[0].requirements).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unsupported requirement facet "<classification>"')
    );
    warnSpy.mockRestore();
  });

  it("skips an unrecognized applicability facet and logs a warning instead of throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const xmlWithMaterial = SAMPLE_IDS.replace(
      "</applicability>",
      "<material><value><simpleValue>Concrete</simpleValue></value></material></applicability>"
    );

    const specifications = parseIdsXml(xmlWithMaterial);

    expect(specifications[0].applicabilityEntityNames).toEqual(["IFCWALL"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unsupported applicability facet "<material>"')
    );
    warnSpy.mockRestore();
  });

  it("returns an empty list for a document with no specifications", () => {
    expect(parseIdsXml("<ids><specifications></specifications></ids>")).toEqual([]);
  });
});
