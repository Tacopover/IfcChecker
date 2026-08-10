import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { matchesApplicability, evaluateRequirement } from "./facet-evaluation.js";
import type {
  ParsedAttributeFacet,
  ParsedClassificationFacet,
  ParsedPropertyFacet,
} from "./parse-ids.js";

function makeElement(overrides: Partial<NormalizedElement>): NormalizedElement {
  return {
    globalId: "g1",
    ifcType: "IFCWALL",
    predefinedType: null,
    name: null,
    attributes: {},
    propertySets: {},
    ...overrides,
  };
}

describe("matchesApplicability", () => {
  it("matches case-insensitively", () => {
    expect(matchesApplicability(makeElement({ ifcType: "IfcWall" }), ["IFCWALL"])).toBe(true);
  });

  it("returns false when no entity name matches", () => {
    expect(matchesApplicability(makeElement({ ifcType: "IFCDOOR" }), ["IFCWALL"])).toBe(false);
  });

  it("matches a subtype against a supertype applicability entry", () => {
    const wall = makeElement({ ifcType: "IFCWALL" });
    expect(matchesApplicability(wall, ["IFCELEMENT"])).toBe(true);
    expect(matchesApplicability(wall, ["IFCBUILDINGELEMENT"])).toBe(true);
  });

  it("does not match a supertype element against a subtype applicability entry", () => {
    expect(matchesApplicability(makeElement({ ifcType: "IFCELEMENT" }), ["IFCWALL"])).toBe(false);
  });

  it("does not match across sibling branches", () => {
    expect(matchesApplicability(makeElement({ ifcType: "IFCDUCTSEGMENT" }), ["IFCWALL"])).toBe(false);
    expect(matchesApplicability(makeElement({ ifcType: "IFCDUCTSEGMENT" }), ["IFCFLOWSEGMENT"])).toBe(
      true
    );
  });
});

function attributeFacet(overrides: Partial<ParsedAttributeFacet> = {}): ParsedAttributeFacet {
  return {
    kind: "attribute",
    name: "Name",
    restriction: null,
    cardinality: "required",
    ...overrides,
  };
}

function propertyFacet(overrides: Partial<ParsedPropertyFacet> = {}): ParsedPropertyFacet {
  return {
    kind: "property",
    propertySet: "Pset_WallCommon",
    baseName: "FireRating",
    dataType: "IFCLABEL",
    restriction: null,
    cardinality: "required",
    ...overrides,
  };
}

