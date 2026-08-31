import { describe, expect, it, vi } from "vitest";
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
  caseInsensitivePattern,
  carryAnnotation,
  carryCaseInsensitive,
  compileDraft,
  compileValue,
  effectiveCardinalityOf,
  escapeRegExp,
  friendlyReadingOf,
  nextOrGroupId,
  orGroupIdsInUse,
  orGroupSiblingsOf,
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

describe("caseInsensitivePattern", () => {
  it("folds every ASCII letter into a class matching either case", () => {
    expect(caseInsensitivePattern("Wall")).toBe("[Ww][Aa][Ll][Ll]");
  });

  it("still escapes regex metacharacters, so a literal dot or paren cannot over-match", () => {
    expect(caseInsensitivePattern("A.B(c)")).toBe("[Aa]\\.[Bb]\\([Cc]\\)");
  });

  it("leaves digits and other non-letters untouched", () => {
    expect(caseInsensitivePattern("L-01")).toBe("[Ll]-01");
  });
});

describe("compileValue — case-insensitive", () => {
  it("folds equals into a pattern restriction instead of an exact one", () => {
    const compiled = compileValue({ kind: "simple", value: "Level 1", caseInsensitive: true });
    if (compiled?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(compiled.regex.test("LEVEL 1")).toBe(true);
    expect(compiled.regex.test("level 1")).toBe(true);
    expect(compiled.regex.test("Level 2")).toBe(false);
  });

  it("leaves equals exact when the flag is off", () => {
    expect(compileValue({ kind: "simple", value: "Level 1" })).toEqual({
      kind: "exact",
      value: "Level 1",
    });
  });

  it("folds oneOf into a disjunction matching any listed value in any case", () => {
    const compiled = compileValue({
      kind: "enum",
      values: ["Level 1", "Level 2"],
      caseInsensitive: true,
    });
    if (compiled?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(compiled.regex.test("LEVEL 1")).toBe(true);
    expect(compiled.regex.test("level 2")).toBe(true);
    expect(compiled.regex.test("Level 3")).toBe(false);
  });

  it("folds an affix operator's literal, keeping the wildcard case-sensitive escaping otherwise unchanged", () => {
    const compiled = compileValue({
      kind: "affix",
      operator: "startsWith",
      literal: "GF",
      caseInsensitive: true,
    });
    if (compiled?.kind !== "pattern") throw new Error("expected a pattern restriction");

    expect(compiled.source).toBe("[Gg][Ff].*");
    expect(compiled.regex.test("gf-01")).toBe(true);
    expect(compiled.regex.test("01-gf")).toBe(false);
  });
});

describe("carryCaseInsensitive", () => {
  const folded: ValueDraft = { kind: "simple", value: "Level 1", caseInsensitive: true };

  it("carries the flag onto whatever value replaces the one that stated it", () => {
    expect(carryCaseInsensitive(folded, { kind: "enum", values: ["A"] })).toEqual({
      kind: "enum",
      values: ["A"],
      caseInsensitive: true,
    });
  });

  it("does not carry into a pattern, bounds, or length — the toggle is never shown beside those", () => {
    expect(carryCaseInsensitive(folded, { kind: "pattern", sources: ["A.*"] })).toEqual({
      kind: "pattern",
      sources: ["A.*"],
    });
    expect(
      carryCaseInsensitive(folded, { kind: "bounds", base: "xs:double", min: null, max: null })
    ).toEqual({ kind: "bounds", base: "xs:double", min: null, max: null });
  });

  it("leaves a value alone when there was nothing to carry", () => {
    const plain: ValueDraft = { kind: "simple", value: "x" };
    expect(carryCaseInsensitive(plain, { kind: "enum", values: ["A"] })).toEqual({
      kind: "enum",
      values: ["A"],
    });
    expect(carryCaseInsensitive(null, folded)).toEqual(folded);
    expect(carryCaseInsensitive(folded, null)).toBeNull();
  });
});

describe("applicabilityEntityNamesOf", () => {
  // `entityTypes` is the literal, final list for every rule, authored or imported alike — nothing
  // gets expanded here. A "add a type" or "expand" UI action is what writes a concrete list into
  // `entityTypes` before this function ever sees it.
  it("leaves an abstract type's name exactly as given", () => {
    expect(applicabilityEntityNamesOf(rule({ entityTypes: ["IfcElement"] }))).toEqual(["IFCELEMENT"]);
  });

  it("leaves a supertype's name exactly as given, without its subtypes", () => {
    expect(applicabilityEntityNamesOf(rule({ entityTypes: ["IfcWall"] }))).toEqual(["IFCWALL"]);
  });

  it("leaves a concrete leaf type alone", () => {
    expect(applicabilityEntityNamesOf(rule({ entityTypes: ["IfcSanitaryTerminal"] }))).toEqual([
      "IFCSANITARYTERMINAL",
    ]);
  });

  it("does not repeat a name reached under two different cases", () => {
    const names = applicabilityEntityNamesOf(rule({ entityTypes: ["IfcWall", "ifcwall"] }));
    expect(names).toEqual(["IFCWALL"]);
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

describe("orGroupSiblingsOf", () => {
  it("is empty for a rule with no identifier at all", () => {
    const solo = rule({ id: "r1" });
    expect(orGroupSiblingsOf([solo], solo)).toEqual([]);
  });

  it("is empty for a rule whose identifier is not this tool's OR-group prefix", () => {
    const solo = rule({ id: "r1", identifier: "REQ-042" });
    const other = rule({ id: "r2", identifier: "REQ-042" });
    expect(orGroupSiblingsOf([solo, other], solo)).toEqual([]);
  });

  it("finds the other members sharing the same group id, excluding itself", () => {
    const a = rule({ id: "r1", name: "Branch A", identifier: "ifcqa:or:g1" });
    const b = rule({ id: "r2", name: "Branch B", identifier: "ifcqa:or:g1" });
    const c = rule({ id: "r3", name: "Unrelated", identifier: "ifcqa:or:g2" });
    expect(orGroupSiblingsOf([a, b, c], a)).toEqual([b]);
    expect(orGroupSiblingsOf([a, b, c], b)).toEqual([a]);
  });

  it("is empty once every other member of the group is gone", () => {
    const a = rule({ id: "r1", identifier: "ifcqa:or:g1" });
    expect(orGroupSiblingsOf([a], a)).toEqual([]);
  });
});

describe("orGroupIdsInUse", () => {
  it("is empty when no rule carries an OR-group identifier", () => {
    const a = rule({ id: "r1" });
    const b = rule({ id: "r2", identifier: "REQ-042" });
    expect(orGroupIdsInUse([a, b])).toEqual(new Set());
  });

  it("collects every distinct group id, including one read verbatim off an import", () => {
    const a = rule({ id: "r1", identifier: "ifcqa:or:g1" });
    const b = rule({ id: "r2", identifier: "ifcqa:or:g1" });
    const c = rule({ id: "r3", identifier: "ifcqa:or:g2" });
    expect(orGroupIdsInUse([a, b, c])).toEqual(new Set(["g1", "g2"]));
  });
});

describe("nextOrGroupId", () => {
  it("takes the id source's first candidate when nothing is using it yet", () => {
    const mint = vi.fn().mockReturnValue("or1");
    expect(nextOrGroupId([], mint)).toBe("or1");
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it("redraws until the candidate is not already in use — the import-collision case", () => {
    // A page counter can hand out "or7" again after a reload, while an imported rule already
    // carries that exact group id — the id source alone cannot tell the two apart.
    const imported = rule({ id: "r1", identifier: "ifcqa:or:or7" });
    const mint = vi.fn().mockReturnValueOnce("or7").mockReturnValueOnce("or8");
    expect(nextOrGroupId([imported], mint)).toBe("or8");
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it("keeps redrawing past several collisions in a row", () => {
    const a = rule({ id: "r1", identifier: "ifcqa:or:or1" });
    const b = rule({ id: "r2", identifier: "ifcqa:or:or2" });
    const mint = vi.fn().mockReturnValueOnce("or1").mockReturnValueOnce("or2").mockReturnValueOnce("or3");
    expect(nextOrGroupId([a, b], mint)).toBe("or3");
    expect(mint).toHaveBeenCalledTimes(3);
  });
});

describe("effectiveCardinalityOf", () => {
  it("defaults to required for a rule that never stated one and never imported one", () => {
    expect(effectiveCardinalityOf(rule())).toBe("required");
  });

  it("reads the builder's own explicit override", () => {
    expect(effectiveCardinalityOf(rule({ cardinality: "prohibited" }))).toBe("prohibited");
  });

  // The bug this guards: the importer deliberately never sets `cardinality` on the draft (it is only
  // the builder's own statement), so a specification imported straight from a file with
  // minOccurs="0" maxOccurs="0" has to keep reading as prohibited from its own source, not from a
  // field that was never written.
  it("falls back to an untouched import's own source occurs attributes", () => {
    const imported = rule({
      imported: {
        attributes: {},
        applicabilityAttributes: { minOccurs: "0", maxOccurs: "0" },
        entityNamesAsEnumeration: false,
        requirementsAttributes: {},
        passThrough: [],
      },
    });
    expect(effectiveCardinalityOf(imported)).toBe("prohibited");
  });

  it("lets an explicit override win over an imported source that disagrees", () => {
    const overridden = rule({
      cardinality: "required",
      imported: {
        attributes: {},
        applicabilityAttributes: { minOccurs: "0", maxOccurs: "0" },
        entityNamesAsEnumeration: false,
        requirementsAttributes: {},
        passThrough: [],
      },
    });
    expect(effectiveCardinalityOf(overridden)).toBe("required");
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

  it("defaults an authored rule's cardinality to required, and honors an explicit reading", () => {
    const [required] = compileDraft([rule()]);
    expect(required.cardinality).toBe("required");

    const [prohibited] = compileDraft([rule({ cardinality: "prohibited" })]);
    expect(prohibited.cardinality).toBe("prohibited");

    const [optional] = compileDraft([rule({ cardinality: "optional" })]);
    expect(optional.cardinality).toBe("optional");
  });

  it("prefers an explicit cardinality over an imported rule's source occurs attributes", () => {
    const [spec] = compileDraft([
      rule({
        cardinality: "prohibited",
        imported: {
          attributes: {},
          applicabilityAttributes: { minOccurs: "1", maxOccurs: "unbounded" },
          entityNamesAsEnumeration: false,
          requirementsAttributes: null,
          passThrough: [],
        },
      }),
    ]);
    expect(spec.cardinality).toBe("prohibited");
  });

  // A rule the importer read straight out of a file never gets `cardinality` set on the draft —
  // that field is only the builder's own override — so an imported prohibited specification has to
  // keep reading as prohibited from its own source's occurs attributes, with nothing touched.
  it("reads an untouched import's cardinality from its own source occurs attributes", () => {
    const [spec] = compileDraft([
      rule({
        imported: {
          attributes: {},
          applicabilityAttributes: { minOccurs: "0", maxOccurs: "0" },
          entityNamesAsEnumeration: false,
          requirementsAttributes: {},
          passThrough: [],
        },
      }),
    ]);
    expect(spec.cardinality).toBe("prohibited");
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
