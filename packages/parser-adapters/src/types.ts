import type { ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";

export interface UnrecognizedEntityType {
  ifcType: string;
  count: number;
}

export interface IfcParseResult {
  elements: NormalizedElement[];
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
