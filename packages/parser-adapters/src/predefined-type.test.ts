import { describe, expect, it } from "vitest";
import { effectivePredefinedType, resolvePredefinedType } from "./predefined-type.js";

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

  // IfcTypeProcess declares the same idea under a third name, so an IfcTaskType states its
  // user-defined type in neither of the two fields an element or an element type uses.
  it("falls back to ProcessType, which is where a type process states it", () => {
    expect(effectivePredefinedType("USERDEFINED", null, null, "TASKY")).toBe("TASKY");
  });

  // Keeping the stored value is the honest answer: the model says the type is user-defined and
  // then fails to define it. Reporting null would let "is a predefined type stated" pass.
  it("keeps USERDEFINED when neither field names anything", () => {
    expect(effectivePredefinedType("USERDEFINED", null, "")).toBe("USERDEFINED");
  });
});

describe("resolvePredefinedType", () => {
  it("keeps the enumeration literal alongside the name it resolves to", () => {
    expect(resolvePredefinedType("USERDEFINED", null, "WALDO")).toEqual({
      predefinedType: "WALDO",
      storedPredefinedType: "USERDEFINED",
    });
  });

  // Nothing is carried twice: an ordinary value, an absent one, and a USERDEFINED that names
  // nothing all resolve to themselves, so there is no second string for a rule to match.
  it("states no stored value when the two would be the same string", () => {
    expect(resolvePredefinedType("SOLIDWALL", null)).toEqual({
      predefinedType: "SOLIDWALL",
      storedPredefinedType: null,
    });
    expect(resolvePredefinedType(null, "ignored")).toEqual({
      predefinedType: null,
      storedPredefinedType: null,
    });
    expect(resolvePredefinedType("USERDEFINED", null, "")).toEqual({
      predefinedType: "USERDEFINED",
      storedPredefinedType: null,
    });
  });
});
