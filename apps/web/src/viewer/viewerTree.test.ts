import { describe, expect, it } from "vitest";
import type { ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";
import { buildViewerTree, collectElementIds, findTreeNode, type TreeModelInput } from "./viewerTree.js";

function element(expressId: number, ifcType: string, name: string | null): NormalizedElement {
  return {
    globalId: `g${expressId}`,
    expressId,
    ifcType,
    predefinedType: null,
    name,
    attributes: {},
    propertySets: {},
  };
}

const structure: ModelStructureNode = {
  expressId: 1,
  ifcType: "IFCPROJECT",
  name: "Tower",
  elementIdsByType: {},
  children: [
    {
      expressId: 2,
      ifcType: "IFCBUILDING",
      name: "Block A",
      elementIdsByType: {},
      children: [
        {
          expressId: 3,
          ifcType: "IFCBUILDINGSTOREY",
          name: "Level 1",
          elementIdsByType: { IFCWALL: [100, 200], IFCDOOR: [300] },
          children: [],
        },
      ],
    },
  ],
};

const arch: TreeModelInput = {
  key: "arch.ifc:10:1",
  fileName: "arch.ifc",
  modelStructure: structure,
  elements: [
    element(100, "IFCWALL", "Wall A"),
    element(200, "IFCWALL", null),
    element(300, "IFCDOOR", "Door 1"),
  ],
};

const mep: TreeModelInput = {
  key: "mep.ifc:20:1",
  fileName: "mep.ifc",
  modelStructure: null,
  elements: [element(100, "IFCPIPESEGMENT", "Pipe 1"), element(150, "IFCVALVE", null)],
};

describe("buildViewerTree", () => {
  it("gives every loaded file a row, so the tree spans the whole federation", () => {
    const tree = buildViewerTree([arch, mep]);
    expect(tree.map((node) => [node.kind, node.label])).toEqual([
      ["model", "arch.ifc"],
      ["model", "mep.ifc"],
    ]);
  });

  it("nests project, building and storey down to individual elements", () => {
    const [model] = buildViewerTree([arch]);
    const project = model.children[0];
    const storey = project.children[0].children[0];

    expect(project.label).toBe("Project — Tower");
    expect(storey.label).toBe("Storey — Level 1");
    expect(storey.children.map((node) => node.label)).toEqual(["IFCDOOR (1)", "IFCWALL (2)"]);

    const walls = storey.children[1];
    expect(walls.children.map((node) => [node.kind, node.expressId, node.label])).toEqual([
      ["element", 100, "Wall A"],
      ["element", 200, "IFCWALL #200"],
    ]);
  });

  it("keys elements by model as well as express id, so two files never collide", () => {
    const tree = buildViewerTree([arch, mep]);
    const fromArch = findTreeNode(tree, "arch.ifc:10:1#100");
    const fromMep = findTreeNode(tree, "mep.ifc:20:1#100");

    expect(fromArch?.ifcType).toBe("IFCWALL");
    expect(fromMep?.ifcType).toBe("IFCPIPESEGMENT");
  });

  // A file that parses but declares no IfcProject should still be browsable
  // rather than quietly missing from the tree.
  it("falls back to flat type groups for a model with no spatial structure", () => {
    const [model] = buildViewerTree([mep]);
    expect(model.children.map((node) => [node.kind, node.label])).toEqual([
      ["type-group", "IFCPIPESEGMENT (1)"],
      ["type-group", "IFCVALVE (1)"],
    ]);
  });

  it("names an unnamed spatial node rather than rendering a blank row", () => {
    const [model] = buildViewerTree([
      { ...arch, modelStructure: { ...structure, name: null } },
    ]);
    expect(model.children[0].label).toBe("Project (unnamed)");
  });

  it("keeps a model with no elements at all as an empty row", () => {
    const [model] = buildViewerTree([{ ...mep, elements: [], modelStructure: null }]);
    expect(model.kind).toBe("model");
    expect(model.children).toEqual([]);
  });
});

describe("collectElementIds", () => {
  it("gathers every element under a storey, across its type groups", () => {
    const [model] = buildViewerTree([arch]);
    const storey = model.children[0].children[0].children[0];
    expect(collectElementIds(storey).sort((a, b) => a - b)).toEqual([100, 200, 300]);
  });

  it("gathers a whole file from its model row", () => {
    const [model] = buildViewerTree([mep]);
    expect(collectElementIds(model).sort((a, b) => a - b)).toEqual([100, 150]);
  });

  it("returns just the one id for an element row", () => {
    const [model] = buildViewerTree([arch]);
    const wall = findTreeNode([model], "arch.ifc:10:1#100")!;
    expect(collectElementIds(wall)).toEqual([100]);
  });

  // Spatial rows are containers, not elements — a storey must not isolate
  // itself as if it were a thing with geometry.
  it("does not count spatial nodes as elements", () => {
    const [model] = buildViewerTree([{ ...arch, elements: [] }]);
    const project = model.children[0];
    expect(collectElementIds(project).sort((a, b) => a - b)).toEqual([100, 200, 300]);
    expect(collectElementIds(project)).not.toContain(project.expressId);
  });
});

describe("findTreeNode", () => {
  it("returns null for a key that is not in the tree", () => {
    expect(findTreeNode(buildViewerTree([arch]), "nope")).toBeNull();
  });
});
