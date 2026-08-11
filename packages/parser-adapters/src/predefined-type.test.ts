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
    expect(
      resolvePredefinedType({ predefinedType: "USERDEFINED", elementType: "WALDO" })
    ).toEqual({ predefinedType: "WALDO", storedPredefinedType: "USERDEFINED" });
  });

  // Nothing is carried twice: an ordinary value, an absent one, and a USERDEFINED that names
  // nothing all resolve to themselves, so there is no second string for a rule to match.
  it("states no stored value when the two would be the same string", () => {
    expect(resolvePredefinedType({ predefinedType: "SOLIDWALL" })).toEqual({
      predefinedType: "SOLIDWALL",
      storedPredefinedType: null,
    });
    expect(resolvePredefinedType({ predefinedType: null, objectType: "ignored" })).toEqual({
      predefinedType: null,
      storedPredefinedType: null,
    });
    expect(resolvePredefinedType({ predefinedType: "USERDEFINED", elementType: "" })).toEqual({
      predefinedType: "USERDEFINED",
      storedPredefinedType: null,
    });
  });

  it("takes the type object's value over the occurrence's own", () => {
    expect(
      resolvePredefinedType(
        { predefinedType: null },
        { predefinedType: "USERDEFINED", elementType: "X" }
      )
    ).toEqual({ predefinedType: "X", storedPredefinedType: "USERDEFINED" });

    expect(
      resolvePredefinedType({ predefinedType: "SOLIDWALL" }, { predefinedType: "PARTITIONING" })
    ).toEqual({ predefinedType: "PARTITIONING", storedPredefinedType: null });
  });

  // NOTDEFINED is the enumeration saying "no value here", so a type carrying it defines nothing
  // and the occurrence's own value stands. On the occurrence there is nowhere further to look, so
  // the same literal is kept rather than reported as absent.
  it("reads NOTDEFINED on a type as defining nothing, and keeps it on an occurrence", () => {
    expect(
      resolvePredefinedType(
        { predefinedType: "USERDEFINED", objectType: "Y" },
        { predefinedType: "NOTDEFINED" }
      )
    ).toEqual({ predefinedType: "Y", storedPredefinedType: "USERDEFINED" });

    expect(resolvePredefinedType({ predefinedType: "NOTDEFINED" }, null)).toEqual({
      predefinedType: "NOTDEFINED",
      storedPredefinedType: null,
    });
  });
});
