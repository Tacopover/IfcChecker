# IFC QA Tool — 05: Worker Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/worker`, a BullMQ `Worker` that consumes `PARSE_JOB_QUEUE_NAME` jobs, parses each uploaded IFC file through a pluggable `IfcParserAdapter`, validates the result against the run's IDS rule set, and persists `elementResults` + `fileJobs`/`runs` status — with its job-processing logic built and unit-tested against fakes now, and wired to the real parser adapters + real IDS validator once sub-plans 01 and 02 land.

**Architecture:** The core logic lives in one pure-ish function, `processParseJob(payload, deps)`, that takes its `IfcParserAdapter` and `validateElements`-shaped function as injected dependencies instead of constructing them itself. This makes it fully testable today with a local `FakeAdapter` and a fake `validateElements`, against a real Postgres instance (per the foundation plan's `client.integration.test.ts` pattern — DB correctness is not faked). A thin top-level bootstrap (`apps/worker/src/index.ts`) instantiates the real BullMQ `Worker`, the real `createParserAdapter` factory, and the real `@ifc-qa/ids-validator` export, then calls `processParseJob` per job. That bootstrap is the only piece of this plan blocked on other sub-plans.

**Tech Stack:** BullMQ `^5.80.7`, `ioredis` `^5.11.1`, `@ifc-qa/shared-types`, `@ifc-qa/db` (Drizzle ORM), `@ifc-qa/storage`, `@ifc-qa/parser-adapters` (interface today, concrete engines later), `@ifc-qa/ids-validator` (real function wired last), Vitest, real Postgres via the repo's `docker-compose.yml` (from sub-plan 00).

## Global Constraints

- No auth — every service assumes a trusted internal network (per spec).
- Package scope for all internal packages: `@ifc-qa/*`; this app's own package name is `@ifc-qa/worker`.
- Node.js >= 20, pnpm >= 9 (already pinned by the root `package.json`'s `packageManager` field from sub-plan 00).
- Every cross-service contract (queue payloads, DB rows) is defined once in `@ifc-qa/shared-types` / `@ifc-qa/db` and imported here — never redeclared.
- BullMQ's `Worker` constructor requires `opts.connection` and throws at construction time if a manually-created `ioredis` client doesn't set `maxRetriesPerRequest: null` (confirmed via context7 `/taskforcesh/bullmq`) — the worker bootstrap must always pass that option.
- A `Worker` instance must have an `.on('error', ...)` listener attached: without one, Node treats the EventEmitter's unhandled `'error'` event as an unhandled exception, and the worker can stop processing jobs entirely (confirmed via context7) — this is the concrete mechanism by which "one file's failure doesn't affect the rest of the batch" could silently break, so it is non-negotiable in the bootstrap task.
- A corrupt/unparseable IFC file must fail only its own FileJob (spec, "Error Handling"). BullMQ already processes each queued job independently, so this plan's job is narrower: `processParseJob` must catch `adapter.parse` errors itself and return a `status: "failed"` `ParseJobResult` rather than let a rejection propagate uncaught out of the processor.
- Local disk storage only for v1 — the only storage call this plan makes is `storageAdapter.getAbsolutePath(key)`, per the foundation's `StorageAdapter` interface not leaking local-disk assumptions into callers.

## Dependency Notes for Orchestration

- Depends on sub-plan 00 (foundation) for `@ifc-qa/shared-types`, `@ifc-qa/db`, `@ifc-qa/storage`, and the `@ifc-qa/parser-adapters` interface scaffold — all must exist before Task 1's `pnpm install` can link this app's workspace dependencies.
- Can start in parallel with sub-plans 01 (parser-adapters concrete engines), 02 (ids-validator), 03, 04 (api-service), and 06 (frontend): Tasks 1-3 below build and unit-test `processParseJob` entirely against a local `FakeAdapter` test double and a fake `validateElements` function defined inside this plan's own test file — never importing `WebIfcAdapter`, `IfcLiteAdapter`, or the real `@ifc-qa/ids-validator` package.
- Task 4 (wiring the real `createParserAdapter` factory + the real `validateElements` into the top-level worker bootstrap `apps/worker/src/index.ts`) has a **hard dependency on sub-plan 01** (`WebIfcAdapter`, `IfcLiteAdapter`) **and sub-plan 02** (`validateElements`) **both landing**. This is the one task in this plan that must wait, and it overlaps in time with sub-plan 07 (integration), which exercises the fully-wired worker against real fixture files end-to-end.

---

### Task 1: Scaffold `apps/worker`

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/vitest.config.ts`

**Interfaces:**
- Consumes: the pnpm workspace glob and root scripts (`pnpm-workspace.yaml`, root `package.json`) and `tsconfig.base.json`, all from sub-plan 00.
- Produces: the `@ifc-qa/worker` workspace package that every later task in this plan adds source files to.

- [ ] **Step 1: Write `apps/worker/package.json`**

```json
{
  "name": "@ifc-qa/worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "bullmq": "^5.80.7",
    "ioredis": "^5.11.1",
    "drizzle-orm": "^0.36.1",
    "@ifc-qa/shared-types": "workspace:*",
    "@ifc-qa/db": "workspace:*",
    "@ifc-qa/storage": "workspace:*",
    "@ifc-qa/parser-adapters": "workspace:*",
    "@ifc-qa/ids-validator": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4",
    "tsx": "^4.19.2"
  }
}
```

- [ ] **Step 2: Write `apps/worker/tsconfig.json`**

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

- [ ] **Step 3: Write `apps/worker/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
  },
});
```

- [ ] **Step 4: Verify workspace install**

Run: `pnpm install`
Expected: exits 0; `node_modules/.pnpm` now includes a link for `@ifc-qa/worker` and its `workspace:*` dependencies resolve to the sibling packages created by sub-plan 00 (`@ifc-qa/shared-types`, `@ifc-qa/db`, `@ifc-qa/storage`, `@ifc-qa/parser-adapters`). `@ifc-qa/ids-validator`'s own `package.json` must exist in the workspace (from sub-plan 02, even if its `validateElements` export isn't implemented yet) for this install to succeed — if it doesn't exist yet at the time this task runs, re-run `pnpm install` once sub-plan 02 has at least scaffolded its `package.json`.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/package.json apps/worker/tsconfig.json apps/worker/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(worker): scaffold apps/worker package"
```

