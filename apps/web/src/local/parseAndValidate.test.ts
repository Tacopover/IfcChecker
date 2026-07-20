import { describe, expect, it, vi } from "vitest";
import { parseAndValidateFile, parseAndValidateFiles } from "./parseAndValidate.js";

const { parseWebIfcBuffer, parseIfcLiteBuffer } = vi.hoisted(() => ({
  parseWebIfcBuffer: vi.fn(),
  parseIfcLiteBuffer: vi.fn(),
}));
const { validateElements } = vi.hoisted(() => ({ validateElements: vi.fn() }));

vi.mock("@ifc-qa/parser-adapters", () => ({ parseWebIfcBuffer, parseIfcLiteBuffer }));
vi.mock("@ifc-qa/ids-validator", () => ({ validateElements }));

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

describe("parseAndValidateFile", () => {
  it("parses with the selected engine and maps violations to ElementResult rows tagged with the file name", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({
      elements: [{ globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} }],
      parseMs: 12,
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
});
