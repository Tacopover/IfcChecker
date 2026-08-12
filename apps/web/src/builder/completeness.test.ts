import { describe, expect, it } from "vitest";
import { buildIdsXml, type ConditionDraft, type RuleDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import {
  conditionProblem,
  exportBlockers,
  isRuleComplete,
  patternError,
  ruleProblems,
} from "./completeness";
import { stating } from "../test/conditions";

const CONDITION: ConditionDraft = {
  id: "c1",
  kind: "property",
  propertySet: plainName("Pset_WallCommon"),
  name: plainName("FireRating"),
  ...stating("exists"),
};

const RULE: RuleDraft = {
  id: "r1",
  name: "Walls declare a fire rating",
  entityTypes: ["IfcWall"],
  conditions: [{ ...CONDITION, ...stating("oneOf", "", ["60", "90"]) }],
};

describe("conditionProblem", () => {
  it("rejects a oneOf with nothing ticked — the XML would accept every value", () => {
    const empty: ConditionDraft = { ...CONDITION, ...stating("oneOf") };

    // Proof this is not a theoretical worry: what we would emit is an unrestricted xs:string.
    // Sliced at <requirements> because the applicability's own entity names are an enumeration.
    const xml = buildIdsXml([{ ...RULE, conditions: [empty] }]);
    const requirements = xml.slice(xml.indexOf("<requirements"));
    expect(requirements).toContain('<xs:restriction base="xs:string">');
    expect(requirements).not.toContain("<xs:enumeration");

    expect(conditionProblem(empty)).toMatch(/Tick at least one value/);
    expect(conditionProblem({ ...empty, ...stating("oneOf", "", ["60"]) })).toBeNull();
  });

  it("rejects every text operator with an empty box, and only while it is empty", () => {
    for (const operator of ["equals", "contains", "startsWith", "endsWith", "matches"] as const) {
      expect(conditionProblem({ ...CONDITION, ...stating(operator, "") })).toMatch(/Enter a value/);
      expect(conditionProblem({ ...CONDITION, ...stating(operator, "REI") })).toBeNull();
    }
  });

  it("leaves operators that need no value alone", () => {
    expect(conditionProblem({ ...CONDITION, ...stating("exists") })).toBeNull();
    expect(conditionProblem({ ...CONDITION, ...stating("notExists") })).toBeNull();
  });

  it("folds an uncompilable pattern into the same report", () => {
    expect(conditionProblem({ ...CONDITION, ...stating("matches", "[A-Z") })).toMatch(
      /Invalid pattern/
    );
  });
});

describe("patternError", () => {
  it("only reports on a matches condition whose text cannot compile", () => {
    expect(patternError({ ...CONDITION, ...stating("matches", "[A-Z]+") })).toBeNull();
    expect(patternError({ ...CONDITION, ...stating("matches", "") })).toBeNull();
    expect(patternError({ ...CONDITION, ...stating("contains", "[") })).toBeNull();
    expect(patternError({ ...CONDITION, ...stating("matches", "[") })).toContain("[");
  });
});

describe("ruleProblems", () => {
  it("rejects a rule with no entity types — IDS requires an applicability facet", () => {
    const stripped: RuleDraft = { ...RULE, entityTypes: [] };

    // The document we would emit has an applicability element with no child at all.
    expect(buildIdsXml([stripped])).toContain(
      '<applicability minOccurs="1" maxOccurs="unbounded">\n      </applicability>'
    );
    expect(ruleProblems(stripped)).toEqual({
      applicability: expect.stringMatching(/No element types/),
      conditions: null,
    });
  });

  it("rejects a rule with no conditions — the requirements block would be empty", () => {
    const stripped: RuleDraft = { ...RULE, conditions: [] };

    expect(buildIdsXml([stripped])).toContain("<requirements>\n      </requirements>");
    expect(ruleProblems(stripped)).toEqual({
      applicability: null,
      conditions: expect.stringMatching(/No conditions/),
    });
  });

  it("reports both when both are missing, and neither when the rule is whole", () => {
    const both = ruleProblems({ ...RULE, entityTypes: [], conditions: [] });
    expect(both.applicability).not.toBeNull();
    expect(both.conditions).not.toBeNull();
    expect(ruleProblems(RULE)).toEqual({ applicability: null, conditions: null });
  });
});

describe("isRuleComplete", () => {
  it("is false when any single condition is incomplete", () => {
    expect(isRuleComplete(RULE)).toBe(true);
    expect(
      isRuleComplete({ ...RULE, conditions: [{ ...CONDITION, ...stating("oneOf") }] })
    ).toBe(false);
  });
});

describe("exportBlockers", () => {
  it("is empty only for a rule set whose XML means what the page shows", () => {
    expect(exportBlockers([RULE])).toEqual([]);
  });

  it("names the rule and the field behind each problem", () => {
    const [blocker] = exportBlockers([
      { ...RULE, conditions: [{ ...CONDITION, ...stating("contains", "") }] },
    ]);

    expect(blocker).toContain("Walls declare a fire rating");
    expect(blocker).toContain("FireRating");
    expect(blocker).toMatch(/Enter a value/);
  });

  it("blocks an empty rule set — an IDS document with no specification is not one", () => {
    expect(exportBlockers([])).toEqual([expect.stringMatching(/No rules yet/)]);
  });

  it("reports every offending rule, not just the first", () => {
    const blockers = exportBlockers([
      { ...RULE, id: "a", name: "A", entityTypes: [] },
      RULE,
      { ...RULE, id: "b", name: "B", conditions: [{ ...CONDITION, ...stating("oneOf") }] },
    ]);

    expect(blockers).toHaveLength(2);
    expect(blockers[0]).toContain('"A"');
    expect(blockers[1]).toContain('"B"');
  });
});
