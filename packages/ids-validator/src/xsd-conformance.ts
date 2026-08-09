import { readFileSync } from "node:fs";
import { validateXML } from "xmllint-wasm";

/**
 * Validation against the real `ids.xsd`, not against our reading of it.
 *
 * `idsSchemaViolations` is hand-written from the schema by the same person who wrote the exporter,
 * so it inherits whatever that person misread. This runs the schema itself, through libxml2
 * compiled to WebAssembly — no native build, no Python, no network, so the gate cannot skip it.
 *
 * Node only: it reads the vendored schema off disk and pulls in a 4 MB wasm module. Deliberately
 * not re-exported from `index.ts`, because the browser bundle must not grow a schema validator.
 */

const SCHEMA_DIR = new URL("../schema/", import.meta.url);

/**
 * `ids.xsd` imports the two W3C meta-schemas by absolute URL. Nothing here has network access, so
 * point those two `schemaLocation`s at the vendored copies and drop the XMLSchema-instance import,
 * which resolves to no schema document at all — libxml2 knows `xsi:` natively. The vendored
 * `ids.xsd` itself stays byte-for-byte upstream so it can be diffed against a new release.
 */
function localizedIdsSchema(): string {
  return readFileSync(new URL("ids.xsd", SCHEMA_DIR), "utf8")
    .replace("http://www.w3.org/2001/xml.xsd", "xml.xsd")
    .replace("http://www.w3.org/2001/XMLSchema.xsd", "XMLSchema.xsd")
    .replace(/[ \t]*<xs:import namespace="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance"[^>]*\/>\n/, "");
}

let schemaFiles: { fileName: string; contents: string }[] | null = null;

function loadSchema(): { fileName: string; contents: string }[] {
  if (!schemaFiles) {
    schemaFiles = [
      { fileName: "ids.xsd", contents: localizedIdsSchema() },
      { fileName: "xml.xsd", contents: readFileSync(new URL("xml.xsd", SCHEMA_DIR), "utf8") },
      {
        fileName: "XMLSchema.xsd",
        contents: readFileSync(new URL("XMLSchema.xsd", SCHEMA_DIR), "utf8"),
      },
    ];
  }
  return schemaFiles;
}

/**
 * Warnings libxml2 emits while compiling the schema, not findings about the document. The
 * duplicate-import one is unavoidable: XMLSchema.xsd imports xml.xsd by URL, and we have already
 * imported the same namespace from the vendored copy.
 */
function isSchemaCompileNoise(message: string): boolean {
  return /Schemas parser warning|failed to load external entity/.test(message);
}

/** Empty when the document satisfies `ids.xsd`; one entry per schema violation otherwise. */
export async function idsXsdViolations(idsXml: string): Promise<string[]> {
  const [schema, ...preload] = loadSchema();

  let errors: readonly { message: string }[];
  try {
    const result = await validateXML({
      xml: [{ fileName: "document.ids", contents: idsXml }],
      schema: [schema],
      preload,
    });
    if (result.valid) return [];
    errors = result.errors;
  } catch (error) {
    // xmllint-wasm throws rather than returning for a document it cannot even parse.
    return [`xmllint could not read the document: ${error instanceof Error ? error.message : error}`];
  }

  const violations = errors
    .map((entry) => entry.message.replace(/^Schemas validity error : /, "").trim())
    .filter((message) => !isSchemaCompileNoise(message));

  // valid === false with everything filtered away would report a clean document from a failed run.
  return violations.length > 0 ? violations : ["xmllint reported the document invalid without a reason"];
}