describe("evaluateRequirement — attribute facet", () => {
  const patternFacet = attributeFacet({
    restriction: { kind: "pattern", source: "W-\\d+", regex: /^(?:W-\d+)$/ },
  });

  it("passes when the top-level Name attribute matches the pattern", () => {
    expect(evaluateRequirement(makeElement({ name: "W-001" }), patternFacet)).toEqual({
      passed: true,
      message: "",
    });
  });

  it("fails when the top-level Name attribute does not match the pattern", () => {
    const result = evaluateRequirement(makeElement({ name: "West Wall" }), patternFacet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Name");
    expect(result.message).toContain("W-\\d+");
  });

  // IDS: a pattern applies to strings and nothing else. Stringifying first made
  // `.*` match a number, which is the specification's own example of a check
  // that must fail — and it only became reachable once numeric attributes were
  // carried at all.
  it("fails a pattern applied to a number rather than matching its text", () => {
    const anything: ParsedAttributeFacet = attributeFacet({
      name: "RefractionIndex",
      restriction: { kind: "pattern", source: ".*", regex: /^(?:.*)$/ },
    });
    const result = evaluateRequirement(
      makeElement({ attributes: { RefractionIndex: { value: 42 } } }),
      anything
    );

    expect(result.passed).toBe(false);
    expect(result.message).toContain("a number");
  });

  it("fails a pattern applied to a boolean too", () => {
    const anything: ParsedAttributeFacet = attributeFacet({
      name: "IsCritical",
      restriction: { kind: "pattern", source: ".*", regex: /^(?:.*)$/ },
    });
    const result = evaluateRequirement(
      makeElement({ attributes: { IsCritical: { value: true } } }),
      anything
    );

    expect(result.passed).toBe(false);
    expect(result.message).toContain("a boolean");
  });

  it("fails when the attribute is missing entirely", () => {
    const result = evaluateRequirement(makeElement({ attributes: {} }), attributeFacet({ name: "Tag" }));
    expect(result).toEqual({ passed: false, message: 'Attribute "Tag" is missing' });
  });

  it("treats an empty string as not filled in", () => {
    const result = evaluateRequirement(
      makeElement({ attributes: { Tag: { value: "" } } }),
      attributeFacet({ name: "Tag" })
    );
    expect(result.passed).toBe(false);
  });

  it("falls back to the attributes bag for non-top-level attribute names", () => {
    const result = evaluateRequirement(
      makeElement({ attributes: { Tag: { value: "W-001" } } }),
      attributeFacet({ name: "Tag" })
    );
    expect(result).toEqual({ passed: true, message: "" });
  });

  it("matches an attribute key case-insensitively when the exact key is absent", () => {
    const facet = attributeFacet({ name: "Tag" });
    expect(evaluateRequirement(makeElement({ attributes: { tag: { value: "W-1" } } }), facet)).toEqual({
      passed: true,
      message: "",
    });
    expect(evaluateRequirement(makeElement({ attributes: { Tag: { value: "W-1" } } }), facet)).toEqual({
      passed: true,
      message: "",
    });
    expect(
      evaluateRequirement(makeElement({ attributes: { OBJECTTYPE: { value: "Basic" } } }), attributeFacet({ name: "ObjectType" }))
        .passed
    ).toBe(true);
  });

  it("prefers the exactly-cased attribute key over a case-insensitive one", () => {
    const facet = attributeFacet({
      name: "Tag",
      restriction: { kind: "exact", value: "exact-hit" },
    });
    const element = makeElement({ attributes: { tag: { value: "loose-hit" }, Tag: { value: "exact-hit" } } });
    expect(evaluateRequirement(element, facet).passed).toBe(true);
  });

  it("enforces an exact restriction", () => {
    const facet = attributeFacet({ restriction: { kind: "exact", value: "W-001" } });
    expect(evaluateRequirement(makeElement({ name: "W-001" }), facet).passed).toBe(true);
    const failure = evaluateRequirement(makeElement({ name: "W-002" }), facet);
    expect(failure.passed).toBe(false);
    expect(failure.message).toContain('must be "W-001"');
  });

  it("enforces an enum restriction", () => {
    const facet = attributeFacet({ restriction: { kind: "enum", values: ["A", "B"] } });
    expect(evaluateRequirement(makeElement({ name: "B" }), facet).passed).toBe(true);
    const failure = evaluateRequirement(makeElement({ name: "C" }), facet);
    expect(failure.passed).toBe(false);
    expect(failure.message).toContain("A, B");
  });
});

describe("evaluateRequirement — property facet", () => {
  it("passes when the property set and base name are present", () => {
    const element = makeElement({ propertySets: { Pset_WallCommon: { FireRating: { value: "REI60" } } } });
    expect(evaluateRequirement(element, propertyFacet())).toEqual({ passed: true, message: "" });
  });

  it("fails when the property set is missing entirely", () => {
    const result = evaluateRequirement(makeElement({ propertySets: {} }), propertyFacet());
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Pset_WallCommon");
  });

  it("fails when the property set exists but the base name is missing", () => {
    const result = evaluateRequirement(
      makeElement({ propertySets: { Pset_WallCommon: {} } }),
      propertyFacet()
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("FireRating");
  });

  it("applies an enum restriction to the property value", () => {
    const facet = propertyFacet({ restriction: { kind: "enum", values: ["60", "90"] } });
    const good = makeElement({ propertySets: { Pset_WallCommon: { FireRating: { value: "90" } } } });
    const bad = makeElement({ propertySets: { Pset_WallCommon: { FireRating: { value: "30" } } } });

    expect(evaluateRequirement(good, facet).passed).toBe(true);
    const failure = evaluateRequirement(bad, facet);
    expect(failure.passed).toBe(false);
    expect(failure.message).toContain("FireRating");
    expect(failure.message).toContain("60, 90");
  });

  it("applies a pattern restriction to the property value", () => {
    const facet = propertyFacet({
      restriction: { kind: "pattern", source: "REI\\d+", regex: /^(?:REI\d+)$/ },
    });
    const bad = makeElement({ propertySets: { Pset_WallCommon: { FireRating: { value: "unknown" } } } });
    expect(evaluateRequirement(bad, facet).passed).toBe(false);
  });
});

describe("evaluateRequirement — dataType", () => {
  const facet = propertyFacet({ baseName: "Duration", dataType: "IFCTIMEMEASURE" });
  const elementWith = (dataType?: string) =>
    makeElement({ propertySets: { Pset_WallCommon: { Duration: { value: 2, dataType } } } });

  it("fails a value stored as a different measure, however equal the number looks", () => {
    const result = evaluateRequirement(elementWith("IFCMASSMEASURE"), facet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("IFCMASSMEASURE");
    expect(result.message).toContain("IFCTIMEMEASURE");
  });

  it("passes a value stored as the measure the specification names", () => {
    expect(evaluateRequirement(elementWith("IFCTIMEMEASURE"), facet).passed).toBe(true);
  });

  it("ignores case, which hand-written IDS files are inconsistent about", () => {
    expect(evaluateRequirement(elementWith("IfcTimeMeasure"), facet).passed).toBe(true);
  });

  // A multi-valued property carries candidates instead of a measure type. Failing on an unknown
  // type would reject every list and enumerated property a specification names by data type.
  it("does not enforce a type the parser did not report", () => {
    expect(evaluateRequirement(elementWith(undefined), facet).passed).toBe(true);
  });

  it("does not apply to an attribute facet, which IDS gives no dataType", () => {
    const element = makeElement({ attributes: { Tag: { value: "W-001" } } });
    expect(evaluateRequirement(element, attributeFacet({ name: "Tag" })).passed).toBe(true);
  });
});

describe("evaluateRequirement — optional cardinality", () => {
  const facet = attributeFacet({ name: "Name", restriction: { kind: "exact", value: "Foobar" } });
  const optional = attributeFacet({ ...facet, cardinality: "optional" });

  it("passes when the model does not state the value", () => {
    expect(evaluateRequirement(makeElement({ name: null }), optional).passed).toBe(true);
  });

  // The line is absent-versus-empty, not absent-versus-satisfactory. An empty string is a value
  // the author wrote, so it is judged -- and both parsers now keep it distinct from null.
  it("fails when the model states the value as empty", () => {
    expect(evaluateRequirement(makeElement({ name: "" }), optional).passed).toBe(false);
  });

  it("still checks a value that is stated", () => {
    expect(evaluateRequirement(makeElement({ name: "Foobar" }), optional).passed).toBe(true);
    expect(evaluateRequirement(makeElement({ name: "Other" }), optional).passed).toBe(false);
  });

  it("leaves a required facet failing on an absent value", () => {
    expect(evaluateRequirement(makeElement({ name: null }), facet).passed).toBe(false);
  });

  it("passes an optional property facet whose property set is missing entirely", () => {
    const element = makeElement({ propertySets: {} });
    const propertyOptional = propertyFacet({ cardinality: "optional" });
    expect(evaluateRequirement(element, propertyOptional).passed).toBe(true);
  });
});

describe("evaluateRequirement — a multi-valued property matches on any of its values", () => {
  // What ifc-lite hands over for IFCPROPERTYENUMERATEDVALUE((IFCLABEL('EXISTING'),IFCLABEL('DEMOLISH'))):
  // a display rendering of the set, plus the candidates behind it.
  const enumerated = makeElement({
    propertySets: {
      Pset_WallCommon: {
        Status: { value: "EXISTING, DEMOLISH", values: ["EXISTING", "DEMOLISH"] },
      },
    },
  });
  const statusIs = (value: string) =>
    propertyFacet({ baseName: "Status", dataType: null, restriction: { kind: "exact", value } });

  it("passes on the first candidate", () => {
    expect(evaluateRequirement(enumerated, statusIs("EXISTING")).passed).toBe(true);
  });

  it("passes on a later candidate", () => {
    expect(evaluateRequirement(enumerated, statusIs("DEMOLISH")).passed).toBe(true);
  });

  it("fails when no candidate matches", () => {
    expect(evaluateRequirement(enumerated, statusIs("NEW")).passed).toBe(false);
  });

  // The rendering is the one thing that must NOT match: no author writes it, and matching it would
  // let a set pass a check aimed at a single value.
  it("does not match the parser's rendering of the whole set", () => {
    expect(evaluateRequirement(enumerated, statusIs("EXISTING, DEMOLISH")).passed).toBe(false);
  });

  it("matches a candidate inside an enum restriction", () => {
    const facet = propertyFacet({
      baseName: "Status",
      dataType: null,
      restriction: { kind: "enum", values: ["NEW", "DEMOLISH"] },
    });
    expect(evaluateRequirement(enumerated, facet).passed).toBe(true);
  });

  it("still reads the single value when there are no candidates", () => {
    const single = makeElement({
      propertySets: { Pset_WallCommon: { Status: { value: "EXISTING" } } },
    });
    expect(evaluateRequirement(single, statusIs("EXISTING")).passed).toBe(true);
    expect(evaluateRequirement(single, statusIs("DEMOLISH")).passed).toBe(false);
  });
});

describe("evaluateRequirement — comparing a number as a number", () => {
  const exact = (value: string) => ({ kind: "exact", value }) as const;
  const realFacet = (value: string) =>
    propertyFacet({ baseName: "Foo", dataType: "IFCREAL", restriction: exact(value) });
  const storedReal = makeElement({
    propertySets: { Pset_WallCommon: { Foo: { value: 42, dataType: "IFCREAL" } } },
  });

  // " 42 " included on purpose: XSD's numeric types collapse whitespace before validating, so a
  // padded literal is a valid way to write the number and not a mismatch.
  it.each(["42", "42.", "42.0", "+42", "4.2e1", "4.2E1", " 42 "])(
    "matches a stored 42 written as %s",
    (literal) => {
      expect(evaluateRequirement(storedReal, realFacet(literal)).passed).toBe(true);
    }
  );

  it.each(["43", "42.5", "4.2e2"])("does not match a stored 42 written as %s", (literal) => {
    expect(evaluateRequirement(storedReal, realFacet(literal)).passed).toBe(false);
  });

  // parseFloat reads "42,3" as 42 and would match. The suite states that document as one that
  // must fail, so the literal has to be rejected outright rather than salvaged.
  it.each(["42,3", "forty-two", "0x2A", ""])(
    "refuses %s, which is not a number in any XSD type",
    (literal) => {
      expect(evaluateRequirement(storedReal, realFacet(literal)).passed).toBe(false);
    }
  );

  it("applies the same casting inside an enum restriction", () => {
    const facet = propertyFacet({
      baseName: "Foo",
      dataType: "IFCREAL",
      restriction: { kind: "enum", values: ["1.0", "42.0"] },
    });
    expect(evaluateRequirement(storedReal, facet).passed).toBe(true);
  });

  it("leaves a string value compared as a string", () => {
    const element = makeElement({
      propertySets: { Pset_WallCommon: { FireRating: { value: "REI60" } } },
    });
    const facet = propertyFacet({ dataType: null, restriction: exact("REI60") });
    expect(evaluateRequirement(element, facet).passed).toBe(true);
  });

  describe("a whole number rejects a literal written with a decimal", () => {
    it("for a property the file typed as IFCINTEGER", () => {
      const element = makeElement({
        propertySets: { Pset_WallCommon: { Foo: { value: 42, dataType: "IFCINTEGER" } } },
      });
      const facet = (value: string) =>
        propertyFacet({ baseName: "Foo", dataType: "IFCINTEGER", restriction: exact(value) });

      expect(evaluateRequirement(element, facet("42")).passed).toBe(true);
      expect(evaluateRequirement(element, facet("42.")).passed).toBe(false);
      expect(evaluateRequirement(element, facet("42.0")).passed).toBe(false);
    });

    // Both arrive as the JS number 42; only the entity table separates them.
    it("for an attribute the schema types as an integer, but not for one it types as a real", () => {
      const stair = makeElement({
        ifcType: "IFCSTAIRFLIGHT",
        attributes: { NumberOfRisers: { value: 42 } },
      });
      const style = makeElement({
        ifcType: "IFCSURFACESTYLEREFRACTION",
        attributes: { RefractionIndex: { value: 42 } },
      });

      const risers = attributeFacet({ name: "NumberOfRisers", restriction: exact("42.0") });
      const index = attributeFacet({ name: "RefractionIndex", restriction: exact("42.0") });

      expect(evaluateRequirement(stair, risers).passed).toBe(false);
      expect(evaluateRequirement(style, index).passed).toBe(true);
    });
  });
});

describe("evaluateRequirement — prohibited cardinality", () => {
  it("passes an attribute facet when the value is absent and fails when it is filled in", () => {
    const facet = attributeFacet({ name: "Tag", cardinality: "prohibited" });

    expect(evaluateRequirement(makeElement({ attributes: {} }), facet)).toEqual({
      passed: true,
      message: "",
    });
    const failure = evaluateRequirement(makeElement({ attributes: { Tag: { value: "W-1" } } }), facet);
    expect(failure.passed).toBe(false);
    expect(failure.message).toContain("must not be filled in");
    expect(failure.message).toContain("W-1");
  });

  it("passes a property facet whose property set is absent", () => {
    const facet = propertyFacet({ cardinality: "prohibited" });
    expect(evaluateRequirement(makeElement({ propertySets: {} }), facet).passed).toBe(true);
    expect(
      evaluateRequirement(
        makeElement({ propertySets: { Pset_WallCommon: { FireRating: { value: "REI60" } } } }),
        facet
      ).passed
    ).toBe(false);
  });

  it("ignores any restriction when the facet is prohibited", () => {
    const facet = attributeFacet({
      name: "Tag",
      cardinality: "prohibited",
      restriction: { kind: "exact", value: "W-1" },
    });
    expect(evaluateRequirement(makeElement({ attributes: { Tag: { value: "W-1" } } }), facet).passed).toBe(false);
  });
});

describe("evaluateRequirement — numeric bounds", () => {
  const stored = (value: number) =>
    makeElement({ propertySets: { Pset_WallCommon: { Foo: { value, dataType: "IFCREAL" } } } });
  const between = (min: number, max: number, inclusive: boolean) =>
    propertyFacet({
      baseName: "Foo",
      dataType: "IFCREAL",
      restriction: {
        kind: "bounds",
        min: { value: min, inclusive },
        max: { value: max, inclusive },
      },
    });

  it.each([0, 5, 10])("accepts %s inside an inclusive 0..10", (value) => {
    expect(evaluateRequirement(stored(value), between(0, 10, true)).passed).toBe(true);
  });

  it.each([-0.1, 100])("rejects %s outside an inclusive 0..10", (value) => {
    expect(evaluateRequirement(stored(value), between(0, 10, false)).passed).toBe(false);
  });

  it("excludes both edges when the bounds are exclusive", () => {
    expect(evaluateRequirement(stored(5), between(0, 10, false)).passed).toBe(true);
    expect(evaluateRequirement(stored(0), between(0, 10, false)).passed).toBe(false);
    expect(evaluateRequirement(stored(10), between(0, 10, false)).passed).toBe(false);
  });

  it("checks only the edge that is stated", () => {
    const atLeast = propertyFacet({
      baseName: "Foo",
      dataType: "IFCREAL",
      restriction: { kind: "bounds", min: { value: 0, inclusive: true }, max: null },
    });
    expect(evaluateRequirement(stored(1e9), atLeast).passed).toBe(true);
    expect(evaluateRequirement(stored(-1), atLeast).passed).toBe(false);
  });

  // The tolerance rule that governs equality explicitly does not reach ranges, which is what lets
  // an author write a range to mean "exactly this, no tolerance". A tolerant bound would approve
  // both of these, and the suite states both as documents that must fail.
  it("compares exactly, with none of the equality tolerance", () => {
    const atLeastZero = propertyFacet({
      baseName: "Foo",
      dataType: "IFCREAL",
      restriction: { kind: "bounds", min: { value: 0, inclusive: true }, max: null },
    });
    expect(evaluateRequirement(stored(-1e-7), atLeastZero).passed).toBe(false);

    const exactly42 = between(42, 42, true);
    expect(evaluateRequirement(stored(42), exactly42).passed).toBe(true);
    expect(evaluateRequirement(stored(42.0000001), exactly42).passed).toBe(false);
  });

  it("fails a value that is not a number rather than stringifying it into the range", () => {
    const element = makeElement({
      propertySets: { Pset_WallCommon: { Foo: { value: "5" } } },
    });
    const facet = propertyFacet({
      baseName: "Foo",
      dataType: null,
      restriction: {
        kind: "bounds",
        min: { value: 0, inclusive: true },
        max: { value: 10, inclusive: true },
      },
    });
    const result = evaluateRequirement(element, facet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain(">= 0");
  });

  it("passes when any candidate of a multi-valued property is in range", () => {
    const element = makeElement({
      propertySets: { Pset_WallCommon: { Foo: { value: "1000, 3000", values: [1000, 3000] } } },
    });
    expect(evaluateRequirement(element, between(2000, 4000, true)).passed).toBe(true);
    expect(evaluateRequirement(element, between(4000, 5000, true)).passed).toBe(false);
  });
});

describe("evaluateRequirement — floating-point equality tolerance", () => {
  const storedReal = (value: number) =>
    makeElement({ propertySets: { Pset_WallCommon: { Foo: { value, dataType: "IFCREAL" } } } });
  const wants = (literal: string) =>
    propertyFacet({ baseName: "Foo", dataType: "IFCREAL", restriction: { kind: "exact", value: literal } });

  // The boundary values from the implementers' document's own table, which is also where the
  // conformance suite draws its pass/fail pairs from. Each pass sits exactly ON the edge, so
  // these pin the arithmetic and not merely the idea of a tolerance.
  const edges: [string, number, number][] = [
    // literal, on the edge (passes), just past it (fails)
    ["1.", 0.999998, 0.9999979],
    ["1.", 1.000002, 1.0000021],
    ["0.", 0.000001, 0.0000011],
    ["0.", -0.000001, -0.0000011],
    ["100000.", 99999.899999, 99999.8999989],
    ["100000.", 100000.100001, 100000.1000011],
    ["-1000000.", -1000001.000001, -1000001.0000011],
    ["-1000000.", -999998.999999, -999998.9999989],
    ["0.0000001", 0.0000011000001, 0.00000110000011],
    ["-0.0000001", -0.0000011000001, -0.00000110000011],
  ];

  it.each(edges)("accepts %s at the tolerance edge (%s)", (literal, onEdge) => {
    expect(evaluateRequirement(storedReal(onEdge), wants(literal)).passed).toBe(true);
  });

  it.each(edges)("rejects %s just beyond the tolerance edge (%s -> %s)", (literal, _onEdge, beyond) => {
    expect(evaluateRequirement(storedReal(beyond), wants(literal)).passed).toBe(false);
  });

  it("applies the tolerance inside an enum restriction too", () => {
    const facet = propertyFacet({
      baseName: "Foo",
      dataType: "IFCREAL",
      restriction: { kind: "enum", values: ["7.5", "1.0"] },
    });
    expect(evaluateRequirement(storedReal(0.999998), facet).passed).toBe(true);
    expect(evaluateRequirement(storedReal(0.9999979), facet).passed).toBe(false);
  });

  // A relative tolerance on a large integer would span the whole numbers either side of it and
  // approve one of them. IDS grants the tolerance to floating-point numbers only.
  it("withholds the tolerance from a value the schema types as an integer", () => {
    const element = makeElement({
      propertySets: { Pset_WallCommon: { Foo: { value: 100000000, dataType: "IFCINTEGER" } } },
    });
    const facet = (value: string) =>
      propertyFacet({ baseName: "Foo", dataType: "IFCINTEGER", restriction: { kind: "exact", value } });

    expect(evaluateRequirement(element, facet("100000000")).passed).toBe(true);
    expect(evaluateRequirement(element, facet("100000001")).passed).toBe(false);
  });

  it("leaves a string comparison exact", () => {
    const element = makeElement({ propertySets: { Pset_WallCommon: { Foo: { value: "1.0" } } } });
    const facet = propertyFacet({
      baseName: "Foo",
      dataType: null,
      restriction: { kind: "exact", value: "1.000000" },
    });
    expect(evaluateRequirement(element, facet).passed).toBe(false);
  });
});

describe("evaluateRequirement — unit conversion", () => {
  const MILLIMETRES = { IFCLENGTHMEASURE: 1e-3 };
  const storedLength = (value: number | undefined, values?: number[]) =>
    makeElement({
      propertySets: {
        Pset_WallCommon: {
          Foo: { value: value ?? "1000, 3000", values, dataType: "IFCLENGTHMEASURE" },
        },
      },
    });
  const wantsMetres = (literal: string) =>
    propertyFacet({
      baseName: "Foo",
      dataType: "IFCLENGTHMEASURE",
      restriction: { kind: "exact", value: literal },
    });

  // The pair the suite states: IDS nominates metres, so a millimetre model storing 2000 satisfies
  // "2" and one storing 2 does not. Comparing the raw numbers gets both exactly backwards, and the
  // "2 stored, 2 asked" case is a false pass — the direction that matters most.
  it("passes 2000 mm against a required 2 m", () => {
    expect(evaluateRequirement(storedLength(2000), wantsMetres("2"), MILLIMETRES).passed).toBe(true);
  });

  it("fails 2 mm against a required 2 m", () => {
    expect(evaluateRequirement(storedLength(2), wantsMetres("2"), MILLIMETRES).passed).toBe(false);
  });

  it("compares raw when the model declares no scaling for that measure", () => {
    expect(evaluateRequirement(storedLength(2), wantsMetres("2"), {}).passed).toBe(true);
    expect(evaluateRequirement(storedLength(2000), wantsMetres("2"), {}).passed).toBe(false);
  });

  it("scales every candidate of a multi-valued property", () => {
    const element = storedLength(undefined, [1000, 3000, 5000]);
    expect(evaluateRequirement(element, wantsMetres("3"), MILLIMETRES).passed).toBe(true);
    expect(evaluateRequirement(element, wantsMetres("2"), MILLIMETRES).passed).toBe(false);
  });

  it("scales before a bounds comparison too", () => {
    const between = (min: number, max: number) =>
      propertyFacet({
        baseName: "Foo",
        dataType: "IFCLENGTHMEASURE",
        restriction: {
          kind: "bounds",
          min: { value: min, inclusive: true },
          max: { value: max, inclusive: true },
        },
      });
    expect(evaluateRequirement(storedLength(3000), between(1, 5), MILLIMETRES).passed).toBe(true);
    expect(evaluateRequirement(storedLength(3000), between(1000, 5000), MILLIMETRES).passed).toBe(false);
  });

  // The scale belongs to the measure the model stored, and a slot with no measure type has no
  // unit to convert from — scaling one anyway would rescale plain reals and counts.
  it("leaves a value with no stored measure type alone", () => {
    const element = makeElement({
      propertySets: { Pset_WallCommon: { Foo: { value: 2000 } } },
    });
    const facet = propertyFacet({
      baseName: "Foo",
      dataType: null,
      restriction: { kind: "exact", value: "2000" },
    });
    expect(evaluateRequirement(element, facet, MILLIMETRES).passed).toBe(true);
  });

  it("leaves a non-numeric value alone", () => {
    const element = makeElement({
      propertySets: { Pset_WallCommon: { Foo: { value: "REI60", dataType: "IFCLENGTHMEASURE" } } },
    });
    const facet = propertyFacet({
      baseName: "Foo",
      dataType: "IFCLENGTHMEASURE",
      restriction: { kind: "exact", value: "REI60" },
    });
    expect(evaluateRequirement(element, facet, MILLIMETRES).passed).toBe(true);
  });
});

describe("evaluateRequirement — classification", () => {
  function classificationFacet(
    overrides: Partial<ParsedClassificationFacet> = {}
  ): ParsedClassificationFacet {
    return { kind: "classification", system: null, value: null, cardinality: "required", ...overrides };
  }

  const uniclass = { system: "Uniclass 2015", identifications: ["EF_25_10", "EF_25"] };
  const nlsfb = { system: "NL/SfB", identifications: ["21"] };

  it("matches a parent code against an element classified under one of its children", () => {
    const element = makeElement({ classifications: [uniclass] });
    const facet = classificationFacet({ value: { kind: "exact", value: "EF_25" } });
    expect(evaluateRequirement(element, facet).passed).toBe(true);
  });

  it("requires system and value to be satisfied by the same reference", () => {
    const element = makeElement({ classifications: [uniclass, nlsfb] });
    // Both strings are present on the element, but never together on one reference.
    const facet = classificationFacet({
      system: { kind: "exact", value: "NL/SfB" },
      value: { kind: "exact", value: "EF_25_10" },
    });
    expect(evaluateRequirement(element, facet).passed).toBe(false);
  });

  it("treats a facet stating neither parameter as a check that the element is classified", () => {
    const facet = classificationFacet();
    expect(evaluateRequirement(makeElement({ classifications: [nlsfb] }), facet).passed).toBe(true);
    expect(evaluateRequirement(makeElement({ classifications: [] }), facet).passed).toBe(false);
  });

  it("waives an optional facet only when the element carries no classification at all", () => {
    const facet = classificationFacet({
      cardinality: "optional",
      value: { kind: "exact", value: "EF_25_10" },
    });

    expect(evaluateRequirement(makeElement({ classifications: [] }), facet).passed).toBe(true);
    expect(evaluateRequirement(makeElement({ classifications: [uniclass] }), facet).passed).toBe(true);

    // Classified, but not as the facet asks. The waiver must not extend to it — scoping the
    // waiver by system instead would approve an element whose only classification names a
    // system the facet does not accept, which the suite states as a document that must fail.
    expect(evaluateRequirement(makeElement({ classifications: [nlsfb] }), facet).passed).toBe(false);
  });

  it("inverts for a prohibited facet", () => {
    const facet = classificationFacet({
      cardinality: "prohibited",
      value: { kind: "exact", value: "EF_25_10" },
    });
    expect(evaluateRequirement(makeElement({ classifications: [uniclass] }), facet).passed).toBe(false);
    expect(evaluateRequirement(makeElement({ classifications: [nlsfb] }), facet).passed).toBe(true);
  });

  it("does not match a classification code against a numeric range", () => {
    const element = makeElement({ classifications: [nlsfb] });
    const facet = classificationFacet({
      value: { kind: "bounds", min: { value: 0, inclusive: true }, max: { value: 99, inclusive: true } },
    });
    expect(evaluateRequirement(element, facet).passed).toBe(false);
  });
});
