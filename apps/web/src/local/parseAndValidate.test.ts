import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidIdsRuleSetError,
  parseAndValidateFile,
  parseAndValidateFiles,
  parseIfcFileOnly,
} from "./parseAndValidate.js";

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

// Every existing test below passes a real (if trivial) rule set through
// idsXml, so parseIdsXml's pre-check should see at least one specification
// unless a test deliberately overrides it to assert the empty-rule-set path.
beforeEach(() => {
  vi.clearAllMocks();
  parseIdsXml.mockReturnValue([{ name: "fake-spec", applicabilityEntityNames: [], requirements: [] }]);
});

describe("parseAndValidateFile", () => {
  it("parses with the selected engine and maps violations to ElementResult rows tagged with the file name", async () => {
    const modelStructure = {
      expressId: 1,
      ifcType: "IFCPROJECT",
      name: "Fixture Project",
      elementCounts: {},
      children: [],
    };
    parseWebIfcBuffer.mockResolvedValueOnce({
      elements: [{ globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} }],
      parseMs: 12,
      modelStructure,
    });
    validateElements.mockReturnValueOnce([
      { elementGlobalId: "g1", elementType: "IFCWALL", ruleId: "naming-prefix", severity: "error", message: "Name must start with 'W-'" },
    ]);

    const outcome = await parseAndValidateFile(makeFile("model-a.ifc"), "<ids/>", "web-ifc");

    expect(parseWebIfcBuffer).toHaveBeenCalledTimes(1);
    expect(parseIfcLiteBuffer).not.toHaveBeenCalled();
    expect(validateElements).toHaveBeenCalledWith(
      [expect.objectContaining({ globalId: "g1" })],
      "<ids/>"
    );

    expect(outcome.status).toBe("succeeded");
    expect(outcome.fileName).toBe("model-a.ifc");
    expect(outcome.parseMs).toBe(12);
    expect(outcome.elementCount).toBe(1);
    expect(outcome.results).toEqual([
      expect.objectContaining({
        fileName: "model-a.ifc",
        elementGlobalId: "g1",
        elementType: "IFCWALL",
        ruleId: "naming-prefix",
        severity: "error",
        message: "Name must start with 'W-'",
      }),
    ]);
    expect(outcome.modelStructure).toEqual(modelStructure);
  });

  it("routes to the ifc-lite engine when selected", async () => {
    parseIfcLiteBuffer.mockResolvedValueOnce({ elements: [], parseMs: 4 });
    validateElements.mockReturnValueOnce([]);

    const outcome = await parseAndValidateFile(makeFile("model-b.ifc"), "<ids/>", "ifc-lite");

    expect(parseIfcLiteBuffer).toHaveBeenCalledTimes(1);
    expect(outcome.results).toEqual([]);
  });

  it("marks the file failed and records the error message when parsing throws, without crashing", async () => {
    parseWebIfcBuffer.mockRejectedValueOnce(new Error("unexpected EOF"));

    const outcome = await parseAndValidateFile(makeFile("corrupt.ifc"), "<ids/>", "web-ifc");

    expect(outcome.status).toBe("failed");
    expect(outcome.errorMessage).toBe("unexpected EOF");
    expect(outcome.parseMs).toBeNull();
    expect(outcome.results).toEqual([]);
    expect(outcome.modelStructure).toBeNull();
  });
});

describe("parseIfcFileOnly", () => {
  it("returns the parsed elements without touching the validator", async () => {
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

    const result = await parseIfcFileOnly(makeFile("model-a.ifc"), "web-ifc");

    expect(result).toEqual({ elements, parseMs: 9, modelStructure });
    expect(validateElements).not.toHaveBeenCalled();
    expect(parseIdsXml).not.toHaveBeenCalled();
  });

  it("routes to the ifc-lite engine and normalises a missing model structure to null", async () => {
    parseIfcLiteBuffer.mockResolvedValueOnce({ elements: [], parseMs: 4 });

    const result = await parseIfcFileOnly(makeFile("model-b.ifc"), "ifc-lite");

    expect(parseIfcLiteBuffer).toHaveBeenCalledTimes(1);
    expect(parseWebIfcBuffer).not.toHaveBeenCalled();
    expect(result.modelStructure).toBeNull();
  });

  it("propagates parse failures instead of swallowing them into an outcome row", async () => {
    parseWebIfcBuffer.mockRejectedValueOnce(new Error("unexpected EOF"));

    await expect(parseIfcFileOnly(makeFile("corrupt.ifc"), "web-ifc")).rejects.toThrow("unexpected EOF");
  });
});

describe("parseAndValidateFiles", () => {
  it("processes every file independently, one failure not blocking the rest", async () => {
    parseWebIfcBuffer
      .mockResolvedValueOnce({ elements: [], parseMs: 3 })
      .mockRejectedValueOnce(new Error("bad file"))
      .mockResolvedValueOnce({ elements: [], parseMs: 7 });
    validateElements.mockReturnValue([]);

    const outcomes = await parseAndValidateFiles(
      [makeFile("a.ifc"), makeFile("b.ifc"), makeFile("c.ifc")],
      "<ids/>",
      "web-ifc"
    );

    expect(outcomes.map((o) => o.status)).toEqual(["succeeded", "failed", "succeeded"]);
    expect(outcomes.map((o) => o.fileName)).toEqual(["a.ifc", "b.ifc", "c.ifc"]);
  });

  it("rejects with InvalidIdsRuleSetError instead of silently reporting zero issues when the IDS file has no specifications", async () => {
    parseIdsXml.mockReturnValue([]);

    await expect(
      parseAndValidateFiles([makeFile("a.ifc")], "<not-really-ids/>", "web-ifc")
    ).rejects.toThrow(InvalidIdsRuleSetError);

    expect(parseWebIfcBuffer).not.toHaveBeenCalled();
  });

  it("reports progress for each file before it starts parsing, in order", async () => {
    parseWebIfcBuffer
      .mockResolvedValueOnce({ elements: [], parseMs: 3 })
      .mockResolvedValueOnce({ elements: [], parseMs: 7 });
    validateElements.mockReturnValue([]);

    const onProgress = vi.fn();
    await parseAndValidateFiles([makeFile("a.ifc"), makeFile("b.ifc")], "<ids/>", "web-ifc", onProgress);

    expect(onProgress).toHaveBeenNthCalledWith(1, { fileName: "a.ifc", index: 1, total: 2 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { fileName: "b.ifc", index: 2, total: 2 });
  });

  it("still reports progress for a file that goes on to fail", async () => {
    parseWebIfcBuffer.mockRejectedValueOnce(new Error("bad file"));

    const onProgress = vi.fn();
    const outcomes = await parseAndValidateFiles([makeFile("a.ifc")], "<ids/>", "web-ifc", onProgress);

    expect(onProgress).toHaveBeenCalledWith({ fileName: "a.ifc", index: 1, total: 1 });
    expect(outcomes[0].status).toBe("failed");
  });
});
