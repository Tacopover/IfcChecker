import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { matchesApplicability, evaluateRequirement } from "./facet-evaluation.js";
import type { ParsedAttributeFacet, ParsedPropertyFacet } from "./parse-ids.js";

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
