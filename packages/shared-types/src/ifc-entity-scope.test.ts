import { describe, expect, it } from "vitest";
import { isNormalizableEntityType } from "./ifc-entity-scope.js";

describe("isNormalizableEntityType", () => {
  it("is false for geometry", () => {
    for (const type of ["IFCCARTESIANPOINT", "IFCPOLYLOOP", "IFCEXTRUDEDAREASOLID"]) {
      expect(isNormalizableEntityType(type)).toBe(false);
    }
  });

  // Every property is already carried on the element it describes, and in a real MEP model these
  // entities are 64-87% of everything a parse would normalize — enough to make the result too big
  // to hand back from the worker.
  it("is false for property definitions, which each element already carries itself", () => {
    for (const type of [
      "IFCPROPERTYSET",
      "IFCPROPERTYSINGLEVALUE",
      "IFCPROPERTYBOUNDEDVALUE",
      "IFCPROPERTYENUMERATEDVALUE",
      "IFCPROPERTYLISTVALUE",
      "IFCPROPERTYTABLEVALUE",
      "IFCPROPERTYREFERENCEVALUE",
      "IFCCOMPLEXPROPERTY",
      "IFCRELDEFINESBYPROPERTIES",
    ]) {
      expect(isNormalizableEntityType(type)).toBe(false);
    }
  });

  it("stays true for everything else a rule may name, quantities included", () => {
    for (const type of [
      "IFCWALL",
      "IFCWALLTYPE",
      "IFCRELAGGREGATES",
      "IFCRELDEFINESBYTYPE",
      "IFCELEMENTQUANTITY",
      "IFCQUANTITYCOUNT",
      "IFCQUANTITYLENGTH",
      "IFCMATERIAL",
    ]) {
      expect(isNormalizableEntityType(type)).toBe(true);
    }
  });

  it("is case- and whitespace-insensitive, and true for a type outside both schemas", () => {
    expect(isNormalizableEntityType("  ifcPropertySet ")).toBe(false);
    expect(isNormalizableEntityType("IFCMADEUPTHING")).toBe(true);
  });
});