---

### Task 2: `processParseJob` — happy path + run-completion aggregation

**Files:**
- Create: `apps/worker/src/types.ts`
- Create: `apps/worker/src/job-processor.ts`
- Test: `apps/worker/src/job-processor.test.ts`

**Interfaces:**
- Consumes: `ParseJobPayload`, `ParseJobResult`, `NormalizedElement`, `Severity` (`@ifc-qa/shared-types`); `DbClient`, `fileJobs`, `runs`, `ruleSets`, `elementResults` (`@ifc-qa/db`); `StorageAdapter` (`@ifc-qa/storage`); `IfcParserAdapter` (`@ifc-qa/parser-adapters`).
- Produces: `IdsViolation` type, `ProcessParseJobDeps` interface, `processParseJob(payload: ParseJobPayload, deps: ProcessParseJobDeps): Promise<ParseJobResult>` — Task 3 (this plan) extends its error handling; Task 4 (this plan) wires it to real dependencies; sub-plan 07 (integration) exercises it end-to-end.

- [ ] **Step 1: Write `apps/worker/src/types.ts`**

```typescript
import type { Severity } from "@ifc-qa/shared-types";

// Mirrors the shape @ifc-qa/ids-validator's `validateElements` will return
// (sub-plan 02). Declared locally so this package's own tests never need
// to import that package before it exists; Task 4 wires the real function
// in, and its return type satisfies this interface structurally.
export interface IdsViolation {
  elementGlobalId: string;
  elementType: string;
  ruleId: string;
  severity: Severity;
  message: string;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/worker/src/job-processor.test.ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createDbClient, elementResults, fileJobs, ruleSets, runs } from "@ifc-qa/db";
import { LocalDiskStorageAdapter } from "@ifc-qa/storage";
import type { IfcParserAdapter } from "@ifc-qa/parser-adapters";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { processParseJob } from "./job-processor.js";
import type { IdsViolation } from "./types.js";

const CONNECTION_STRING =
  process.env.DATABASE_URL ?? "postgresql://ifc_qa:ifc_qa@localhost:5432/ifc_qa";

class FakeAdapter implements IfcParserAdapter {
  constructor(private readonly result: { elements: NormalizedElement[]; parseMs: number }) {}

  async parse(_filePath: string) {
    return this.result;
  }
}

const sampleElement: NormalizedElement = {
  globalId: "g1",
  ifcType: "IFCWALL",
  predefinedType: null,
  name: "Wall-01",
  attributes: {},
  propertySets: {},
};

describe("processParseJob", () => {
  const db = createDbClient(CONNECTION_STRING);
  let storageRoot: string;

  beforeAll(() => {
    execSync("pnpm --filter @ifc-qa/db run db:migrate", { stdio: "inherit" });
  });

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), "ifc-qa-worker-"));
  });

  afterEach(() => {
    rmSync(storageRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await db.delete(elementResults);
    await db.delete(fileJobs);
    await db.delete(runs);
    await db.delete(ruleSets);
  });

  async function seedRunWithFileJobs(fileNames: string[]) {
    const [ruleSet] = await db
      .insert(ruleSets)
      .values({ name: "Test Rule Set", idsXml: "<ids/>" })
      .returning();
    const [run] = await db
      .insert(runs)
      .values({ ruleSetId: ruleSet.id, engine: "web-ifc" })
      .returning();
    const jobs = [];
    for (const fileName of fileNames) {
      const [job] = await db
        .insert(fileJobs)
        .values({ runId: run.id, fileName, storageKey: `runs/${run.id}/${fileName}` })
        .returning();
      jobs.push(job);
    }
    return { ruleSet, run, jobs };
  }

  it("success path: persists violations, marks fileJob succeeded, completes run when it is the only file", async () => {
    const { run, jobs } = await seedRunWithFileJobs(["model-a.ifc"]);
    const storageAdapter = new LocalDiskStorageAdapter(storageRoot);
    await storageAdapter.write(jobs[0].storageKey, Buffer.from("ISO-10303-21;"));

    const violations: IdsViolation[] = [
      {
        elementGlobalId: "g1",
        elementType: "IFCWALL",
        ruleId: "naming-prefix",
        severity: "error",
        message: "Name must start with 'W-'",
      },
    ];

    const result = await processParseJob(
      {
        fileJobId: jobs[0].id,
        runId: run.id,
        engine: "web-ifc",
        filePath: jobs[0].storageKey,
        ruleSetId: run.ruleSetId,
      },
      {
        db,
        storageAdapter,
        adapter: new FakeAdapter({ elements: [sampleElement], parseMs: 42 }),
        validateElements: () => violations,
      }
    );

    expect(result.status).toBe("succeeded");
    expect(result.elementCount).toBe(1);
    expect(result.parseMs).toBe(42);

    const [updatedJob] = await db.select().from(fileJobs).where(eq(fileJobs.id, jobs[0].id));
    expect(updatedJob.status).toBe("succeeded");
    expect(updatedJob.parseMs).toBe(42);
    expect(updatedJob.errorMessage).toBeNull();

    const storedViolations = await db
      .select()
      .from(elementResults)
      .where(eq(elementResults.fileJobId, jobs[0].id));
    expect(storedViolations).toHaveLength(1);
    expect(storedViolations[0].ruleId).toBe("naming-prefix");
    expect(storedViolations[0].elementGlobalId).toBe("g1");

    const [updatedRun] = await db.select().from(runs).where(eq(runs.id, run.id));
    expect(updatedRun.status).toBe("completed");
  });

  it("keeps the run non-completed while a sibling fileJob is still queued, then completes it once both are terminal", async () => {
    const { run, jobs } = await seedRunWithFileJobs(["model-a.ifc", "model-b.ifc"]);
    const storageAdapter = new LocalDiskStorageAdapter(storageRoot);
    await storageAdapter.write(jobs[0].storageKey, Buffer.from("ISO-10303-21;"));
    await storageAdapter.write(jobs[1].storageKey, Buffer.from("ISO-10303-21;"));

    await processParseJob(
      {
        fileJobId: jobs[0].id,
        runId: run.id,
        engine: "web-ifc",
        filePath: jobs[0].storageKey,
        ruleSetId: run.ruleSetId,
      },
      {
        db,
        storageAdapter,
        adapter: new FakeAdapter({ elements: [sampleElement], parseMs: 10 }),
        validateElements: () => [],
      }
    );

    const [runAfterFirst] = await db.select().from(runs).where(eq(runs.id, run.id));
    expect(runAfterFirst.status).not.toBe("completed");

    await processParseJob(
      {
        fileJobId: jobs[1].id,
        runId: run.id,
        engine: "web-ifc",
        filePath: jobs[1].storageKey,
        ruleSetId: run.ruleSetId,
      },
      {
        db,
        storageAdapter,
        adapter: new FakeAdapter({ elements: [sampleElement], parseMs: 11 }),
        validateElements: () => [],
      }
    );

    const [runAfterSecond] = await db.select().from(runs).where(eq(runs.id, run.id));
    expect(runAfterSecond.status).toBe("completed");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/worker test`
