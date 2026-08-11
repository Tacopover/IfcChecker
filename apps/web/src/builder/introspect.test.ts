import type { NormalizedElement } from "@ifc-qa/shared-types";
import { describe, expect, it } from "vitest";
import { introspectModel, type TreeNode } from "./introspect.js";

let nextId = 0;
function element(ifcType: string, overrides: Overrides = {}): NormalizedElement {
  nextId += 1;
  return {
    globalId: `g${nextId}`,
    ifcType,
    predefinedType: null,
    name: `${ifcType}-${nextId}`,
    attributes: {},
    propertySets: {},
    ...overrides,
  };
}

type Overrides = Partial<Omit<NormalizedElement, "ifcType">>;

function many(ifcType: string, n: number, build: (i: number) => Overrides = () => ({})) {
  return Array.from({ length: n }, (_, i) => element(ifcType, build(i)));
}

// The set the group qualification rules were agreed against: MEP flow
// elements, two building elements and one spatial element.
const REVIEWED_MODEL: NormalizedElement[] = [
  ...many("IFCDUCTSEGMENT", 40),
  ...many("IFCPIPESEGMENT", 30),
  ...many("IFCDUCTFITTING", 20),
  ...many("IFCAIRTERMINAL", 10),
  ...many("IFCVALVE", 5),
  ...many("IFCWALL", 14),
  ...many("IFCDOOR", 6),
  ...many("IFCSPACE", 3),
];

function findNode(nodes: TreeNode[], name: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node;
    const hit = findNode(node.children, name);
    if (hit) return hit;
  }
  return undefined;
}

describe("introspectModel — entity types", () => {
  it("canonicalises the upper-case type names IFC files carry and counts them, most common first", () => {
    const { entityTypes } = introspectModel(REVIEWED_MODEL);

    expect(entityTypes).toEqual([
      { name: "IfcDuctSegment", count: 40 },
      { name: "IfcPipeSegment", count: 30 },
      { name: "IfcDuctFitting", count: 20 },
      { name: "IfcWall", count: 14 },
      { name: "IfcAirTerminal", count: 10 },
      { name: "IfcDoor", count: 6 },
      { name: "IfcValve", count: 5 },
      { name: "IfcSpace", count: 3 },
    ]);
  });

  it("keeps a type outside the IFC4 table under its literal name so it stays selectable", () => {
    const { entityTypes, groups } = introspectModel([element("IFCMADEUPTHING"), element("IFCWALL")]);

    expect(entityTypes.map((t) => t.name)).toEqual(["IFCMADEUPTHING", "IfcWall"]);
    expect(groups).toEqual([]);
  });
});

describe("introspectModel — group qualification", () => {
  it("offers exactly the four groups agreed for the reviewed model", () => {
    const { groups } = introspectModel(REVIEWED_MODEL);

    expect(groups.map((g) => [g.name, g.types.length, g.count])).toEqual([
      ["IfcElement", 7, 125],
      ["IfcDistributionFlowElement", 5, 105],
      ["IfcFlowSegment", 2, 70],
      ["IfcBuildingElement", 2, 20],
    ]);
  });

  it("drops a supertype covering only one present type", () => {
    const { groups } = introspectModel(REVIEWED_MODEL);
    const names = groups.map((g) => g.name);

    // IfcSpace is the only spatial type, IfcValve the only flow controller.
    expect(names).not.toContain("IfcSpatialElement");
    expect(names).not.toContain("IfcSpatialStructureElement");
    expect(names).not.toContain("IfcFlowController");
    expect(names).not.toContain("IfcFlowTerminal");
    expect(names).not.toContain("IfcFlowFitting");
  });

  it("keeps only the most specific of two supertypes covering the identical set of present types", () => {
    const { groups } = introspectModel(REVIEWED_MODEL);
    const flowGroup = groups.find((g) => g.name === "IfcDistributionFlowElement");

    expect(flowGroup?.types.sort()).toEqual(
      ["IfcAirTerminal", "IfcDuctFitting", "IfcDuctSegment", "IfcPipeSegment", "IfcValve"].sort()
    );
    // Same five types as IfcDistributionFlowElement, one level shallower.
    expect(groups.map((g) => g.name)).not.toContain("IfcDistributionElement");
  });

  it("never offers IfcProduct or anything above it", () => {
    const { groups } = introspectModel([...many("IFCWALL", 2), ...many("IFCSPACE", 2), ...many("IFCANNOTATION", 2)]);
    const names = groups.map((g) => g.name);

    for (const abstract of ["IfcProduct", "IfcObject", "IfcObjectDefinition", "IfcRoot"]) {
      expect(names).not.toContain(abstract);
    }
  });
});

