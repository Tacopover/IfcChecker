import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { WebIfcAdapter, parseWebIfcBuffer } from "./web-ifc-adapter.js";
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
    expect(wall.attributes.Tag).toEqual({ value: "TAG-001" });
    expect(wall.attributes.Description).toEqual({ value: "Fixture wall for QA tool tests" });
    expect(wall.propertySets.Pset_WallCommon).toEqual({
      IsExternal: { value: true, dataType: "IFCBOOLEAN" },
      FireRating: { value: "REI60", dataType: "IFCLABEL" },
    });
  });

  it("rejects the truncated fixture", async () => {
    const adapter = new WebIfcAdapter();
    await expect(adapter.parse(fixturePath("corrupt-truncated.ifc"))).rejects.toThrow();
  });
});

describe("parseWebIfcBuffer", () => {
  it("parses an in-memory buffer the same way the file-based adapter does", async () => {
    const raw = await readFile(fixturePath("minimal-wall.ifc"));
    const result = await parseWebIfcBuffer(raw);

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].globalId).toBe("1abc2defGHI3jkl4mno5pq");
  });

  it("builds the project/site/building/storey tree with per-storey element counts", async () => {
    const raw = await readFile(fixturePath("minimal-wall.ifc"));
    const result = await parseWebIfcBuffer(raw);

    const project = result.modelStructure;
    expect(project?.ifcType).toBe("IFCPROJECT");
    expect(project?.name).toBe("Fixture Project");

    const site = project?.children[0];
    expect(site?.ifcType).toBe("IFCSITE");
    expect(site?.name).toBe("Fixture Site");

    const building = site?.children[0];
    expect(building?.ifcType).toBe("IFCBUILDING");
    expect(building?.name).toBe("Fixture Building");

    const storey = building?.children[0];
    expect(storey?.ifcType).toBe("IFCBUILDINGSTOREY");
    expect(storey?.name).toBe("Level 1");
    expect(storey?.elementIdsByType).toEqual({ IFCWALL: [15] });
    expect(storey?.children).toEqual([]);
  });

  it("collects the concrete MEP classes a real export writes, not a fixed list of type names", async () => {
    const raw = await readFile(fixturePath("mep-systems.ifc"));
    const result = await parseWebIfcBuffer(raw);
    const present = new Set(result.elements.map((element) => element.ifcType));

    for (const type of ["IFCVALVE", "IFCAIRTERMINAL", "IFCDUCTFITTING", "IFCDAMPER", "IFCPIPEFITTING", "IFCSENSOR", "IFCACTUATOR", "IFCPUMP", "IFCSANITARYTERMINAL"]) {
      expect(present).toContain(type);
    }

    const valve = result.elements.find((element) => element.globalId === "1Mm2Bb3Cc4Dd5Ee6Ff7G08");
    expect(valve?.ifcType).toBe("IFCVALVE");
    expect(valve?.predefinedType).toBe("ISOLATING");
    expect(valve?.name).toBe("V-001");
    expect(valve?.propertySets.Pset_MEPCommon).toEqual({
      SystemAbbreviation: { value: "CHW", dataType: "IFCLABEL" },
      Insulation: { value: "19mm", dataType: "IFCLABEL" },
    });
  });

  it("leaves openings, ports and annotations out of the element list", async () => {
    const raw = await readFile(fixturePath("mep-systems.ifc"));
    const result = await parseWebIfcBuffer(raw);
    const present = new Set(result.elements.map((element) => element.ifcType));

    for (const type of ["IFCOPENINGELEMENT", "IFCDISTRIBUTIONPORT", "IFCANNOTATION", "IFCPROJECT", "IFCBUILDINGSTOREY"]) {
      expect(present).not.toContain(type);
    }
    expect(result.unrecognizedTypes).toEqual([]);
  });
});
