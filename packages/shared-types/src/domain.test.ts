import { describe, expect, it } from "vitest";
import {
  NormalizedElementSchema,
  ElementResultSchema,
  EngineIdSchema,
} from "./domain.js";

describe("NormalizedElementSchema", () => {
  it("accepts a well-formed element", () => {
    const parsed = NormalizedElementSchema.parse({
      globalId: "1abc2defGHI3jkl4mno5pq",
      ifcType: "IFCWALL",
      predefinedType: "STANDARD",
      name: "Wall-01",
      attributes: { Tag: "W-001" },
      propertySets: { Pset_WallCommon: { IsExternal: true, FireRating: "REI60" } },
    });
    expect(parsed.ifcType).toBe("IFCWALL");
  });

  it("rejects a missing globalId", () => {
    const result = NormalizedElementSchema.safeParse({
      ifcType: "IFCWALL",
      predefinedType: null,
      name: null,
      attributes: {},
      propertySets: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("EngineIdSchema", () => {
  it("only accepts the two known engines", () => {
    expect(EngineIdSchema.safeParse("web-ifc").success).toBe(true);
    expect(EngineIdSchema.safeParse("ifc-lite").success).toBe(true);
    expect(EngineIdSchema.safeParse("revit").success).toBe(false);
  });
});

describe("ElementResultSchema", () => {
  it("accepts a well-formed result", () => {
    const parsed = ElementResultSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      fileJobId: "22222222-2222-2222-2222-222222222222",
      elementGlobalId: "1abc2defGHI3jkl4mno5pq",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
    });
    expect(parsed.severity).toBe("error");
  });
});
