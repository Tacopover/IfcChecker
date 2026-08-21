// Browser-safe entry point (import via "@ifc-qa/parser-adapters/browser").
// Unlike the package's default entry ("."), this file's module graph has no
// Node-only imports (no node:fs, node:url, etc.) anywhere in it — every file
// it (transitively) imports is safe to evaluate in a Vite-bundled browser
// client. The default entry's WebIfcAdapter/IfcLiteAdapter classes (Node's
// filePath-based adapters, for the future worker-service) are deliberately
// excluded: importing that module graph crashes instantly in a browser the
// moment a top-level `node:fs/promises` import is evaluated, regardless of
// whether the Node-only code is ever called.
export * from "./types.js";
export * from "./element-filter.js";
export * from "./web-ifc-buffer.js";
export * from "./ifc-lite-buffer.js";
