import type { NormalizedElement } from "@ifc-qa/shared-types";
import {
  compileDraft,
  evaluateRequirement,
  matchesApplicability,
  type RuleDraft,
} from "@ifc-qa/ids-validator";

export interface RuleEvaluation {
  matched: number;
  passed: number;
  perCondition: number[];
  failures: Array<{ element: NormalizedElement; conditionIndex: number }>;
}

/**
 * A half-million element model can fail on nearly every element, and the failing-elements table only
 * ever shows a page of them — collecting the rest would cost memory for nothing. Counts stay exact;
 * only the sample is capped.
 */
export const MAX_COLLECTED_FAILURES = 300;

/**
 * Live pass/fail for one draft rule. Everything the numbers depend on comes from the validator:
 * the rule is compiled exactly as export would compile it, and applicability and requirements are
 * judged by the same functions that run a real IDS file — so the preview cannot drift from the
 * XML the user downloads.
 */
export function evaluateRuleDraft(rule: RuleDraft, elements: NormalizedElement[]): RuleEvaluation {
  const [specification] = compileDraft([rule]);
  const { applicabilityEntityNames, requirements } = specification;

  const perCondition = requirements.map(() => 0);
  const failures: RuleEvaluation["failures"] = [];
  let matched = 0;
  let passed = 0;

  for (const element of elements) {
    if (!matchesApplicability(element, applicabilityEntityNames)) continue;
    matched += 1;

    // A rule with no conditions checks nothing, so nothing can have passed it.
    let satisfiesAll = requirements.length > 0;
    for (let index = 0; index < requirements.length; index += 1) {
      if (evaluateRequirement(element, requirements[index]).passed) {
        perCondition[index] += 1;
      } else {
        satisfiesAll = false;
        if (failures.length < MAX_COLLECTED_FAILURES) failures.push({ element, conditionIndex: index });
      }
    }
    if (satisfiesAll) passed += 1;
  }

  return { matched, passed, perCondition, failures };
}
