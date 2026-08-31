import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidIdsRuleSetError, parseFile, validateParsedModels } from "./parseAndValidate.js";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
const { validateBySpecification, parseIdsXml, isEvaluable } = vi.hoisted(() => ({
  validateBySpecification: vi.fn(),
  parseIdsXml: vi.fn(),
  isEvaluable: vi.fn(),
}));

vi.mock("./parseWorkerClient.js", () => ({ parseWorkerClient: { parse } }));
vi.mock("@ifc-qa/ids-validator", () => ({ validateBySpecification, parseIdsXml, isEvaluable }));

function outcome(overrides: Record<string, unknown> = {}) {
  return {
    name: "fake-spec",
    checked: true,
    unsupported: [],
    applicableCount: 0,
    passedCount: 0,
    failedCount: 0,
    violations: [],
    ...overrides,
  };
}

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

// Every test below passes a real (if trivial) rule set through idsXml, so
// parseIdsXml's pre-check should see at least one specification unless a test
// deliberately overrides it to assert the empty-rule-set path.
beforeEach(() => {
  vi.clearAllMocks();
  parseIdsXml.mockReturnValue([
    { name: "fake-spec", applicability: { entityNames: ["IFCWALL"], facets: [] }, requirements: [], unsupported: [], applicabilityComplete: true },
  ]);
  isEvaluable.mockReturnValue(true);
});

describe("parseFile", () => {
  it("returns the parsed elements and the engine that produced them, without touching the validator", async () => {
    const modelStructure = {
      expressId: 1,
      ifcType: "IFCPROJECT",
      name: "Fixture Project",
      elementIdsByType: {},
      children: [],
    };
    const elements = [
      { globalId: "g1", expressId: 1, ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} },
    ];
    parse.mockResolvedValueOnce({ elements, idsScope: elements, unitScales: {}, parseMs: 9, modelStructure });

    const outcome = await parseFile(makeFile("model-a.ifc"), "web-ifc");

    expect(outcome).toEqual({
      status: "succeeded",
      engine: "web-ifc",
      parseMs: 9,
      errorMessage: null,
      elements,
      idsScope: elements,
      // An engine that reports no scaling leaves the model comparable as authored, which is what
      // an all-SI file means — not "units were never looked at".
      unitScales: {},
      modelStructure,
    });
    expect(validateBySpecification).not.toHaveBeenCalled();
    expect(parseIdsXml).not.toHaveBeenCalled();
  });

  it("routes through the parse worker client and normalises a missing model structure to null", async () => {
    parse.mockResolvedValueOnce({ elements: [], idsScope: [], unitScales: {}, parseMs: 4, modelStructure: null });

    const outcome = await parseFile(makeFile("model-b.ifc"), "ifc-lite");

    expect(parse).toHaveBeenCalledWith(expect.anything(), "ifc-lite", undefined);
    expect(outcome.modelStructure).toBeNull();
  });

  it("records a parse failure as an outcome instead of throwing, so one bad file doesn't sink a batch", async () => {
    parse.mockRejectedValueOnce(new Error("unexpected EOF"));

    const outcome = await parseFile(makeFile("corrupt.ifc"), "web-ifc");

    expect(outcome.status).toBe("failed");
    expect(outcome.errorMessage).toBe("unexpected EOF");
    expect(outcome.parseMs).toBeNull();
    expect(outcome.elements).toEqual([]);
    expect(outcome.idsScope).toEqual([]);
    expect(outcome.modelStructure).toBeNull();
  });
});

