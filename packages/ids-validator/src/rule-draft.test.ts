import { describe, expect, it } from "vitest";
import type { ConditionDraft, RuleDraft } from "./rule-draft.js";
import {
  applicabilityEntityNamesOf,
  cardinalityForCondition,
  compileDraft,
  escapeRegExp,
  restrictionForCondition,
} from "./rule-draft.js";

function condition(overrides: Partial<ConditionDraft> = {}): ConditionDraft {
  return {
    id: "c1",
    kind: "attribute",
    propertySet: null,
    name: "Name",
    operator: "exists",
    values: [],
    text: "",
    ...overrides,
  };
}

function rule(overrides: Partial<RuleDraft> = {}): RuleDraft {
  return {
    id: "r1",
    name: "Rule",
    entityTypes: ["IfcWall"],
    conditions: [],
    ...overrides,
  };
}

describe("escapeRegExp", () => {
  it("neutralises every regex metacharacter", () => {
    const escaped = escapeRegExp("A.B(C)[D]*+?^${}|\\");
    expect(new RegExp(`^${escaped}$`).test("A.B(C)[D]*+?^${}|\\")).toBe(true);
    expect(new RegExp(`^${escaped}$`).test("AXB(C)[D]*+?^${}|\\")).toBe(false);
  });
});

