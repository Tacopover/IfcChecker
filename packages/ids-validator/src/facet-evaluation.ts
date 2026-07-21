import type { NormalizedElement, PropertyValue } from "@ifc-qa/shared-types";
import type { ParsedRequirementFacet } from "./parse-ids.js";

export interface FacetCheckResult {
  passed: boolean;
  message: string;
}

const TOP_LEVEL_ATTRIBUTE_READERS: Record<string, (element: NormalizedElement) => PropertyValue | null> = {
  GLOBALID: (element) => element.globalId,
  NAME: (element) => element.name,
  PREDEFINEDTYPE: (element) => element.predefinedType,
};

export function matchesApplicability(element: NormalizedElement, entityNames: string[]): boolean {
  return entityNames.some((entityName) => entityName.toUpperCase() === element.ifcType.toUpperCase());
}

function readAttributeValue(element: NormalizedElement, attributeName: string): PropertyValue | null {
  const topLevelReader = TOP_LEVEL_ATTRIBUTE_READERS[attributeName.toUpperCase()];
  if (topLevelReader) return topLevelReader(element);
  return attributeName in element.attributes ? element.attributes[attributeName] : null;
}

export function evaluateRequirement(
  element: NormalizedElement,
  facet: ParsedRequirementFacet
): FacetCheckResult {
  if (facet.kind === "attribute") {
    const value = readAttributeValue(element, facet.name);
    if (value === null) {
      return { passed: false, message: `Attribute "${facet.name}" is missing` };
    }
    if (facet.pattern && !facet.pattern.test(String(value))) {
      return {
        passed: false,
        message: `Attribute "${facet.name}" value "${String(value)}" does not match required pattern "${facet.patternSource}"`,
      };
    }
    return { passed: true, message: "" };
  }

  const propertySet = element.propertySets[facet.propertySet];
  const value = propertySet ? propertySet[facet.baseName] : undefined;
  if (value === undefined || value === null) {
    return {
      passed: false,
      message: `Property "${facet.baseName}" is missing in property set "${facet.propertySet}"`,
    };
  }
  return { passed: true, message: "" };
}
