import { describe, expect, it } from "vitest";
import { normalizePropertyValue } from "./normalize-property-value.js";

describe("normalizePropertyValue", () => {
  it("passes primitives through unchanged", () => {
    expect(normalizePropertyValue("REI60")).toBe("REI60");
    expect(normalizePropertyValue(3000)).toBe(3000);
    expect(normalizePropertyValue(true)).toBe(true);
  });

  it("maps null and undefined to null", () => {
    expect(normalizePropertyValue(null)).toBeNull();
    expect(normalizePropertyValue(undefined)).toBeNull();
  });

  it("unwraps an engine-typed {value} object", () => {
    expect(normalizePropertyValue({ value: "REI60" })).toBe("REI60");
    expect(normalizePropertyValue({ value: true })).toBe(true);
  });

  it("stringifies arrays", () => {
    expect(normalizePropertyValue(["a", "b"])).toBe(JSON.stringify(["a", "b"]));
  });
});