Expected: FAIL — `Cannot find module './job-processor'`

- [ ] **Step 4: Write `apps/worker/src/job-processor.ts`**

```typescript
import { and, eq, notInArray } from "drizzle-orm";
import type { DbClient } from "@ifc-qa/db";
import { elementResults, fileJobs, ruleSets, runs } from "@ifc-qa/db";
import type { IfcParserAdapter } from "@ifc-qa/parser-adapters";
import type { StorageAdapter } from "@ifc-qa/storage";
import type { NormalizedElement, ParseJobPayload, ParseJobResult } from "@ifc-qa/shared-types";
import type { IdsViolation } from "./types.js";

export interface ProcessParseJobDeps {
  db: DbClient;
  storageAdapter: StorageAdapter;
  adapter: IfcParserAdapter;
  validateElements: (elements: NormalizedElement[], idsXml: string) => IdsViolation[];
}

export async function processParseJob(
  payload: ParseJobPayload,
  deps: ProcessParseJobDeps
): Promise<ParseJobResult> {
  const { db, storageAdapter, adapter, validateElements } = deps;
  const { fileJobId } = payload;

  await db.update(fileJobs).set({ status: "running" }).where(eq(fileJobs.id, fileJobId));

  const [fileJob] = await db.select().from(fileJobs).where(eq(fileJobs.id, fileJobId));
  const absolutePath = storageAdapter.getAbsolutePath(fileJob.storageKey);

  const parseResult = await adapter.parse(absolutePath);

  const [run] = await db.select().from(runs).where(eq(runs.id, fileJob.runId));
  const [ruleSet] = await db.select().from(ruleSets).where(eq(ruleSets.id, run.ruleSetId));
  const violations = validateElements(parseResult.elements, ruleSet.idsXml);

  if (violations.length > 0) {
    await db.insert(elementResults).values(
      violations.map((violation) => ({
        fileJobId,
        elementGlobalId: violation.elementGlobalId,
        elementType: violation.elementType,
        ruleId: violation.ruleId,
        severity: violation.severity,
        message: violation.message,
      }))
    );
  }

  await db
    .update(fileJobs)
    .set({ status: "succeeded", parseMs: parseResult.parseMs, errorMessage: null })
    .where(eq(fileJobs.id, fileJobId));

  await completeRunIfAllTerminal(db, fileJob.runId);

  return {
    fileJobId,
    status: "succeeded",
    parseMs: parseResult.parseMs,
    elementCount: parseResult.elements.length,
    errorMessage: null,
  };
}

async function completeRunIfAllTerminal(db: DbClient, runId: string): Promise<void> {
  const openSiblings = await db
    .select({ id: fileJobs.id })
    .from(fileJobs)
    .where(and(eq(fileJobs.runId, runId), notInArray(fileJobs.status, ["succeeded", "failed"])));

  if (openSiblings.length === 0) {
    await db.update(runs).set({ status: "completed" }).where(eq(runs.id, runId));
  }
}
```

