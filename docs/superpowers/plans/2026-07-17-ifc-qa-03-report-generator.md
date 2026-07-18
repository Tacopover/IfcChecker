# IFC QA Tool — 03: Report Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@ifc-qa/report-generator`, a pure rendering package exposing `generatePdfReport` and `generateExcelReport` — both take an already-assembled `RunReportData` payload and return a `Promise<Buffer>`, with no DB/network I/O of their own.

**Architecture:** A single small package with one pure function per output format, plus a shared row-sorting helper both formats use so PDF and Excel present issues in the same order. PDF rendering uses `pdfkit`'s native `doc.table()` (confirmed present in the published `pdfkit@0.19.1`, not a manual text/rect layout). Excel rendering uses `exceljs`'s `Workbook`/`Worksheet` API, writing directly to a `Buffer` via `workbook.xlsx.writeBuffer()`.

**Tech Stack:** TypeScript 5, Vitest, `pdfkit@^0.19.1` (+ `@types/pdfkit@^0.17.6`), `exceljs@^4.4.0`, `@types/node@^22.10.1`.

## Global Constraints

- Package scope: `@ifc-qa/*` (this package is `@ifc-qa/report-generator`).
- Node.js >= 20, pnpm >= 9 — per root `package.json`/`pnpm-workspace.yaml` from sub-plan 00.
- This package does **no DB or network I/O** — callers pass in already-fetched data; this package only renders it (per spec's Data Flow step 7: "PDF/Excel export is generated on demand from the same stored results").
- The two exported function names, their signatures, and the `RunReportData` shape are fixed contracts shared with the api-service sub-plan (04) — do not rename or reshape them:
  ```typescript
  export interface RunReportData {
    runId: string;
    ruleSetName: string;
    engine: "web-ifc" | "ifc-lite";
    generatedAt: string; // ISO timestamp
    results: Array<ElementResult & { fileName: string }>;
  }

  export function generatePdfReport(data: RunReportData): Promise<Buffer>;
  export function generateExcelReport(data: RunReportData): Promise<Buffer>;
  ```
- Scaffold (`package.json`, `tsconfig.json`, `vitest.config.ts`) follows the exact pattern used for `packages/shared-types` in sub-plan 00: extends `../../tsconfig.base.json`, `vitest.config.ts` sets `test.environment: "node"`, `"main": "./src/index.ts"`, `"types": "./src/index.ts"`.
- `ElementResult` and `Severity` are imported from `@ifc-qa/shared-types` (sub-plan 00) — never redeclared.

## Dependency Notes for Orchestration

This plan depends only on sub-plan 00 (foundation — it needs `@ifc-qa/shared-types`'s `ElementResult`/`Severity` to exist). It runs fully in parallel with sub-plans 01 (parser-adapters), 02 (ids-validator), 04 (api-service), 05 (worker-service), and 06 (frontend). Sub-plan 04 (api-service) depends on this plan's two exported functions (`generatePdfReport`, `generateExcelReport`) existing before final integration in sub-plan 07, but can stub/mock them in the meantime — the function names and `RunReportData` shape above are stable and safe to code against immediately.

---

### Task 1: Scaffold `@ifc-qa/report-generator` + `RunReportData` type

**Files:**
- Create: `packages/report-generator/package.json`
- Create: `packages/report-generator/tsconfig.json`
- Create: `packages/report-generator/vitest.config.ts`
- Create: `packages/report-generator/src/types.ts`
- Create: `packages/report-generator/src/index.ts`

**Interfaces:**
- Consumes: `ElementResult` (`@ifc-qa/shared-types`, sub-plan 00, Task 2).
- Produces: `RunReportData` — every later task in this plan, and the api-service sub-plan (04), imports this exact shape.

This task is pure scaffolding and a type-only file (no runtime behavior to red/green test — `RunReportData` is erased at compile time, so a Vitest unit test importing only the type would pass trivially even if the file were missing, since `import type` is elided by esbuild). It is verified with a real type-check (`tsc`) instead of a Vitest run, matching how sub-plan 00's Task 1 (root skeleton) verifies scaffolding with `pnpm install` rather than a unit test.

- [ ] **Step 1: Write `packages/report-generator/package.json`**

```json
{
  "name": "@ifc-qa/report-generator",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@ifc-qa/shared-types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/report-generator/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `packages/report-generator/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Write `packages/report-generator/src/types.ts`**

```typescript
import type { ElementResult } from "@ifc-qa/shared-types";

export interface RunReportData {
  runId: string;
  ruleSetName: string;
  engine: "web-ifc" | "ifc-lite";
  generatedAt: string; // ISO timestamp
  results: Array<ElementResult & { fileName: string }>;
}
```

- [ ] **Step 5: Write `packages/report-generator/src/index.ts`**

```typescript
export * from "./types.js";
```

- [ ] **Step 6: Install and type-check**

Run: `pnpm install`
Expected: pnpm discovers the new `packages/report-generator` workspace member (matches the `packages/*` glob in `pnpm-workspace.yaml` from sub-plan 00), links `@ifc-qa/shared-types` into its `node_modules`, and updates the root `pnpm-lock.yaml`.

Run: `pnpm --filter @ifc-qa/report-generator run build`
Expected: exits 0, emits `packages/report-generator/dist/types.js` and `dist/index.js` with no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/report-generator pnpm-lock.yaml
git commit -m "feat(report-generator): scaffold package and RunReportData type"
```

---

### Task 2: `sortResults` — shared row ordering helper

**Files:**
- Create: `packages/report-generator/src/sort-results.ts`
- Test: `packages/report-generator/src/sort-results.test.ts`

**Interfaces:**
- Consumes: `ElementResult`, `Severity` (`@ifc-qa/shared-types`, sub-plan 00, Task 2).
- Produces: `sortResults<T extends ElementResult & { fileName: string }>(results: T[]): T[]` — an internal helper (not re-exported from `index.ts`) that Tasks 3 and 4 both call so the PDF and Excel reports present rows in identical order.

Sort choice (stated explicitly, per the spec's "Group or sort however is clearest" guidance): sort by file name ascending, then by severity with errors before warnings, then by element type ascending as a final tiebreaker.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/report-generator/src/sort-results.test.ts
import { describe, expect, it } from "vitest";
import { sortResults } from "./sort-results.js";

describe("sortResults", () => {
  it("sorts by file name, then errors before warnings, then element type", () => {
    const unsorted = [
      {
        id: "r1",
        fileJobId: "fj1",
        elementGlobalId: "g1",
        elementType: "IFCWALL",
        ruleId: "naming-prefix",
        severity: "error" as const,
        message: "Name must start with 'W-'",
        fileName: "model-b.ifc",
      },
      {
        id: "r2",
        fileJobId: "fj1",
        elementGlobalId: "g2",
        elementType: "IFCDOOR",
        ruleId: "naming-prefix",
        severity: "warning" as const,
        message: "Door name missing suffix",
        fileName: "model-a.ifc",
      },
      {
        id: "r3",
        fileJobId: "fj2",
        elementGlobalId: "g3",
        elementType: "IFCWALL",
        ruleId: "fire-rating-required",
        severity: "error" as const,
        message: "Missing FireRating property",
        fileName: "model-a.ifc",
      },
    ];

    const sorted = sortResults(unsorted);

    expect(sorted.map((r) => r.id)).toEqual(["r3", "r2", "r1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/report-generator test`
Expected: FAIL — cannot resolve `./sort-results` (module does not exist yet)

- [ ] **Step 3: Write `packages/report-generator/src/sort-results.ts`**

```typescript
import type { ElementResult, Severity } from "@ifc-qa/shared-types";

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
};

export function sortResults<T extends ElementResult & { fileName: string }>(
  results: T[]
): T[] {
  return [...results].sort((a, b) => {
    if (a.fileName !== b.fileName) {
      return a.fileName.localeCompare(b.fileName);
    }
    if (a.severity !== b.severity) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    return a.elementType.localeCompare(b.elementType);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/report-generator test`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add packages/report-generator/src/sort-results.ts packages/report-generator/src/sort-results.test.ts
git commit -m "feat(report-generator): add sortResults row-ordering helper"
```

---

### Task 3: `generatePdfReport` — PDF export via pdfkit

**Files:**
- Modify: `packages/report-generator/package.json`
- Modify: `packages/report-generator/src/index.ts`
- Create: `packages/report-generator/src/pdf-report.ts`
- Test: `packages/report-generator/src/pdf-report.test.ts`

**Interfaces:**
- Consumes: `RunReportData` (Task 1), `sortResults` (Task 2).
- Produces: `generatePdfReport(data: RunReportData): Promise<Buffer>` — the api-service sub-plan (04) calls this from its PDF export route.

Confirmed against the actually-published packages (not assumed from memory):
- `pdfkit@0.19.1`'s bundled `js/pdfkit.js` contains a real `table(opts)` method (`TableMixin`/`PDFTable`) and `@types/pdfkit@0.17.6` types it as `table(options: TableOptionsWithData): PDFDocument` when a `data` array is supplied — so table rows are built with `doc.table({ columnStyles, defaultStyle, data })`, not manual rects/text.
- `PDFDocument` extends `stream.Readable` (`type PDFKitReadable = import("stream").Readable`), so the documented buffer-collection pattern (attach a consumer, then call `doc.end()`) applies. This plan uses Node's built-in `buffer()` from `node:stream/consumers` rather than a manual `data`/`end` listener pair, since it's equivalent and needs no extra dependency.
- `pdfkit` ships no `types` field in its own `package.json` — TypeScript types come from the separate `@types/pdfkit` package, added here as a devDependency.

- [ ] **Step 1: Modify `packages/report-generator/package.json` to add pdfkit**

```json
{
  "name": "@ifc-qa/report-generator",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@ifc-qa/shared-types": "workspace:*",
    "pdfkit": "^0.19.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "@types/pdfkit": "^0.17.6",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Install the new dependencies**

Run: `pnpm install`
Expected: exits 0, adds `pdfkit`, `@types/pdfkit`, `@types/node` under `packages/report-generator/node_modules` and updates `pnpm-lock.yaml`.

- [ ] **Step 3: Write the failing test**

```typescript
// packages/report-generator/src/pdf-report.test.ts
import { describe, expect, it } from "vitest";
import { generatePdfReport } from "./pdf-report.js";
import type { RunReportData } from "./types.js";

const fixture: RunReportData = {
  runId: "11111111-1111-1111-1111-111111111111",
  ruleSetName: "Company Naming Standard v3",
  engine: "web-ifc",
  generatedAt: "2026-07-17T00:00:00.000Z",
  results: [
    {
      id: "r1",
      fileJobId: "fj1",
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
      fileName: "model-b.ifc",
    },
    {
      id: "r2",
      fileJobId: "fj1",
      elementGlobalId: "g2",
      elementType: "IFCDOOR",
      ruleId: "naming-prefix",
      severity: "warning",
      message: "Door name missing suffix",
      fileName: "model-a.ifc",
    },
    {
      id: "r3",
      fileJobId: "fj2",
      elementGlobalId: "g3",
      elementType: "IFCWALL",
      ruleId: "fire-rating-required",
      severity: "error",
      message: "Missing FireRating property",
      fileName: "model-a.ifc",
    },
  ],
};

describe("generatePdfReport", () => {
  it("returns a non-empty PDF buffer", async () => {
    const result = await generatePdfReport(fixture);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/report-generator test`
Expected: FAIL — cannot resolve `./pdf-report` (module does not exist yet)

- [ ] **Step 5: Write `packages/report-generator/src/pdf-report.ts`**

```typescript
import PDFDocument from "pdfkit";
import { buffer } from "node:stream/consumers";
import type { Severity } from "@ifc-qa/shared-types";
import type { RunReportData } from "./types.js";
import { sortResults } from "./sort-results.js";

const SEVERITY_COLORS: Record<Severity, string> = {
  error: "#B00020",
  warning: "#8A6D00",
};

export async function generatePdfReport(data: RunReportData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });

  doc.fontSize(18).text("IFC QA Report", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Run ID: ${data.runId}`);
  doc.text(`Rule Set: ${data.ruleSetName}`);
  doc.text(`Engine: ${data.engine}`);
  doc.text(`Generated At: ${data.generatedAt}`);
  doc.moveDown(1);

  const sorted = sortResults(data.results);
  const headerRow = ["File", "Element Type", "Global ID", "Rule", "Severity", "Message"].map(
    (text) => ({
      text,
      font: { family: "Helvetica-Bold" },
      backgroundColor: "#eeeeee",
    })
  );
  const dataRows = sorted.map((result) => [
    { text: result.fileName },
    { text: result.elementType },
    { text: result.elementGlobalId },
    { text: result.ruleId },
    { text: result.severity, textColor: SEVERITY_COLORS[result.severity] },
    { text: result.message },
  ]);

  doc.table({
    columnStyles: [90, 70, 110, 90, 60, "*"],
    defaultStyle: { padding: 4, border: 1, borderColor: "#cccccc" },
    data: [headerRow, ...dataRows],
  });

  const pdfBuffer = buffer(doc);
  doc.end();
  return pdfBuffer;
}
```

- [ ] **Step 6: Modify `packages/report-generator/src/index.ts` to export it**

```typescript
export * from "./types.js";
export * from "./pdf-report.js";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/report-generator test`
Expected: PASS (2 tests total)

- [ ] **Step 8: Commit**

```bash
git add packages/report-generator
git commit -m "feat(report-generator): add generatePdfReport using pdfkit's table API"
```

---

### Task 4: `generateExcelReport` — Excel export via exceljs

**Files:**
- Modify: `packages/report-generator/package.json`
- Modify: `packages/report-generator/src/index.ts`
- Create: `packages/report-generator/src/excel-report.ts`
- Test: `packages/report-generator/src/excel-report.test.ts`

**Interfaces:**
- Consumes: `RunReportData` (Task 1), `sortResults` (Task 2).
- Produces: `generateExcelReport(data: RunReportData): Promise<Buffer>` — the api-service sub-plan (04) calls this from its Excel export route.

Confirmed against the actually-published `exceljs@4.4.0` package (its bundled `index.d.ts`, not assumed from memory): the workbook class is a **named** export (`export class Workbook { ... }`) with no `export default` and no `export =` — so the correct TypeScript import is `import { Workbook } from "exceljs"`, not `import ExcelJS from "exceljs"` (the latter would fail to type-check: there is no default export to synthesize, since `esModuleInterop` only synthesizes a default for CommonJS-style `export =` declarations, and this `.d.ts` is plain ESM-style named exports). Also confirmed: `workbook.xlsx.writeBuffer(): Promise<Buffer>` and `workbook.xlsx.load(buffer: Buffer): Promise<Workbook>` — both return/accept a real Node `Buffer`, no wrapping needed.

- [ ] **Step 1: Modify `packages/report-generator/package.json` to add exceljs**

```json
{
  "name": "@ifc-qa/report-generator",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@ifc-qa/shared-types": "workspace:*",
    "exceljs": "^4.4.0",
    "pdfkit": "^0.19.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "@types/pdfkit": "^0.17.6",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Install the new dependency**

Run: `pnpm install`
Expected: exits 0, adds `exceljs` under `packages/report-generator/node_modules` and updates `pnpm-lock.yaml`. (`exceljs` bundles its own types, so no `@types/exceljs` is needed.)

- [ ] **Step 3: Write the failing test**

```typescript
// packages/report-generator/src/excel-report.test.ts
import { describe, expect, it } from "vitest";
import { Workbook } from "exceljs";
import { generateExcelReport } from "./excel-report.js";
import type { RunReportData } from "./types.js";

const fixture: RunReportData = {
  runId: "11111111-1111-1111-1111-111111111111",
  ruleSetName: "Company Naming Standard v3",
  engine: "web-ifc",
  generatedAt: "2026-07-17T00:00:00.000Z",
  results: [
    {
      id: "r1",
      fileJobId: "fj1",
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
      fileName: "model-b.ifc",
    },
    {
      id: "r2",
      fileJobId: "fj1",
      elementGlobalId: "g2",
      elementType: "IFCDOOR",
      ruleId: "naming-prefix",
      severity: "warning",
      message: "Door name missing suffix",
      fileName: "model-a.ifc",
    },
    {
      id: "r3",
      fileJobId: "fj2",
      elementGlobalId: "g3",
      elementType: "IFCWALL",
      ruleId: "fire-rating-required",
      severity: "error",
      message: "Missing FireRating property",
      fileName: "model-a.ifc",
    },
  ],
};

describe("generateExcelReport", () => {
  it("returns a buffer that round-trips through exceljs with sorted rows", async () => {
    const result = await generateExcelReport(fixture);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const workbook = new Workbook();
    await workbook.xlsx.load(result);

    const resultsSheet = workbook.getWorksheet("Results");
    if (!resultsSheet) throw new Error("Results worksheet missing");

    expect(resultsSheet.rowCount).toBe(4); // 1 header + 3 data rows

    // Row 2: model-a.ifc / IFCWALL / error (sorted before model-a's warning)
    const row2 = resultsSheet.getRow(2);
    expect(row2.getCell(1).value).toBe("model-a.ifc");
    expect(row2.getCell(2).value).toBe("IFCWALL");
    expect(row2.getCell(5).value).toBe("error");
    expect(row2.getCell(6).value).toBe("Missing FireRating property");

    // Row 3: model-a.ifc / IFCDOOR / warning
    const row3 = resultsSheet.getRow(3);
    expect(row3.getCell(1).value).toBe("model-a.ifc");
    expect(row3.getCell(5).value).toBe("warning");

    // Row 4: model-b.ifc / IFCWALL / error
    const row4 = resultsSheet.getRow(4);
    expect(row4.getCell(1).value).toBe("model-b.ifc");
    expect(row4.getCell(5).value).toBe("error");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/report-generator test`
Expected: FAIL — cannot resolve `./excel-report` (module does not exist yet)

- [ ] **Step 5: Write `packages/report-generator/src/excel-report.ts`**

```typescript
import { Workbook } from "exceljs";
import type { RunReportData } from "./types.js";
import { sortResults } from "./sort-results.js";

const SUMMARY_SHEET_NAME = "Summary";
const RESULTS_SHEET_NAME = "Results";

export async function generateExcelReport(data: RunReportData): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = "IFC QA Tool";
  workbook.created = new Date(data.generatedAt);

  const summarySheet = workbook.addWorksheet(SUMMARY_SHEET_NAME);
  summarySheet.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Value", key: "value", width: 50 },
  ];
  summarySheet.addRows([
    { field: "Run ID", value: data.runId },
    { field: "Rule Set", value: data.ruleSetName },
    { field: "Engine", value: data.engine },
    { field: "Generated At", value: data.generatedAt },
  ]);

  const resultsSheet = workbook.addWorksheet(RESULTS_SHEET_NAME);
  resultsSheet.columns = [
    { header: "File", key: "fileName", width: 25 },
    { header: "Element Type", key: "elementType", width: 20 },
    { header: "Global ID", key: "elementGlobalId", width: 25 },
    { header: "Rule", key: "ruleId", width: 20 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Message", key: "message", width: 50 },
  ];
  resultsSheet.addRows(sortResults(data.results));

  return workbook.xlsx.writeBuffer();
}
```

- [ ] **Step 6: Modify `packages/report-generator/src/index.ts` to export it**

```typescript
export * from "./types.js";
export * from "./pdf-report.js";
export * from "./excel-report.js";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/report-generator test`
Expected: PASS (3 tests total)

- [ ] **Step 8: Commit**

```bash
git add packages/report-generator
git commit -m "feat(report-generator): add generateExcelReport using exceljs"
```

---

### Task 5: Public API integration smoke test + full verification

**Files:**
- Test: `packages/report-generator/src/index.test.ts`

**Interfaces:**
- Consumes: `generatePdfReport`, `generateExcelReport`, `RunReportData` — all re-exported from `./index` (Tasks 1, 3, 4).

This closes the loop on the contract the api-service sub-plan (04) will actually use: `import { generatePdfReport, generateExcelReport } from "@ifc-qa/report-generator"` resolves to `packages/report-generator/src/index.ts` (per its `"main"` field), so this test imports from `./index` (not the individual files) to prove the barrel re-exports both functions correctly.

- [ ] **Step 1: Write the test**

```typescript
// packages/report-generator/src/index.test.ts
import { describe, expect, it } from "vitest";
import { generatePdfReport, generateExcelReport } from "./index.js";
import type { RunReportData } from "./index.js";

const fixture: RunReportData = {
  runId: "11111111-1111-1111-1111-111111111111",
  ruleSetName: "Company Naming Standard v3",
  engine: "ifc-lite",
  generatedAt: "2026-07-17T00:00:00.000Z",
  results: [
    {
      id: "r1",
      fileJobId: "fj1",
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
      fileName: "model-b.ifc",
    },
    {
      id: "r2",
      fileJobId: "fj1",
      elementGlobalId: "g2",
      elementType: "IFCDOOR",
      ruleId: "naming-prefix",
      severity: "warning",
      message: "Door name missing suffix",
      fileName: "model-a.ifc",
    },
  ],
};

describe("@ifc-qa/report-generator public API", () => {
  it("generates a non-empty PDF buffer via the package barrel", async () => {
    const pdf = await generatePdfReport(fixture);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("generates a non-empty Excel buffer via the package barrel", async () => {
    const excel = await generateExcelReport(fixture);
    expect(Buffer.isBuffer(excel)).toBe(true);
    expect(excel.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `pnpm --filter @ifc-qa/report-generator test`
Expected: PASS (7 tests total: 1 sort-results, 1 pdf-report, 1 excel-report, 2 index)

- [ ] **Step 3: Run the full type-check/build**

Run: `pnpm --filter @ifc-qa/report-generator run build`
Expected: exits 0, no type errors, emits `packages/report-generator/dist/`.

- [ ] **Step 4: Commit**

```bash
git add packages/report-generator/src/index.test.ts
git commit -m "test(report-generator): add public API integration smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** The report content requirements from the spec — per row: file name, element type, element global ID, rule id, severity, message, plus a header/summary section with run id, rule set name, engine, and generated-at timestamp — are covered by both `generatePdfReport` (header text block + `doc.table()`) and `generateExcelReport` (`Summary` sheet + `Results` sheet). Filtering by file/element type/rule/severity is explicitly a frontend/UI concern per the spec ("filterable in-browser issue table") — this package only needs to present all the data those filters operate on, which it does; it does not implement filtering itself.
- **Sorting choice stated explicitly:** file name ascending, then errors before warnings, then element type ascending (Task 2), applied identically to both output formats via the shared `sortResults` helper.
- **No placeholders:** every step has complete, real code; no "TODO"/"add validation"/"similar to Task N" shortcuts.
- **Type consistency:** `RunReportData`, `generatePdfReport`, `generateExcelReport` are declared once (Tasks 1, 3, 4) and used identically in every later step and test — matching the exact contract handed to the api-service sub-plan.
- **API grounding:** `pdfkit`'s `doc.table()` and `exceljs`'s named `Workbook` export (no default export) were confirmed by extracting and inspecting the actual published npm tarballs (`pdfkit@0.19.1`, `@types/pdfkit@0.17.6`, `exceljs@4.4.0`) and cross-checked against Context7's current docs — not assumed from training data.
- **Isolation:** no task in this plan touches any file outside `packages/report-generator/`.
