import { describe, expect, it } from "vitest";
import type { ConditionDraft, ConditionOperator, RuleDraft, ValueDraft } from "./rule-draft.js";
import {
  affixReadingOf,
  applicabilityEntityNamesOf,
  cardinalityForOperator,
  compileDraft,
  compileValue,
  escapeRegExp,
  friendlyReadingOf,
  patternValueDraft,
  valueDraftForOperator,
} from "./rule-draft.js";

function condition(
  overrides: Partial<ConditionDraft> & {
    operator?: ConditionOperator;
    text?: string;
    values?: string[];
  } = {}
): ConditionDraft {
  const { operator = "exists", text = "", values = [], ...rest } = overrides;
  return {
    id: "c1",
    kind: "attribute",
    propertySet: null,
    name: "Name",
    value: valueDraftForOperator(operator, text, values),
    cardinality: cardinalityForOperator(operator),
    ...rest,
    // `kind` widens back to the union through the spread, and a partial of a discriminated union
    // cannot narrow it again. Asserted here so the call sites stay one line each.
  } as ConditionDraft;
}

/** The restriction an operator's value compiles to, which is what the validator ends up checking. */
function restrictionFor(operator: ConditionOperator, text = "", values: string[] = []) {
  return compileValue(valueDraftForOperator(operator, text, values));
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

describe("compileValue", () => {
  it("returns no restriction for exists and notExists", () => {
    expect(restrictionFor("exists")).toBeNull();
    expect(restrictionFor("notExists")).toBeNull();
  });

  it("maps equals to an exact restriction and oneOf to an enum", () => {
    expect(restrictionFor("equals", "W-1")).toEqual({ kind: "exact", value: "W-1" });
    expect(restrictionFor("oneOf", "", ["SA", "RA"])).toEqual({
      kind: "enum",
      values: ["SA", "RA"],
    });
  });

  it("escapes literal text before composing contains/startsWith/endsWith patterns", () => {
    const contains = restrictionFor("contains", "A.B");
    if (contains?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(contains.source).toBe(".*A\\.B.*");
    expect(contains.regex.test("xxA.Byy")).toBe(true);
    expect(contains.regex.test("xxAZByy")).toBe(false);
  });

  it("produces a usable pattern from text that would otherwise be an invalid regex", () => {
    const startsWith = restrictionFor("startsWith", "(dev)");
    if (startsWith?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(startsWith.source).toBe("\\(dev\\).*");
    expect(startsWith.regex.test("(dev)-01")).toBe(true);
    expect(startsWith.regex.test("dev-01")).toBe(false);
  });

  it("anchors endsWith to the end of the value", () => {
    const endsWith = restrictionFor("endsWith", "-01");
    if (endsWith?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(endsWith.source).toBe(".*-01");
    expect(endsWith.regex.test("W-01")).toBe(true);
    expect(endsWith.regex.test("W-01-x")).toBe(false);
  });

  it("passes a matches pattern through unescaped", () => {
    const matches = restrictionFor("matches", "W-\\d+");
    if (matches?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(matches.source).toBe("W-\\d+");
    expect(matches.regex.test("W-12")).toBe(true);
  });

  it("compiles a range, and drops an edge that is not a number rather than comparing NaN", () => {
    const range = (value: string): ValueDraft => ({
      kind: "bounds",
      base: "xs:double",
      min: { value, inclusive: true },
      max: null,
    });

    expect(compileValue(range("10"))).toEqual({
      kind: "bounds",
      min: { value: 10, inclusive: true },
      max: null,
    });
    // Every comparison against NaN answers false, so a bad edge would reject silently.
    expect(compileValue(range("ten"))).toEqual({ kind: "bounds", min: null, max: null });
  });

  // The base is the author's, not ours: real files write a range as xs:double, xs:integer, and
  // even a capitalised xs:Decimal. It is carried so the export can hand back what came in.
  it("carries the base without letting it reach the compiled restriction", () => {
    const compiled = compileValue({
      kind: "bounds",
      base: "xs:Decimal",
      min: null,
      max: { value: "5", inclusive: false },
    });

    expect(compiled).toEqual({ kind: "bounds", min: null, max: { value: 5, inclusive: false } });
  });

  it("compiles a length, reading each count back as a number", () => {
    expect(compileValue({ kind: "length", exact: null, min: "2", max: "03" })).toEqual({
      kind: "length",
      exact: null,
      min: 2,
      max: 3,
    });
  });
});

describe("cardinalityForOperator", () => {
  it("only notExists is prohibited", () => {
    expect(cardinalityForOperator("notExists")).toBe("prohibited");
    expect(cardinalityForOperator("exists")).toBe("required");
    expect(cardinalityForOperator("equals")).toBe("required");
  });
});

describe("the friendly operators are a reading of the value, not the storage", () => {
  const OPERATORS: ConditionOperator[] = [
    "exists",
    "equals",
    "oneOf",
    "contains",
    "startsWith",
    "endsWith",
    "matches",
    "notExists",
  ];

  // The row has to survive being read back: the operator select must stay where the user put it,
  // and the box beside it must still hold what they typed.
  it("reads every operator back as itself, with the text or values it was given", () => {
    for (const operator of OPERATORS) {
      const needsValues = operator === "oneOf";
      const text = needsValues ? "" : "A.B(C)";
      const values = needsValues ? ["SA", "RA"] : [];
      const reading = friendlyReadingOf(condition({ operator, text, values }));

      expect(reading).toEqual({
        operator,
        text: operator === "exists" || operator === "notExists" ? "" : text,
        values,
      });
    }
  });

  // An empty box is the state every affix row starts in. Deriving the operator from the compiled
  // pattern alone would read ".*.*" back as "must match pattern" and move the select as the user
  // cleared the field.
  it("holds an affix operator whose text is still empty", () => {
    for (const operator of ["contains", "startsWith", "endsWith"] as const) {
      expect(friendlyReadingOf(condition({ operator, text: "" }))).toEqual({
        operator,
        text: "",
        values: [],
      });
    }
  });

  it("has no reading for what the eight operators cannot say", () => {
    // A range.
    expect(
      friendlyReadingOf(condition({ value: { kind: "bounds", base: "xs:double", min: null, max: null } }))
    ).toBeNull();
    // A length.
    expect(
      friendlyReadingOf(condition({ value: { kind: "length", exact: "2", min: null, max: null } }))
    ).toBeNull();
    // "Must not be Steel" — notExists would widen it to "must not be present at all".
    expect(
      friendlyReadingOf(
        condition({ cardinality: "prohibited", value: { kind: "simple", value: "Steel" } })
      )
    ).toBeNull();
    expect(friendlyReadingOf(condition({ cardinality: "optional" }))).toBeNull();
  });
});

describe("patternValueDraft", () => {
  it("reads a pattern an affix operator would have written back as that operator", () => {
    expect(patternValueDraft(".*A\\.B.*")).toEqual({
      kind: "affix",
      operator: "contains",
      literal: "A.B",
    });
    expect(patternValueDraft("\\(dev\\).*")).toEqual({
      kind: "affix",
      operator: "startsWith",
      literal: "(dev)",
    });
  });

  // Claiming a source the affix form would not rebuild exactly would edit the author's regex.
  it("keeps anything else as the author's own pattern", () => {
    expect(patternValueDraft("W-\\d+")).toEqual({ kind: "pattern", source: "W-\\d+" });
    expect(patternValueDraft(".*[A-Z].*")).toEqual({ kind: "pattern", source: ".*[A-Z].*" });
    expect(affixReadingOf(".*")).toBeNull();
  });

  it("rebuilds every affix pattern it claims character for character", () => {
    for (const source of [".*A\\.B.*", "\\(dev\\).*", ".*-01", ".*x.*"]) {
      const draft = patternValueDraft(source) as Extract<ValueDraft, { kind: "affix" }>;
      const compiled = compileValue(draft);
      if (compiled?.kind !== "pattern") throw new Error("expected a pattern restriction");
      expect(compiled.source).toBe(source);
    }
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
        // Nothing was chosen, so nothing is declared: a dataType the model does not hold fails
        // every element, and only the file can say which one it holds.
        dataType: null,
        restriction: null,
        cardinality: "required",
      },
      { kind: "attribute", name: "Tag", restriction: null, cardinality: "required" },
    ]);
  });

  it("marks a notExists condition prohibited with no restriction", () => {
    const [spec] = compileDraft([
      rule({ conditions: [condition({ name: "Tag", operator: "notExists" })] }),
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
