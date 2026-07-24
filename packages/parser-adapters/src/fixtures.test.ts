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

  it("corrupt-truncated.ifc is not well-formed", async () => {
    const buffer = await readFile(fixturePath("corrupt-truncated.ifc"));
    expect(() => assertWellFormedStepFile(new Uint8Array(buffer))).toThrow();
  });
});
