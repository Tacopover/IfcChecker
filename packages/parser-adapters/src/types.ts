import type { ModelStructureNode, NormalizedElement, UnitScales } from "@ifc-qa/shared-types";

export interface UnrecognizedEntityType {
  ifcType: string;
  count: number;
}

export interface IfcParseResult {
  /** What a reviewer checks: physical elements, spaces and spatial zones. */
  elements: NormalizedElement[];
  /**
   * What an IDS specification may be written against — a **superset** of
   * `elements`, adding type objects, relationships, the spatial backbone,
   * materials, actors and presentation resources.
   *
   * Two lists rather than one wider list because the two questions differ: the
   * element list drives the Validate page and the explorer rail and would be
   * unusable flooded with relationships, while an applicability naming
   * `IfcWallType` has to find something. Validation reads this one so it cannot
   * accidentally be run against the narrow set — which reported a model clean
   * whenever a rule's target was not a physical element.
   */
  idsScope: NormalizedElement[];
  /**
   * What each measure in this file must be multiplied by to reach the SI unit IDS compares in.
   * Model-level rather than per-value: the file declares its units once, and a `dataType` on the
   * slot is enough to find the right one.
   */
  unitScales: UnitScales;
  parseMs: number;
  modelStructure: ModelStructureNode | null;
  /**
   * Types the file contains that no schema this build carries declares, with
   * how many instances of each. Empty for a well-formed IFC4/IFC2X3 model.
   * Anything listed here was dropped and may have been a real element — the
   * point is that it is now visible instead of vanishing.
   */
  unrecognizedTypes: UnrecognizedEntityType[];
}

export interface IfcParserAdapter {
  parse(filePath: string): Promise<IfcParseResult>;
}
