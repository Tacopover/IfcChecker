import type { ElementResult, EngineId, ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";
import { parseIfcLiteBuffer, parseWebIfcBuffer } from "@ifc-qa/parser-adapters/browser";
import { parseIdsXml, validateBySpecification } from "@ifc-qa/ids-validator";
import type { ParseOutcome } from "../state/loadedModels.js";
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

// A file is parsed on its own, before any rule set exists: the user may be
// heading for the rule builder rather than a check. A failure is returned, not
// thrown, so one bad file in a batch doesn't cost the user the others.
export async function parseFile(file: File, engine: EngineId): Promise<ParseOutcome> {
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { elements, parseMs, modelStructure } = await PARSE_BY_ENGINE[engine](buffer);
    return {
      status: "succeeded",
      engine,
      parseMs,
      errorMessage: null,
      elements,
      modelStructure: modelStructure ?? null,
    };
  } catch (error) {
    return {
      status: "failed",
      engine,
      parseMs: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      elements: [],
      modelStructure: null,
    };
  }
}

export interface ParsedModel {
  /** Identity, as the store defines it — file names collide, so results cannot join back on one. */
  key: string;
  fileName: string;
  elements: NormalizedElement[];
}

export interface CheckRow extends ElementResult {
  fileName: string;
  modelKey: string;
  elementName: string | null;
}

export interface SpecificationSummary {
  name: string;
  applicableCount: number;
  passedCount: number;
  failedCount: number;
  violations: CheckRow[];
}

/**
 * Checks models that are already in memory — a second rule set never re-parses a file.
 *
 * Results are grouped by specification rather than flattened, because "no violations" is not
 * an answer on its own: a rule that matched nothing produces the same empty list as one that
 * every element passed, and only the first of those means the model was never checked.
 */
export function validateParsedModels(
  models: ParsedModel[],
  idsXml: string
): SpecificationSummary[] {
  const specifications = parseIdsXml(idsXml);
  if (specifications.length === 0) {
    throw new InvalidIdsRuleSetError();
  }

  // Merged by position, not by name: an IDS may carry two specifications with the same name,
  // and every model yields these outcomes in document order.
  const summaries = specifications.map<SpecificationSummary>((specification) => ({
    name: specification.name,
    applicableCount: 0,
    passedCount: 0,
    failedCount: 0,
    violations: [],
  }));

  for (const model of models) {
    validateBySpecification(model.elements, idsXml).forEach((outcome, index) => {
      const summary = summaries[index];
      summary.applicableCount += outcome.applicableCount;
      summary.passedCount += outcome.passedCount;
      summary.failedCount += outcome.failedCount;
      summary.violations.push(
        ...outcome.violations.map<CheckRow>((violation, position) => ({
          // No real FileJob exists in this client-only path — fileName stands in for
          // fileJobId, since ElementResult requires one and there's no backend id to use.
          id: `${model.key}#${index}#${position}`,
          fileJobId: model.fileName,
          fileName: model.fileName,
          modelKey: model.key,
          elementGlobalId: violation.elementGlobalId,
          elementType: violation.elementType,
          elementName: violation.elementName,
          ruleId: violation.ruleId,
          severity: violation.severity,
          message: violation.message,
        }))
      );
    });
  }

  return summaries;
}
