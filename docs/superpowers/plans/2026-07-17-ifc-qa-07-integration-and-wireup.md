# IFC QA Tool — 07: Integration & Wire-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the one real gap self-review found between the parallel sub-plans (no `GET /runs` list endpoint, needed by the frontend's Run History page), sequence the two wiring tasks that sub-plans 04 and 05 deliberately left blocked on their siblings, and prove the whole pipeline works end-to-end against real Postgres/Redis/disk — not mocks — for both parser engines.

**Architecture:** No new subsystem. This plan only touches seams between already-built packages/apps: one new API route + its DTO, execution of two already-written-but-blocked tasks in sub-plans 04/05, one new cross-adapter integration test, and the Docker/Compose wiring to run the full stack locally.

**Tech Stack:** Same as sub-plans 00–06 — no new libraries introduced here.

## Global Constraints

- This plan assumes sub-plans 00–06 are ALL complete and merged. Do not start Task 1 until every package/app they define exists and its own tests pass.
- No new cross-service contract is invented without also adding it to `@ifc-qa/shared-types` (per sub-plan 00's constraint) — Task 1 below is the one case this plan needs.
- No auth — trusted internal network (per spec, restated for every sub-plan).

## Dependency Notes for Orchestration

This is the final, sequential plan. It depends on **all of sub-plans 00–06**. Its tasks have an internal order (Task 1 → 2 → 3, then 4 and 5 can run in parallel with each other, then 6, then 7, then 8) — see each task's own dependency line. Nothing after this plan is parallelizable; this is the end of the dependency graph.

---

### Task 1: Add `RunSummary`/`RunListResponse` to `@ifc-qa/shared-types`

**Why this task exists:** sub-plan 06 (frontend) flagged that the confirmed sub-plan 04 API contract has no endpoint listing runs, and — per the spec's "No auth means Run history is global/shared" statement — correctly refused to fake history with client-side `localStorage`. It built `RunHistoryPage` against an assumed `GET /runs` contract and left resolving it to this plan. This task adds that DTO to the one place cross-service contracts live.

**Files:**
- Modify: `packages/shared-types/src/api.ts`
- Modify: `packages/shared-types/src/index.ts` (no change needed — already does `export * from "./api.js"`; verify only)
- Test: `packages/shared-types/src/api.test.ts`

**Interfaces:**
- Consumes: `RunStatusSchema`, `EngineIdSchema` (`./domain`, sub-plan 00).
- Produces: `RunSummarySchema`/`RunSummary`, `RunListResponseSchema`/`RunListResponse` — Task 2 (this plan) returns these from the new API route; Task 3 (this plan) points the frontend at them instead of its local mirror type.

- [ ] **Step 1: Write the failing test**

Add this to `packages/shared-types/src/api.test.ts`:

```typescript
describe("RunListResponseSchema", () => {
  it("accepts a list of run summaries", () => {
    const parsed = RunListResponseSchema.parse({
      runs: [
        {
          id: "r1",
          status: "completed",
          engine: "web-ifc",
          ruleSetId: "rs1",
          createdAt: "2026-07-17T00:00:00.000Z",
          fileCount: 3,
        },
      ],
    });
    expect(parsed.runs[0].fileCount).toBe(3);
  });
});
```

Add the import at the top of the file alongside the existing ones: `RunListResponseSchema`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: FAIL — `RunListResponseSchema is not defined`

- [ ] **Step 3: Add the schemas to `packages/shared-types/src/api.ts`**

Append (after `RuleSetSummarySchema`):

```typescript
export const RunSummarySchema = z.object({
  id: z.string(),
  status: RunStatusSchema,
  engine: EngineIdSchema,
  ruleSetId: z.string(),
  createdAt: z.string(),
  fileCount: z.number(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const RunListResponseSchema = z.object({
  runs: z.array(RunSummarySchema),
});
export type RunListResponse = z.infer<typeof RunListResponseSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/shared-types test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add RunSummary/RunListResponse for GET /runs"
```

---

### Task 2: `GET /runs` in `apps/api`

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/runs.test.ts` (add a new `describe` block; this file already exists from sub-plan 04's Task 4)

**Interfaces:**
- Consumes: `runs`, `fileJobs` (`@ifc-qa/db`), `RunListResponseSchema` (`@ifc-qa/shared-types`, Task 1 above).
- Produces: nothing new consumed elsewhere in this plan — this closes sub-plan 06's flagged gap.

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `apps/api/src/runs.test.ts`, alongside the existing `describe("GET /runs/:runId/status", ...)`:

```typescript
  describe("GET /runs", () => {
    it("lists every run, newest first, with a computed status and file count", async () => {
      const [ruleSet] = await deps.db
        .insert(ruleSets)
        .values({ name: "RS", idsXml: "<ids/>" })
        .returning();

      const [olderRun] = await deps.db
        .insert(runs)
        .values({ ruleSetId: ruleSet.id, engine: "web-ifc" })
        .returning();
      await deps.db
        .insert(fileJobs)
        .values([
          { runId: olderRun.id, fileName: "a.ifc", storageKey: "a", status: "succeeded" },
          { runId: olderRun.id, fileName: "b.ifc", storageKey: "b", status: "failed" },
        ]);

      const [newerRun] = await deps.db
        .insert(runs)
        .values({ ruleSetId: ruleSet.id, engine: "ifc-lite" })
        .returning();
      await deps.db
        .insert(fileJobs)
        .values([{ runId: newerRun.id, fileName: "c.ifc", storageKey: "c", status: "queued" }]);

      const response = await app.inject({ method: "GET", url: "/runs" });
      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.runs).toHaveLength(2);
      expect(body.runs[0].id).toBe(newerRun.id);
      expect(body.runs[0].status).toBe("queued");
      expect(body.runs[0].fileCount).toBe(1);
      expect(body.runs[1].id).toBe(olderRun.id);
      expect(body.runs[1].status).toBe("completed");
      expect(body.runs[1].fileCount).toBe(2);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `404` (`GET /runs` not registered)

- [ ] **Step 3: Add the route to `apps/api/src/app.ts`**

Insert this block after the existing `GET /runs/:runId/status` route (same file the other `runs`-related routes live in), reusing the identical status-derivation logic those routes already use (`allFinished`/`anyStarted` → `"completed"`/`"running"`/`"queued"`) so run status is computed identically everywhere in this API — do not introduce a second, subtly-different status formula:

```typescript
  app.get("/runs", async () => {
    const allRuns = await deps.db
      .select()
      .from(runs)
      .orderBy(desc(runs.createdAt));

    const summaries = await Promise.all(
      allRuns.map(async (run) => {
        const jobs = await deps.db
          .select()
          .from(fileJobs)
          .where(eq(fileJobs.runId, run.id));

        const allFinished =
          jobs.length > 0 &&
          jobs.every((job) => job.status === "succeeded" || job.status === "failed");
        const anyStarted = jobs.some((job) => job.status !== "queued");
        const status: RunStatus = allFinished
          ? "completed"
          : anyStarted
            ? "running"
            : "queued";

        return {
          id: run.id,
          status,
          engine: run.engine,
          ruleSetId: run.ruleSetId,
          createdAt: run.createdAt.toISOString(),
          fileCount: jobs.length,
        };
      })
    );

    return RunListResponseSchema.parse({ runs: summaries });
  });
```

Add `desc` to the existing `drizzle-orm` import line in `apps/api/src/app.ts`, and add `RunListResponseSchema` and `RunStatus` to the existing `@ifc-qa/shared-types` import line.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add GET /runs list endpoint"
```

---

### Task 3: Point the frontend at the real `GET /runs` contract

**Files:**
- Modify: `apps/web/src/api/types.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/client.test.ts` (import path only)
- Modify: `apps/web/src/pages/RunHistoryPage.tsx` (import path only, if it imports `RunSummary`/`RunListResponse` from `./types` directly)

**Interfaces:**
- Consumes: `RunSummary`, `RunListResponse` (`@ifc-qa/shared-types`, Task 1 above).

- [ ] **Step 1: Delete the local mirror types**

In `apps/web/src/api/types.ts`, remove the `RunSummary`/`RunListResponse` interfaces sub-plan 06 defined locally (they were explicitly marked `// ASSUMED types for the ASSUMED GET /runs endpoint`) — everything else in that file stays as-is.

- [ ] **Step 2: Update the import in `apps/web/src/api/client.ts`**

Change the `import type { RunListResponse } from "./types.js";` line to:

```typescript
import type { RunListResponse } from "@ifc-qa/shared-types";
```

Also add `RunListResponse` to the existing `@ifc-qa/shared-types` import list in that file if a separate `./types` import isn't already merged with it, and remove `./types` from the import if it no longer exports anything this file uses.

- [ ] **Step 3: Update any other files importing the local mirror types**

Run: `grep -rn "from \"./types\"" apps/web/src apps/web/src --include=*.tsx --include=*.ts` (or use your editor's find-in-files) and change any `RunSummary`/`RunListResponse` imports from `./types` to `@ifc-qa/shared-types`.

- [ ] **Step 4: Run the full frontend test suite**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS — sub-plan 06's tests for `fetchRunList`/`RunHistoryPage` were written against the MSW-mocked `GET /runs` contract using field names (`id`, `status`, `engine`, `ruleSetId`, `createdAt`, `fileCount`) that already match Task 1's real schema exactly, so no test assertions should need to change — only the import path.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "chore(web): point Run History at the real GET /runs contract from shared-types"
```

---

### Task 4: Execute sub-plan 04's Task 7 (report export routes)

**Files:** as defined in `docs/superpowers/plans/2026-07-17-ifc-qa-04-api-service.md`, Task 7.

Sub-plan 04 wrote this task in full (`GET /runs/:runId/report.pdf`, `GET /runs/:runId/report.xlsx`) but marked it blocked: *"this task has a soft dependency on sub-plan 03 (`@ifc-qa/report-generator`). If `packages/report-generator/package.json` does not exist yet when you reach this task, stop here."* Sub-plan 03 is now complete, so this task is unblocked.

- [ ] **Step 1: Confirm the dependency landed**

Run: `ls packages/report-generator/package.json`
Expected: file exists.

- [ ] **Step 2: Execute sub-plan 04's Task 7 exactly as written**

Follow every step in that task verbatim (it is fully self-contained with complete code — do not re-derive it here). Run its tests as instructed there.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (all tests, including the new report-route tests from sub-plan 04's Task 7)

---

### Task 5: Execute sub-plan 05's Task 4 (wire real parser adapters + validator into the worker)

**Files:** as defined in `docs/superpowers/plans/2026-07-17-ifc-qa-05-worker-service.md`, Task 4.

Sub-plan 05 wrote this task in full (`createParserAdapter` factory, real `apps/worker/src/index.ts` bootstrap importing `WebIfcAdapter`/`IfcLiteAdapter` from `@ifc-qa/parser-adapters` and `validateElements` from `@ifc-qa/ids-validator`) but marked it explicitly: *"Do not start this task until sub-plan 01 ... and sub-plan 02 ... have both landed."* Both are now complete.

- [ ] **Step 1: Confirm both dependencies landed**

Run: `ls packages/parser-adapters/src/web-ifc-adapter.ts packages/ids-validator/src/validate-elements.ts` (adjust filenames to whatever sub-plans 01/02 actually named their source files if different — the point is confirming real implementations exist, not stubs)
Expected: both files exist.

- [ ] **Step 2: Execute sub-plan 05's Task 4 exactly as written**

Follow every step in that task verbatim. Run its tests as instructed there.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @ifc-qa/worker test`
Expected: PASS (all tests, including the new adapter-factory tests from sub-plan 05's Task 4)

---

### Task 6: One real end-to-end integration test per parser engine

**Why this task exists:** the spec's Testing section requires "One integration test per adapter running a real fixture file end-to-end, asserting the job completes, results persist, and timing is recorded." Sub-plans 01/02/05 each tested their own layer in isolation (fixtures, fakes); this is the first test exercising the real `WebIfcAdapter`/`IfcLiteAdapter` → real `validateElements` → real Postgres chain together, per engine.

**Files:**
- Create: `apps/worker/src/process-parse-job.e2e.test.ts`

**Interfaces:**
- Consumes: `processParseJob` (`apps/worker/src/process-job.ts`, sub-plan 05); `WebIfcAdapter`, `IfcLiteAdapter` (`@ifc-qa/parser-adapters`, sub-plan 01); `validateElements` (`@ifc-qa/ids-validator`, sub-plan 02); `createDbClient`, `ruleSets`, `runs`, `fileJobs`, `elementResults` (`@ifc-qa/db`); `LocalDiskStorageAdapter` (`@ifc-qa/storage`); the `fixtures/ifc/minimal-wall.ifc` fixture (sub-plan 01) and the `fixtures/ids/naming-and-fire-rating.ids` fixture (sub-plan 02).

- [ ] **Step 1: Write the test**

```typescript
// apps/worker/src/process-parse-job.e2e.test.ts
import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  createDbClient,
  ruleSets,
  runs,
  fileJobs,
  elementResults,
} from "@ifc-qa/db";
import { LocalDiskStorageAdapter } from "@ifc-qa/storage";
import { WebIfcAdapter, IfcLiteAdapter } from "@ifc-qa/parser-adapters";
import { validateElements } from "@ifc-qa/ids-validator";
import { processParseJob } from "./process-job.js";

const CONNECTION_STRING =
  process.env.DATABASE_URL ?? "postgresql://ifc_qa:ifc_qa@localhost:5432/ifc_qa";
const REPO_ROOT = join(__dirname, "..", "..", "..");

describe.each([
  { engineName: "web-ifc", Adapter: WebIfcAdapter },
  { engineName: "ifc-lite", Adapter: IfcLiteAdapter },
] as const)("processParseJob end-to-end with $engineName", ({ engineName, Adapter }) => {
  const db = createDbClient(CONNECTION_STRING);
  let storageRoot: string;
  let storage: LocalDiskStorageAdapter;

  beforeAll(() => {
    execSync("pnpm --filter @ifc-qa/db run db:migrate", { stdio: "inherit" });
  });

  afterEach(async () => {
    await db.delete(elementResults);
    await db.delete(fileJobs);
    await db.delete(runs);
    await db.delete(ruleSets);
    if (storageRoot) rmSync(storageRoot, { recursive: true, force: true });
  });

  it(`parses the real fixture with ${engineName}, persists results, and records timing`, async () => {
    storageRoot = mkdtempSync(join(tmpdir(), "ifc-qa-e2e-"));
    storage = new LocalDiskStorageAdapter(storageRoot);

    const idsXml = readFileSync(
      join(REPO_ROOT, "fixtures/ids/naming-and-fire-rating.ids"),
      "utf-8"
    );
    const fixtureBytes = readFileSync(
      join(REPO_ROOT, "fixtures/ifc/minimal-wall.ifc")
    );

    const [ruleSet] = await db
      .insert(ruleSets)
      .values({ name: "E2E Rule Set", idsXml })
      .returning();
    const [run] = await db
      .insert(runs)
      .values({ ruleSetId: ruleSet.id, engine: engineName })
      .returning();

    const storageKey = `runs/${run.id}/minimal-wall.ifc`;
    await storage.write(storageKey, fixtureBytes);

    const [fileJob] = await db
      .insert(fileJobs)
      .values({ runId: run.id, fileName: "minimal-wall.ifc", storageKey })
      .returning();

    const result = await processParseJob(
      {
        fileJobId: fileJob.id,
        runId: run.id,
        engine: engineName,
        filePath: storage.getAbsolutePath(storageKey),
        ruleSetId: ruleSet.id,
      },
      {
        db,
        storageAdapter: storage,
        adapter: new Adapter(),
        validateElements,
      }
    );

    expect(result.status).toBe("succeeded");
    expect(result.parseMs).toBeGreaterThan(0);
    expect(result.elementCount).toBeGreaterThan(0);

    const [persistedJob] = await db
      .select()
      .from(fileJobs)
      .where(eq(fileJobs.id, fileJob.id));
    expect(persistedJob.status).toBe("succeeded");
    expect(persistedJob.parseMs).toBeGreaterThan(0);

    const persistedResults = await db
      .select()
      .from(elementResults)
      .where(eq(elementResults.fileJobId, fileJob.id));
    expect(persistedResults.length).toBeGreaterThan(0);
  });
});
```

Add `import { eq } from "drizzle-orm";` at the top.

> **Note for the implementer:** `processParseJob`'s exact parameter/dependency-object shape (`{db, storageAdapter, adapter, validateElements}`) must match whatever sub-plan 05 actually defined as `ProcessParseJobDeps` — check `apps/worker/src/process-job.ts` (or wherever sub-plan 05's Task 2 put it) and adjust the call above to match exactly if the field names differ from this sketch.

- [ ] **Step 2: Ensure Postgres is running and run the test**

Run: `docker compose up -d postgres`
Run: `pnpm --filter @ifc-qa/worker test -- process-parse-job.e2e`
Expected: PASS (2 tests — one per engine). If either engine's adapter rejects `fixtures/ifc/minimal-wall.ifc`, this is the point sub-plan 01's own note anticipated — adjust that fixture minimally so both engines accept it (do not fork the fixture file), then rerun.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/process-parse-job.e2e.test.ts
git commit -m "test(worker): add real end-to-end integration test per parser engine"
```

---

### Task 7: Docker Compose for the full local stack

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/worker/Dockerfile`
- Modify: `docker-compose.yml` (repo root, created by sub-plan 00 Task 7)
- Modify: `package.json` (repo root) — add a `dev` script

**Interfaces:**
- Consumes: the existing `postgres`/`redis` services (sub-plan 00, Task 7).

- [ ] **Step 1: Write `apps/api/Dockerfile`**

```dockerfile
FROM node:20-slim AS base
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ifc-qa/api... run build
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: Write `apps/worker/Dockerfile`**

```dockerfile
FROM node:20-slim AS base
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ifc-qa/worker... run build
WORKDIR /repo/apps/worker
CMD ["node", "dist/index.js"]
```

> **Note for the implementer:** these Dockerfiles assume sub-plans 04/05 each added a `"build": "tsc -p tsconfig.json"` script and that `apps/api`'s entry point is `dist/server.js` / `apps/worker`'s is `dist/index.js` — check the actual `package.json` `main`/`scripts` sub-plans 04 and 05 wrote and adjust the `CMD` paths to match exactly if they differ.

- [ ] **Step 3: Extend `docker-compose.yml`**

Add these two services alongside the existing `postgres`/`redis`:

```yaml
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://ifc_qa:ifc_qa@postgres:5432/ifc_qa
      REDIS_HOST: redis
      REDIS_PORT: "6379"
      STORAGE_ROOT: /data/uploads
    ports:
      - "3000:3000"
    volumes:
      - ./docker/uploads:/data/uploads
    depends_on:
      - postgres
      - redis

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      DATABASE_URL: postgresql://ifc_qa:ifc_qa@postgres:5432/ifc_qa
      REDIS_HOST: redis
      REDIS_PORT: "6379"
      STORAGE_ROOT: /data/uploads
    volumes:
      - ./docker/uploads:/data/uploads
    depends_on:
      - postgres
      - redis
```

> **Note for the implementer:** confirm sub-plans 04/05 actually read `DATABASE_URL`/`REDIS_HOST`/`REDIS_PORT`/`STORAGE_ROOT` from `process.env` in their bootstrap files (`apps/api/src/server.ts`, `apps/worker/src/index.ts`) with these exact names; if they used different env var names, use those instead — don't silently introduce a second naming convention.

- [ ] **Step 4: Add a root `dev` script for local (non-Docker) development**

Add `"concurrently": "^9.1.0"` to the root `package.json`'s `devDependencies`, and add this script:

```json
"dev": "concurrently -n api,worker,web \"pnpm --filter @ifc-qa/api run dev\" \"pnpm --filter @ifc-qa/worker run dev\" \"pnpm --filter @ifc-qa/web run dev\""
```

> **Note for the implementer:** this assumes sub-plans 04/05 each added a `"dev"` script (e.g. `tsx watch src/server.ts` / `tsx watch src/index.ts`); if they only defined `"build"`+`"start"`, add a `dev` script to each app's `package.json` now rather than inventing a different root-level convention.

- [ ] **Step 5: Verify the Docker stack builds**

Run: `docker compose build api worker`
Expected: both images build without error.

- [ ] **Step 6: Commit**

```bash
git add apps/api/Dockerfile apps/worker/Dockerfile docker-compose.yml package.json pnpm-lock.yaml
git commit -m "feat(infra): add Docker Compose services for api/worker and a root dev script"
```

---

### Task 8: Full-stack smoke test

**Files:**
- Create: `scripts/smoke-test.mjs`

**Interfaces:**
- Consumes: the live `api` service (HTTP), the live `worker` service (via the queue, indirectly), the `fixtures/ifc/minimal-wall.ifc` and `fixtures/ids/naming-and-fire-rating.ids` fixtures.

- [ ] **Step 1: Write `scripts/smoke-test.mjs`**

```javascript
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const API_BASE = process.env.SMOKE_API_BASE ?? "http://localhost:3000";

async function main() {
  const ruleSetForm = new FormData();
  ruleSetForm.append("name", "Smoke Test Rule Set");
  ruleSetForm.append(
    "file",
    new Blob([readFileSync("fixtures/ids/naming-and-fire-rating.ids")]),
    "naming-and-fire-rating.ids"
  );
  const ruleSetRes = await fetch(`${API_BASE}/rule-sets`, {
    method: "POST",
    body: ruleSetForm,
  });
  if (!ruleSetRes.ok) throw new Error(`POST /rule-sets failed: ${ruleSetRes.status}`);
  const ruleSet = await ruleSetRes.json();
  console.log(`Created rule set ${ruleSet.id}`);

  const runForm = new FormData();
  runForm.append("ruleSetId", ruleSet.id);
  runForm.append("engine", "web-ifc");
  runForm.append(
    "files",
    new Blob([readFileSync("fixtures/ifc/minimal-wall.ifc")]),
    "minimal-wall.ifc"
  );
  const runRes = await fetch(`${API_BASE}/runs`, { method: "POST", body: runForm });
  if (!runRes.ok) throw new Error(`POST /runs failed: ${runRes.status}`);
  const run = await runRes.json();
  console.log(`Created run ${run.runId}`);

  let status = "queued";
  for (let attempt = 0; attempt < 30 && status !== "completed"; attempt++) {
    await sleep(1000);
    const statusRes = await fetch(`${API_BASE}/runs/${run.runId}/status`);
    const body = await statusRes.json();
    status = body.status;
    console.log(`  status: ${status}`);
  }
  if (status !== "completed") throw new Error("run did not complete within 30s");

  const resultsRes = await fetch(`${API_BASE}/runs/${run.runId}/results`);
  const results = await resultsRes.json();
  console.log(`Results: ${results.results.length} issue(s) found`);

  const pdfRes = await fetch(`${API_BASE}/runs/${run.runId}/report.pdf`);
  if (!pdfRes.ok) throw new Error(`GET report.pdf failed: ${pdfRes.status}`);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  if (pdfBuffer.length === 0) throw new Error("report.pdf was empty");
  console.log(`report.pdf: ${pdfBuffer.length} bytes`);

  const xlsxRes = await fetch(`${API_BASE}/runs/${run.runId}/report.xlsx`);
  if (!xlsxRes.ok) throw new Error(`GET report.xlsx failed: ${xlsxRes.status}`);
  const xlsxBuffer = Buffer.from(await xlsxRes.arrayBuffer());
  if (xlsxBuffer.length === 0) throw new Error("report.xlsx was empty");
  console.log(`report.xlsx: ${xlsxBuffer.length} bytes`);

  console.log("SMOKE TEST PASSED");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add a root script**

Add to the root `package.json` `scripts`: `"smoke": "node scripts/smoke-test.mjs"`.

- [ ] **Step 3: Run it against the full Docker stack**

Run: `docker compose up -d`
Run: `pnpm db:migrate`
Run: `pnpm smoke`
Expected: `SMOKE TEST PASSED` printed, exit code 0. If `POST /runs` returns 400 with "ruleSetId and engine fields must be sent before the file parts", the field-append order in this script (or in the real client that reproduces it) is wrong — `ruleSetId`/`engine` must be appended before `files` (this is the exact bug Task 3's frontend fix addressed; the same ordering rule applies to any client, including this script, which is why it's written with fields first above).

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-test.mjs package.json
git commit -m "test: add full-stack smoke test script"
```

---

## Self-Review Notes

- **Spec coverage:** every sub-plan (00–06) plus this plan together now cover every bullet in the design spec's Architecture, Data Flow, Error Handling, and Testing sections — including the one item (`GET /runs` for run history) that only became visible once the frontend was planned against the API contract, which is exactly the kind of gap this integration tier exists to catch.
- **The one real defect self-review found before this plan was even written**: sub-plan 06's `createRun()` appended file parts before the `ruleSetId`/`engine` fields, which would have made every run creation 400 against sub-plan 04's real handler. Fixed directly in `docs/superpowers/plans/2026-07-17-ifc-qa-06-frontend.md`'s `createRun` code block — field order is now `ruleSetId`, `engine`, then files, with a comment explaining why the order matters. Task 8's smoke-test script deliberately mirrors the same fixed order as a regression guard.
- **No placeholders** — every step above has complete, runnable code; Tasks 4 and 5 intentionally point to sub-plans 04/05's own already-complete task content instead of duplicating it (DRY — those tasks are real and finished, not stubs).
- Every class/function name this plan calls (`WebIfcAdapter`, `IfcLiteAdapter`, `validateElements`, `processParseJob`, `generatePdfReport`, `generateExcelReport`, `createDbClient`, `LocalDiskStorageAdapter`) was verified present with the exact same name in the sub-plan that defines it before being used here.
