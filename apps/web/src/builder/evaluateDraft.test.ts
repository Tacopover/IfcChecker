import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ConditionDraft, ConditionOperator, RuleDraft } from "@ifc-qa/ids-validator";
import { describe, expect, it } from "vitest";
import { MAX_COLLECTED_FAILURES, evaluateRuleDraft } from "./evaluateDraft.js";

let nextId = 0;
type Overrides = Partial<Omit<NormalizedElement, "ifcType">>;

function element(ifcType: string, overrides: Overrides = {}): NormalizedElement {
  nextId += 1;
  return {
    globalId: `g${nextId}`,
    expressId: nextId + 1,
    ifcType,
    predefinedType: null,
    name: `${ifcType}-${nextId}`,
    attributes: {},
    propertySets: {},
    ...overrides,
  };
}

function condition(overrides: Partial<ConditionDraft> = {}): ConditionDraft {
  nextId += 1;
  return {
    id: `c${nextId}`,
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
  return { id: "r1", name: "Rule", entityTypes: ["IfcWall"], conditions: [], ...overrides };
}

// Four walls chosen so every operator lands on a different count.
const NAMED_WALLS: NormalizedElement[] = [
  element("IFCWALL", { name: "EXT-Brick-100" }),
  element("IFCWALL", { name: "INT-Gypsum-050" }),
  element("IFCWALL", { name: "EXT-Concrete-100" }),
  element("IFCWALL", { name: null }),
];

describe("evaluateRuleDraft — operators", () => {
  const cases: Array<[ConditionOperator, Partial<ConditionDraft>, number]> = [
    ["exists", {}, 3],
    ["equals", { text: "EXT-Brick-100" }, 1],
    ["oneOf", { values: ["EXT-Brick-100", "INT-Gypsum-050"] }, 2],
    ["contains", { text: "Brick" }, 1],
    ["startsWith", { text: "EXT" }, 2],
    ["endsWith", { text: "100" }, 2],
    ["matches", { text: "EXT-.*" }, 2],
    ["notExists", {}, 1],
  ];

  for (const [operator, extra, expected] of cases) {
    it(`counts ${operator} correctly`, () => {
      const evaluation = evaluateRuleDraft(
        rule({ conditions: [condition({ operator, ...extra })] }),
        NAMED_WALLS
      );

      expect(evaluation.matched).toBe(4);
      expect(evaluation.passed).toBe(expected);
      expect(evaluation.perCondition).toEqual([expected]);
      expect(evaluation.failures).toHaveLength(4 - expected);
    });
  }

  it("escapes the user's text rather than treating it as a pattern", () => {
    const walls = [element("IFCWALL", { name: "A.B" }), element("IFCWALL", { name: "AxB" })];
    const evaluation = evaluateRuleDraft(
      rule({ conditions: [condition({ operator: "contains", text: "A.B" })] }),
      walls
    );

    expect(evaluation.passed).toBe(1);
    expect(evaluation.failures.map((f) => f.element.name)).toEqual(["AxB"]);
  });
});

describe("evaluateRuleDraft — notExists is prohibited, not inverted-presence-only", () => {
  const walls = [
    element("IFCWALL", { propertySets: { Pset_WallCommon: { Status: "Demolish" } } }),
    element("IFCWALL", { propertySets: { Pset_WallCommon: { Status: "" } } }),
    element("IFCWALL", { propertySets: { Pset_WallCommon: {} } }),
    element("IFCWALL", {}),
  ];

  it("passes when the property is absent or empty and fails when it carries a value", () => {
    const evaluation = evaluateRuleDraft(
      rule({
        conditions: [
          condition({ kind: "property", propertySet: "Pset_WallCommon", name: "Status", operator: "notExists" }),
        ],
      }),
      walls
    );

    expect(evaluation.matched).toBe(4);
    expect(evaluation.passed).toBe(3);
    expect(evaluation.failures).toEqual([
      { element: walls[0], conditionIndex: 0, message: expect.stringContaining("must not be filled in") },
    ]);
  });

  it("is the exact complement of the same condition under exists", () => {
    const conditions = [
      condition({ kind: "property", propertySet: "Pset_WallCommon", name: "Status", operator: "exists" }),
    ];
    const evaluation = evaluateRuleDraft(rule({ conditions }), walls);

    expect(evaluation.passed).toBe(1);
  });
});

describe("evaluateRuleDraft — applicability", () => {
  const model: NormalizedElement[] = [
    element("IFCWALL"),
    element("IFCDOOR"),
    element("IFCDUCTSEGMENT"),
    element("IFCSPACE"),
    element("IFCSITE"),
  ];

  it("matches subtypes of a group applicability", () => {
    const evaluation = evaluateRuleDraft(
      rule({ entityTypes: ["IfcElement"], conditions: [condition({ operator: "exists" })] }),
      model
    );

    // IfcSpace and IfcSite are spatial, not IfcElement.
    expect(evaluation.matched).toBe(3);
    expect(evaluation.passed).toBe(3);
  });

  it("keeps a concrete type applicability to that type alone", () => {
    const evaluation = evaluateRuleDraft(
      rule({ entityTypes: ["IfcWall"], conditions: [condition({ operator: "exists" })] }),
      model
    );

    expect(evaluation.matched).toBe(1);
  });

  it("reports zeros when the applicability selects nothing", () => {
    const evaluation = evaluateRuleDraft(
      rule({
        entityTypes: ["IfcWindow"],
        conditions: [condition({ operator: "exists" }), condition({ operator: "equals", text: "x" })],
      }),
      model
    );

    expect(evaluation).toEqual({ matched: 0, passed: 0, perCondition: [0, 0], failures: [] });
  });

  it("matches nothing when the rule has no applicability at all", () => {
    const evaluation = evaluateRuleDraft(rule({ entityTypes: [] }), model);

    expect(evaluation.matched).toBe(0);
  });
});

describe("evaluateRuleDraft — empty rule", () => {
  it("counts matches but passes nobody, because nothing is being checked", () => {
    const evaluation = evaluateRuleDraft(rule({ conditions: [] }), NAMED_WALLS);

    expect(evaluation).toEqual({ matched: 4, passed: 0, perCondition: [], failures: [] });
  });
});

// Each element fails a different, known condition, so the mapping from
// requirement slot back to condition slot is pinned rather than assumed.
const INTERLEAVED_MODEL: NormalizedElement[] = [
  element("IFCWALL", { name: "OK", propertySets: { Pset_Wall: { FireRating: "60", LoadBearing: "true" } } }),
  element("IFCWALL", { name: "OK", propertySets: { Pset_Wall: { FireRating: "60" } } }),
  element("IFCWALL", { name: "OK", propertySets: { Pset_Wall: {} } }),
  element("IFCWALL", { name: "NO", propertySets: { Pset_Wall: { FireRating: "60" } } }),
  element("IFCWALL", { name: "OK", propertySets: { Pset_Wall: { LoadBearing: "true" } } }),
];

describe("evaluateRuleDraft — condition alignment", () => {
  // property, attribute, property: compileDraft must preserve document order, or every count and
  // every conditionIndex below lands on the wrong row of the rule card.
  const interleaved = rule({
    conditions: [
      condition({ kind: "property", propertySet: "Pset_Wall", name: "FireRating", operator: "exists" }),
      condition({ kind: "attribute", name: "Name", operator: "equals", text: "OK" }),
      condition({ kind: "property", propertySet: "Pset_Wall", name: "LoadBearing", operator: "exists" }),
    ],
  });

  it("keeps perCondition index-aligned with an interleaved rule's conditions", () => {
    const evaluation = evaluateRuleDraft(interleaved, INTERLEAVED_MODEL);

    expect(evaluation.matched).toBe(5);
    // FireRating on 3, Name === "OK" on 4, LoadBearing on 2 — distinct, so a reordered
    // compile cannot produce this triple.
    expect(evaluation.perCondition).toEqual([3, 4, 2]);
  });

  it("reports the index of the condition each element actually failed", () => {
    const { failures } = evaluateRuleDraft(interleaved, INTERLEAVED_MODEL);

    expect(failures.map((f) => [f.element.globalId, f.conditionIndex])).toEqual([
      [INTERLEAVED_MODEL[1].globalId, 2],
      [INTERLEAVED_MODEL[2].globalId, 0],
      [INTERLEAVED_MODEL[2].globalId, 2],
      [INTERLEAVED_MODEL[3].globalId, 1],
      [INTERLEAVED_MODEL[3].globalId, 2],
      [INTERLEAVED_MODEL[4].globalId, 0],
    ]);
  });

  it("counts per-condition passes independently of the overall pass count", () => {
    const evaluation = evaluateRuleDraft(interleaved, INTERLEAVED_MODEL);

    // Only the first wall satisfies all three, yet every condition passes on most elements.
    expect(evaluation.passed).toBe(1);
    expect(evaluation.perCondition.every((count) => count > evaluation.passed)).toBe(true);
  });
});

describe("evaluateRuleDraft — failure reasons", () => {
  it("carries the validator's own wording, so a near-miss cannot read like a pass", () => {
    const walls = [element("IFCWALL", { name: "W-003" })];
    const { failures } = evaluateRuleDraft(
      rule({ conditions: [condition({ operator: "oneOf", values: ["W-001", "W-002"] })] }),
      walls
    );

    expect(failures[0].message).toBe(
      'Attribute "Name" value "W-003" is not one of: W-001, W-002'
    );
  });
});

describe("evaluateRuleDraft — failure cap", () => {
  it("caps collected failures while keeping the counts exact", () => {
    const walls = Array.from({ length: MAX_COLLECTED_FAILURES + 120 }, () => element("IFCWALL", { name: null }));
    const evaluation = evaluateRuleDraft(
      rule({ conditions: [condition({ operator: "exists" })] }),
      walls
    );

    expect(evaluation.matched).toBe(walls.length);
    expect(evaluation.passed).toBe(0);
    expect(evaluation.perCondition).toEqual([0]);
    expect(evaluation.failures).toHaveLength(MAX_COLLECTED_FAILURES);
  });
});
