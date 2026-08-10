import { describe, expect, it } from "vitest";
import { WebIfcAdapter } from "./web-ifc-adapter.js";
import { IfcLiteAdapter } from "./ifc-lite-adapter.js";
import { fixturePath } from "./fixture-path.js";

// A property stated once on an IfcTypeObject reaches its occurrences only
// through IFCRELDEFINESBYTYPE. Both adapters read instance-level
// IFCRELDEFINESBYPROPERTIES; until they also walked the type relationship,
// every type-defined property was invisible to every check — on a real project
// file that hid '3.6 NL-SfB code' on all 280 flow segments while the ASML set
// carrying it was itself read.
const adapters = [
  ["web-ifc", () => new WebIfcAdapter()],
  ["ifc-lite", () => new IfcLiteAdapter()],
] as const;

async function wallsByName(makeAdapter: () => WebIfcAdapter | IfcLiteAdapter) {
  const result = await makeAdapter().parse(fixturePath("type-inherited-psets.ifc"));
  return new Map(result.elements.map((element) => [element.name, element]));
}

describe.each(adapters)("type-inherited property sets (%s)", (_engine, makeAdapter) => {
  it("gives a typed occurrence the union of its own and its type's sets", async () => {
    const walls = await wallsByName(makeAdapter);

    expect(walls.get("W-001")?.propertySets).toEqual({
      // '3.5 Type' is stated on both levels and the occurrence wins;
      // '3.6 NL-SfB code' exists only on the type and 'Q Lengte' only on the
      // occurrence, so a merge that replaced the set wholesale would drop one
      // of them whichever way round it went.
      ASML: {
        "3.5 Type": { value: "instance", dataType: "IFCLABEL" },
        "3.6 NL-SfB code": { value: "21.11", dataType: "IFCTEXT" },
        "Q Lengte": { value: 3000, dataType: "IFCLENGTHMEASURE" },
      },
      Pset_ManufacturerTypeInformation: { Manufacturer: { value: "Acme", dataType: "IFCLABEL" } },
      Pset_TypeViaRelation: { TypeRelProp: { value: "fromRel", dataType: "IFCLABEL" } },
    });
  });

  it("gives an occurrence with no sets of its own the type's sets unchanged", async () => {
    const walls = await wallsByName(makeAdapter);

    expect(walls.get("W-002")?.propertySets).toEqual({
      ASML: {
        "3.5 Type": { value: "type", dataType: "IFCLABEL" },
        "3.6 NL-SfB code": { value: "21.11", dataType: "IFCTEXT" },
      },
      Pset_ManufacturerTypeInformation: { Manufacturer: { value: "Acme", dataType: "IFCLABEL" } },
      Pset_TypeViaRelation: { TypeRelProp: { value: "fromRel", dataType: "IFCLABEL" } },
    });
  });

  it("leaves an untyped occurrence with only its own sets", async () => {
    const walls = await wallsByName(makeAdapter);

    expect(walls.get("W-003")?.propertySets).toEqual({
      Pset_WallCommon: { IsExternal: { value: true, dataType: "IFCBOOLEAN" } },
    });
  });

  // Qto_WallBaseQuantities shares the type's HasPropertySets list. Quantity sets
  // are not read at either level today; without a guard it arrives as a named
  // set with nothing in it.
  it("does not surface an IfcElementQuantity on the type as a property set", async () => {
    const walls = await wallsByName(makeAdapter);

    for (const name of ["W-001", "W-002"]) {
      expect(Object.keys(walls.get(name)?.propertySets ?? {})).not.toContain("Qto_WallBaseQuantities");
    }
  });

  it("does not turn the type object itself into an element", async () => {
    const result = await makeAdapter().parse(fixturePath("type-inherited-psets.ifc"));

    expect(result.elements.map((element) => element.ifcType)).toEqual(["IFCWALL", "IFCWALL", "IFCWALL"]);
    expect(result.unrecognizedTypes).toEqual([]);
  });
});

describe("type-inherited property sets (parity)", () => {
  it("both engines resolve type inheritance identically", async () => {
    const path = fixturePath("type-inherited-psets.ifc");
    const fromWebIfc = await new WebIfcAdapter().parse(path);
    const fromIfcLite = await new IfcLiteAdapter().parse(path);

    expect(fromIfcLite.elements).toEqual(fromWebIfc.elements);
  });
});