Note: `payload` also carries `filePath` and `ruleSetId` directly (they travel with the queue job), but this function deliberately re-reads the storage key and rule set through `fileJob` → `run` → `ruleSet` rows instead of trusting the payload's copies, so it always acts on the row's current state. `completeRunIfAllTerminal` re-queries open siblings after every terminal update rather than tracking counts in memory — see this plan's closing notes for why that is safe under concurrent workers.

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose up -d postgres` (if not already running), then `pnpm --filter @ifc-qa/worker test`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/types.ts apps/worker/src/job-processor.ts apps/worker/src/job-processor.test.ts
git commit -m "feat(worker): add processParseJob happy path and run-completion aggregation"
```

---

### Task 3: `processParseJob` — failure path

**Files:**
- Modify: `apps/worker/src/job-processor.ts`
- Modify: `apps/worker/src/job-processor.test.ts`

**Interfaces:**
- Consumes: `processParseJob`, `ProcessParseJobDeps` (Task 2, this file).
- Produces: the failure branch of `processParseJob` — Task 4 (this plan) relies on this branch never throwing so the real BullMQ processor callback can call `processParseJob` directly without its own try/catch.

- [ ] **Step 1: Write the failing test**

Add to `apps/worker/src/job-processor.test.ts`, alongside the existing `FakeAdapter`:

