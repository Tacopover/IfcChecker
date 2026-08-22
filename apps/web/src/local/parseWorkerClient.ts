import type { EngineId } from "@ifc-qa/shared-types";
import type { ParseRequestMessage, ParseWorkerResponse, ParseWorkerResult } from "./parseWorkerProtocol.js";

type PendingEntry = { resolve: (result: ParseWorkerResult) => void; reject: (error: Error) => void };

function defaultWorkerFactory(): Worker {
  return new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" });
}

/**
 * Owns one parse worker at a time. A worker that has thrown or been killed for memory cannot be
 * trusted for outstanding or future requests: `onerror` rejects everything still pending and drops
 * the worker, so the next `parse()` call gets a fresh one instead of postMessage()ing into a corpse.
 */
export class ParseWorkerClient {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingEntry>();
  private nextId = 0;

  constructor(private readonly createWorker: () => Worker = defaultWorkerFactory) {}

  parse(file: File, engine: EngineId): Promise<ParseWorkerResult> {
    const worker = this.ensureWorker();
    const requestId = String(this.nextId++);
    const result = new Promise<ParseWorkerResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
    });
    const message: ParseRequestMessage = { type: "parse", requestId, engine, file };
    worker.postMessage(message);
    return result;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event: MessageEvent<ParseWorkerResponse>) => this.handleMessage(event.data);
    worker.onerror = (event: ErrorEvent) => this.handleFatal(event.message || "Worker failed unexpectedly");
    this.worker = worker;
    return worker;
  }

  private handleMessage(message: ParseWorkerResponse) {
    const entry = this.pending.get(message.requestId);
    if (!entry) return;
    this.pending.delete(message.requestId);
    if (message.type === "success") entry.resolve(message.result);
    else entry.reject(new Error(message.message));
  }

  private handleFatal(message: string) {
    for (const entry of this.pending.values()) {
      entry.reject(new Error(`Parsing failed: ${message}`));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}

export const parseWorkerClient = new ParseWorkerClient();
