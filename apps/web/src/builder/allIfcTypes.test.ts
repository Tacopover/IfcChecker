import { describe, expect, it } from "vitest";
import { allIfcTypeNames } from "./allIfcTypes";

describe("allIfcTypeNames", () => {
  it("returns a sorted, deduplicated list of concrete IFC type names", () => {
    const names = allIfcTypeNames();

    expect(names.length).toBeGreaterThan(500);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("includes concrete leaves, including one not present in a typical model", () => {
    const names = allIfcTypeNames();

    expect(names).toContain("IfcWall");
    expect(names).toContain("IfcCurtainWall");
  });

  it("excludes abstract entities, which no element can carry directly", () => {
    const names = allIfcTypeNames();

    expect(names).not.toContain("IfcElement");
    expect(names).not.toContain("IfcProduct");
  });
});
