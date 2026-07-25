import { getEntities } from "@ifc-lite/data";
import { describe, expect, it } from "vitest";
import { IFC_LEGACY_TYPE_NAMES, IFC_PRODUCT_PARENTS } from "@ifc-qa/shared-types";
import {
  PHYSICAL_ELEMENT_TYPE_NAMES,
  classifyEntityType,
  isPhysicalElementType,
} from "./element-filter.js";

describe("classifyEntityType", () => {
  it("keeps the concrete MEP classes a Revit export actually carries", () => {
    for (const type of [
      "IFCVALVE",
      "IFCAIRTERMINAL",
      "IFCDUCTFITTING",
      "IFCDAMPER",
      "IFCPIPEFITTING",
      "IFCSENSOR",
      "IFCPUMP",
      "IFCCABLECARRIERSEGMENT",
    ]) {
      expect(classifyEntityType(type)).toBe("element");
    }
  });

  it("keeps architectural and structural elements, and spaces", () => {
    for (const type of ["IFCWALL", "IFCSLAB", "IFCDOOR", "IFCREINFORCINGBAR", "IFCSPACE", "IFCSPATIALZONE"]) {
      expect(classifyEntityType(type)).toBe("element");
    }
  });

  it("drops the IfcFeatureElement subtree even though it sits under IfcElement", () => {
    for (const type of ["IFCOPENINGELEMENT", "IFCOPENINGSTANDARDCASE", "IFCVOIDINGFEATURE", "IFCPROJECTIONELEMENT", "IFCSURFACEFEATURE"]) {
      expect(isPhysicalElementType(type)).toBe(false);
      expect(classifyEntityType(type)).toBe("ignored");
    }
  });

  it("drops annotations, grids, ports and the spatial backbone", () => {
    for (const type of [
      "IFCANNOTATION",
      "IFCGRID",
      "IFCPORT",
      "IFCDISTRIBUTIONPORT",
      "IFCPROJECT",
      "IFCSITE",
      "IFCBUILDING",
      "IFCBUILDINGSTOREY",
    ]) {
      expect(classifyEntityType(type)).toBe("ignored");
    }
  });

  it("ignores the non-product entities that make up the bulk of a file", () => {
    for (const type of ["IFCCARTESIANPOINT", "IFCRELAGGREGATES", "IFCPROPERTYSET", "IFCSIUNIT", "IFCOWNERHISTORY"]) {
      expect(classifyEntityType(type)).toBe("ignored");
    }
  });

  it("reports a type no schema in this build declares as unrecognized", () => {
    expect(classifyEntityType("IFCMADEUPTHING")).toBe("unrecognized");
    // IFC4X3 infrastructure classes are outside the IFC4 + IFC2X3 table, so
    // they surface as gaps rather than disappearing.
    expect(classifyEntityType("IFCBUILTELEMENT")).toBe("unrecognized");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(classifyEntityType("  ifcValve ")).toBe("element");
  });

  it("keeps IFC2X3-only element names so a 2x3 export is not gutted", () => {
    expect(classifyEntityType("IFCELECTRICALELEMENT")).toBe("element");
    expect(classifyEntityType("IFCEQUIPMENTELEMENT")).toBe("element");
    expect(classifyEntityType("IFCELECTRICDISTRIBUTIONPOINT")).toBe("element");
    // ...but 2x3 feature elements stay excluded, like their IFC4 siblings.
    expect(classifyEntityType("IFCEDGEFEATURE")).toBe("ignored");
  });

  it("covers the whole element subtree, not a curated slice", () => {
    expect(PHYSICAL_ELEMENT_TYPE_NAMES.size).toBeGreaterThan(120);
  });
});

// A committed table is only trustworthy while it still matches the package it
// was generated from. This is what makes a stale checkout fail loudly instead
// of quietly under-reporting elements again.
describe("the committed table still agrees with @ifc-lite/data", () => {
  it("has the same IfcElement subtree as the live IFC4 schema", async () => {
    const entities = await getEntities("IFC4");
    const children = new Map<string, string[]>();
    for (const entity of entities) {
      if (!entity.parent) continue;
      const bucket = children.get(entity.parent);
      if (bucket) bucket.push(entity.name);
      else children.set(entity.parent, [entity.name]);
    }
    const subtree = (root: string, acc: string[] = []) => {
      for (const child of children.get(root) ?? []) {
        acc.push(child);
        subtree(child, acc);
      }
      return acc;
    };

    const live = new Set(subtree("IfcElement"));
    const committed = new Set(
      Object.keys(IFC_PRODUCT_PARENTS).filter((name) => {
        let cursor: string | null | undefined = IFC_PRODUCT_PARENTS[name];
        while (cursor) {
          if (cursor === "IfcElement") return true;
          cursor = IFC_PRODUCT_PARENTS[cursor];
        }
        return false;
      })
    );

    const legacy = new Set(IFC_LEGACY_TYPE_NAMES);
    expect([...live].filter((name) => !committed.has(name))).toEqual([]);
    expect([...committed].filter((name) => !live.has(name) && !legacy.has(name))).toEqual([]);
  });

  it("records the same direct parent as the live schema for every shared name", async () => {
    const entities = await getEntities("IFC4");
    const parentOf = new Map(entities.map((entity) => [entity.name, entity.parent ?? null]));
    const legacy = new Set(IFC_LEGACY_TYPE_NAMES);

    const mismatches = Object.entries(IFC_PRODUCT_PARENTS)
      .filter(([name]) => name !== "IfcProduct" && !legacy.has(name))
      .filter(([name, parent]) => parentOf.get(name) !== parent);

    expect(mismatches).toEqual([]);
  });
});