describe("restrictionForCondition", () => {
  it("returns no restriction for exists and notExists", () => {
    expect(restrictionForCondition(condition({ operator: "exists" }))).toBeNull();
    expect(restrictionForCondition(condition({ operator: "notExists" }))).toBeNull();
  });

  it("maps equals to an exact restriction and oneOf to an enum", () => {
    expect(restrictionForCondition(condition({ operator: "equals", text: "W-1" }))).toEqual({
      kind: "exact",
      value: "W-1",
    });
    expect(restrictionForCondition(condition({ operator: "oneOf", values: ["SA", "RA"] }))).toEqual({
      kind: "enum",
      values: ["SA", "RA"],
    });
  });

  it("escapes literal text before composing contains/startsWith/endsWith patterns", () => {
    const contains = restrictionForCondition(condition({ operator: "contains", text: "A.B" }));
    if (contains?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(contains.source).toBe(".*A\\.B.*");
    expect(contains.regex.test("xxA.Byy")).toBe(true);
    expect(contains.regex.test("xxAZByy")).toBe(false);
  });

  it("produces a usable pattern from text that would otherwise be an invalid regex", () => {
    const startsWith = restrictionForCondition(condition({ operator: "startsWith", text: "(dev)" }));
    if (startsWith?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(startsWith.source).toBe("\\(dev\\).*");
    expect(startsWith.regex.test("(dev)-01")).toBe(true);
    expect(startsWith.regex.test("dev-01")).toBe(false);
  });

  it("anchors endsWith to the end of the value", () => {
    const endsWith = restrictionForCondition(condition({ operator: "endsWith", text: "-01" }));
    if (endsWith?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(endsWith.source).toBe(".*-01");
    expect(endsWith.regex.test("W-01")).toBe(true);
    expect(endsWith.regex.test("W-01-x")).toBe(false);
  });

  it("passes a matches pattern through unescaped", () => {
    const matches = restrictionForCondition(condition({ operator: "matches", text: "W-\\d+" }));
    if (matches?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(matches.source).toBe("W-\\d+");
    expect(matches.regex.test("W-12")).toBe(true);
  });
});

describe("cardinalityForCondition", () => {
  it("only notExists is prohibited", () => {
    expect(cardinalityForCondition(condition({ operator: "notExists" }))).toBe("prohibited");
    expect(cardinalityForCondition(condition({ operator: "exists" }))).toBe("required");
    expect(cardinalityForCondition(condition({ operator: "equals" }))).toBe("required");
  });
});

describe("applicabilityEntityNamesOf", () => {
  it("expands an abstract type into its concrete subtypes and drops the abstract name", () => {
    const names = applicabilityEntityNamesOf(rule({ entityTypes: ["IfcElement"] }));

    expect(names).not.toContain("IFCELEMENT");
    expect(names).not.toContain("IFCBUILTELEMENT"); // abstract in IFC4X3, absent from IFC4
    expect(names).not.toContain("IFCBUILDINGELEMENT"); // abstract
    expect(names).toContain("IFCWALL");
    expect(names).toContain("IFCDOOR");
    expect(names).toContain("IFCSANITARYTERMINAL");
  });

  it("keeps a concrete type and adds the concrete types below it", () => {
    expect(applicabilityEntityNamesOf(rule({ entityTypes: ["IfcWall"] }))).toEqual([
      "IFCWALL",
      "IFCWALLELEMENTEDCASE",
      "IFCWALLSTANDARDCASE",
    ]);
  });

  it("leaves a concrete leaf type alone", () => {
    expect(applicabilityEntityNamesOf(rule({ entityTypes: ["IfcSanitaryTerminal"] }))).toEqual([
      "IFCSANITARYTERMINAL",
    ]);
  });

  it("does not repeat a type reachable from two selections", () => {
    const names = applicabilityEntityNamesOf(rule({ entityTypes: ["IfcWall", "IfcWallStandardCase"] }));
    expect(names.filter((name) => name === "IFCWALLSTANDARDCASE")).toHaveLength(1);
  });

  // Rewriting the author's own entity list is the thing the import work exists not to do. A file
  // naming an abstract class is reported as selecting nothing, which is what any checker does.
  it("leaves an imported rule's names exactly as the source wrote them", () => {
    const imported = rule({
      entityTypes: ["IfcElement"],
      imported: {
        attributes: {},
        entityNamesAsEnumeration: false,
        applicabilityAttributes: {},
        requirementsAttributes: {},
        passThrough: [],
      },
    });
    expect(applicabilityEntityNamesOf(imported)).toEqual(["IFCELEMENT"]);
  });

  it("keeps a name the schema table does not know", () => {
    expect(applicabilityEntityNamesOf(rule({ entityTypes: ["IfcNotAThing"] }))).toEqual(["IFCNOTATHING"]);
  });
});

describe("compileDraft", () => {
  it("uppercases applicability entity names and keeps the rule name", () => {
    const [spec] = compileDraft([rule({ name: "Sanitary", entityTypes: ["IfcSanitaryTerminal", "ifcBoiler"] })]);
    expect(spec.name).toBe("Sanitary");
    expect(spec.applicabilityEntityNames).toEqual(["IFCSANITARYTERMINAL", "IFCBOILER"]);
  });

  it("compiles the same entity names the exported file states", () => {
    const walls = rule({ entityTypes: ["IfcWall"] });
    const [spec] = compileDraft([walls]);
    expect(spec.applicabilityEntityNames).toEqual(applicabilityEntityNamesOf(walls));
  });

  it("emits one requirement per condition, in condition order", () => {
    const [spec] = compileDraft([
      rule({
        conditions: [
          condition({ id: "a", kind: "property", propertySet: "MEP_Data", name: "SystemAbbreviation" }),
          condition({ id: "b", name: "Tag" }),
        ],
      }),
    ]);

    expect(spec.requirements).toEqual([
      {
        kind: "property",
        propertySet: "MEP_Data",
        baseName: "SystemAbbreviation",
        dataType: "IFCLABEL",
        restriction: null,
        cardinality: "required",
      },
      { kind: "attribute", name: "Tag", restriction: null, cardinality: "required" },
    ]);
  });

  it("marks a notExists condition prohibited with no restriction", () => {
    const [spec] = compileDraft([
      rule({ conditions: [condition({ name: "Tag", operator: "notExists", text: "ignored" })] }),
    ]);

    expect(spec.requirements[0]).toEqual({
      kind: "attribute",
      name: "Tag",
      restriction: null,
      cardinality: "prohibited",
    });
  });

  it("falls back to an empty property set name when a property condition has none", () => {
    const [spec] = compileDraft([
      rule({ conditions: [condition({ kind: "property", propertySet: null, name: "X" })] }),
    ]);
    const [facet] = spec.requirements;
    if (facet.kind !== "property") throw new Error("expected a property facet");
    expect(facet.propertySet).toBe("");
  });

  it("returns one specification per rule and an empty list for no rules", () => {
    expect(compileDraft([])).toEqual([]);
    expect(compileDraft([rule({ id: "a" }), rule({ id: "b" })])).toHaveLength(2);
  });
});