describe("introspectModel — tree", () => {
  it("nests qualifying groups as branches and present types as leaves", () => {
    const { tree } = introspectModel(REVIEWED_MODEL);
    const shape = (nodes: TreeNode[]): unknown =>
      nodes.map((n) => [n.name, n.kind, n.count, n.typeCount, shape(n.children)]);

    expect(shape(tree)).toEqual([
      ["IfcElement", "group", 125, 7, [
        ["IfcDistributionFlowElement", "group", 105, 5, [
          ["IfcFlowSegment", "group", 70, 2, [
            ["IfcDuctSegment", "type", 40, 1, []],
            ["IfcPipeSegment", "type", 30, 1, []],
          ]],
          ["IfcDuctFitting", "type", 20, 1, []],
          ["IfcAirTerminal", "type", 10, 1, []],
          ["IfcValve", "type", 5, 1, []],
        ]],
        ["IfcBuildingElement", "group", 20, 2, [
          ["IfcWall", "type", 14, 1, []],
          ["IfcDoor", "type", 6, 1, []],
        ]],
      ]],
      ["IfcSpace", "type", 3, 1, []],
    ]);
  });

  it("places a type with no qualifying group at the root", () => {
    const { tree } = introspectModel(REVIEWED_MODEL);

    expect(tree.map((n) => n.name)).toContain("IfcSpace");
    expect(findNode(tree, "IfcDistributionElement")).toBeUndefined();
  });

  it("reconciles every branch count and typeCount with the sum of its children", () => {
    const { tree } = introspectModel(REVIEWED_MODEL);
    let branches = 0;

    const check = (node: TreeNode) => {
      if (node.kind === "group") {
        branches += 1;
        expect(node.count).toBe(node.children.reduce((n, c) => n + c.count, 0));
        expect(node.typeCount).toBe(node.children.reduce((n, c) => n + c.typeCount, 0));
      } else {
        expect(node.children).toEqual([]);
        expect(node.typeCount).toBe(1);
      }
      node.children.forEach(check);
    };
    tree.forEach(check);

    expect(branches).toBe(4);
    expect(tree.reduce((n, node) => n + node.count, 0)).toBe(REVIEWED_MODEL.length);
  });

  it("sorts siblings by count descending, then by name", () => {
    const { tree } = introspectModel([...many("IFCWALL", 5), ...many("IFCDOOR", 5), ...many("IFCBEAM", 9)]);
    const building = findNode(tree, "IfcBuildingElement");

    expect(building?.children.map((c) => c.name)).toEqual(["IfcBeam", "IfcDoor", "IfcWall"]);
  });
});

describe("introspectModel — resolveTypes", () => {
  it("expands a group to its present member types and passes a concrete type through", () => {
    const { resolveTypes } = introspectModel(REVIEWED_MODEL);

    expect(resolveTypes(["IfcFlowSegment"]).sort()).toEqual(["IfcDuctSegment", "IfcPipeSegment"]);
    expect(resolveTypes(["IfcWall"])).toEqual(["IfcWall"]);
  });

  it("de-duplicates overlapping selections and drops names absent from the file", () => {
    const { resolveTypes } = introspectModel(REVIEWED_MODEL);

    expect(resolveTypes(["IfcFlowSegment", "IfcDuctSegment"]).sort()).toEqual([
      "IfcDuctSegment",
      "IfcPipeSegment",
    ]);
    expect(resolveTypes(["IfcWindow", "IFCWALL"])).toEqual(["IfcWall"]);
  });
});

const FIELD_MODEL: NormalizedElement[] = [
  ...many("IFCDUCTSEGMENT", 4, (i) => ({
    attributes: { Tag: { value: `DS-${i}` }, Description: { value: i === 0 ? "Supply air" : null } },
    propertySets: {
      MEP_Data: { SystemAbbreviation: { value: i < 3 ? "SA" : "RA", dataType: "IFCLABEL" } },
    },
  })),
  ...many("IFCPIPESEGMENT", 2, (i) => ({
    attributes: { Tag: { value: i === 0 ? `PS-${i}` : null } },
    propertySets: {
      // Stored as a different type from the ducts', which is what a rule over the group has to see.
      MEP_Data: { SystemAbbreviation: { value: "CHWS", dataType: "IFCIDENTIFIER" } },
      Pset_PipeSegmentTypeCommon: { Status: { value: "New" } },
    },
  })),
];

