import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runParse } from "./parseWorkerCore.js";

const { parseWebIfcBuffer, parseWebIfcSource, parseIfcLiteBuffer } = vi.hoisted(() => ({
  parseWebIfcBuffer: vi.fn(),
  parseWebIfcSource: vi.fn(),
  parseIfcLiteBuffer: vi.fn(),
}));
vi.mock("@ifc-qa/parser-adapters/browser", () => ({ parseWebIfcBuffer, parseWebIfcSource, parseIfcLiteBuffer }));

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

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

  describe("in a worker, where FileReaderSync exists", () => {
    it("hands web-ifc a source that reads slices of the file, never the whole of it", async () => {
      vi.stubGlobal(
        "FileReaderSync",
        class {
          readAsArrayBuffer(blob: Blob) {
            // jsdom's Blob has no arrayBuffer(); the source under test only needs the bytes.
            return new TextEncoder().encode((blob as unknown as { __text: string }).__text).buffer;
          }
        }
      );
      const file = makeFile("model.ifc", "0123456789");
      file.slice = (start = 0, end = 10) => ({ __text: "0123456789".slice(start, end) }) as unknown as Blob;
      file.arrayBuffer = () => Promise.reject(new Error("must not read the whole file"));
      parseWebIfcSource.mockResolvedValueOnce({ elements: [], parseMs: 1 });

      await runParse(file, "web-ifc");

      expect(parseWebIfcBuffer).not.toHaveBeenCalled();
      const source = parseWebIfcSource.mock.calls[0][0];
      expect(source.byteLength).toBe(10);
      expect(new TextDecoder().decode(source.read(3, 4))).toBe("3456");
      expect(new TextDecoder().decode(source.read(8, 100))).toBe("89");
    });
  });

  describe("a file too large for the browser to load whole", () => {
    function makeHugeFile() {
      const file = makeFile("huge.ifc");
      Object.defineProperty(file, "size", { value: 2150400895 });
      file.arrayBuffer = () => Promise.reject(new DOMException("could not be read", "NotReadableError"));
      return file;
    }

    it("is parsed by web-ifc from slices when ifc-lite, which needs the whole file, was asked for", async () => {
      vi.stubGlobal("FileReaderSync", class {});
      parseWebIfcSource.mockResolvedValueOnce({ elements: [], parseMs: 3 });

      const result = await runParse(makeHugeFile(), "ifc-lite");

      expect(parseIfcLiteBuffer).not.toHaveBeenCalled();
      expect(parseWebIfcSource).toHaveBeenCalledTimes(1);
      expect(result.parseMs).toBe(3);
    });

    it("fails naming the file and its size where slices cannot be read either", async () => {
      await expect(runParse(makeHugeFile(), "ifc-lite")).rejects.toThrow(/huge\.ifc \(2\.00 GB\).*too large/);
      expect(parseIfcLiteBuffer).not.toHaveBeenCalled();
      expect(parseWebIfcSource).not.toHaveBeenCalled();
    });
  });

  it("forwards progress events to the caller's callback for ifc-lite", async () => {
    parseIfcLiteBuffer.mockImplementationOnce(async (_buffer, onProgress) => {
      onProgress?.("scan", 50);
      return { elements: [], parseMs: 1 };
    });
    const events: Array<[string, number]> = [];

    await runParse(makeFile("model.ifc"), "ifc-lite", (phase, percent) => events.push([phase, percent]));

    expect(events).toEqual([["scan", 50]]);
  });
});
