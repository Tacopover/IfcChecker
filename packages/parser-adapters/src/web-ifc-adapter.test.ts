import { describe, expect, it } from "vitest";
import { WebIfcAdapter } from "./web-ifc-adapter.js";
import { fixturePath } from "./fixture-path.js";

describe("WebIfcAdapter", () => {
  it("parses the minimal wall fixture into one normalized IFCWALL element", async () => {
    const adapter = new WebIfcAdapter();
    const result = await adapter.parse(fixturePath("minimal-wall.ifc"));

    expect(result.parseMs).toBeGreaterThanOrEqual(0);
    expect(result.elements).toHaveLength(1);

    const [wall] = result.elements;
    expect(wall.globalId).toBe("1abc2defGHI3jkl4mno5pq");
    expect(wall.ifcType).toBe("IFCWALL");
    expect(wall.predefinedType).toBe("STANDARD");
    expect(wall.name).toBe("W-001");
    expect(wall.attributes.tag).toBe("TAG-001");
    expect(wall.attributes.description).toBe("Fixture wall for QA tool tests");
    expect(wall.propertySets.Pset_WallCommon).toEqual({
      IsExternal: true,
      FireRating: "REI60",
    });
  });

  it("rejects the truncated fixture", async () => {
    const adapter = new WebIfcAdapter();
    await expect(adapter.parse(fixturePath("corrupt-truncated.ifc"))).rejects.toThrow();
  });
});