describe("validateParsedModels", () => {
  it("maps violations to rows tagged with the file and the model key they came from", () => {
    validateBySpecification.mockReturnValueOnce([
      outcome({
        name: "naming-prefix",
        applicableCount: 1,
        failedCount: 1,
        violations: [
          {
            elementGlobalId: "g1",
            elementType: "IFCWALL",
            elementName: "Wall-1",
            ruleId: "naming-prefix",
            severity: "error",
            message: "Name must start with 'W-'",
          },
        ],
      }),
    ]);

    const elements = [
      { globalId: "g1", expressId: 1, ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} },
    ];
    const summaries = validateParsedModels(
      [{ key: "model-a.ifc:12:99", fileName: "model-a.ifc", idsScope: elements, unitScales: {} }],
      "<ids/>"
    );

    expect(validateBySpecification).toHaveBeenCalledWith(elements, "<ids/>", {});
    expect(summaries[0].violations).toEqual([
      expect.objectContaining({
        fileName: "model-a.ifc",
        fileJobId: "model-a.ifc",
        modelKey: "model-a.ifc:12:99",
        elementGlobalId: "g1",
        elementName: "Wall-1",
        elementType: "IFCWALL",
        ruleId: "naming-prefix",
        severity: "error",
        message: "Name must start with 'W-'",
      }),
    ]);
  });

  it("keeps two files that share a name apart, since the file name is not identity", () => {
    const violation = {
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      elementName: null,
      ruleId: "r1",
      severity: "error",
      message: "no",
    };
    validateBySpecification
      .mockReturnValueOnce([outcome({ applicableCount: 1, failedCount: 1, violations: [violation] })])
      .mockReturnValueOnce([outcome({ applicableCount: 1, failedCount: 1, violations: [violation] })]);

    const [summary] = validateParsedModels(
      [
        { key: "model.ifc:10:1", fileName: "model.ifc", idsScope: [], unitScales: {} },
        { key: "model.ifc:20:2", fileName: "model.ifc", idsScope: [], unitScales: {} },
      ],
      "<ids/>"
    );

    expect(summary.violations.map((row) => row.modelKey)).toEqual(["model.ifc:10:1", "model.ifc:20:2"]);
    expect(new Set(summary.violations.map((row) => row.id)).size).toBe(2);
  });

  it("sums each specification's counts across every model, never re-reading the files", () => {
    validateBySpecification
      .mockReturnValueOnce([outcome({ applicableCount: 3, passedCount: 2, failedCount: 1 })])
      .mockReturnValueOnce([outcome({ applicableCount: 4, passedCount: 4, failedCount: 0 })]);

    const [summary] = validateParsedModels(
      [
        { key: "a", fileName: "a.ifc", idsScope: [], unitScales: {} },
        { key: "b", fileName: "b.ifc", idsScope: [], unitScales: {} },
      ],
      "<ids/>"
    );

    expect(summary).toMatchObject({ applicableCount: 7, passedCount: 6, failedCount: 1 });
    expect(parse).not.toHaveBeenCalled();
  });

  it("reports a specification that matched nothing, rather than returning an empty result set", () => {
    parseIdsXml.mockReturnValue([
      { name: "Walls are fire rated", applicability: { entityNames: ["IFCWALL"], facets: [] }, requirements: [], unsupported: [], applicabilityComplete: true },
    ]);
    validateBySpecification.mockReturnValueOnce([outcome({ name: "Walls are fire rated" })]);

    const summaries = validateParsedModels([{ key: "a", fileName: "a.ifc", idsScope: [], unitScales: {} }], "<ids/>");

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      name: "Walls are fire rated",
      checked: true,
      applicableCount: 0,
      violations: [],
    });
  });

  it("carries the parser's verdict that a specification could not be checked at all", () => {
    const unsupported = [
      { section: "applicability", construct: "property", description: "Selects elements by <property>, which cannot be represented." },
    ];
    parseIdsXml.mockReturnValue([
      { name: "Load-bearing walls", applicability: { entityNames: ["IFCWALL"], facets: [] }, requirements: [], unsupported, applicabilityComplete: false },
    ]);
    isEvaluable.mockReturnValue(false);
    validateBySpecification.mockReturnValueOnce([
      outcome({ name: "Load-bearing walls", checked: false, unsupported }),
    ]);

    const [summary] = validateParsedModels([{ key: "a", fileName: "a.ifc", idsScope: [], unitScales: {} }], "<ids/>");

    // Whether a rule can run is decided by the rule set, not by any one model, so it survives
    // the merge across files rather than being recomputed per outcome.
    expect(summary.checked).toBe(false);
    expect(summary.unsupported).toEqual(unsupported);
  });

  it("throws InvalidIdsRuleSetError instead of silently reporting zero issues when the IDS file has no specifications", () => {
    parseIdsXml.mockReturnValue([]);

    expect(() =>
      validateParsedModels([{ key: "a", fileName: "a.ifc", idsScope: [], unitScales: {} }], "<not-really-ids/>")
    ).toThrow(InvalidIdsRuleSetError);
    expect(validateBySpecification).not.toHaveBeenCalled();
  });
});
