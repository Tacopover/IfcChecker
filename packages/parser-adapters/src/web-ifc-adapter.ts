import { readFile } from "node:fs/promises";
import type { IfcParseResult, IfcParserAdapter } from "./types.js";
import { parseWebIfcBuffer } from "./web-ifc-buffer.js";

export { parseWebIfcBuffer } from "./web-ifc-buffer.js";

export class WebIfcAdapter implements IfcParserAdapter {
  async parse(filePath: string): Promise<IfcParseResult> {
    const raw = await readFile(filePath);
    return parseWebIfcBuffer(raw);
  }
}
