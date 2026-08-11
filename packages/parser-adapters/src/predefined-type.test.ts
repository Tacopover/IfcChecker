import { describe, expect, it } from "vitest";
import { effectivePredefinedType } from "./predefined-type.js";

describe("effectivePredefinedType", () => {
  it("passes an ordinary enumeration value through", () => {
    expect(effectivePredefinedType("BEAM", "ignored")).toBe("BEAM");
    expect(effectivePredefinedType(null, "ignored")).toBeNull();
  });

  // IFC reserves USERDEFINED to mean "the name is elsewhere". A rule asking for WATERBOTTLE is
  // comparing against ObjectType, and against the literal "USERDEFINED" it would match nothing.
  it("substitutes ObjectType when the enumeration says USERDEFINED", () => {
    expect(effectivePredefinedType("USERDEFINED", "WATERBOTTLE")).toBe("WATERBOTTLE");
  });

  it("falls back to ElementType, which is where a type object states it", () => {
    expect(effectivePredefinedType("USERDEFINED", null, "BESPOKE_PANEL")).toBe("BESPOKE_PANEL");
  });

  // Keeping the stored value is the honest answer: the model says the type is user-defined and
  // then fails to define it. Reporting null would let "is a predefined type stated" pass.
  it("keeps USERDEFINED when neither field names anything", () => {
    expect(effectivePredefinedType("USERDEFINED", null, "")).toBe("USERDEFINED");
  });
});
