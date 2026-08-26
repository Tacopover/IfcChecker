// Browser-safe entry point (import via "@ifc-qa/report-generator/browser").
// Unlike the package's default entry ("."), this file's module graph has no
// Node-only imports anywhere in it. The default entry's generatePdfReport
// pulls in pdfkit, which imports node:fs/stream/zlib, and pdf-report.ts
// itself reads the result via node:stream/consumers — both crash instantly
// in a Vite-bundled browser client. pdf-report.ts is deliberately excluded
// until that's fixed.
export * from "./types.js";
export * from "./sort-results.js";
export * from "./excel-report.js";
export * from "./bcf-report.js";
