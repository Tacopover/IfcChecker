import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { validateElements } from "./validate-elements.js";

const IDS_XML = `<?xml version="1.0" encoding="utf-8"?>
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

describe("validateElements", () => {
  it("returns no violations for a fully compliant element", () => {
    const element = makeElement({
      globalId: "wall-1",
      name: "W-007",
      propertySets: { Pset_WallCommon: { FireRating: "REI90" } },
    });

    expect(validateElements([element], IDS_XML)).toEqual([]);
  });

  it("reports both a pattern violation and a missing-property violation for a non-compliant element", () => {
    const element = makeElement({
      globalId: "wall-2",
      name: "West Wall",
      propertySets: { Pset_WallCommon: {} },
    });

    const violations = validateElements([element], IDS_XML);

    expect(violations).toHaveLength(2);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementGlobalId: "wall-2",
          elementType: "IFCWALL",
          ruleId: "Wall naming and fire rating",
          severity: "error",
          message: expect.stringContaining("Name"),
        }),
        expect.objectContaining({
          elementGlobalId: "wall-2",
          elementType: "IFCWALL",
          ruleId: "Wall naming and fire rating",
          severity: "error",
          message: expect.stringContaining("FireRating"),
        }),
      ])
    );
  });

  it("does not evaluate requirements for elements whose type doesn't match applicability", () => {
    const element = makeElement({
      globalId: "door-1",
      ifcType: "IFCDOOR",
      name: null,
      propertySets: {},
    });

    expect(validateElements([element], IDS_XML)).toEqual([]);
  });
});
