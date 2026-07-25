import { describe, expect, it } from "vitest";
import type { IfcParserAdapter } from "./types.js";

class FakeAdapter implements IfcParserAdapter {
  async parse(filePath: string) {
    return {
      elements: [
        {
          globalId: "g1",
          ifcType: "IFCWALL",
          predefinedType: null,
          name: filePath,
          attributes: {},
          propertySets: {},
        },
      ],
      parseMs: 1,
      modelStructure: null,
      unrecognizedTypes: [],
    };
  }
}

describe("IfcParserAdapter", () => {
  it("a conforming class can be constructed and parsed", async () => {
    const adapter = new FakeAdapter();
    const result = await adapter.parse("fixture.ifc");
    expect(result.elements[0].ifcType).toBe("IFCWALL");
    expect(result.parseMs).toBeGreaterThan(0);
  });
});
