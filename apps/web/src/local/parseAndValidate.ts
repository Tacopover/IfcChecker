import type { ElementResult, EngineId, ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";
import { parseIfcLiteBuffer, parseWebIfcBuffer } from "@ifc-qa/parser-adapters/browser";
import { parseIdsXml, validateElements } from "@ifc-qa/ids-validator";
import { locateWebIfcWasm } from "./webIfcWasm.js";

// A rule-set XML with zero <specification> elements is indistinguishable
// from "everything passed" downstream (validateElements just has nothing to
// check against) — parseIdsXml itself never throws on malformed/wrong XML,
// it silently returns []. Since this page lets a user pick ANY file for the
// rule set, that silent zero-specs case must be caught here and surfaced as
// an error, not run as a batch that will falsely report full compliance.
export class InvalidIdsRuleSetError extends Error {
  constructor() {
    super(
      "This doesn't look like a valid IDS rule set — no <specification> elements were found. Check that you selected the right file."
    );
    this.name = "InvalidIdsRuleSetError";
  }
}

export interface ParseProgress {
  fileName: string;
  index: number;
  total: number;
}

export interface LocalFileOutcome {
  fileName: string;
  status: "succeeded" | "failed";
  parseMs: number | null;
  errorMessage: string | null;
  elementCount: number;
  results: Array<ElementResult & { fileName: string }>;
  modelStructure: ModelStructureNode | null;
}

const PARSE_BY_ENGINE: Record<
  EngineId,
  (buffer: Uint8Array) => Promise<{
    elements: NormalizedElement[];
    parseMs: number;
    modelStructure: ModelStructureNode | null;
  }>
> = {
  "web-ifc": (buffer) => parseWebIfcBuffer(buffer, locateWebIfcWasm),
  "ifc-lite": parseIfcLiteBuffer,
};

export async function parseAndValidateFile(
  file: File,
  idsXml: string,
  engine: EngineId
): Promise<LocalFileOutcome> {
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { elements, parseMs, modelStructure } = await PARSE_BY_ENGINE[engine](buffer);
    const violations = validateElements(elements, idsXml);

    // No real FileJob exists in this client-only path — file.name stands in
    // for fileJobId, since ElementResult requires one and there's no backend
    // id to use.
    const results = violations.map((violation, index) => ({
      id: `${file.name}#${index}`,
      fileJobId: file.name,
      fileName: file.name,
      elementGlobalId: violation.elementGlobalId,
      elementType: violation.elementType,
      ruleId: violation.ruleId,
      severity: violation.severity,
      message: violation.message,
    }));

    return {
      fileName: file.name,
      status: "succeeded",
      parseMs,
      errorMessage: null,
      elementCount: elements.length,
      results,
      modelStructure,
    };
  } catch (error) {
    return {
      fileName: file.name,
      status: "failed",
      parseMs: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      elementCount: 0,
      results: [],
      modelStructure: null,
    };
  }
}

export async function parseAndValidateFiles(
  files: File[],
  idsXml: string,
  engine: EngineId,
  onProgress?: (progress: ParseProgress) => void
): Promise<LocalFileOutcome[]> {
  if (parseIdsXml(idsXml).length === 0) {
    throw new InvalidIdsRuleSetError();
  }

  const outcomes: LocalFileOutcome[] = [];
  // Sequential, not Promise.all: each file spins up its own WASM engine
  // instance (see parseWebIfcBuffer/parseIfcLiteBuffer); running many of
  // those concurrently in one tab risks memory pressure on a large batch
  // (up to 20 files, up to 2GB each per the product spec).
  for (const [index, file] of files.entries()) {
    onProgress?.({ fileName: file.name, index: index + 1, total: files.length });
    outcomes.push(await parseAndValidateFile(file, idsXml, engine));
  }
  return outcomes;
}
