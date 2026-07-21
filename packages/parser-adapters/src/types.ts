import type { ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";

export interface IfcParseResult {
  elements: NormalizedElement[];
  parseMs: number;
  modelStructure: ModelStructureNode | null;
}

export interface IfcParserAdapter {
  parse(filePath: string): Promise<IfcParseResult>;
}