describe("introspectModel — fieldsFor", () => {
  it("reports coverage as hits over the elements in the selection and sorts fields by hits", () => {
    const { fieldsFor } = introspectModel(FIELD_MODEL);
    const ducts = fieldsFor(["IfcDuctSegment"]);

    expect(ducts.total).toBe(4);
    expect(ducts.attributes.map((f) => [f.name, f.hits, f.coverage])).toEqual([
      ["GlobalId", 4, 1],
      ["Name", 4, 1],
      ["Tag", 4, 1],
      ["Description", 1, 0.25],
    ]);
    expect(ducts.attributes.every((f) => f.propertySet === null)).toBe(true);
  });

  it("skips fields whose value is null or empty rather than counting them as present", () => {
    const { fieldsFor } = introspectModel(FIELD_MODEL);
    const pipes = fieldsFor(["IfcPipeSegment"]);

    // Only one of two pipes carries a Tag; the other's is null.
    expect(pipes.attributes.find((f) => f.name === "Tag")).toMatchObject({ hits: 1, coverage: 0.5 });
    expect(pipes.attributes.map((f) => f.name)).not.toContain("Description");
    expect(pipes.attributes.map((f) => f.name)).not.toContain("PredefinedType");
  });

  it("lists distinct values most common first, with counts", () => {
    const { fieldsFor } = introspectModel(FIELD_MODEL);
    const system = fieldsFor(["IfcDuctSegment"]).propertySets
      .find((p) => p.name === "MEP_Data")
      ?.fields.find((f) => f.name === "SystemAbbreviation");

    expect(system).toMatchObject({ propertySet: "MEP_Data", hits: 4, coverage: 1 });
    expect(system?.values).toEqual([
      { value: "SA", count: 3 },
      { value: "RA", count: 1 },
    ]);
  });

  // A declared dataType the model does not hold fails every element, so the picker can only offer
  // what the file reports — and has to show a field stored two ways as exactly that.
  it("reports the data types a property is stored as, commonest first", () => {
    const { fieldsFor } = introspectModel(FIELD_MODEL);
    const fieldIn = (names: string[]) =>
      fieldsFor(names)
        .propertySets.find((p) => p.name === "MEP_Data")
        ?.fields.find((f) => f.name === "SystemAbbreviation");

    expect(fieldIn(["IfcDuctSegment"])?.dataTypes).toEqual([{ value: "IFCLABEL", count: 4 }]);
    expect(fieldIn(["IfcFlowSegment"])?.dataTypes).toEqual([
      { value: "IFCLABEL", count: 4 },
      { value: "IFCIDENTIFIER", count: 2 },
    ]);
  });

  it("reports no data type where the parser knows none", () => {
    const { fieldsFor } = introspectModel(FIELD_MODEL);
    const status = fieldsFor(["IfcPipeSegment"])
      .propertySets.find((p) => p.name === "Pset_PipeSegmentTypeCommon")
      ?.fields.find((f) => f.name === "Status");

    expect(status?.dataTypes).toEqual([]);
    // An attribute never carries one: IDS declares dataType on <property> alone.
    expect(fieldsFor(["IfcDuctSegment"]).attributes.every((f) => f.dataTypes.length === 0)).toBe(true);
  });

  it("aggregates across every member type when a group is selected", () => {
    const { fieldsFor } = introspectModel(FIELD_MODEL);
    const flow = fieldsFor(["IfcFlowSegment"]);

    expect(flow.total).toBe(6);
    const system = flow.propertySets.find((p) => p.name === "MEP_Data")?.fields[0];
    expect(system).toMatchObject({ name: "SystemAbbreviation", hits: 6, coverage: 1 });
    expect(system?.values).toEqual([
      { value: "SA", count: 3 },
      { value: "CHWS", count: 2 },
      { value: "RA", count: 1 },
    ]);
    // A property set only two of the six elements carry still shows up.
    expect(flow.propertySets.map((p) => p.name)).toEqual(["MEP_Data", "Pset_PipeSegmentTypeCommon"]);
    expect(flow.propertySets[1].fields[0]).toMatchObject({ name: "Status", hits: 2, coverage: 2 / 6 });
  });

  it("returns an empty selection cleanly instead of dividing by zero", () => {
    const { fieldsFor } = introspectModel(FIELD_MODEL);

    expect(fieldsFor([])).toEqual({ total: 0, attributes: [], propertySets: [] });
    expect(fieldsFor(["IfcWindow"]).total).toBe(0);
  });

  it("surfaces the top-level IFC attributes IDS addresses by name", () => {
    const withPredefined: NormalizedElement[] = [
      element("IFCWALL", { predefinedType: "SOLIDWALL" }),
      element("IFCWALL", { predefinedType: "PARTITIONING" }),
      element("IFCWALL", { predefinedType: null }),
    ];
    const { fieldsFor } = introspectModel(withPredefined);
    const predefined = fieldsFor(["IfcWall"]).attributes.find((f) => f.name === "PredefinedType");

    expect(predefined).toMatchObject({ hits: 2, coverage: 2 / 3 });
    expect(predefined?.values.map((v) => v.value).sort()).toEqual(["PARTITIONING", "SOLIDWALL"]);
  });
});

describe("introspectModel — empty model", () => {
  it("produces no types, groups or tree", () => {
    const empty: NormalizedElement[] = [];
    const introspection = introspectModel(empty);

    expect(introspection.entityTypes).toEqual([]);
    expect(introspection.groups).toEqual([]);
    expect(introspection.tree).toEqual([]);
  });
});
