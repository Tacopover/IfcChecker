import { parseIfcLiteBuffer, parseWebIfcBuffer } from "@ifc-qa/parser-adapters/browser";
import type { EngineId } from "@ifc-qa/shared-types";
import { locateWebIfcWasm } from "./webIfcWasm.js";
import type { ParseWorkerResult } from "./parseWorkerProtocol.js";

// Runs inside the parse worker (see parse.worker.ts) — kept separate from the worker's
// onmessage/postMessage plumbing so it can be unit tested without a real Worker runtime.
export async function runParse(file: File, engine: EngineId): Promise<ParseWorkerResult> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const outcome =
    engine === "web-ifc"
      ? await parseWebIfcBuffer(buffer, locateWebIfcWasm)
      : await parseIfcLiteBuffer(buffer);
  return {
    elements: outcome.elements,
    idsScope: outcome.idsScope ?? outcome.elements,
    unitScales: outcome.unitScales ?? {},
    parseMs: outcome.parseMs,
    modelStructure: outcome.modelStructure ?? null,
  };
}