```typescript
class ThrowingAdapter implements IfcParserAdapter {
  constructor(private readonly error: Error) {}

  async parse(_filePath: string): Promise<{ elements: NormalizedElement[]; parseMs: number }> {
    throw this.error;
  }
}
```

Add a new `it` inside the `describe("processParseJob", ...)` block:

```typescript
  it("failure path: adapter throw marks fileJob failed with the error message, and still completes the run once all siblings are terminal", async () => {
    const { run, jobs } = await seedRunWithFileJobs(["model-a.ifc", "model-b.ifc"]);
    const storageAdapter = new LocalDiskStorageAdapter(storageRoot);
    await storageAdapter.write(jobs[0].storageKey, Buffer.from("ISO-10303-21;"));
    await storageAdapter.write(jobs[1].storageKey, Buffer.from("garbage"));

    await processParseJob(
      {
        fileJobId: jobs[0].id,
        runId: run.id,
        engine: "web-ifc",
        filePath: jobs[0].storageKey,
        ruleSetId: run.ruleSetId,
      },
      {
        db,
        storageAdapter,
        adapter: new FakeAdapter({ elements: [sampleElement], parseMs: 5 }),
        validateElements: () => [],
      }
    );

    const result = await processParseJob(
      {
        fileJobId: jobs[1].id,
        runId: run.id,
        engine: "ifc-lite",
        filePath: jobs[1].storageKey,
        ruleSetId: run.ruleSetId,
      },
      {
        db,
        storageAdapter,
        adapter: new ThrowingAdapter(new Error("corrupt IFC header")),
        validateElements: () => [],
      }
    );

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("corrupt IFC header");

    const [failedJob] = await db.select().from(fileJobs).where(eq(fileJobs.id, jobs[1].id));
    expect(failedJob.status).toBe("failed");
    expect(failedJob.errorMessage).toBe("corrupt IFC header");
    expect(failedJob.parseMs).toBeNull();

    const violationsForFailedJob = await db
      .select()
      .from(elementResults)
      .where(eq(elementResults.fileJobId, jobs[1].id));
    expect(violationsForFailedJob).toHaveLength(0);

    const [succeededJob] = await db.select().from(fileJobs).where(eq(fileJobs.id, jobs[0].id));
    expect(succeededJob.status).toBe("succeeded");

    const [updatedRun] = await db.select().from(runs).where(eq(runs.id, run.id));
    expect(updatedRun.status).toBe("completed");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/worker test`
Expected: FAIL — the new test throws `Error: corrupt IFC header` out of `processParseJob` uncaught, instead of returning a `status: "failed"` result.

- [ ] **Step 3: Modify `apps/worker/src/job-processor.ts` to catch the parse error**

Replace the line `const parseResult = await adapter.parse(absolutePath);` with:

```typescript
  let parseResult: { elements: NormalizedElement[]; parseMs: number };
  try {
    parseResult = await adapter.parse(absolutePath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await db
      .update(fileJobs)
      .set({ status: "failed", errorMessage, parseMs: null })
      .where(eq(fileJobs.id, fileJobId));
    await completeRunIfAllTerminal(db, fileJob.runId);
    return {
      fileJobId,
      status: "failed",
      parseMs: 0,
      elementCount: 0,
      errorMessage,
    };
  }
```

