import type { NormalizedElement, Severity } from "@ifc-qa/shared-types";
import type { UnsupportedConstruct } from "./parse-ids.js";
import { isEvaluable, parseIdsXml } from "./parse-ids.js";
import { matchesApplicability, evaluateRequirement } from "./facet-evaluation.js";

export interface IdsViolation {
  elementGlobalId: string;
  elementType: string;
  elementName: string | null;
  ruleId: string;
  severity: Severity;
  message: string;
}

// What one specification did to the model. Violations alone cannot answer the
// question a reviewer actually asks first — "did this rule check anything?" — and
// an empty list reads as a clean model whether the rule passed everything or
// matched nothing at all. applicableCount separates those two.
export interface SpecificationOutcome {
  name: string;
  /**
   * False when the specification was never run, because its applicability could not be fully
   * represented. Its zero counts then mean "unknown", not "clean" — see `isEvaluable`.
   */
  checked: boolean;
  /** What the source asked for and this parser could not represent. */
  unsupported: UnsupportedConstruct[];
  applicableCount: number;
  passedCount: number;
  failedCount: number;
  violations: IdsViolation[];
  /**
   * Why the specification failed as a whole, independent of any element — or
   * `null` when it did not.
   *
   * IDS gives the applicability a cardinality, and the default is *required*:
   * at least one element must match. A model where nothing matches fails the
   * rule, and that is not visible in any of the counts above — zero applicable,
   * zero failed and an empty violation list is exactly what a clean model looks
   * like. Kept separate from `failedCount` so `passed + failed` stays the
   * number of elements the rule applied to.
   */
  cardinalityFailure: string | null;
}

/**
 * Counts are per element, not per violation: one wall missing two required properties is one
 * failing wall, so passed + failed always equals the number of elements the rule applied to.
 */
export function validateBySpecification(
  elements: NormalizedElement[],
  idsXml: string
): SpecificationOutcome[] {
  return parseIdsXml(idsXml).map((specification) => {
    // Refused rather than run: evaluating a half-understood applicability silently checks the
    // wrong set of elements, and reports the model clean when the rule never applied at all.
    if (!isEvaluable(specification)) {
      return {
        name: specification.name,
        checked: false,
        unsupported: specification.unsupported,
        applicableCount: 0,
        passedCount: 0,
        failedCount: 0,
        violations: [],
        cardinalityFailure: null,
      };
    }

    const violations: IdsViolation[] = [];
    let applicableCount = 0;
    let failedCount = 0;

    for (const element of elements) {
      if (!matchesApplicability(element, specification.applicabilityEntityNames)) {
        continue;
      }
      applicableCount += 1;

      // A prohibited specification is a statement that nothing should match, so
      // the elements it selects are the failure. There is nothing to check on
      // them, and a document that asks for checks anyway is invalid.
      if (specification.cardinality === "prohibited") continue;

      const before = violations.length;
      for (const facet of specification.requirements) {
        const result = evaluateRequirement(element, facet);
        if (result.passed) continue;
        violations.push({
          elementGlobalId: element.globalId,
          elementType: element.ifcType,
          elementName: element.name,
          ruleId: specification.name,
          severity: "error",
          message: result.message,
        });
      }
      if (violations.length > before) failedCount += 1;
    }

    return {
      name: specification.name,
      checked: true,
      unsupported: specification.unsupported,
      applicableCount,
      passedCount: applicableCount - failedCount,
      failedCount,
      violations,
      cardinalityFailure: cardinalityFailure(specification, applicableCount),
    };
  });
}

function cardinalityFailure(
  specification: { cardinality: string; requirements: unknown[] },
  applicableCount: number
): string | null {
  if (specification.cardinality === "prohibited") {
    if (specification.requirements.length > 0) {
      return "This specification is prohibited — nothing may match it — so it cannot also state requirements. The document is invalid.";
    }
    return applicableCount > 0
      ? `Nothing may match this specification, but ${applicableCount} element${applicableCount === 1 ? "" : "s"} did.`
      : null;
  }

  if (specification.cardinality === "required" && applicableCount === 0) {
    return "This specification requires at least one matching element, and the model has none. It was not checked because there was nothing to check.";
  }

  return null;
}

export function validateElements(elements: NormalizedElement[], idsXml: string): IdsViolation[] {
  return validateBySpecification(elements, idsXml).flatMap((outcome) => outcome.violations);
}
