import {
  parseIfcLiteBuffer,
  parseWebIfcBuffer,
  parseWebIfcSource,
  type WebIfcSource,
} from "@ifc-qa/parser-adapters/browser";
import type { EngineId } from "@ifc-qa/shared-types";
import { locateWebIfcWasm } from "./webIfcWasm.js";
import type { ParseWorkerResult } from "./parseWorkerProtocol.js";

// Worker-only global; this project's tsconfig compiles with the DOM lib, which omits it.
declare const FileReaderSync: (new () => { readAsArrayBuffer(blob: Blob): ArrayBuffer }) | undefined;

// A worker can read a File synchronously a slice at a time, which is what lets web-ifc's chunk
// callback pull bytes straight from disk. Anywhere FileReaderSync is missing (the unit-test
// runtime), there is no such source and the file has to be read whole.
function streamingSource(file: File): WebIfcSource | null {
  if (typeof FileReaderSync === "undefined") return null;
  const reader = new FileReaderSync();
  return {
    byteLength: file.size,
    read: (offset, size) =>
      new Uint8Array(reader.readAsArrayBuffer(file.slice(offset, Math.min(offset + size, file.size)))),
  };
}

// Browsers cap one ArrayBuffer (and so File.arrayBuffer()) at roughly 2 GB, and the failure they
// give — "NotReadableError: The requested file could not be read, typically due to permission
// problems" — names nothing about size. Null here means "does not fit", not "cannot be read".
async function readWhole(file: File): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

function tooLargeError(file: File): Error {
  const gigabytes = (file.size / 1024 ** 3).toFixed(2);
  return new Error(`${file.name} (${gigabytes} GB) is too large for this browser to load into memory at once`);
}

// Runs inside the parse worker (see parse.worker.ts) — kept separate from the worker's
// onmessage/postMessage plumbing so it can be unit tested without a real Worker runtime.
export async function runParse(
  file: File,
  engine: EngineId,
  onProgress?: (phase: string, percent: number) => void
): Promise<ParseWorkerResult> {
  const source = streamingSource(file);
  let outcome;
  if (engine === "web-ifc" && source) {
    outcome = await parseWebIfcSource(source, locateWebIfcWasm);
  } else {
    const buffer = await readWhole(file);
    if (buffer) {
      outcome =
        engine === "web-ifc"
          ? await parseWebIfcBuffer(buffer, locateWebIfcWasm)
          : await parseIfcLiteBuffer(buffer, onProgress);
    } else if (source) {
      // Only ifc-lite lands here, and only for a file too big to hold as one buffer: it needs the
      // whole file in memory, web-ifc does not, so the file goes to the engine that can take it.
      outcome = await parseWebIfcSource(source, locateWebIfcWasm);
    } else {
      throw tooLargeError(file);
    }
  }
  return {
    elements: outcome.elements,
    idsScope: outcome.idsScope ?? outcome.elements,
    unitScales: outcome.unitScales ?? {},
    parseMs: outcome.parseMs,
    modelStructure: outcome.modelStructure ?? null,
  };
}
