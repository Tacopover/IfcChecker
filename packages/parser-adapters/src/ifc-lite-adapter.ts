import { readFile } from "node:fs/promises";
import type { IfcParseResult, IfcParserAdapter } from "./types.js";
import { parseIfcLiteBuffer } from "./ifc-lite-buffer.js";

export { parseIfcLiteBuffer } from "./ifc-lite-buffer.js";

export class IfcLiteAdapter implements IfcParserAdapter {
  async parse(filePath: string): Promise<IfcParseResult> {
    const raw = await readFile(filePath);
    return parseIfcLiteBuffer(raw);
  }
}
