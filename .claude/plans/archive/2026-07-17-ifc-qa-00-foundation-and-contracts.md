# IFC QA Tool — 00: Foundation & Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo skeleton and every cross-cutting contract (domain types, queue job payloads, API DTOs, storage interface, DB schema) that the parser-adapters, ids-validator, report-generator, api, worker, and frontend sub-plans all depend on.

**Architecture:** pnpm workspaces monorepo. All shared contracts live in `packages/shared-types` as Zod schemas (runtime-validatable + statically typed). A tiny `packages/storage` gives api/worker an identical local-disk file interface. A tiny `packages/db` holds the Drizzle ORM schema + client factory so api and worker read/write the same tables without duplicating column definitions. `packages/parser-adapters` gets only its interface here — concrete engine adapters are built in sub-plan 01.

**Tech Stack:** pnpm workspaces, TypeScript 5, Vitest, Zod (schema + type), Drizzle ORM + drizzle-kit (Postgres, `node-postgres`/`pg` driver), Docker Compose (Postgres 16 + Redis 7).

## Global Constraints

- No auth — every service assumes a trusted internal network (per spec).
- Package scope for all internal packages: `@ifc-qa/*`.
- Node.js >= 20, pnpm >= 9 (`packageManager` field pins the exact version).
- Every cross-service contract (queue payloads, API DTOs, DB rows) is defined **once**, in `packages/shared-types` or `packages/db`, and imported everywhere else — never redeclared.
- Local disk storage only for v1 (per spec's deferred hosting choice) — the `StorageAdapter` interface must not leak local-disk assumptions into its callers.

## Dependency Notes for Orchestration

This plan (00) has no dependencies and **must complete before any other sub-plan starts** — every other sub-plan imports `@ifc-qa/shared-types`, and the worker/api sub-plans also import `@ifc-qa/db` and `@ifc-qa/storage`. Once this plan is done, sub-plans 01–06 (parser-adapters, ids-validator, report-generator, api-service, worker-service, frontend) can all run **in parallel** — each only imports the contracts fixed here. Sub-plan 07 (integration) runs last, after 01–06 all land.

---

### Task 1: Monorepo skeleton

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`

**Interfaces:**
- Produces: workspace glob (`apps/*`, `packages/*`) every later package/app registers into; root scripts `pnpm test`, `pnpm build`, `pnpm lint` that fan out with `-r`.

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "ifc-qa-tool",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "db:generate": "pnpm --filter @ifc-qa/db run db:generate",
    "db:migrate": "pnpm --filter @ifc-qa/db run db:migrate"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 3: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": false,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
*.tsbuildinfo
.env
docker/pgdata/
```

- [ ] **Step 5: Write `.npmrc`**

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 6: Verify workspace installs**

Run: `pnpm install`
Expected: exits 0, creates `node_modules/.pnpm` and a root `pnpm-lock.yaml`. No packages exist yet, so this just proves pnpm is available and the workspace file is valid.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .npmrc pnpm-lock.yaml
git commit -m "chore: initialize pnpm monorepo skeleton"
```

---

### Task 2: `@ifc-qa/shared-types` — domain schemas

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/vitest.config.ts`
- Create: `packages/shared-types/src/domain.ts`
- Create: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/domain.test.ts`

**Interfaces:**
- Produces: `PropertyValueSchema`/`PropertyValue`, `NormalizedElementSchema`/`NormalizedElement`, `EngineIdSchema`/`EngineId` (`'web-ifc' | 'ifc-lite'`), `FileJobStatusSchema`/`FileJobStatus`, `RunStatusSchema`/`RunStatus`, `SeveritySchema`/`Severity`, `ElementResultSchema`/`ElementResult` — every later task in every sub-plan imports these from `@ifc-qa/shared-types`.

- [ ] **Step 1: Write `packages/shared-types/package.json`**

```json
{
  "name": "@ifc-qa/shared-types",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/shared-types/tsconfig.json`**

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

- [ ] **Step 3: Write `packages/shared-types/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing test**

```typescript
// packages/shared-types/src/domain.test.ts
import { describe, expect, it } from "vitest";
import {
  NormalizedElementSchema,
  ElementResultSchema,
  EngineIdSchema,
} from "./domain.js";

describe("NormalizedElementSchema", () => {
  it("accepts a well-formed element", () => {
    const parsed = NormalizedElementSchema.parse({
      globalId: "1abc2defGHI3jkl4mno5pq",
      ifcType: "IFCWALL",
      predefinedType: "STANDARD",
      name: "Wall-01",
      attributes: { Tag: "W-001" },
      propertySets: { Pset_WallCommon: { IsExternal: true, FireRating: "REI60" } },
    });
    expect(parsed.ifcType).toBe("IFCWALL");
  });

  it("rejects a missing globalId", () => {
    const result = NormalizedElementSchema.safeParse({
      ifcType: "IFCWALL",
      predefinedType: null,
      name: null,
      attributes: {},
      propertySets: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("EngineIdSchema", () => {
  it("only accepts the two known engines", () => {
    expect(EngineIdSchema.safeParse("web-ifc").success).toBe(true);
    expect(EngineIdSchema.safeParse("ifc-lite").success).toBe(true);
    expect(EngineIdSchema.safeParse("revit").success).toBe(false);
  });
});

describe("ElementResultSchema", () => {
  it("accepts a well-formed result", () => {
    const parsed = ElementResultSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      fileJobId: "22222222-2222-2222-2222-222222222222",
      elementGlobalId: "1abc2defGHI3jkl4mno5pq",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
    });
    expect(parsed.severity).toBe("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: FAIL — `Cannot find module './domain'`

- [ ] **Step 3: Write `packages/shared-types/src/domain.ts`**

```typescript
import { z } from "zod";

export const PropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type PropertyValue = z.infer<typeof PropertyValueSchema>;

export const NormalizedElementSchema = z.object({
  globalId: z.string(),
  ifcType: z.string(),
  predefinedType: z.string().nullable(),
  name: z.string().nullable(),
  attributes: z.record(z.string(), PropertyValueSchema),
  propertySets: z.record(z.string(), z.record(z.string(), PropertyValueSchema)),
});
export type NormalizedElement = z.infer<typeof NormalizedElementSchema>;

export const EngineIdSchema = z.enum(["web-ifc", "ifc-lite"]);
export type EngineId = z.infer<typeof EngineIdSchema>;

export const FileJobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export type FileJobStatus = z.infer<typeof FileJobStatusSchema>;

export const RunStatusSchema = z.enum(["queued", "running", "completed"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const SeveritySchema = z.enum(["error", "warning"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ElementResultSchema = z.object({
  id: z.string(),
  fileJobId: z.string(),
  elementGlobalId: z.string(),
  elementType: z.string(),
  ruleId: z.string(),
  severity: SeveritySchema,
  message: z.string(),
});
export type ElementResult = z.infer<typeof ElementResultSchema>;
```

- [ ] **Step 4: Write `packages/shared-types/src/index.ts`**

```typescript
export * from "./domain.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add domain schemas (NormalizedElement, ElementResult, enums)"
```

---

### Task 3: `@ifc-qa/shared-types` — queue job contracts

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/queue.ts`
- Test: `packages/shared-types/src/queue.test.ts`

**Interfaces:**
- Consumes: `EngineIdSchema` (Task 2).
- Produces: `PARSE_JOB_QUEUE_NAME` (string constant), `ParseJobPayloadSchema`/`ParseJobPayload`, `ParseJobResultSchema`/`ParseJobResult` — the api-service sub-plan (04) enqueues `ParseJobPayload`; the worker-service sub-plan (05) consumes it and returns `ParseJobResult`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared-types/src/queue.test.ts
import { describe, expect, it } from "vitest";
import { ParseJobPayloadSchema, ParseJobResultSchema, PARSE_JOB_QUEUE_NAME } from "./queue.js";

describe("PARSE_JOB_QUEUE_NAME", () => {
  it("is a stable, non-empty string", () => {
    expect(PARSE_JOB_QUEUE_NAME).toBe("parse-file-job");
  });
});

describe("ParseJobPayloadSchema", () => {
  it("accepts a well-formed payload", () => {
    const parsed = ParseJobPayloadSchema.parse({
      fileJobId: "22222222-2222-2222-2222-222222222222",
      runId: "33333333-3333-3333-3333-333333333333",
      engine: "web-ifc",
      filePath: "runs/33333333.../model.ifc",
      ruleSetId: "44444444-4444-4444-4444-444444444444",
    });
    expect(parsed.engine).toBe("web-ifc");
  });

  it("rejects an unknown engine", () => {
    const result = ParseJobPayloadSchema.safeParse({
      fileJobId: "x",
      runId: "y",
      engine: "revit",
      filePath: "z",
      ruleSetId: "w",
    });
    expect(result.success).toBe(false);
  });
});

describe("ParseJobResultSchema", () => {
  it("accepts a failed result with an error message", () => {
    const parsed = ParseJobResultSchema.parse({
      fileJobId: "22222222-2222-2222-2222-222222222222",
      status: "failed",
      parseMs: 0,
      elementCount: 0,
      errorMessage: "corrupt IFC header",
    });
    expect(parsed.status).toBe("failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: FAIL — `Cannot find module './queue'`

- [ ] **Step 3: Write `packages/shared-types/src/queue.ts`**

```typescript
import { z } from "zod";
import { EngineIdSchema } from "./domain.js";

export const PARSE_JOB_QUEUE_NAME = "parse-file-job";

export const ParseJobPayloadSchema = z.object({
  fileJobId: z.string(),
  runId: z.string(),
  engine: EngineIdSchema,
  filePath: z.string(),
  ruleSetId: z.string(),
});
export type ParseJobPayload = z.infer<typeof ParseJobPayloadSchema>;

export const ParseJobResultSchema = z.object({
  fileJobId: z.string(),
  status: z.enum(["succeeded", "failed"]),
  parseMs: z.number(),
  elementCount: z.number(),
  errorMessage: z.string().nullable(),
});
export type ParseJobResult = z.infer<typeof ParseJobResultSchema>;
```

- [ ] **Step 4: Add the export to `packages/shared-types/src/index.ts`**

```typescript
export * from "./domain.js";
export * from "./queue.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: PASS (7 tests total)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add BullMQ parse-job queue contracts"
```

---

### Task 4: `@ifc-qa/shared-types` — API DTO contracts

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/api.ts`
- Test: `packages/shared-types/src/api.test.ts`

**Interfaces:**
- Consumes: `EngineIdSchema`, `FileJobStatusSchema`, `RunStatusSchema`, `ElementResultSchema` (Task 2).
- Produces: `CreateRunResponseSchema`/`CreateRunResponse`, `RunStatusResponseSchema`/`RunStatusResponse`, `RunResultsResponseSchema`/`RunResultsResponse`, `RuleSetSummarySchema`/`RuleSetSummary` — the api-service sub-plan (04) returns these from its HTTP routes; the frontend sub-plan (06) fetches and renders them (and can build against these types before the real API exists, e.g. via a mock server).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared-types/src/api.test.ts
import { describe, expect, it } from "vitest";
import {
  CreateRunResponseSchema,
  RunStatusResponseSchema,
  RunResultsResponseSchema,
  RuleSetSummarySchema,
} from "./api.js";

describe("CreateRunResponseSchema", () => {
  it("accepts a run id plus its file job ids", () => {
    const parsed = CreateRunResponseSchema.parse({
      runId: "r1",
      fileJobIds: ["f1", "f2"],
    });
    expect(parsed.fileJobIds).toHaveLength(2);
  });
});

describe("RunStatusResponseSchema", () => {
  it("accepts per-file status with nullable timing/error", () => {
    const parsed = RunStatusResponseSchema.parse({
      runId: "r1",
      status: "running",
      fileJobs: [
        {
          id: "f1",
          fileName: "model-a.ifc",
          status: "succeeded",
          engine: "web-ifc",
          parseMs: 842,
          errorMessage: null,
        },
        {
          id: "f2",
          fileName: "model-b.ifc",
          status: "failed",
          engine: "ifc-lite",
          parseMs: null,
          errorMessage: "unexpected EOF",
        },
      ],
    });
    expect(parsed.fileJobs[1].errorMessage).toBe("unexpected EOF");
  });
});

describe("RunResultsResponseSchema", () => {
  it("accepts results tagged with the source file name", () => {
    const parsed = RunResultsResponseSchema.parse({
      runId: "r1",
      results: [
        {
          id: "e1",
          fileJobId: "f1",
          elementGlobalId: "g1",
          elementType: "IFCWALL",
          ruleId: "naming-prefix",
          severity: "error",
          message: "bad name",
          fileName: "model-a.ifc",
        },
      ],
    });
    expect(parsed.results[0].fileName).toBe("model-a.ifc");
  });
});

describe("RuleSetSummarySchema", () => {
  it("accepts an uploaded rule set summary", () => {
    const parsed = RuleSetSummarySchema.parse({
      id: "rs1",
      name: "Company Naming Standard v3",
      uploadedAt: "2026-07-17T00:00:00.000Z",
    });
    expect(parsed.name).toContain("Naming Standard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: FAIL — `Cannot find module './api'`

- [ ] **Step 3: Write `packages/shared-types/src/api.ts`**

```typescript
import { z } from "zod";
import {
  EngineIdSchema,
  FileJobStatusSchema,
  RunStatusSchema,
  ElementResultSchema,
} from "./domain.js";

export const CreateRunResponseSchema = z.object({
  runId: z.string(),
  fileJobIds: z.array(z.string()),
});
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;

export const FileJobSummarySchema = z.object({
  id: z.string(),
  fileName: z.string(),
  status: FileJobStatusSchema,
  engine: EngineIdSchema,
  parseMs: z.number().nullable(),
  errorMessage: z.string().nullable(),
});
export type FileJobSummary = z.infer<typeof FileJobSummarySchema>;

export const RunStatusResponseSchema = z.object({
  runId: z.string(),
  status: RunStatusSchema,
  fileJobs: z.array(FileJobSummarySchema),
});
export type RunStatusResponse = z.infer<typeof RunStatusResponseSchema>;

export const RunResultsResponseSchema = z.object({
  runId: z.string(),
  results: z.array(ElementResultSchema.extend({ fileName: z.string() })),
});
export type RunResultsResponse = z.infer<typeof RunResultsResponseSchema>;

export const RuleSetSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  uploadedAt: z.string(),
});
export type RuleSetSummary = z.infer<typeof RuleSetSummarySchema>;
```

- [ ] **Step 4: Add the export to `packages/shared-types/src/index.ts`**

```typescript
export * from "./domain.js";
export * from "./queue.js";
export * from "./api.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: PASS (11 tests total)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add API response DTO contracts"
```

---

### Task 5: `@ifc-qa/parser-adapters` — adapter interface scaffold

**Files:**
- Create: `packages/parser-adapters/package.json`
- Create: `packages/parser-adapters/tsconfig.json`
- Create: `packages/parser-adapters/vitest.config.ts`
- Create: `packages/parser-adapters/src/types.ts`
- Create: `packages/parser-adapters/src/index.ts`
- Test: `packages/parser-adapters/src/types.test.ts`

**Interfaces:**
- Consumes: `NormalizedElement` (`@ifc-qa/shared-types`, Task 2).
- Produces: `IfcParserAdapter` interface — sub-plan 01 implements `WebIfcAdapter` and `IfcLiteAdapter` against this exact shape; sub-plan 05 (worker) depends on this interface (not the concrete engines) to write its own unit tests against a fake adapter.

- [ ] **Step 1: Write `packages/parser-adapters/package.json`**

```json
{
  "name": "@ifc-qa/parser-adapters",
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

- [ ] **Step 2: Write `packages/parser-adapters/tsconfig.json`**

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

- [ ] **Step 3: Write `packages/parser-adapters/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing test**

```typescript
// packages/parser-adapters/src/types.test.ts
import { describe, expect, it } from "vitest";
import type { IfcParserAdapter } from "./types.js";

class FakeAdapter implements IfcParserAdapter {
  async parse(filePath: string) {
    return {
      elements: [
        {
          globalId: "g1",
          ifcType: "IFCWALL",
          predefinedType: null,
          name: filePath,
          attributes: {},
          propertySets: {},
        },
      ],
      parseMs: 1,
    };
  }
}

describe("IfcParserAdapter", () => {
  it("a conforming class can be constructed and parsed", async () => {
    const adapter = new FakeAdapter();
    const result = await adapter.parse("fixture.ifc");
    expect(result.elements[0].ifcType).toBe("IFCWALL");
    expect(result.parseMs).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: FAIL — `Cannot find module './types'`

- [ ] **Step 6: Write `packages/parser-adapters/src/types.ts`**

```typescript
import type { NormalizedElement } from "@ifc-qa/shared-types";

export interface IfcParseResult {
  elements: NormalizedElement[];
  parseMs: number;
}

export interface IfcParserAdapter {
  parse(filePath: string): Promise<IfcParseResult>;
}
```

- [ ] **Step 7: Write `packages/parser-adapters/src/index.ts`**

```typescript
export * from "./types.js";
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (1 test)

- [ ] **Step 9: Commit**

```bash
git add packages/parser-adapters
git commit -m "feat(parser-adapters): add IfcParserAdapter interface scaffold"
```

---

### Task 6: `@ifc-qa/storage` — storage interface + local disk implementation

**Files:**
- Create: `packages/storage/package.json`
- Create: `packages/storage/tsconfig.json`
- Create: `packages/storage/vitest.config.ts`
- Create: `packages/storage/src/types.ts`
- Create: `packages/storage/src/local-disk-storage-adapter.ts`
- Create: `packages/storage/src/index.ts`
- Test: `packages/storage/src/local-disk-storage-adapter.test.ts`

**Interfaces:**
- Produces: `StorageAdapter` interface, `LocalDiskStorageAdapter` class (`constructor(rootDir: string)`) — sub-plan 04 (api) uses this to persist uploaded files; sub-plan 05 (worker) uses the same instance/config to read them back and to persist generated reports.

- [ ] **Step 1: Write `packages/storage/package.json`**

```json
{
  "name": "@ifc-qa/storage",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/storage/tsconfig.json`**

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

- [ ] **Step 3: Write `packages/storage/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing test**

```typescript
// packages/storage/src/local-disk-storage-adapter.test.ts
import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { LocalDiskStorageAdapter } from "./local-disk-storage-adapter.js";

describe("LocalDiskStorageAdapter", () => {
  const roots: string[] = [];
  const makeRoot = () => {
    const dir = mkdtempSync(join(tmpdir(), "ifc-qa-storage-"));
    roots.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of roots.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips a buffer write/read", async () => {
    const adapter = new LocalDiskStorageAdapter(makeRoot());
    await adapter.write("runs/r1/model.ifc", Buffer.from("ISO-10303-21;"));

    const stream = await adapter.read("runs/r1/model.ifc");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("ISO-10303-21;");
  });

  it("round-trips a stream write", async () => {
    const adapter = new LocalDiskStorageAdapter(makeRoot());
    await adapter.write("runs/r2/model.ifc", Readable.from([Buffer.from("hello")]));

    const stream = await adapter.read("runs/r2/model.ifc");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("hello");
  });

  it("deletes a stored key", async () => {
    const adapter = new LocalDiskStorageAdapter(makeRoot());
    await adapter.write("runs/r3/model.ifc", Buffer.from("x"));
    await adapter.delete("runs/r3/model.ifc");
    await expect(adapter.read("runs/r3/model.ifc")).rejects.toThrow();
  });

  it("exposes an absolute path for keys that were written", async () => {
    const root = makeRoot();
    const adapter = new LocalDiskStorageAdapter(root);
    await adapter.write("runs/r4/model.ifc", Buffer.from("x"));
    expect(adapter.getAbsolutePath("runs/r4/model.ifc")).toBe(
      join(root, "runs/r4/model.ifc")
    );
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/storage test`
Expected: FAIL — `Cannot find module './local-disk-storage-adapter'`

- [ ] **Step 6: Write `packages/storage/src/types.ts`**

```typescript
export interface StorageAdapter {
  write(key: string, data: Buffer | NodeJS.ReadableStream): Promise<void>;
  read(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  getAbsolutePath(key: string): string;
}
```

- [ ] **Step 7: Write `packages/storage/src/local-disk-storage-adapter.ts`**

```typescript
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { StorageAdapter } from "./types.js";

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
  }

  getAbsolutePath(key: string): string {
    return join(this.rootDir, key);
  }

  async write(key: string, data: Buffer | NodeJS.ReadableStream): Promise<void> {
    const absolutePath = this.getAbsolutePath(key);
    await mkdir(dirname(absolutePath), { recursive: true });
    const source = Buffer.isBuffer(data) ? Readable.from(data) : data;
    await pipeline(source, createWriteStream(absolutePath));
  }

  async read(key: string): Promise<NodeJS.ReadableStream> {
    return createReadStream(this.getAbsolutePath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.getAbsolutePath(key), { force: true });
  }
}
```

- [ ] **Step 8: Write `packages/storage/src/index.ts`**

```typescript
export * from "./types.js";
export * from "./local-disk-storage-adapter.js";
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/storage test`
Expected: PASS (4 tests)

- [ ] **Step 10: Commit**

```bash
git add packages/storage
git commit -m "feat(storage): add StorageAdapter interface and local disk implementation"
```

---

### Task 7: `@ifc-qa/db` — Drizzle schema, client factory, and local Postgres/Redis via Docker Compose

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/vitest.config.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Test: `packages/db/src/client.integration.test.ts`
- Create: `docker-compose.yml` (repo root)

**Interfaces:**
- Produces: `ruleSets`, `runs`, `fileJobs`, `elementResults` Drizzle tables; `createDbClient(connectionString: string): DbClient` — sub-plan 04 (api) and sub-plan 05 (worker) both import `schema` and `createDbClient` from `@ifc-qa/db` to read/write the same rows.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ifc_qa
      POSTGRES_PASSWORD: ifc_qa
      POSTGRES_DB: ifc_qa
    ports:
      - "5432:5432"
    volumes:
      - ./docker/pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

- [ ] **Step 2: Write `packages/db/package.json`**

```json
{
  "name": "@ifc-qa/db",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.1",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@types/pg": "^8.11.10",
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 3: Write `packages/db/tsconfig.json`**

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

- [ ] **Step 4: Write `packages/db/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
  },
});
```

- [ ] **Step 5: Write `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://ifc_qa:ifc_qa@localhost:5432/ifc_qa",
  },
});
```

- [ ] **Step 6: Write `packages/db/src/schema.ts`**

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

export const engineEnum = pgEnum("engine", ["web-ifc", "ifc-lite"]);
export const fileJobStatusEnum = pgEnum("file_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "completed",
]);
export const severityEnum = pgEnum("severity", ["error", "warning"]);

export const ruleSets = pgTable("rule_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  idsXml: text("ids_xml").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleSetId: uuid("rule_set_id")
    .notNull()
    .references(() => ruleSets.id),
  engine: engineEnum("engine").notNull(),
  status: runStatusEnum("status").notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fileJobs = pgTable("file_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  fileName: text("file_name").notNull(),
  storageKey: text("storage_key").notNull(),
  status: fileJobStatusEnum("status").notNull().default("queued"),
  parseMs: integer("parse_ms"),
  errorMessage: text("error_message"),
});

export const elementResults = pgTable("element_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileJobId: uuid("file_job_id")
    .notNull()
    .references(() => fileJobs.id),
  elementGlobalId: text("element_global_id").notNull(),
  elementType: text("element_type").notNull(),
  ruleId: text("rule_id").notNull(),
  severity: severityEnum("severity").notNull(),
  message: text("message").notNull(),
});
```

- [ ] **Step 7: Write `packages/db/src/client.ts`**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export function createDbClient(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
export { schema };
```

- [ ] **Step 8: Write `packages/db/src/index.ts`**

```typescript
export * from "./schema.js";
export * from "./client.js";
```

- [ ] **Step 9: Write the integration test (requires `docker compose up -d postgres`)**

```typescript
// packages/db/src/client.integration.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { createDbClient, ruleSets, runs, fileJobs } from "./index.js";

const CONNECTION_STRING =
  process.env.DATABASE_URL ?? "postgresql://ifc_qa:ifc_qa@localhost:5432/ifc_qa";

describe("db client against a real Postgres instance", () => {
  const db = createDbClient(CONNECTION_STRING);

  beforeAll(() => {
    execSync("pnpm --filter @ifc-qa/db run db:migrate", { stdio: "inherit" });
  });

  afterAll(async () => {
    await db.delete(fileJobs);
    await db.delete(runs);
    await db.delete(ruleSets);
  });

  it("inserts a rule set, a run, and a file job, then reads them back", async () => {
    const [ruleSet] = await db
      .insert(ruleSets)
      .values({ name: "Test Rule Set", idsXml: "<ids/>" })
      .returning();

    const [run] = await db
      .insert(runs)
      .values({ ruleSetId: ruleSet.id, engine: "web-ifc" })
      .returning();

    const [fileJob] = await db
      .insert(fileJobs)
      .values({
        runId: run.id,
        fileName: "model.ifc",
        storageKey: `runs/${run.id}/model.ifc`,
      })
      .returning();

    expect(fileJob.status).toBe("queued");
    expect(fileJob.runId).toBe(run.id);
  });
});
```

- [ ] **Step 10: Start Postgres and generate the initial migration**

Run: `docker compose up -d postgres`
Run: `pnpm --filter @ifc-qa/db run db:generate`
Expected: creates `packages/db/migrations/0000_*.sql` with `CREATE TYPE`/`CREATE TABLE` statements for all four tables.

- [ ] **Step 11: Run the integration test**

Run: `pnpm --filter @ifc-qa/db test`
Expected: PASS (1 test) — the `beforeAll` hook applies the generated migration before the test runs.

- [ ] **Step 12: Commit**

```bash
git add packages/db docker-compose.yml
git commit -m "feat(db): add Drizzle schema, client factory, and Docker Compose for local Postgres/Redis"
```

---

### Task 8: Root dev-setup documentation

**Files:**
- Create: `README.md` (repo root)

- [ ] **Step 1: Write `README.md`**

```markdown
# IFC QA Tool

Internal MEPover tool for checking naming/parameter compliance on uploaded IFC models against buildingSMART IDS rule sets. See `docs/superpowers/specs/2026-07-17-ifc-qa-tool-design.md` for the full design and `docs/superpowers/plans/` for the implementation plans.

## Dev setup

1. Install pnpm 9+ and Node 20+.
2. `pnpm install`
3. `docker compose up -d` (starts Postgres on 5432, Redis on 6379)
4. `pnpm db:migrate`
5. `pnpm test` — runs every package's test suite.

## Monorepo layout

- `apps/web` — React frontend
- `apps/api` — Fastify API
- `apps/worker` — BullMQ worker
- `packages/shared-types` — cross-service Zod schemas/types
- `packages/db` — Drizzle schema + client
- `packages/storage` — file storage interface (local disk for v1)
- `packages/parser-adapters` — `IfcParserAdapter` interface + web-ifc/ifc-lite implementations
- `packages/ids-validator` — buildingSMART IDS XML rule evaluation
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add root dev setup instructions"
```

---

## Self-Review Notes

- Every schema/table/interface referenced by sub-plans 01–07 (see the design spec's "Sub-Plans" index) is defined in exactly one place above: domain types and queue/API contracts in `@ifc-qa/shared-types`, the parser interface in `@ifc-qa/parser-adapters`, the storage interface in `@ifc-qa/storage`, and the DB schema in `@ifc-qa/db`.
- No placeholders — every step has real, complete code.
- Package names, exports, and function signatures (`createDbClient`, `LocalDiskStorageAdapter`, `IfcParserAdapter.parse`, `PARSE_JOB_QUEUE_NAME`) are used verbatim in sub-plans 01–07; if any of those plans need a different shape, update this plan first since everything else derives from it.
