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
      propertySets: { Pset_WallCommon: { FireRating: { value: "REI90" } } },
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
    propertySets: { Pset_WallCommon: { FireRating: { value: "REI90" } } },
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

  // A property-value applicability: this selects walls *bearing* a load, not all walls. Keeping
  // IFCWALL and dropping the property would check the wrong set, which is why it used to refuse the
  // whole specification; now the property decides the selection, so both readings are gone.
  const LOAD_BEARING_APPLICABILITY = `<property dataType="IFCBOOLEAN">
         <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
         <baseName><simpleValue>LoadBearing</simpleValue></baseName>
         <value><simpleValue>TRUE</simpleValue></value>
       </property></applicability>`;

  it("selects on an applicability property as well as on the entity name", () => {
    const bearingWall = makeElement({
      globalId: "wall-3",
      name: "W-009",
      propertySets: {
        Pset_WallCommon: { FireRating: { value: "REI90" }, LoadBearing: { value: "TRUE" } },
      },
    });
    const idsXml = IDS_XML.replace("</applicability>", LOAD_BEARING_APPLICABILITY);

    const [outcome] = validateBySpecification([compliantWall, failingWall, bearingWall], idsXml);

    expect(outcome.checked).toBe(true);
    expect(outcome.unsupported).toEqual([]);
    // The two walls that state no LoadBearing are not in the rule's subject at all, so the one
    // that would have failed its requirements never reaches them.
    expect(outcome).toMatchObject({ applicableCount: 1, passedCount: 1, failedCount: 0 });
    expect(outcome.violations).toEqual([]);
  });

  it("refuses an applicability facet stating a cardinality, which ids.xsd gives it none of", () => {
    const idsXml = IDS_XML.replace(
      "</applicability>",
      LOAD_BEARING_APPLICABILITY.replace("<property ", `<property cardinality="prohibited" `)
    );

    const [outcome] = validateBySpecification([compliantWall, failingWall], idsXml);

    // Reading it as a requirement's `prohibited` would invert the selection and check the walls
    // that are *not* load-bearing, which is a different rule from the one the file states.
    expect(outcome.checked).toBe(false);
    expect(outcome.applicableCount).toBe(0);
    expect(outcome.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "property/cardinality" })
    );
  });

  // All five facets `ids.xsd` allows beside `<entity>` are read now, so what is left to refuse is a
  // facet from a later revision. The claim is unchanged: an applicability narrowed by something we
  // did not read selects a different set of elements than its author wrote.
  it("refuses to run a specification whose applicability it could not fully read", () => {
    const idsXml = IDS_XML.replace(
      "</applicability>",
      `<zone><name><simpleValue>Z1</simpleValue></name></zone></applicability>`
    );

    const [outcome] = validateBySpecification([compliantWall, failingWall], idsXml);

    expect(outcome.checked).toBe(false);
    expect(outcome.violations).toEqual([]);
    expect(outcome.applicableCount).toBe(0);
    expect(outcome.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "zone" })
    );
  });

  // partOf has no use in the 464 hand-authored corpus specifications, none in all 7,784 corpus
  // files, and no conformance case — so this test and the real model are the only evidence it
  // works. Stated here rather than left implicit.
  it("selects on an applicability partOf, which no corpus file and no conformance case writes", () => {
    const inASystem = makeElement({
      globalId: "wall-4",
      name: "W-010",
      propertySets: { Pset_WallCommon: { FireRating: { value: "REI90" } } },
      partOf: [
        { ifcType: "IFCSYSTEM", predefinedType: null, relation: "IFCRELASSIGNSTOGROUP" },
      ],
    });
    const idsXml = IDS_XML.replace(
      "</applicability>",
      `<partOf relation="IFCRELASSIGNSTOGROUP">
         <entity><name><simpleValue>IFCSYSTEM</simpleValue></name></entity>
       </partOf></applicability>`
    );

    const [outcome] = validateBySpecification([compliantWall, failingWall, inASystem], idsXml);

    expect(outcome.checked).toBe(true);
    expect(outcome.unsupported).toEqual([]);
    expect(outcome).toMatchObject({ applicableCount: 1, passedCount: 1, failedCount: 0 });
  });

  it("marks a specification it could fully read as checked", () => {
    const [outcome] = validateBySpecification([compliantWall], IDS_XML);

    expect(outcome.checked).toBe(true);
    expect(outcome.unsupported).toEqual([]);
  });

  it("runs a specification that only lost a requirement, and says what it lost", () => {
    // A facet from no version of the schema this build knows: each of the six IDS 1.0 facets
    // becomes readable as it lands, so one of them would stop being "lost" and this test would
    // quietly start asserting nothing.
    const idsXml = IDS_XML.replace(
      "</requirements>",
      "<zone><value><simpleValue>Concrete</simpleValue></value></zone></requirements>"
    );

    const [outcome] = validateBySpecification([compliantWall, failingWall], idsXml);

    // Applicability is intact, so the rule still selects what its author meant — it is merely
    // weaker than they wrote, which is reportable rather than disqualifying.
    expect(outcome.checked).toBe(true);
    expect(outcome.applicableCount).toBe(2);
    expect(outcome.unsupported).toContainEqual(
      expect.objectContaining({ section: "requirements", construct: "zone" })
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

  // ids.xsd inherits XML Schema's occurs group, where minOccurs defaults to 1. So the plain
  // <applicability maxOccurs="unbounded"> every rule in the wild carries is *required*, and a
  // model where nothing matches fails it — indistinguishable from a clean model on the counts.
  describe("specification cardinality", () => {
    const cardinalityIds = (occurs: string, requirements = true) => `<?xml version="1.0"?>
<ids xmlns="http://standards.buildingsmart.org/IDS">
  <specifications>
    <specification name="Walls are named" ifcVersion="IFC4">
      <applicability ${occurs}>
        <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
      </applicability>
      ${requirements ? "<requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>" : ""}
    </specification>
  </specifications>
</ids>`;

    it("fails a required specification the model has nothing for", () => {
      const [outcome] = validateBySpecification([door], cardinalityIds(`maxOccurs="unbounded"`));

      expect(outcome.applicableCount).toBe(0);
      expect(outcome.failedCount).toBe(0);
      expect(outcome.cardinalityFailure).toMatch(/requires at least one matching element/);
    });

    it("passes a required specification the model does have something for", () => {
      const [outcome] = validateBySpecification(
        [compliantWall],
        cardinalityIds(`maxOccurs="unbounded"`)
      );

      expect(outcome.applicableCount).toBe(1);
      expect(outcome.cardinalityFailure).toBeNull();
    });

    it("lets an optional specification match nothing", () => {
      const [outcome] = validateBySpecification(
        [door],
        cardinalityIds(`minOccurs="0" maxOccurs="unbounded"`)
      );

      expect(outcome.applicableCount).toBe(0);
      expect(outcome.cardinalityFailure).toBeNull();
    });

    it("fails a prohibited specification whose applicability matches", () => {
      const [outcome] = validateBySpecification(
        [compliantWall],
        cardinalityIds(`minOccurs="0" maxOccurs="0"`, false)
      );

      expect(outcome.applicableCount).toBe(1);
      expect(outcome.cardinalityFailure).toMatch(/Nothing may match/);
    });

    it("passes a prohibited specification whose applicability matches nothing", () => {
      const [outcome] = validateBySpecification(
        [door],
        cardinalityIds(`minOccurs="0" maxOccurs="0"`, false)
      );

      expect(outcome.cardinalityFailure).toBeNull();
    });

    // A prohibited specification says nothing may match it, so there is nothing left to require.
    it("rejects a prohibited specification that also states requirements", () => {
      const [outcome] = validateBySpecification(
        [door],
        cardinalityIds(`minOccurs="0" maxOccurs="0"`)
      );

      expect(outcome.cardinalityFailure).toMatch(/cannot also state requirements/);
    });

    // The elements a prohibited specification selects are the failure; there is nothing to check
    // on them, so they must not be counted as failing on their own merits.
    it("does not judge the elements a prohibited specification selects", () => {
      const [outcome] = validateBySpecification(
        [failingWall],
        cardinalityIds(`minOccurs="0" maxOccurs="0"`, false)
      );

      expect(outcome.applicableCount).toBe(1);
      expect(outcome.failedCount).toBe(0);
      expect(outcome.violations).toEqual([]);
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
