import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { IfcLiteAdapter, parseIfcLiteBuffer } from "./ifc-lite-adapter.js";
import { fixturePath } from "./fixture-path.js";

describe("IfcLiteAdapter", () => {
  it("parses the minimal wall fixture into one normalized IFCWALL element", async () => {
    const adapter = new IfcLiteAdapter();
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
    const adapter = new IfcLiteAdapter();
    await expect(adapter.parse(fixturePath("corrupt-truncated.ifc"))).rejects.toThrow();
  });
});

describe("parseIfcLiteBuffer", () => {
  it("parses an in-memory buffer the same way the file-based adapter does", async () => {
    const raw = await readFile(fixturePath("minimal-wall.ifc"));
    const result = await parseIfcLiteBuffer(raw);

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].globalId).toBe("1abc2defGHI3jkl4mno5pq");
  });

  it("builds the project/site/building/storey tree with per-storey element counts", async () => {
    const raw = await readFile(fixturePath("minimal-wall.ifc"));
    const result = await parseIfcLiteBuffer(raw);

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
    expect(storey?.elementCounts).toEqual({ IFCWALL: 1 });
    expect(storey?.children).toEqual([]);
  });

  it("collects the concrete MEP classes a real export writes, not a fixed list of type names", async () => {
    const raw = await readFile(fixturePath("mep-systems.ifc"));
    const result = await parseIfcLiteBuffer(raw);
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
    const result = await parseIfcLiteBuffer(raw);
    const present = new Set(result.elements.map((element) => element.ifcType));

    for (const type of ["IFCOPENINGELEMENT", "IFCDISTRIBUTIONPORT", "IFCANNOTATION", "IFCPROJECT", "IFCBUILDINGSTOREY"]) {
      expect(present).not.toContain(type);
    }
    expect(result.unrecognizedTypes).toEqual([]);
  });

  // web-ifc discards a type its own schema tables do not name, so only this
  // engine can report one back by name — see element-filter.test.ts for the
  // classification rule itself.
  it("reports a type outside the IFC4/IFC2X3 tables instead of dropping it silently", async () => {
    const raw = await readFile(fixturePath("mep-systems.ifc"));
    // Fixture is committed with LF endings but checks out as CRLF on Windows
    // (core.autocrlf), so match either line ending and reuse whichever was found.
    const withUnknown = new TextDecoder().decode(raw).replace(
      /ENDSEC;(\r?\n)END-ISO-10303-21;/,
      (_match, eol: string) =>
        `#90=IFCVENDOREXTENSIONTHING('1Mm2Bb3Cc4Dd5Ee6Ff7G31',$,'VX-001',$,$,#12,$,'VX-001',$);${eol}ENDSEC;${eol}END-ISO-10303-21;`
    );
    const result = await parseIfcLiteBuffer(new TextEncoder().encode(withUnknown));

    expect(result.unrecognizedTypes).toEqual([{ ifcType: "IFCVENDOREXTENSIONTHING", count: 1 }]);
    expect(result.elements.map((element) => element.ifcType)).not.toContain("IFCVENDOREXTENSIONTHING");
  });

  it("forwards onProgress to the underlying parseColumnar call", async () => {
    const raw = await readFile(fixturePath("minimal-wall.ifc"));
    const events: Array<{ phase: string; percent: number }> = [];

    await parseIfcLiteBuffer(raw, (phase, percent) => events.push({ phase, percent }));

    // parseColumnar always reports at least a start and a completion phase for any input.
    expect(events.length).toBeGreaterThan(0);
  });
});
