import type { ElementResult, EngineId } from "@ifc-qa/shared-types";
import { parseIfcLiteBuffer, parseWebIfcBuffer } from "@ifc-qa/parser-adapters/browser";
import { validateElements } from "@ifc-qa/ids-validator";
import { locateWebIfcWasm } from "./webIfcWasm.js";

export interface LocalFileOutcome {
  fileName: string;
  status: "succeeded" | "failed";
  parseMs: number | null;
  errorMessage: string | null;
  elementCount: number;
  results: Array<ElementResult & { fileName: string }>;
}

const PARSE_BY_ENGINE: Record<EngineId, (buffer: Uint8Array) => Promise<{ elements: unknown[]; parseMs: number }>> = {
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
    const { elements, parseMs } = await PARSE_BY_ENGINE[engine](buffer);
    const violations = validateElements(elements as Parameters<typeof validateElements>[0], idsXml);

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
    };
  } catch (error) {
    return {
      fileName: file.name,
      status: "failed",
      parseMs: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      elementCount: 0,
      results: [],
    };
  }
}

export async function parseAndValidateFiles(
  files: File[],
  idsXml: string,
  engine: EngineId
): Promise<LocalFileOutcome[]> {
  const outcomes: LocalFileOutcome[] = [];
  for (const file of files) {
    outcomes.push(await parseAndValidateFile(file, idsXml, engine));
  }
  return outcomes;
}
