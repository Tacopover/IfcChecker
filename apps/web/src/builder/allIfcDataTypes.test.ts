import { describe, expect, it } from "vitest";
import { allIfcDataTypeNames } from "./allIfcDataTypes";

describe("allIfcDataTypeNames", () => {
  it("offers IfcSimpleValue's members alongside the measure types", () => {
    const names = allIfcDataTypeNames();

    expect(names).toContain("IFCLABEL");
    expect(names).toContain("IFCBOOLEAN");
    expect(names).toContain("IFCINTEGER");
    expect(names).toContain("IFCLENGTHMEASURE");
    expect(names).toContain("IFCTHERMALTRANSMITTANCEMEASURE");
    expect(names).toContain("IFCCOMPLEXNUMBER");
  });

  // The list names what a property is stored *as*, so an entity name in it would be an offer the
  // checker can never satisfy.
  it("holds no entity names", () => {
    const names = allIfcDataTypeNames();

    expect(names).not.toContain("IFCWALL");
    expect(names).not.toContain("IFCPROPERTYSINGLEVALUE");
  });

  it("is sorted and free of duplicates", () => {
    const names = allIfcDataTypeNames();

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(new Set(names).size).toBe(names.length);
  });
});
