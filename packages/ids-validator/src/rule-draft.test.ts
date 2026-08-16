import { describe, expect, it } from "vitest";
import type {
  ConditionDraft,
  ConditionOperator,
  ConditionalCardinality,
  RuleDraft,
  ValueDraft,
} from "./rule-draft.js";
import {
  affixReadingOf,
  applicabilityEntityNamesOf,
  carryAnnotation,
  compileDraft,
  compileValue,
  escapeRegExp,
  friendlyReadingOf,
  patternValueDraft,
  plainName,
  valueDraftForOperator,
} from "./rule-draft.js";

/**
 * Spelled out rather than derived from `Partial<ConditionDraft>`, because `name` and `propertySet`
 * are written here as the plain names a builder row states, and the draft holds a `ValueDraft`.
 */
interface ConditionOverrides {
  id?: string;
  kind?: ConditionDraft["kind"];
  name?: string;
  propertySet?: string | null;
  value?: ValueDraft | null;
  cardinality?: ConditionalCardinality;
  dataType?: string | null;
  uri?: string | null;
  instructions?: string | null;
  explicitCardinality?: boolean;
  operator?: ConditionOperator;
  text?: string;
  values?: string[];
}

function condition(overrides: ConditionOverrides = {}): ConditionDraft {
  const {
    operator = "exists",
    text = "",
    values = [],
    name = "Name",
    propertySet = null,
    ...rest
  } = overrides;
  return {
    id: "c1",
    kind: "attribute",
    value: valueDraftForOperator(operator, text, values),
    cardinality: "required",
    ...rest,
    name: plainName(name),
    propertySet: propertySet === null ? null : plainName(propertySet),
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
  it("returns no restriction for exists", () => {
    expect(restrictionFor("exists")).toBeNull();
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

describe("the friendly operators are a reading of the value, not the storage", () => {
  const OPERATORS: ConditionOperator[] = [
    "exists",
    "equals",
    "oneOf",
    "contains",
    "startsWith",
    "endsWith",
    "matches",
  ];

  // The row has to survive being read back: the operator select must stay where the user put it,
  // and the box beside it must still hold what they typed.
  it("reads every operator back as itself, with the text or values it was given", () => {
    for (const operator of OPERATORS) {
      const needsValues = operator === "oneOf";
      const text = needsValues ? "" : "A.B(C)";
      const values = needsValues ? ["SA", "RA"] : [];
      const reading = friendlyReadingOf(condition({ operator, text, values }).value);

      expect(reading).toEqual({
        operator,
        text: operator === "exists" ? "" : text,
        values,
      });
    }
  });

  // An empty box is the state every affix row starts in. Deriving the operator from the compiled
  // pattern alone would read ".*.*" back as "must match pattern" and move the select as the user
  // cleared the field.
  it("holds an affix operator whose text is still empty", () => {
    for (const operator of ["contains", "startsWith", "endsWith"] as const) {
      expect(friendlyReadingOf(condition({ operator, text: "" }).value)).toEqual({
        operator,
        text: "",
        values: [],
      });
    }
  });

  it("has no reading for the two value shapes no operator states", () => {
    // A range.
    expect(
      friendlyReadingOf({ kind: "bounds", base: "xs:double", min: null, max: null })
    ).toBeNull();
    // A length.
    expect(
      friendlyReadingOf({ kind: "length", exact: "2", min: null, max: null })
    ).toBeNull();
  });

  // The reading is of the value alone, so the row can state cardinality beside it. "Must not be
  // Steel" is a prohibited facet that still names a value, and there is no operator for it —
  // folding the two questions together is what used to leave it, and every optional facet,
  // with no reading at all.
  it("reads the value the same way whatever the cardinality states", () => {
    const equalsSteel = { operator: "equals", text: "Steel", values: [] };

    for (const cardinality of ["required", "optional", "prohibited"] as const) {
      expect(
        friendlyReadingOf(condition({ cardinality, value: { kind: "simple", value: "Steel" } }).value)
      ).toEqual(equalsSteel);
      expect(friendlyReadingOf(condition({ cardinality }).value)).toEqual({
        operator: "exists",
        text: "",
        values: [],
      });
    }
  });
});

describe("patternValueDraft", () => {
  it("reads a pattern an affix operator would have written back as that operator", () => {
    expect(patternValueDraft([".*A\\.B.*"])).toEqual({
      kind: "affix",
      operator: "contains",
      literal: "A.B",
    });
    expect(patternValueDraft(["\\(dev\\).*"])).toEqual({
      kind: "affix",
      operator: "startsWith",
      literal: "(dev)",
    });
  });

  // Claiming a source the affix form would not rebuild exactly would edit the author's regex.
  it("keeps anything else as the author's own pattern", () => {
    expect(patternValueDraft(["W-\\d+"])).toEqual({ kind: "pattern", sources: ["W-\\d+"] });
    expect(patternValueDraft([".*[A-Z].*"])).toEqual({ kind: "pattern", sources: [".*[A-Z].*"] });
    expect(affixReadingOf(".*")).toBeNull();
  });

  // Several sources are a disjunction, which no affix states — ".*A.*" alone is "contains A", and
  // the same source beside another is not. Claiming one would drop the other on the way back out.
  it("never claims an affix reading for several patterns at once", () => {
    expect(patternValueDraft([".*A\\.B.*", "W-\\d+"])).toEqual({
      kind: "pattern",
      sources: [".*A\\.B.*", "W-\\d+"],
    });
  });

  // A disjunction of anchored patterns is one anchored pattern, which is what lets the compiled
  // restriction stay a single regex and the evaluator stay untouched.
  it("compiles several sources into the disjunction XSD reads them as", () => {
    const compiled = compileValue({ kind: "pattern", sources: ["[a-z]{2}[0-9]{2}", "[A-Z]{2}[0-9]{2}"] });
    if (compiled?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(compiled.regex.test("XY99")).toBe(true);
    expect(compiled.regex.test("xy99")).toBe(true);
    expect(compiled.regex.test("Xy99")).toBe(false);
  });

  it("rebuilds every affix pattern it claims character for character", () => {
    for (const source of [".*A\\.B.*", "\\(dev\\).*", ".*-01", ".*x.*"]) {
      const draft = patternValueDraft([source]) as Extract<ValueDraft, { kind: "affix" }>;
      const compiled = compileValue(draft);
      if (compiled?.kind !== "pattern") throw new Error("expected a pattern restriction");
      expect(compiled.source).toBe(source);
    }
  });
});

describe("carryAnnotation", () => {
  const documented: ValueDraft = { kind: "pattern", sources: ["D.*"], annotation: "Why this exists" };

  it("moves the prose onto whatever restriction replaces the one it documented", () => {
    expect(carryAnnotation(documented, { kind: "enum", values: ["A"] })).toEqual({
      kind: "enum",
      values: ["A"],
      annotation: "Why this exists",
    });
  });

  // A <simpleValue> has no <xs:restriction> to hold an annotation, so this is the one edit that
  // loses it — stated here rather than discovered from an exported file missing a sentence.
  it("drops it where the new value has no restriction to hold one", () => {
    expect(carryAnnotation(documented, { kind: "simple", value: "D-01" })).toEqual({
      kind: "simple",
      value: "D-01",
    });
  });

  it("leaves a value alone when there was no prose to carry", () => {
    const plain: ValueDraft = { kind: "pattern", sources: ["D.*"] };
    expect(carryAnnotation(plain, { kind: "enum", values: ["A"] })).toEqual({
      kind: "enum",
      values: ["A"],
    });
    expect(carryAnnotation(null, documented)).toEqual(documented);
    expect(carryAnnotation(documented, null)).toBeNull();
  });

  // Prose is not a constraint, so it must not reach the engine. `compileValue` drops it with
  // everything else that records how the file was written.
  it("states nothing the validator checks", () => {
    expect(compileValue(documented)).toEqual(compileValue({ kind: "pattern", sources: ["D.*"] }));
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
    expect(spec.applicability.entityNames).toEqual(["IFCSANITARYTERMINAL", "IFCBOILER"]);
  });

  it("compiles the same entity names the exported file states", () => {
    const walls = rule({ entityTypes: ["IfcWall"] });
    const [spec] = compileDraft([walls]);
    expect(spec.applicability.entityNames).toEqual(applicabilityEntityNamesOf(walls));
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
        propertySet: { kind: "exact", value: "MEP_Data" },
        baseName: { kind: "exact", value: "SystemAbbreviation" },
        // Nothing was chosen, so nothing is declared: a dataType the model does not hold fails
        // every element, and only the file can say which one it holds.
        dataType: null,
        restriction: null,
        cardinality: "required",
      },
      {
        kind: "attribute",
        name: { kind: "exact", value: "Tag" },
        restriction: null,
        cardinality: "required",
      },
    ]);
  });

  it("compiles a prohibited condition with no restriction", () => {
    const [spec] = compileDraft([
      rule({ conditions: [condition({ name: "Tag", cardinality: "prohibited" })] }),
    ]);

    expect(spec.requirements[0]).toEqual({
      kind: "attribute",
      name: { kind: "exact", value: "Tag" },
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
    expect(facet.propertySet).toEqual({ kind: "exact", value: "" });
  });

  it("returns one specification per rule and an empty list for no rules", () => {
    expect(compileDraft([])).toEqual([]);
    expect(compileDraft([rule({ id: "a" }), rule({ id: "b" })])).toHaveLength(2);
  });
});
