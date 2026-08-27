import { readFileSync } from "node:fs";
import { validateXML } from "xmllint-wasm";

/**
 * Validation against the real BCF-XML 2.1 schemas, not against our reading of them.
 *
 * `bcf-report.ts` is hand-written from `markup.xsd`/`visinfo.xsd`/`version.xsd` by the same person
 * who wrote this test, so it inherits whatever that person misread. This runs the schemas
 * themselves, through libxml2 compiled to WebAssembly — no native build, no network.
 *
 * Node only: it reads the vendored schema off disk and pulls in a 4 MB wasm module. Deliberately
 * not re-exported from `index.ts` or `browser.ts`.
 */

const SCHEMA_DIR = new URL("../schema/bcf-2.1/", import.meta.url);

function readSchema(fileName: string): string {
  return readFileSync(new URL(fileName, SCHEMA_DIR), "utf8");
}

function isSchemaCompileNoise(message: string): boolean {
  return /Schemas parser warning|failed to load external entity/.test(message);
}

/** Empty when `xml` satisfies the named vendored schema (`markup.xsd`, `visinfo.xsd`, `version.xsd`). */
export async function bcfXsdViolations(xml: string, schemaFileName: string): Promise<string[]> {
  let errors: readonly { message: string }[];
  try {
    const result = await validateXML({
      xml: [{ fileName: "document.xml", contents: xml }],
      schema: [readSchema(schemaFileName)],
    });
    if (result.valid) return [];
    errors = result.errors;
  } catch (error) {
    return [`xmllint could not read the document: ${error instanceof Error ? error.message : error}`];
  }

  const violations = errors
    .map((entry) => entry.message.replace(/^Schemas validity error : /, "").trim())
    .filter((message) => !isSchemaCompileNoise(message));

  return violations.length > 0 ? violations : ["xmllint reported the document invalid without a reason"];
}
