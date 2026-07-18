import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Resolves a file name under the repo-root fixtures/ifc/ directory.
 * packages/parser-adapters/src/ is three levels below repo root.
 */
export function fixturePath(fileName: string): string {
  const fixturesDir = fileURLToPath(new URL("../../../fixtures/ifc/", import.meta.url));
  return join(fixturesDir, fileName);
}
