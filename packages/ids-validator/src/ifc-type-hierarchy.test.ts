import { describe, expect, it } from "vitest";
import {
  IFC_SCHEMA,
  ancestorsOf,
  canonicalIfcType,
  collapsibleEntityGroupsFor,
  descendantsOf,
  expandedTypeNamesFor,
  isKnownIfcType,
  isLegacyIfcType,
  isSubtypeOf,
} from "./ifc-type-hierarchy.js";

describe("canonicalIfcType", () => {
  it("normalises the upper-case spelling IFC files produce", () => {
    expect(canonicalIfcType("IFCWALL")).toBe("IfcWall");
    expect(canonicalIfcType("ifcductsegment")).toBe("IfcDuctSegment");
    expect(canonicalIfcType("IfcSpace")).toBe("IfcSpace");
    expect(canonicalIfcType("  IFCDOOR  ")).toBe("IfcDoor");
  });

  it("returns null for types outside the table", () => {
    expect(canonicalIfcType("IfcMadeUpThing")).toBeNull();
    expect(canonicalIfcType("")).toBeNull();
    expect(isKnownIfcType("IfcMadeUpThing")).toBe(false);
    expect(isKnownIfcType("IFCWALL")).toBe(true);
  });

  it("targets IFC4", () => {
    expect(IFC_SCHEMA).toBe("IFC4");
  });
});

describe("ancestorsOf", () => {
  // The chain runs to IfcRoot, not to IfcProduct. It used to stop there, which
  // is why an applicability naming IfcTypeObject or IfcObjectDefinition
  // resolved to nothing and reported every model clean.
  it("walks the full MEP chain, immediate parent first", () => {
    expect(ancestorsOf("IfcDuctSegment")).toEqual([
      "IfcFlowSegment",
      "IfcDistributionFlowElement",
      "IfcDistributionElement",
      "IfcElement",
      "IfcProduct",
      "IfcObject",
      "IfcObjectDefinition",
      "IfcRoot",
    ]);
  });

  it("is case-insensitive", () => {
    expect(ancestorsOf("IFCWALL")).toEqual([
      "IfcBuildingElement",
      "IfcElement",
      "IfcProduct",
      "IfcObject",
      "IfcObjectDefinition",
      "IfcRoot",
    ]);
  });

  it("reaches type objects, which are not products at all", () => {
    expect(ancestorsOf("IfcWallType")).toEqual([
      "IfcBuildingElementType",
      "IfcElementType",
      "IfcTypeProduct",
      "IfcTypeObject",
      "IfcObjectDefinition",
      "IfcRoot",
    ]);
    expect(isSubtypeOf("IfcWallType", "IfcTypeObject")).toBe(true);
    expect(isSubtypeOf("IfcWallType", "IfcWall")).toBe(false);
  });

  it("returns an empty list for a root and for unknown types", () => {
    expect(ancestorsOf("IfcRoot")).toEqual([]);
    expect(ancestorsOf("IfcMadeUpThing")).toEqual([]);
  });
});

describe("descendantsOf", () => {
  it("collects the whole subtree of IfcElement, including deep MEP leaves", () => {
    const descendants = descendantsOf("IfcElement");
    expect(descendants).toContain("IfcWall");
    expect(descendants).toContain("IfcDistributionFlowElement");
    expect(descendants).toContain("IfcDuctSegment");
    expect(descendants).toContain("IfcReinforcingBar");
    expect(descendants).not.toContain("IfcElement");
    expect(descendants).not.toContain("IfcSpace");
  });

  it("returns an empty list for leaves and unknown types", () => {
    expect(descendantsOf("IfcValve")).toEqual([]);
    expect(descendantsOf("IfcMadeUpThing")).toEqual([]);
  });

  it("keeps the standard-case subtypes IFC4 declares under concrete elements", () => {
    expect(descendantsOf("IfcWall")).toEqual(["IfcWallElementedCase", "IfcWallStandardCase"]);
  });
});

describe("the concrete classes Revit exports", () => {
  // The table used to be a hand-written 17-name subset, so an MEP model was
  // largely invisible. These are the classes a real export actually carries.
  const MEP: Array<[string, string]> = [
    ["IfcValve", "IfcFlowController"],
    ["IfcDamper", "IfcFlowController"],
    ["IfcAirTerminal", "IfcFlowTerminal"],
    ["IfcDuctFitting", "IfcFlowFitting"],
    ["IfcPipeFitting", "IfcFlowFitting"],
    ["IfcSensor", "IfcDistributionControlElement"],
  ];

  it.each(MEP)("%s sits under %s and under IfcElement", (type, parent) => {
    expect(ancestorsOf(type)[0]).toBe(parent);
    expect(isSubtypeOf(type, "IfcElement")).toBe(true);
    expect(isSubtypeOf(type, "IfcDistributionFlowElement") || isSubtypeOf(type, "IfcDistributionControlElement")).toBe(
      true
    );
  });

  it("covers the whole IFC4 element subtree, not a curated slice of it", () => {
    expect(descendantsOf("IfcElement").length).toBeGreaterThan(120);
  });
});

