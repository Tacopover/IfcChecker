import type { EngineId, ModelStructureNode, NormalizedElement, UnitScales } from "@ifc-qa/shared-types";

export interface ParseWorkerResult {
  elements: NormalizedElement[];
  idsScope: NormalizedElement[];
  unitScales: UnitScales;
  parseMs: number;
  modelStructure: ModelStructureNode | null;
}

/**
 * `file` is a structured-cloneable File, not a copied byte buffer — the worker reads it with its
 * own `file.arrayBuffer()` call, so the raw bytes are never held on the main thread at all.
 */
export interface ParseRequestMessage {
  type: "parse";
  requestId: string;
  engine: EngineId;
  file: File;
}

export interface ParseSuccessMessage {
  type: "success";
  requestId: string;
  result: ParseWorkerResult;
}

export interface ParseErrorMessage {
  type: "error";
  requestId: string;
  message: string;
}

export type ParseWorkerResponse = ParseSuccessMessage | ParseErrorMessage;
