import type { NormalizedElement, PropertyValue } from "@ifc-qa/shared-types";
import type { ParsedRequirementFacet, ParsedRestriction } from "./parse-ids.js";
import { isSubtypeOf } from "./ifc-type-hierarchy.js";

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
  return entityNames.some((entityName) => isSubtypeOf(element.ifcType, entityName));
}

function readAttributeValue(element: NormalizedElement, attributeName: string): PropertyValue | null {
  const topLevelReader = TOP_LEVEL_ATTRIBUTE_READERS[attributeName.toUpperCase()];
  if (topLevelReader) return topLevelReader(element);
  if (attributeName in element.attributes) return element.attributes[attributeName];

  // Hand-written IDS files are inconsistent about attribute casing, and a missed key would report
  // every element as missing the attribute — a far worse outcome than a lenient match.
  const wanted = attributeName.toUpperCase();
  for (const key of Object.keys(element.attributes)) {
    if (key.toUpperCase() === wanted) return element.attributes[key];
  }
  return null;
}

function readFacetValue(
  element: NormalizedElement,
  facet: ParsedRequirementFacet
): PropertyValue | null {
  if (facet.kind === "attribute") {
    return readAttributeValue(element, facet.name);
  }
  const propertySet = element.propertySets[facet.propertySet];
  const value = propertySet ? propertySet[facet.baseName] : undefined;
  return value === undefined ? null : value;
}

/** An empty string counts as unfilled — that is what a modeller means by "not filled in". */
function isFilledIn(value: PropertyValue | null): boolean {
  return value !== null && value !== undefined && String(value) !== "";
}

function facetLabel(facet: ParsedRequirementFacet): string {
  return facet.kind === "attribute"
    ? `Attribute "${facet.name}"`
    : `Property "${facet.baseName}" in property set "${facet.propertySet}"`;
}

function missingMessage(facet: ParsedRequirementFacet): string {
  return facet.kind === "attribute"
    ? `Attribute "${facet.name}" is missing`
    : `Property "${facet.baseName}" is missing in property set "${facet.propertySet}"`;
}

function restrictionFailure(
  facet: ParsedRequirementFacet,
  restriction: ParsedRestriction,
  value: string
): string | null {
  switch (restriction.kind) {
    case "exact":
      return value === restriction.value
        ? null
        : `${facetLabel(facet)} value "${value}" must be "${restriction.value}"`;
    case "enum":
      return restriction.values.includes(value)
        ? null
        : `${facetLabel(facet)} value "${value}" is not one of: ${restriction.values.join(", ")}`;
    case "pattern":
      return restriction.regex.test(value)
        ? null
        : `${facetLabel(facet)} value "${value}" does not match required pattern "${restriction.source}"`;
  }
}

export function evaluateRequirement(
  element: NormalizedElement,
  facet: ParsedRequirementFacet
): FacetCheckResult {
  const value = readFacetValue(element, facet);
  const filledIn = isFilledIn(value);

  if (facet.cardinality === "prohibited") {
    return filledIn
      ? {
          passed: false,
          message: `${facetLabel(facet)} must not be filled in, but has value "${String(value)}"`,
        }
      : { passed: true, message: "" };
  }

  if (!filledIn) {
    return { passed: false, message: missingMessage(facet) };
  }

  if (facet.restriction) {
    const failure = restrictionFailure(facet, facet.restriction, String(value));
    if (failure) return { passed: false, message: failure };
  }

  return { passed: true, message: "" };
}
