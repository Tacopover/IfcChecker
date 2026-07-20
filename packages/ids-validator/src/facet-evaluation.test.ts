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
});

describe("evaluateRequirement — attribute facet", () => {
  const patternFacet: ParsedAttributeFacet = {
    kind: "attribute",
    name: "Name",
    patternSource: "W-\\d+",
    pattern: /^(?:W-\d+)$/,
  };

  it("passes when the top-level Name attribute matches the pattern", () => {
    const result = evaluateRequirement(makeElement({ name: "W-001" }), patternFacet);
    expect(result).toEqual({ passed: true, message: "" });
  });

  it("fails when the top-level Name attribute does not match the pattern", () => {
    const result = evaluateRequirement(makeElement({ name: "West Wall" }), patternFacet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Name");
  });

  it("fails when the attribute is missing entirely", () => {
    const presenceFacet: ParsedAttributeFacet = {
      kind: "attribute",
      name: "Tag",
      patternSource: null,
      pattern: null,
    };
    const result = evaluateRequirement(makeElement({ attributes: {} }), presenceFacet);
    expect(result).toEqual({ passed: false, message: 'Attribute "Tag" is missing' });
  });

  it("falls back to the attributes bag for non-top-level attribute names", () => {
    const presenceFacet: ParsedAttributeFacet = {
      kind: "attribute",
      name: "Tag",
      patternSource: null,
      pattern: null,
    };
    const result = evaluateRequirement(makeElement({ attributes: { Tag: "W-001" } }), presenceFacet);
    expect(result).toEqual({ passed: true, message: "" });
  });
});

describe("evaluateRequirement — property facet", () => {
  const propertyFacet: ParsedPropertyFacet = {
    kind: "property",
    propertySet: "Pset_WallCommon",
    baseName: "FireRating",
    dataType: "IFCLABEL",
  };

  it("passes when the property set and base name are present", () => {
    const element = makeElement({ propertySets: { Pset_WallCommon: { FireRating: "REI60" } } });
    expect(evaluateRequirement(element, propertyFacet)).toEqual({ passed: true, message: "" });
  });

  it("fails when the property set is missing entirely", () => {
    const element = makeElement({ propertySets: {} });
    const result = evaluateRequirement(element, propertyFacet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Pset_WallCommon");
  });

  it("fails when the property set exists but the base name is missing", () => {
    const element = makeElement({ propertySets: { Pset_WallCommon: {} } });
    const result = evaluateRequirement(element, propertyFacet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("FireRating");
  });
});
