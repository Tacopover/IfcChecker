import { beforeEach, describe, expect, it, vi } from "vitest";
import { runParse } from "./parseWorkerCore.js";

const { parseWebIfcBuffer, parseIfcLiteBuffer } = vi.hoisted(() => ({
  parseWebIfcBuffer: vi.fn(),
  parseIfcLiteBuffer: vi.fn(),
}));
vi.mock("@ifc-qa/parser-adapters/browser", () => ({ parseWebIfcBuffer, parseIfcLiteBuffer }));

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

beforeEach(() => vi.clearAllMocks());

describe("runParse", () => {
  it("routes to ifc-lite and fills in defaults for fields the engine left out", async () => {
    parseIfcLiteBuffer.mockResolvedValueOnce({ elements: [], parseMs: 4 });

    const result = await runParse(makeFile("model.ifc"), "ifc-lite");

    expect(parseIfcLiteBuffer).toHaveBeenCalledTimes(1);
    expect(parseWebIfcBuffer).not.toHaveBeenCalled();
    expect(result).toEqual({
      elements: [],
      idsScope: [],
      unitScales: {},
      parseMs: 4,
      modelStructure: null,
    });
  });

  it("routes to web-ifc and passes the wasm locator", async () => {
    const elements = [{ globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: null, attributes: {}, propertySets: {} }];
    parseWebIfcBuffer.mockResolvedValueOnce({ elements, idsScope: elements, unitScales: {}, parseMs: 9, modelStructure: null });

    const result = await runParse(makeFile("model.ifc"), "web-ifc");

    expect(parseWebIfcBuffer).toHaveBeenCalledWith(expect.any(Uint8Array), expect.any(Function));
    expect(result.elements).toBe(elements);
  });
});
