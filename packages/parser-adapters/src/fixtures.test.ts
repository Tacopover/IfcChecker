import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixturePath } from "./fixture-path.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";

describe("IFC fixtures", () => {
  it("minimal-wall.ifc is a well-formed STEP file", async () => {
    const buffer = await readFile(fixturePath("minimal-wall.ifc"));
    expect(() => assertWellFormedStepFile(new Uint8Array(buffer))).not.toThrow();
    expect(buffer.toString("utf-8")).toContain("IFCWALL");
  });

  it("multi-storey.ifc is a well-formed STEP file", async () => {
    const buffer = await readFile(fixturePath("multi-storey.ifc"));
    expect(() => assertWellFormedStepFile(new Uint8Array(buffer))).not.toThrow();
    expect(buffer.toString("utf-8")).toContain("IFCBUILDINGSTOREY");
  });

  it("mep-systems.ifc carries the concrete MEP classes, not the abstract supertypes", async () => {
    const buffer = await readFile(fixturePath("mep-systems.ifc"));
    expect(() => assertWellFormedStepFile(new Uint8Array(buffer))).not.toThrow();
    const text = buffer.toString("utf-8");
    for (const type of ["IFCVALVE", "IFCAIRTERMINAL", "IFCDUCTFITTING", "IFCDAMPER", "IFCPIPEFITTING", "IFCSENSOR"]) {
      expect(text).toContain(type);
    }
  });

  it("corrupt-truncated.ifc is not well-formed", async () => {
    const buffer = await readFile(fixturePath("corrupt-truncated.ifc"));
    expect(() => assertWellFormedStepFile(new Uint8Array(buffer))).toThrow();
  });
});
