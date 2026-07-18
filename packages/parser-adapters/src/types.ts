import type { NormalizedElement } from "@ifc-qa/shared-types";

export interface IfcParseResult {
  elements: NormalizedElement[];
  parseMs: number;
}

export interface IfcParserAdapter {
  parse(filePath: string): Promise<IfcParseResult>;
}
