import { getEntities } from "@ifc-lite/data";
import { describe, expect, it } from "vitest";
import { IFC_ENTITY_PARENTS, IFC_LEGACY_TYPE_NAMES } from "@ifc-qa/shared-types";
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

  it("keeps the IfcFeatureElement subtree out of the reviewer's list, but still parses it", () => {
    for (const type of ["IFCOPENINGELEMENT", "IFCOPENINGSTANDARDCASE", "IFCVOIDINGFEATURE", "IFCPROJECTIONELEMENT", "IFCSURFACEFEATURE"]) {
      expect(isPhysicalElementType(type)).toBe(false);
      expect(classifyEntityType(type)).toBe("auxiliary");
    }
  });

  it("keeps annotations, grids, ports and the spatial backbone out of the reviewer's list", () => {
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
      expect(classifyEntityType(type)).toBe("auxiliary");
    }
  });

  // These are exactly the types an IDS applicability may name and a reviewer
  // never checks. While they were dropped, such a rule matched nothing and
  // reported the model clean — 27 of the 34 conformance false passes.
  it("parses type objects, relationships and resources so a rule can be written against them", () => {
    for (const type of [
      "IFCWALLTYPE",
      "IFCTYPEOBJECT",
      "IFCTASK",
      "IFCTASKTIME",
      "IFCPERSON",
      "IFCMATERIAL",
      "IFCCLASSIFICATION",
      "IFCRELCONNECTSPATHELEMENTS",
      "IFCRELAGGREGATES",
      "IFCPROPERTYSET",
      "IFCSIUNIT",
      "IFCOWNERHISTORY",
      "IFCSURFACESTYLEREFRACTION",
      "IFCPRESENTATIONLAYERWITHSTYLE",
    ]) {
      expect(classifyEntityType(type)).toBe("auxiliary");
      expect(isPhysicalElementType(type)).toBe(false);
    }
  });

  // Geometry is 96% of a real file by instance count and normalizing it took
  // the 37 MB reference model from 1.6 s to 20.5 s. It is the only subtree
  // whose cost is not worth paying, so it is the only thing still dropped.
  it("ignores geometry, and nothing but geometry", () => {
    for (const type of ["IFCCARTESIANPOINT", "IFCPOLYLOOP", "IFCFACE", "IFCSTYLEDITEM", "IFCEXTRUDEDAREASOLID"]) {
      expect(classifyEntityType(type)).toBe("ignored");
    }

    const ignored = Object.keys(IFC_ENTITY_PARENTS).filter(
      (name) => classifyEntityType(name) === "ignored"
    );
    const outsideGeometry = ignored.filter((name) => {
      let cursor: string | null | undefined = name;
      while (cursor) {
        if (cursor === "IfcRepresentationItem") return false;
        cursor = IFC_ENTITY_PARENTS[cursor];
      }
      return true;
    });
    expect(outsideGeometry).toEqual([]);
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
    // ...but 2x3 feature elements stay out of the reviewer's list, like their
    // IFC4 siblings.
    expect(classifyEntityType("IFCEDGEFEATURE")).toBe("auxiliary");
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
      Object.keys(IFC_ENTITY_PARENTS).filter((name) => {
        let cursor: string | null | undefined = IFC_ENTITY_PARENTS[name];
        while (cursor) {
          if (cursor === "IfcElement") return true;
          cursor = IFC_ENTITY_PARENTS[cursor];
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

    const mismatches = Object.entries(IFC_ENTITY_PARENTS)
      .filter(([name]) => !legacy.has(name))
      .filter(([name, parent]) => parentOf.get(name) !== parent);

    expect(mismatches).toEqual([]);
  });
});