describe("legacy IFC2X3 names", () => {
  it("keeps names IFC4 dropped so a 2x3 export is not gutted", () => {
    expect(isKnownIfcType("IfcElectricalElement")).toBe(true);
    expect(isKnownIfcType("IfcEquipmentElement")).toBe(true);
    expect(isSubtypeOf("IFCELECTRICALELEMENT", "IfcElement")).toBe(true);
    expect(ancestorsOf("IfcElectricDistributionPoint")).toContain("IfcFlowController");
  });

  it("marks them as legacy, and current names as not", () => {
    expect(isLegacyIfcType("IfcElectricalElement")).toBe(true);
    expect(isLegacyIfcType("ifcequipmentelement")).toBe(true);
    expect(isLegacyIfcType("IfcWall")).toBe(false);
    // IfcWallStandardCase is deprecated in IFC4 but still declared there.
    expect(isLegacyIfcType("IfcWallStandardCase")).toBe(false);
    expect(isLegacyIfcType("IfcMadeUpThing")).toBe(false);
  });
});

describe("isSubtypeOf", () => {
  it("is reflexive, case-insensitively", () => {
    expect(isSubtypeOf("IfcWall", "IfcWall")).toBe(true);
    expect(isSubtypeOf("IFCWALL", "IfcWall")).toBe(true);
    expect(isSubtypeOf("IfcMadeUpThing", "IFCMADEUPTHING")).toBe(true);
  });

  it("matches every level of the inheritance chain", () => {
    expect(isSubtypeOf("IFCDUCTSEGMENT", "IfcFlowSegment")).toBe(true);
    expect(isSubtypeOf("IFCDUCTSEGMENT", "IFCELEMENT")).toBe(true);
    expect(isSubtypeOf("IFCDUCTSEGMENT", "IfcProduct")).toBe(true);
  });

  it("does not match sideways or downwards", () => {
    expect(isSubtypeOf("IfcElement", "IfcWall")).toBe(false);
    expect(isSubtypeOf("IfcDuctSegment", "IfcPipeSegment")).toBe(false);
  });

  it("keeps the spatial branch out of IfcElement", () => {
    expect(isSubtypeOf("IFCSPACE", "IfcElement")).toBe(false);
    expect(isSubtypeOf("IFCSPACE", "IfcSpatialElement")).toBe(true);
    expect(isSubtypeOf("IfcBuildingStorey", "IfcSpatialStructureElement")).toBe(true);
    expect(isSubtypeOf("IfcBuilding", "IfcProduct")).toBe(true);
  });

  it("is false for unknown types unless the names are equal", () => {
    expect(isSubtypeOf("IfcMadeUpThing", "IfcElement")).toBe(false);
    expect(isSubtypeOf("IfcWall", "IfcMadeUpThing")).toBe(false);
  });
});

describe("collapsibleEntityGroupsFor", () => {
  it("collapses a full expansion back into its one ancestor", () => {
    expect(collapsibleEntityGroupsFor(expandedTypeNamesFor("IfcWall"))).toEqual([
      { name: "IfcWall", types: ["IfcWall", "IfcWallElementedCase", "IfcWallStandardCase"] },
    ]);
  });

  it("collapses two disjoint full expansions into two groups, largest first", () => {
    const groups = collapsibleEntityGroupsFor([
      ...expandedTypeNamesFor("IfcWall"),
      ...expandedTypeNamesFor("IfcDoor"),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["IfcWall", "IfcDoor"]);
  });

  // A set one member short of a known group is not that group — no partial credit.
  it("stays loose when a member of the full expansion is missing", () => {
    expect(collapsibleEntityGroupsFor(["IfcWall", "IfcWallStandardCase"])).toEqual([]);
  });

  it("does not collapse a single type, or a set too small to name a group", () => {
    expect(collapsibleEntityGroupsFor(["IfcSanitaryTerminal"])).toEqual([]);
  });

  // IfcBuildingElement's full expansion also exactly explains its IfcWall and IfcDoor subsets, but
  // the broader name already accounts for every member, so nothing is left to fragment out.
  it("prefers the broadest ancestor over its own subgroups when both fully match", () => {
    const groups = collapsibleEntityGroupsFor(expandedTypeNamesFor("IfcBuildingElement"));
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("IfcBuildingElement");
    expect(groups[0].types).toHaveLength(expandedTypeNamesFor("IfcBuildingElement").length);
  });

  it("leaves a type outside any fully-matched group loose", () => {
    const groups = collapsibleEntityGroupsFor([...expandedTypeNamesFor("IfcWall"), "IfcSanitaryTerminal"]);
    expect(groups).toEqual([
      { name: "IfcWall", types: ["IfcWall", "IfcWallElementedCase", "IfcWallStandardCase"] },
    ]);
  });

  it("matches regardless of the case entityTypes happens to hold", () => {
    expect(collapsibleEntityGroupsFor(["IFCWALL", "IFCWALLELEMENTEDCASE", "IFCWALLSTANDARDCASE"])).toEqual([
      { name: "IfcWall", types: ["IfcWall", "IfcWallElementedCase", "IfcWallStandardCase"] },
    ]);
  });
});
