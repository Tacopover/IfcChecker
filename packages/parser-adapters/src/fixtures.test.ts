import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixturePath } from "./fixture-path.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";

describe("IFC fixtures", () => {
  it("minimal-wall.ifc is a well-formed STEP file", async () => {
    const text = await readFile(fixturePath("minimal-wall.ifc"), "utf-8");
    expect(() => assertWellFormedStepFile(text)).not.toThrow();
    expect(text).toContain("IFCWALL");
  });

  it("corrupt-truncated.ifc is not well-formed", async () => {
    const text = await readFile(fixturePath("corrupt-truncated.ifc"), "utf-8");
    expect(() => assertWellFormedStepFile(text)).toThrow();
  });
});
