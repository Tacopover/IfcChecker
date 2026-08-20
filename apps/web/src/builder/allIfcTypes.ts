import { IFC_ENTITY_PARENTS } from "@ifc-qa/shared-types";
import { isAbstractIfcType } from "@ifc-qa/ids-validator";

/**
 * Every concrete IFC4 entity name the schema defines, for the Applies-to step's "show all IFC
 * types" toggle. Abstract entities are excluded — no element can carry one directly, so offering
 * one to pick would let a rule select nothing (`expandedTypeNamesFor` already applies the same
 * exclusion when a picked ancestor is expanded).
 */
export function allIfcTypeNames(): string[] {
  return Object.keys(IFC_ENTITY_PARENTS)
    .filter((name) => !isAbstractIfcType(name))
    .sort((a, b) => a.localeCompare(b));
}
