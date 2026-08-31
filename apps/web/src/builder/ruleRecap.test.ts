import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import { ruleRecap } from "./ruleRecap";
import { introspectModel } from "./introspect";

function wall(index: number, fireRating: string | null): NormalizedElement {
  return {
    globalId: `w${index}`,
    expressId: index,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${index}`,
    attributes: {},
    propertySets: {
      Pset_WallCommon: fireRating === null ? {} : { FireRating: { value: fireRating } },
    },
    classifications: [{ system: "Uniformat", identifications: ["B2010"] }],
  };
}

const ELEMENTS = [wall(1, "60"), wall(2, "90"), wall(3, null)];
const INTROSPECTION = introspectModel(ELEMENTS);
const SOURCE = INTROSPECTION.fieldsFor(["IfcWall"]);

const BASE: RuleDraft = {
  id: "r1",
  name: "New rule",
  entityTypes: ["IfcWall"],
  conditions: [],
};

describe("ruleRecap", () => {
  it("reports the type label and the pre-narrowing element count", () => {
    const recap = ruleRecap(BASE, SOURCE, ELEMENTS);

    expect(recap.typeLabel).toBe("IfcWall");
    expect(recap.typeCount).toBe(3);
    expect(recap.narrowing).toBeNull();
    expect(recap.requirement).toBeNull();
  });

  it("describes the first applicability facet with its live match count", () => {
    const draft: RuleDraft = {
      ...BASE,
      applicabilityFacets: [
        { id: "a1", kind: "classification", system: plainName("Uniformat"), value: null, cardinality: "required" },
      ],
    };

    const recap = ruleRecap(draft, SOURCE, ELEMENTS);

    expect(recap.narrowing).toBe("classified in Uniformat (3 match)");
    expect(recap.extraNarrowing).toBe(0);
  });

  it("counts extra applicability facets beyond the first", () => {
    const draft: RuleDraft = {
      ...BASE,
      applicabilityFacets: [
        { id: "a1", kind: "classification", system: plainName("Uniformat"), value: null, cardinality: "required" },
        { id: "a2", kind: "material", value: plainName("Concrete"), cardinality: "required" },
      ],
    };

    expect(ruleRecap(draft, SOURCE, ELEMENTS).extraNarrowing).toBe(1);
  });

  it("describes the first condition and counts extras", () => {
    const draft: RuleDraft = {
      ...BASE,
      conditions: [
        {
          id: "c1",
          kind: "property",
          propertySet: plainName("Pset_WallCommon"),
          name: plainName("FireRating"),
          value: null,
          cardinality: "required",
        },
        {
          id: "c2",
          kind: "attribute",
          propertySet: null,
          name: plainName("Name"),
          value: null,
          cardinality: "required",
        },
      ],
    };

    const recap = ruleRecap(draft, SOURCE, ELEMENTS);
    expect(recap.requirement).toBe("must state a FireRating in Pset_WallCommon");
    expect(recap.extraRequirements).toBe(1);
  });

  it("falls back to a count when the picked types don't fold into one schema group", () => {
    // `collapsibleEntityGroupsFor` is schema-scoped: Wall and Door alone never exactly match a
    // single ancestor's full concrete expansion (IfcBuildingElement has far more subtypes than
    // just those two), so this stays "2 types" rather than folding into a made-up group name.
    const mixed: RuleDraft = { ...BASE, entityTypes: ["IfcWall", "IfcDoor"] };
    expect(ruleRecap(mixed, SOURCE, ELEMENTS).typeLabel).toBe("2 types");
  });
});
