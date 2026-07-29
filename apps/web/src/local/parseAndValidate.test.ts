import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidIdsRuleSetError, parseFile, validateParsedModels } from "./parseAndValidate.js";

const { parseWebIfcBuffer, parseIfcLiteBuffer } = vi.hoisted(() => ({
  parseWebIfcBuffer: vi.fn(),
  parseIfcLiteBuffer: vi.fn(),
}));
const { validateElements, parseIdsXml } = vi.hoisted(() => ({
  validateElements: vi.fn(),
  parseIdsXml: vi.fn(),
}));

vi.mock("@ifc-qa/parser-adapters/browser", () => ({ parseWebIfcBuffer, parseIfcLiteBuffer }));
vi.mock("@ifc-qa/ids-validator", () => ({ validateElements, parseIdsXml }));

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

// Every test below passes a real (if trivial) rule set through idsXml, so
// parseIdsXml's pre-check should see at least one specification unless a test
// deliberately overrides it to assert the empty-rule-set path.
beforeEach(() => {
  vi.clearAllMocks();
  parseIdsXml.mockReturnValue([{ name: "fake-spec", applicabilityEntityNames: [], requirements: [] }]);
});

describe("parseFile", () => {
  it("returns the parsed elements and the engine that produced them, without touching the validator", async () => {
    const modelStructure = {
      expressId: 1,
      ifcType: "IFCPROJECT",
      name: "Fixture Project",
      elementCounts: {},
      children: [],
    };
    const elements = [
      { globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} },
    ];
    parseWebIfcBuffer.mockResolvedValueOnce({ elements, parseMs: 9, modelStructure });

    const outcome = await parseFile(makeFile("model-a.ifc"), "web-ifc");

    expect(outcome).toEqual({
      status: "succeeded",
      engine: "web-ifc",
      parseMs: 9,
      errorMessage: null,
      elements,
      modelStructure,
    });
    expect(validateElements).not.toHaveBeenCalled();
    expect(parseIdsXml).not.toHaveBeenCalled();
  });

  it("routes to the ifc-lite engine and normalises a missing model structure to null", async () => {
    parseIfcLiteBuffer.mockResolvedValueOnce({ elements: [], parseMs: 4 });

    const outcome = await parseFile(makeFile("model-b.ifc"), "ifc-lite");

    expect(parseIfcLiteBuffer).toHaveBeenCalledTimes(1);
    expect(parseWebIfcBuffer).not.toHaveBeenCalled();
    expect(outcome.modelStructure).toBeNull();
  });

  it("records a parse failure as an outcome instead of throwing, so one bad file doesn't sink a batch", async () => {
    parseWebIfcBuffer.mockRejectedValueOnce(new Error("unexpected EOF"));

    const outcome = await parseFile(makeFile("corrupt.ifc"), "web-ifc");

    expect(outcome.status).toBe("failed");
    expect(outcome.errorMessage).toBe("unexpected EOF");
    expect(outcome.parseMs).toBeNull();
    expect(outcome.elements).toEqual([]);
    expect(outcome.modelStructure).toBeNull();
  });
});

describe("validateParsedModels", () => {
  it("maps violations to ElementResult rows tagged with the file they came from", () => {
    validateElements.mockReturnValueOnce([
      { elementGlobalId: "g1", elementType: "IFCWALL", ruleId: "naming-prefix", severity: "error", message: "Name must start with 'W-'" },
    ]);

    const elements = [
      { globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} },
    ];
    const results = validateParsedModels([{ fileName: "model-a.ifc", elements }], "<ids/>");

    expect(validateElements).toHaveBeenCalledWith(elements, "<ids/>");
    expect(results).toEqual([
      expect.objectContaining({
        fileName: "model-a.ifc",
        fileJobId: "model-a.ifc",
        elementGlobalId: "g1",
        elementType: "IFCWALL",
        ruleId: "naming-prefix",
        severity: "error",
        message: "Name must start with 'W-'",
      }),
    ]);
  });

  it("re-checks already-parsed elements from every model, never re-reading the files", () => {
    validateElements
      .mockReturnValueOnce([
        { elementGlobalId: "g1", elementType: "IFCWALL", ruleId: "r1", severity: "error", message: "no" },
      ])
      .mockReturnValueOnce([
        { elementGlobalId: "g2", elementType: "IFCDOOR", ruleId: "r2", severity: "warning", message: "hm" },
      ]);

    const results = validateParsedModels(
      [
        { fileName: "a.ifc", elements: [] },
        { fileName: "b.ifc", elements: [] },
      ],
      "<ids/>"
    );

    expect(results.map((result) => result.fileName)).toEqual(["a.ifc", "b.ifc"]);
    expect(parseWebIfcBuffer).not.toHaveBeenCalled();
    expect(parseIfcLiteBuffer).not.toHaveBeenCalled();
  });

  it("throws InvalidIdsRuleSetError instead of silently reporting zero issues when the IDS file has no specifications", () => {
    parseIdsXml.mockReturnValue([]);

    expect(() => validateParsedModels([{ fileName: "a.ifc", elements: [] }], "<not-really-ids/>")).toThrow(
      InvalidIdsRuleSetError
    );
    expect(validateElements).not.toHaveBeenCalled();
  });
});
