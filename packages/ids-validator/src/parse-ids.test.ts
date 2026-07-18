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
        patternSource: "W-\\d+",
        pattern: expect.any(RegExp),
      },
      {
        kind: "property",
        propertySet: "Pset_WallCommon",
        baseName: "FireRating",
        dataType: "IFCLABEL",
      },
    ]);
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
});
