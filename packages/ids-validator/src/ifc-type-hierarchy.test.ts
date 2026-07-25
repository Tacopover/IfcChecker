import { describe, expect, it } from "vitest";
import {
  IFC_SCHEMA,
  ancestorsOf,
  canonicalIfcType,
  descendantsOf,
  isKnownIfcType,
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
  it("walks the full MEP chain, immediate parent first", () => {
    expect(ancestorsOf("IfcDuctSegment")).toEqual([
      "IfcFlowSegment",
      "IfcDistributionFlowElement",
      "IfcDistributionElement",
      "IfcElement",
      "IfcProduct",
    ]);
  });

  it("is case-insensitive", () => {
    expect(ancestorsOf("IFCWALL")).toEqual(["IfcBuildingElement", "IfcElement", "IfcProduct"]);
  });

  it("returns an empty list for the root and for unknown types", () => {
    expect(ancestorsOf("IfcProduct")).toEqual([]);
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
    expect(descendantsOf("IfcWall")).toEqual([]);
    expect(descendantsOf("IfcMadeUpThing")).toEqual([]);
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
