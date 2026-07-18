import { describe, expect, it } from "vitest";
import { assertWellFormedStepFile } from "./step-well-formed";

describe("assertWellFormedStepFile", () => {
  it("accepts a file ending with the ISO-10303-21 terminator", () => {
    expect(() =>
      assertWellFormedStepFile("ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n")
    ).not.toThrow();
  });

  it("rejects a file missing the terminator", () => {
    expect(() => assertWellFormedStepFile("ISO-10303-21;\nDATA;\n#1=IFCWALL();")).toThrow(
      /malformed IFC STEP file/
    );
  });
});
