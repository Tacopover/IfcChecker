import { describe, expect, it } from "vitest";
import { ELEMENT_TYPE_NAMES } from "./element-types";

describe("ELEMENT_TYPE_NAMES", () => {
  it("includes the core physical building element types the fixtures exercise", () => {
    expect(ELEMENT_TYPE_NAMES).toContain("IFCWALL");
    expect(ELEMENT_TYPE_NAMES).toContain("IFCDOOR");
    expect(ELEMENT_TYPE_NAMES).toContain("IFCSLAB");
  });

  it("contains only uppercase STEP-style type names", () => {
    for (const name of ELEMENT_TYPE_NAMES) {
      expect(name).toBe(name.toUpperCase());
    }
  });
});