The rest of the function (validate → insert `elementResults` → mark succeeded → `completeRunIfAllTerminal`) is unchanged and now only runs when `parseResult` was assigned.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/worker test`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/job-processor.ts apps/worker/src/job-processor.test.ts
git commit -m "feat(worker): catch parser adapter failures and fail only the owning fileJob"
```

---

### Task 4: Real adapter factory + worker bootstrap (BLOCKED on sub-plans 01 and 02)

> **Do not start this task until sub-plan 01 (`WebIfcAdapter`, `IfcLiteAdapter` in `@ifc-qa/parser-adapters`) and sub-plan 02 (`validateElements` in `@ifc-qa/ids-validator`) have both landed.** Tasks 1-3 above do not depend on this task and can be reviewed/merged independently. This task overlaps in time with sub-plan 07 (integration).

**Files:**
- Create: `apps/worker/src/adapter-factory.ts`
- Test: `apps/worker/src/adapter-factory.test.ts`
- Create: `apps/worker/src/index.ts`

**Interfaces:**
- Consumes: `WebIfcAdapter`, `IfcLiteAdapter` (`@ifc-qa/parser-adapters`, sub-plan 01); `validateElements` (`@ifc-qa/ids-validator`, sub-plan 02); `processParseJob`, `ProcessParseJobDeps` (Tasks 2-3, this plan); `createDbClient` (`@ifc-qa/db`); `LocalDiskStorageAdapter` (`@ifc-qa/storage`); `PARSE_JOB_QUEUE_NAME`, `ParseJobPayloadSchema`, `EngineId` (`@ifc-qa/shared-types`).
- Produces: `createParserAdapter(engine: EngineId): IfcParserAdapter`; the runnable worker process (`apps/worker/src/index.ts`) — sub-plan 07 (integration) starts this process against real fixture files end-to-end.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/worker/src/adapter-factory.test.ts
import { describe, expect, it } from "vitest";
import { WebIfcAdapter, IfcLiteAdapter } from "@ifc-qa/parser-adapters";
import { createParserAdapter } from "./adapter-factory.js";

