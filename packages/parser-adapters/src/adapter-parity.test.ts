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

  it("both engines build the same shape of project/site/building/storey tree", async () => {
    const path = fixturePath("minimal-wall.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    function shape(node: typeof webIfcResult.modelStructure): unknown {
      if (!node) return null;
      return { ifcType: node.ifcType, name: node.name, elementCounts: node.elementCounts, children: node.children.map(shape) };
    }

    expect(shape(ifcLiteResult.modelStructure)).toEqual(shape(webIfcResult.modelStructure));
  });

  it("both engines aggregate multiple storeys and multiple element types identically", async () => {
    const path = fixturePath("multi-storey.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    function shape(node: typeof webIfcResult.modelStructure): unknown {
      if (!node) return null;
      return { ifcType: node.ifcType, name: node.name, elementCounts: node.elementCounts, children: node.children.map(shape) };
    }

    const webIfcShape = shape(webIfcResult.modelStructure);
    expect(shape(ifcLiteResult.modelStructure)).toEqual(webIfcShape);

    const building = (webIfcResult.modelStructure?.children[0]?.children[0]) ?? null;
    expect(building?.children.map((storey) => storey.name)).toEqual(["Level 1", "Level 2"]);
    expect(building?.children[0].elementCounts).toEqual({ IFCWALL: 2, IFCDOOR: 1 });
    expect(building?.children[1].elementCounts).toEqual({ IFCWALL: 1 });
  });
});
