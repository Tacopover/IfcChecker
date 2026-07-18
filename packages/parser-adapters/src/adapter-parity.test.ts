import { describe, expect, it } from "vitest";
import { WebIfcAdapter } from "./web-ifc-adapter.js";
import { IfcLiteAdapter } from "./ifc-lite-adapter.js";
import { fixturePath } from "./fixture-path.js";

describe("adapter parity", () => {
  it("both engines normalize the fixture wall identically (parse timing aside)", async () => {
    const path = fixturePath("minimal-wall.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    expect(webIfcResult.elements).toHaveLength(1);
    expect(ifcLiteResult.elements).toHaveLength(1);

    const [a] = webIfcResult.elements;
    const [b] = ifcLiteResult.elements;

    expect(b.globalId).toBe(a.globalId);
    expect(b.ifcType).toBe(a.ifcType);
    expect(b.predefinedType).toBe(a.predefinedType);
    expect(b.name).toBe(a.name);
    expect(b.propertySets).toEqual(a.propertySets);
  });
});
