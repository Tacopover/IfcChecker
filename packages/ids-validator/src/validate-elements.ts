import type { NormalizedElement, Severity } from "@ifc-qa/shared-types";
import { parseIdsXml } from "./parse-ids.js";
import { matchesApplicability, evaluateRequirement } from "./facet-evaluation.js";

export interface IdsViolation {
  elementGlobalId: string;
  elementType: string;
  ruleId: string;
  severity: Severity;
  message: string;
}

export function validateElements(elements: NormalizedElement[], idsXml: string): IdsViolation[] {
  const specifications = parseIdsXml(idsXml);
  const violations: IdsViolation[] = [];

  for (const element of elements) {
    for (const specification of specifications) {
      if (!matchesApplicability(element, specification.applicabilityEntityNames)) {
        continue;
      }

      for (const facet of specification.requirements) {
        const result = evaluateRequirement(element, facet);
        if (!result.passed) {
          violations.push({
            elementGlobalId: element.globalId,
            elementType: element.ifcType,
            ruleId: specification.name,
            severity: "error",
            message: result.message,
          });
        }
      }
    }
  }

  return violations;
}
