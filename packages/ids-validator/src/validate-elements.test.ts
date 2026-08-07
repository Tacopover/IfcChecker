import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { validateBySpecification, validateElements } from "./validate-elements.js";

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

const TWO_SPEC_IDS_XML = `<?xml version="1.0" encoding="utf-8"?>
<ids xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="http://standards.buildingsmart.org/IDS">
  <info>
    <title>Two specifications</title>
  </info>
  <specifications>
    <specification name="Walls are named" ifcVersion="IFC4">
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
      </requirements>
    </specification>
    <specification name="Doors are named" ifcVersion="IFC4">
      <applicability maxOccurs="unbounded">
        <entity>
          <name><simpleValue>IFCDOOR</simpleValue></name>
        </entity>
      </applicability>
      <requirements>
        <attribute>
          <name><simpleValue>Name</simpleValue></name>
        </attribute>
      </requirements>
    </specification>
  </specifications>
</ids>`;

function makeElement(overrides: Partial<NormalizedElement>): NormalizedElement {
  return {
    globalId: "g1",
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

describe("validateBySpecification", () => {
  const compliantWall = makeElement({
    globalId: "wall-1",
    name: "W-007",
    propertySets: { Pset_WallCommon: { FireRating: "REI90" } },
  });
  const failingWall = makeElement({
    globalId: "wall-2",
    name: "West Wall",
    propertySets: { Pset_WallCommon: {} },
  });
  const door = makeElement({ globalId: "door-1", ifcType: "IFCDOOR" });

  it("counts elements, not violations — a wall failing two requirements is one failing wall", () => {
    const [outcome] = validateBySpecification([compliantWall, failingWall], IDS_XML);

    expect(outcome.violations).toHaveLength(2);
    expect(outcome).toMatchObject({
      name: "Wall naming and fire rating",
      applicableCount: 2,
      passedCount: 1,
      failedCount: 1,
    });
  });

  it("reports a specification that matched nothing as applying to zero elements, not as clean", () => {
    const [outcome] = validateBySpecification([door], IDS_XML);

    expect(outcome.violations).toEqual([]);
    // The distinction the flat violation list cannot make: this rule checked nothing,
    // and reporting it the same way as a fully compliant model is a false clean bill.
    expect(outcome.applicableCount).toBe(0);
    expect(outcome.passedCount).toBe(0);
  });

  it("refuses to run a specification whose applicability it could not fully read", () => {
    // A property-value applicability: this selects walls *bearing* a load, not all walls.
    // Dropping the property facet and keeping IFCWALL would check the wrong set; dropping the
    // whole applicability would match nothing and report the model clean. Neither is honest.
    const idsXml = IDS_XML.replace(
      "</applicability>",
      `<property dataType="IFCBOOLEAN">
         <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
         <baseName><simpleValue>LoadBearing</simpleValue></baseName>
         <value><simpleValue>TRUE</simpleValue></value>
       </property></applicability>`
    );

    const [outcome] = validateBySpecification([compliantWall, failingWall], idsXml);

    expect(outcome.checked).toBe(false);
    expect(outcome.violations).toEqual([]);
    expect(outcome.applicableCount).toBe(0);
    expect(outcome.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "property" })
    );
  });

  it("marks a specification it could fully read as checked", () => {
    const [outcome] = validateBySpecification([compliantWall], IDS_XML);

    expect(outcome.checked).toBe(true);
    expect(outcome.unsupported).toEqual([]);
  });

  it("runs a specification that only lost a requirement, and says what it lost", () => {
    const idsXml = IDS_XML.replace(
      "</requirements>",
      "<material><value><simpleValue>Concrete</simpleValue></value></material></requirements>"
    );

    const [outcome] = validateBySpecification([compliantWall, failingWall], idsXml);

    // Applicability is intact, so the rule still selects what its author meant — it is merely
    // weaker than they wrote, which is reportable rather than disqualifying.
    expect(outcome.checked).toBe(true);
    expect(outcome.applicableCount).toBe(2);
    expect(outcome.unsupported).toContainEqual(
      expect.objectContaining({ section: "requirements", construct: "material" })
    );
  });

  it("keeps each specification's elements and counts separate", () => {
    const outcomes = validateBySpecification([failingWall, door], TWO_SPEC_IDS_XML);

    expect(outcomes.map((outcome) => outcome.name)).toEqual(["Walls are named", "Doors are named"]);
    expect(outcomes[0]).toMatchObject({ applicableCount: 1, failedCount: 1 });
    expect(outcomes[1]).toMatchObject({ applicableCount: 1, failedCount: 1 });
    expect(outcomes[0].violations.map((violation) => violation.elementGlobalId)).toEqual(["wall-2"]);
    expect(outcomes[1].violations.map((violation) => violation.elementGlobalId)).toEqual(["door-1"]);
  });

  it("carries the element name, so a row can say which element failed", () => {
    const [outcome] = validateBySpecification([failingWall], IDS_XML);

    expect(outcome.violations[0]).toMatchObject({
      elementGlobalId: "wall-2",
      elementName: "West Wall",
    });
  });

  it("still flattens to the same violations through validateElements", () => {
    const elements = [compliantWall, failingWall, door];
    const flattened = validateBySpecification(elements, TWO_SPEC_IDS_XML).flatMap(
      (outcome) => outcome.violations
    );

    expect(validateElements(elements, TWO_SPEC_IDS_XML)).toEqual(flattened);
  });
});
