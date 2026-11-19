import { beforeEach, describe, expect, it, vi } from "vitest";

const { runParse } = vi.hoisted(() => ({ runParse: vi.fn() }));
vi.mock("./parseWorkerCore.js", () => ({ runParse }));

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  await import("./parse.worker.js");
});

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

describe("parse.worker", () => {
  it("posts a success message with the request id on a clean parse", async () => {
    const result = { elements: [], idsScope: [], unitScales: {}, parseMs: 3, modelStructure: null };
    runParse.mockResolvedValueOnce(result);
    // jsdom's `self` is `window`, whose real postMessage requires a targetOrigin —
    // stub it out so the spy doesn't call through to that incompatible signature.
    const postMessage = vi.spyOn(self, "postMessage").mockImplementation(() => {});

    await self.onmessage?.({
      data: { type: "parse", requestId: "1", engine: "ifc-lite", file: makeFile("a.ifc") },
    } as MessageEvent);

    expect(postMessage).toHaveBeenCalledWith({ type: "success", requestId: "1", result });
  });

  it("posts an error message with the request id when the parse throws", async () => {
    runParse.mockRejectedValueOnce(new Error("out of memory"));
    const postMessage = vi.spyOn(self, "postMessage").mockImplementation(() => {});

    await self.onmessage?.({
      data: { type: "parse", requestId: "2", engine: "ifc-lite", file: makeFile("a.ifc") },
    } as MessageEvent);

    expect(postMessage).toHaveBeenCalledWith({ type: "error", requestId: "2", message: "out of memory" });
  });

  it("says the result is too large when the browser cannot clone it back, with what was parsed", async () => {
    const element = { globalId: "g", ifcType: "IFCWALL" };
    runParse.mockResolvedValueOnce({
      elements: [element],
      idsScope: [element, element, element],
      unitScales: {},
      parseMs: 3,
      modelStructure: null,
    });
    const postMessage = vi.spyOn(self, "postMessage").mockImplementation((message: unknown) => {
      if ((message as { type: string }).type === "success") {
        throw new DOMException("Data cannot be cloned, out of memory.", "DataCloneError");
      }
    });

    await self.onmessage?.({
      data: { type: "parse", requestId: "4", engine: "ifc-lite", file: makeFile("big.ifc") },
    } as MessageEvent);

    expect(postMessage).toHaveBeenLastCalledWith({
      type: "error",
      requestId: "4",
      message: expect.stringMatching(/big\.ifc.*1 element.*3 entities.*too large/s),
    });
  });

  it("posts a progress message for each onProgress call, tagged with the request id", async () => {
    runParse.mockImplementationOnce(async (_file, _engine, onProgress) => {
      onProgress?.("scan", 42);
      return { elements: [], idsScope: [], unitScales: {}, parseMs: 1, modelStructure: null };
    });
    const postMessage = vi.spyOn(self, "postMessage").mockImplementation(() => {});

    await self.onmessage?.({
      data: { type: "parse", requestId: "3", engine: "ifc-lite", file: makeFile("a.ifc") },
    } as MessageEvent);

    expect(postMessage).toHaveBeenCalledWith({ type: "progress", requestId: "3", phase: "scan", percent: 42 });
  });
});