describe("createParserAdapter", () => {
  it("returns a WebIfcAdapter for 'web-ifc'", () => {
    expect(createParserAdapter("web-ifc")).toBeInstanceOf(WebIfcAdapter);
  });

  it("returns an IfcLiteAdapter for 'ifc-lite'", () => {
    expect(createParserAdapter("ifc-lite")).toBeInstanceOf(IfcLiteAdapter);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/worker test`
Expected: FAIL — `Cannot find module './adapter-factory'` (and, if sub-plan 01 has not actually landed yet, a further failure resolving `WebIfcAdapter`/`IfcLiteAdapter` from `@ifc-qa/parser-adapters` — confirming this task really is blocked until it does).

- [ ] **Step 3: Write `apps/worker/src/adapter-factory.ts`**

```typescript
import { WebIfcAdapter, IfcLiteAdapter } from "@ifc-qa/parser-adapters";
import type { IfcParserAdapter } from "@ifc-qa/parser-adapters";
import type { EngineId } from "@ifc-qa/shared-types";

export function createParserAdapter(engine: EngineId): IfcParserAdapter {
  return engine === "web-ifc" ? new WebIfcAdapter() : new IfcLiteAdapter();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/worker test`
Expected: PASS (5 tests total across `job-processor.test.ts` and `adapter-factory.test.ts`)

- [ ] **Step 5: Write `apps/worker/src/index.ts`**

```typescript
import IORedis from "ioredis";
import { Worker } from "bullmq";
import { PARSE_JOB_QUEUE_NAME, ParseJobPayloadSchema } from "@ifc-qa/shared-types";
import type { ParseJobPayload, ParseJobResult } from "@ifc-qa/shared-types";
import { createDbClient } from "@ifc-qa/db";
import { LocalDiskStorageAdapter } from "@ifc-qa/storage";
import { validateElements } from "@ifc-qa/ids-validator";
import { processParseJob } from "./job-processor.js";
import { createParserAdapter } from "./adapter-factory.js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://ifc_qa:ifc_qa@localhost:5432/ifc_qa";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "./data/storage";

const db = createDbClient(DATABASE_URL);
const storageAdapter = new LocalDiskStorageAdapter(STORAGE_ROOT);
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker<ParseJobPayload, ParseJobResult>(
  PARSE_JOB_QUEUE_NAME,
  async (job) => {
    const payload = ParseJobPayloadSchema.parse(job.data);
    return processParseJob(payload, {
      db,
      storageAdapter,
      adapter: createParserAdapter(payload.engine),
      validateElements,
    });
  },
  { connection }
);

// Required so a Redis/connection-level error surfaces as a log line instead
// of an unhandled EventEmitter 'error' exception that can stop the worker
// from processing further jobs.
worker.on("error", (error) => {
  console.error("[worker] connection error", error);
});

// processParseJob never rethrows (Task 3) — a "failed" event here reflects
// a job whose ParseJobResult already recorded status: "failed"; it is
// logged for visibility only and does not affect any other job.
worker.on("failed", (job, error) => {
  console.error(`[worker] job ${job?.id} failed`, error);
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
```

There is no automated test for `index.ts` itself in this plan — it is a process bootstrap with no return value to assert on. It is exercised end-to-end by sub-plan 07's integration tests, which start this process against a real Redis, Postgres, and fixture IFC files.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/adapter-factory.ts apps/worker/src/adapter-factory.test.ts apps/worker/src/index.ts
git commit -m "feat(worker): wire real parser adapter factory and validateElements into the worker bootstrap"
```

---

## Self-Review Notes

- **Spec coverage:** "Data Flow" step 4 (parse → normalize → validate → persist `elementResults` + FileJob summary) is Task 2/3's `processParseJob`. "Error Handling" ("a corrupt or unparseable IFC file fails only its own FileJob; the rest of the batch continues") is Task 3's catch branch plus the Global Constraints note on BullMQ's per-job independence and the mandatory `.on('error', ...)` listener in Task 4. The Run-completes-once-all-FileJobs-finish rule (Data Flow step 5) is `completeRunIfAllTerminal`, tested from both the all-succeeded angle (Task 2) and the mixed succeeded/failed angle (Task 3).
- **Placeholder scan:** every step has complete, real code; the one deliberately unfinished piece (Task 4) is unfinished only because its upstream packages don't exist yet, not because anything was left vague — its code is final and complete, just blocked on landing.
- **Type consistency:** `ProcessParseJobDeps.validateElements` (Task 2) has signature `(elements: NormalizedElement[], idsXml: string) => IdsViolation[]`, matching the real `@ifc-qa/ids-validator` export's declared signature `validateElements(elements: NormalizedElement[], idsXml: string): IdsViolation[]` exactly, so Task 4 can pass the real function in without an adapter shim. `IdsViolation`'s fields (`elementGlobalId`, `elementType`, `ruleId`, `severity`, `message`) match `elementResults`' columns 1:1 (Task 2's insert mapping), and match the real `IdsViolation` sub-plan 02 is defined to produce.
- **Judgment call — run-completion strategy:** `completeRunIfAllTerminal` re-queries "is any sibling fileJob still non-terminal" after every single fileJob update, rather than tracking a counter. This is deliberately race-safe under multiple workers finishing sibling fileJobs of the same run concurrently: fileJob status only ever moves forward (`queued`/`running` → `succeeded`/`failed`, never back), and the final `UPDATE runs SET status = 'completed'` is unconditional and idempotent, so two workers finishing the last two fileJobs at nearly the same instant either both see "zero open siblings" and both issue the same harmless update, or one sees the other's row still open and skips — no lock or transaction is needed for correctness.
- **Judgment call — failure semantics stay inside `ParseJobResult`, not BullMQ's job failure:** `processParseJob` catches `adapter.parse` errors and **returns** `{ status: "failed", ... }` rather than rethrowing so BullMQ marks the *queue job* failed. A corrupt IFC file will fail identically on every retry, so treating it as a normal (non-retryable) processor return value — rather than triggering BullMQ's retry/backoff machinery — matches the spec's framing of "fails only its own FileJob" as a FileJob-level, not queue-level, concept. `@ifc-qa/shared-types`'s `ParseJobResult.status: "succeeded" | "failed"` field exists precisely to carry this outcome without needing the BullMQ job itself to be considered failed.
