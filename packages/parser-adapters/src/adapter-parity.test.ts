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

  // Both engines now enumerate the model instead of iterating one shared list
  // of type names, so "they agree" is no longer true by construction — it has
  // to be asserted on a file with many concrete types in it.
  it("both engines produce the same elements, in the same order, for a full MEP model", async () => {
    const path = fixturePath("mep-systems.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    expect(ifcLiteResult.elements).toEqual(webIfcResult.elements);
    expect(ifcLiteResult.unrecognizedTypes).toEqual(webIfcResult.unrecognizedTypes);
    expect(webIfcResult.unrecognizedTypes).toEqual([]);
  });

  it("both engines agree on the per-storey counts of a full MEP model", async () => {
    const path = fixturePath("mep-systems.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    // IFCSPACE aside, which the two engines place differently for reasons that
    // predate this filter — see the next test.
    const countsByStorey = (result: typeof webIfcResult) =>
      (result.modelStructure?.children[0]?.children[0]?.children ?? []).map((storey) => [
        storey.name,
        Object.fromEntries(Object.entries(storey.elementCounts).filter(([type]) => type !== "IFCSPACE")),
      ]);

    expect(countsByStorey(ifcLiteResult)).toEqual(countsByStorey(webIfcResult));
    expect(countsByStorey(webIfcResult)).toEqual([
      // The two openings and the port contained in Level 1 are not elements, so
      // they never reach a count.
      [
        "Level 1",
        {
          IFCACTUATOR: 1,
          IFCAIRTERMINAL: 2,
          IFCDAMPER: 1,
          IFCDOOR: 1,
          IFCDUCTFITTING: 2,
          IFCDUCTSEGMENT: 2,
          IFCSANITARYTERMINAL: 1,
          IFCSENSOR: 1,
        },
      ],
      ["Plant Level", { IFCPIPEFITTING: 1, IFCPIPESEGMENT: 2, IFCPUMP: 1, IFCVALVE: 2, IFCWALL: 2 }],
    ]);
  });

  // Pre-existing engine divergence, unrelated to which elements are collected:
  // @ifc-lite/parser's spatialHierarchy promotes an IfcSpace to a node of the
  // tree, while web-ifc-buffer walks only Project/Site/Building/Storey and so
  // leaves the space in its storey's counts. Pinned rather than hidden — the
  // element lists themselves agree exactly (asserted above).
  it("differs only in where an IfcSpace lands in the model structure", async () => {
    const path = fixturePath("mep-systems.ifc");
    const plantLevel = (result: { modelStructure: unknown }) =>
      (result.modelStructure as { children: any[] }).children[0].children[0].children[1];

    const fromWebIfc = plantLevel(await new WebIfcAdapter().parse(path));
    const fromIfcLite = plantLevel(await new IfcLiteAdapter().parse(path));

    expect(fromWebIfc.children).toEqual([]);
    expect(fromWebIfc.elementCounts.IFCSPACE).toBe(1);

    expect(fromIfcLite.children.map((child: { ifcType: string }) => child.ifcType)).toEqual(["IFCSPACE"]);
    expect(fromIfcLite.elementCounts.IFCSPACE).toBeUndefined();
  });
});
