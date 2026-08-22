import type {
  ElementResult,
  EngineId,
  ModelStructureNode,
  NormalizedElement,
  UnitScales,
} from "@ifc-qa/shared-types";
import type { UnsupportedConstruct } from "@ifc-qa/ids-validator";
import { isEvaluable, parseIdsXml, validateBySpecification } from "@ifc-qa/ids-validator";
import type { ParseOutcome } from "../state/loadedModels.js";
import { parseWorkerClient } from "./parseWorkerClient.js";

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

// A file is parsed on its own, before any rule set exists: the user may be
// heading for the rule builder rather than a check. A failure is returned, not
// thrown, so one bad file in a batch doesn't cost the user the others — including a failure
// caused by the parse worker itself dying (see parseWorkerClient.ts), which surfaces here as
// an ordinary rejection.
export async function parseFile(file: File, engine: EngineId): Promise<ParseOutcome> {
  try {
    const { elements, idsScope, unitScales, parseMs, modelStructure } =
      await parseWorkerClient.parse(file, engine);
    return {
      status: "succeeded",
      engine,
      parseMs,
      errorMessage: null,
      elements,
      idsScope: idsScope ?? elements,
      unitScales: unitScales ?? {},
      modelStructure: modelStructure ?? null,
    };
  } catch (error) {
    return {
      status: "failed",
      engine,
      parseMs: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      elements: [],
      idsScope: [],
      unitScales: {},
      modelStructure: null,
    };
  }
}

export interface ParsedModel {
  /** Identity, as the store defines it — file names collide, so results cannot join back on one. */
  key: string;
  fileName: string;
  /** Checking runs against the wider IDS scope, not the reviewer element list. */
  idsScope: NormalizedElement[];
  /** This file's own measure scaling — a federated set can mix millimetre and metre models. */
  unitScales: UnitScales;
}

export interface CheckRow extends ElementResult {
  fileName: string;
  modelKey: string;
  elementName: string | null;
}

export interface SpecificationSummary {
  name: string;
  /** False when the specification was never run — its zero counts mean "unknown", not "clean". */
  checked: boolean;
  unsupported: UnsupportedConstruct[];
  applicableCount: number;
  passedCount: number;
  failedCount: number;
  violations: CheckRow[];
  /**
   * Why the specification failed as a whole rather than on any element — most often that its
   * applicability is required and nothing in the model matched it. Null when it did not.
   *
   * Across a batch this is the first model that failed it: cardinality is a question about one
   * model, and summing applicable counts over files would let a file full of walls cover for a
   * file with none.
   */
  cardinalityFailure: string | null;
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
  // Whether a specification can be run at all is a property of the rule set, not of any one
  // model, so it is read here once rather than merged out of the per-model outcomes.
  const summaries = specifications.map<SpecificationSummary>((specification) => ({
    name: specification.name,
    checked: isEvaluable(specification),
    unsupported: specification.unsupported,
    applicableCount: 0,
    passedCount: 0,
    failedCount: 0,
    violations: [],
    cardinalityFailure: null,
  }));

  for (const model of models) {
    validateBySpecification(model.idsScope, idsXml, model.unitScales).forEach((outcome, index) => {
      const summary = summaries[index];
      summary.applicableCount += outcome.applicableCount;
      summary.passedCount += outcome.passedCount;
      summary.failedCount += outcome.failedCount;
      summary.cardinalityFailure ??= outcome.cardinalityFailure;
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
