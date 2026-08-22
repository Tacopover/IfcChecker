import { describe, expect, it, vi } from "vitest";
import { ParseWorkerClient } from "./parseWorkerClient.js";
import type { ParseWorkerResponse } from "./parseWorkerProtocol.js";

// A fake Worker whose test can push responses in and inspect what was posted out —
// stands in for the postMessage/onmessage/onerror surface parseWorkerClient depends on.
class FakeWorker {
  posted: unknown[] = [];
  onmessage: ((event: MessageEvent<ParseWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  respond(response: ParseWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<ParseWorkerResponse>);
  }

  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

describe("ParseWorkerClient", () => {
  it("resolves parse() with the result carried by a matching success message", async () => {
    let worker!: FakeWorker;
    const client = new ParseWorkerClient(() => (worker = new FakeWorker()) as unknown as Worker);

    const pending = client.parse(makeFile("a.ifc"), "ifc-lite");
    const result = { elements: [], idsScope: [], unitScales: {}, parseMs: 1, modelStructure: null };
    const requestId = (worker.posted[0] as { requestId: string }).requestId;
    worker.respond({ type: "success", requestId, result });

    await expect(pending).resolves.toEqual(result);
  });

  it("rejects every pending parse() when the worker fires onerror, and drops the dead worker", async () => {
    let workers: FakeWorker[] = [];
    const client = new ParseWorkerClient(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    });

    const first = client.parse(makeFile("a.ifc"), "ifc-lite");
    workers[0].fail("out of memory");

    await expect(first).rejects.toThrow(/out of memory/);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);

    // The next parse() must not reuse the dead worker.
    const second = client.parse(makeFile("b.ifc"), "ifc-lite");
    expect(workers).toHaveLength(2);
    const requestId = (workers[1].posted[0] as { requestId: string }).requestId;
    workers[1].respond({ type: "success", requestId, result: { elements: [], idsScope: [], unitScales: {}, parseMs: 1, modelStructure: null } });
    await expect(second).resolves.toBeDefined();
  });

  it("rejects with the error message carried by an error response", async () => {
    let worker!: FakeWorker;
    const client = new ParseWorkerClient(() => (worker = new FakeWorker()) as unknown as Worker);

    const pending = client.parse(makeFile("a.ifc"), "ifc-lite");
    const requestId = (worker.posted[0] as { requestId: string }).requestId;
    worker.respond({ type: "error", requestId, message: "unexpected EOF" });

    await expect(pending).rejects.toThrow("unexpected EOF");
  });
});
