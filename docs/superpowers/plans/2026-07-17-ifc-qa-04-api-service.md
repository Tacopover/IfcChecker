# IFC QA Tool — 04: API Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/api`, a Fastify HTTP API exposing rule-set upload/listing, batch run creation (chunked multipart upload + BullMQ enqueue), run status/results polling, and PDF/Excel report export — all backed by the contracts fixed in sub-plan 00.

**Architecture:** A single Fastify instance built by `buildApp(deps: AppDeps)` where `AppDeps = { db, storage, queue }` are injected (not module-level singletons), so tests can point the app at a real local Postgres/Redis without touching global state. `src/server.ts` is the only place that constructs real `AppDeps` from env vars and calls `.listen()`. All routes validate their outbound JSON against the shared Zod schemas from `@ifc-qa/shared-types` (`Schema.parse(...)`) before sending, so a shape drift fails the test loudly instead of silently drifting from what the frontend expects. Large file uploads are streamed straight to disk via `@fastify/multipart`'s `request.parts()` async iterator piped into `LocalDiskStorageAdapter.write()` — never buffered whole in memory.

**Tech Stack:** Fastify 5, `@fastify/multipart` 10, BullMQ 5, ioredis 5, Drizzle ORM (via `@ifc-qa/db`), Vitest, `form-data` (test-only, for building multipart request bodies against `app.inject()`).

## Global Constraints

- No auth — trusted internal network (per spec).
- Package scope `@ifc-qa/*`; this app's package name is `@ifc-qa/api`.
- Node.js >= 20, pnpm >= 9.
- Import every cross-cutting contract verbatim from `@ifc-qa/shared-types`, `@ifc-qa/db`, `@ifc-qa/storage` — never redeclare a DTO, table, or queue payload shape locally.
- Local disk storage only for v1 — routes use `StorageAdapter`/`LocalDiskStorageAdapter`, never `fs` directly.
- Batch uploads are up to ~20 files, each up to 2GB (per spec) — uploaded file bytes must be streamed to disk, never fully buffered in memory (small text payloads like the IDS XML rule-set upload are the one exception, since those are KB-sized and stored as a DB text column, not a file).
- A run's mixed pass/fail across its file jobs is expected, not an error — a run is `"completed"` once every file job is `"succeeded"` or `"failed"`, regardless of the mix (per spec's Error Handling section).
- All tests in this plan (Tasks 1–7) require Postgres and Redis running locally: `docker compose up -d postgres redis` (from repo root, using the `docker-compose.yml` and `packages/db` migrations produced by sub-plan 00) before running `pnpm --filter @ifc-qa/api test`.

## Dependency Notes for Orchestration

- Depends on sub-plan 00 (foundation) for `@ifc-qa/shared-types`, `@ifc-qa/db`, `@ifc-qa/storage` — must not start before 00 lands.
- Can start in parallel with sub-plans 01 (parser-adapters), 02 (ids-validator), 05 (worker-service), 06 (frontend) — none of those are consumed by this plan.
- Task 7 (`GET /runs/:runId/report.pdf` and `.xlsx`) has a **soft dependency on sub-plan 03 (`@ifc-qa/report-generator`)**: it is the one task in this plan that must be sequenced after 03 lands, because it adds `@ifc-qa/report-generator` as a real workspace dependency and imports its exports directly. Tasks 1–6 do not touch `@ifc-qa/report-generator` at all and can be done in any order relative to sub-plan 03. If you reach Task 7 and `packages/report-generator` does not exist yet (or has no `package.json`), stop, note that sub-plan 03 hasn't landed, and come back to Task 7 later — do not write a stub/fake replacement for it.

---

### Task 1: Scaffold `apps/api` and a health-check route

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/test/test-helpers.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `DbClient`/`createDbClient` (`@ifc-qa/db`), `StorageAdapter`/`LocalDiskStorageAdapter` (`@ifc-qa/storage`), `ParseJobPayload`/`PARSE_JOB_QUEUE_NAME` (`@ifc-qa/shared-types`) — all from sub-plan 00.
- Produces: `AppDeps` interface (`{ db: DbClient; storage: StorageAdapter; queue: Queue<ParseJobPayload> }`), `buildApp(deps: AppDeps): FastifyInstance` — every later task in this plan adds routes inside `buildApp`. Also produces `createTestDeps()`, `migrateTestDb()`, `closeTestDeps(deps)` from `src/test/test-helpers.ts` — every later task's tests import these.

- [ ] **Step 1: Start local Postgres and Redis**

Run: `docker compose up -d postgres redis`
Expected: both containers report `Started`/`Running`. (Uses the root `docker-compose.yml` from sub-plan 00.)

- [ ] **Step 2: Write `apps/api/package.json`**

```json
{
  "name": "@ifc-qa/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/server.js",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "fastify": "^5.10.0",
    "@fastify/multipart": "^10.1.0",
    "bullmq": "^5.80.7",
    "ioredis": "^5.11.1",
    "@ifc-qa/shared-types": "workspace:*",
    "@ifc-qa/db": "workspace:*",
    "@ifc-qa/storage": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4",
    "form-data": "^4.0.1"
  }
}
```

Note: `@ifc-qa/report-generator` is deliberately **not** listed here — it is added in Task 7 only, once sub-plan 03 has produced that package. Adding it now would make `pnpm install` fail for the whole monorepo if `packages/report-generator` doesn't exist yet, which would block Tasks 1–6 for no reason.

- [ ] **Step 3: Write `apps/api/tsconfig.json`**

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

- [ ] **Step 4: Write `apps/api/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
  },
});
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: exits 0; `apps/api` now has its own `node_modules` linked via pnpm workspace symlinks to `@ifc-qa/shared-types`, `@ifc-qa/db`, `@ifc-qa/storage`.

- [ ] **Step 6: Write the failing test**

```typescript
// apps/api/src/app.test.ts
import { describe, expect, it, afterAll } from "vitest";
import { buildApp } from "./app";
import { createTestDeps, closeTestDeps } from "./test/test-helpers";

describe("buildApp", () => {
  const deps = createTestDeps();
  const app = buildApp(deps);

  afterAll(async () => {
    await app.close();
    await closeTestDeps(deps);
  });

  it("responds to GET /health", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `Cannot find module './app'` (and `'./test/test-helpers'`)

- [ ] **Step 8: Write `apps/api/src/test/test-helpers.ts`**

```typescript
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { createDbClient } from "@ifc-qa/db";
import { LocalDiskStorageAdapter } from "@ifc-qa/storage";
import { PARSE_JOB_QUEUE_NAME, type ParseJobPayload } from "@ifc-qa/shared-types";
import type { AppDeps } from "../app";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://ifc_qa:ifc_qa@localhost:5432/ifc_qa";
export const TEST_REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export function migrateTestDb(): void {
  execSync("pnpm --filter @ifc-qa/db run db:migrate", { stdio: "inherit" });
}

export function createTestDeps(): AppDeps {
  const db = createDbClient(TEST_DATABASE_URL);
  const storage = new LocalDiskStorageAdapter(
    mkdtempSync(join(tmpdir(), "ifc-qa-api-"))
  );
  const connection = new IORedis(TEST_REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<ParseJobPayload>(PARSE_JOB_QUEUE_NAME, { connection });
  return { db, storage, queue };
}

export async function closeTestDeps(deps: AppDeps): Promise<void> {
  await deps.queue.close();
}
```

- [ ] **Step 9: Write `apps/api/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import type { Queue } from "bullmq";
import type { DbClient } from "@ifc-qa/db";
import type { StorageAdapter } from "@ifc-qa/storage";
import type { ParseJobPayload } from "@ifc-qa/shared-types";

export interface AppDeps {
  db: DbClient;
  storage: StorageAdapter;
  queue: Queue<ParseJobPayload>;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(multipart, {
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024,
      files: 20,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
```

- [ ] **Step 10: Write `apps/api/src/server.ts`**

```typescript
import { createDbClient } from "@ifc-qa/db";
import { LocalDiskStorageAdapter } from "@ifc-qa/storage";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { PARSE_JOB_QUEUE_NAME, type ParseJobPayload } from "@ifc-qa/shared-types";
import { buildApp } from "./app";

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://ifc_qa:ifc_qa@localhost:5432/ifc_qa";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "./storage-data";

const db = createDbClient(DATABASE_URL);
const storage = new LocalDiskStorageAdapter(STORAGE_ROOT);
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue<ParseJobPayload>(PARSE_JOB_QUEUE_NAME, { connection });

const app = buildApp({ db, storage, queue });

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 11: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (1 test)

- [ ] **Step 12: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold Fastify app with health check"
```

---

### Task 2: `POST /rule-sets`

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/rule-sets.test.ts`

**Interfaces:**
- Consumes: `ruleSets` table (`@ifc-qa/db`), `RuleSetSummarySchema`/`RuleSetSummary` (`@ifc-qa/shared-types`), `AppDeps`/`buildApp` (Task 1), `createTestDeps`/`migrateTestDb`/`closeTestDeps` (Task 1).
- Produces: nothing new consumed by other tasks (rule-sets route is a leaf).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/rule-sets.test.ts
import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import FormData from "form-data";
import { buildApp } from "./app";
import { createTestDeps, closeTestDeps, migrateTestDb } from "./test/test-helpers";
import { ruleSets } from "@ifc-qa/db";

describe("rule-sets routes", () => {
  const deps = createTestDeps();
  const app = buildApp(deps);

  beforeAll(() => {
    migrateTestDb();
  });

  afterEach(async () => {
    await deps.db.delete(ruleSets);
  });

  afterAll(async () => {
    await app.close();
    await closeTestDeps(deps);
  });

  describe("POST /rule-sets", () => {
    it("stores the uploaded IDS XML and returns a RuleSetSummary", async () => {
      const form = new FormData();
      form.append("name", "Company Naming Standard v3");
      form.append(
        "file",
        Buffer.from(
          '<ids:ids xmlns:ids="http://standards.buildingsmart.org/IDS" />'
        ),
        { filename: "rules.xml", contentType: "text/xml" }
      );

      const response = await app.inject({
        method: "POST",
        url: "/rule-sets",
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe("Company Naming Standard v3");
      expect(typeof body.id).toBe("string");
      expect(typeof body.uploadedAt).toBe("string");
    });

    it("rejects a request missing the name field", async () => {
      const form = new FormData();
      form.append("file", Buffer.from("<ids:ids />"), {
        filename: "rules.xml",
        contentType: "text/xml",
      });

      const response = await app.inject({
        method: "POST",
        url: "/rule-sets",
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `404` (route not registered), first assertion `expect(response.statusCode).toBe(201)` fails.

- [ ] **Step 3: Update `apps/api/src/app.ts`**

Full file contents:

```typescript
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import type { Queue } from "bullmq";
import type { DbClient } from "@ifc-qa/db";
import { ruleSets } from "@ifc-qa/db";
import type { StorageAdapter } from "@ifc-qa/storage";
import { type ParseJobPayload, RuleSetSummarySchema } from "@ifc-qa/shared-types";

export interface AppDeps {
  db: DbClient;
  storage: StorageAdapter;
  queue: Queue<ParseJobPayload>;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(multipart, {
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024,
      files: 20,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/rule-sets", async (request, reply) => {
    let name: string | undefined;
    let idsXml: string | undefined;

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "name") {
        name = String(part.value);
      } else if (part.type === "file") {
        idsXml = (await part.toBuffer()).toString("utf-8");
      }
    }

    if (!name || !idsXml) {
      return reply
        .status(400)
        .send({ error: "name field and IDS XML file are both required" });
    }

    const [row] = await deps.db
      .insert(ruleSets)
      .values({ name, idsXml })
      .returning();

    return reply.status(201).send(
      RuleSetSummarySchema.parse({
        id: row.id,
        name: row.name,
        uploadedAt: row.uploadedAt.toISOString(),
      })
    );
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (3 tests total)

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add POST /rule-sets"
```

---

### Task 3: `GET /rule-sets`

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/rule-sets.test.ts`

**Interfaces:**
- Consumes: same as Task 2, plus `RuleSetSummarySchema.array()` for the list response.
- Produces: nothing new.

- [ ] **Step 1: Add the failing test**

Add this `describe` block inside the existing `describe("rule-sets routes", ...)` in `apps/api/src/rule-sets.test.ts`, alongside the existing `describe("POST /rule-sets", ...)`:

```typescript
  describe("GET /rule-sets", () => {
    it("lists every uploaded rule set", async () => {
      await deps.db
        .insert(ruleSets)
        .values([
          { name: "Rule Set A", idsXml: "<ids/>" },
          { name: "Rule Set B", idsXml: "<ids/>" },
        ]);

      const response = await app.inject({ method: "GET", url: "/rule-sets" });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(2);
      expect(body.map((r: { name: string }) => r.name).sort()).toEqual([
        "Rule Set A",
        "Rule Set B",
      ]);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `404` (`GET /rule-sets` not registered yet)

- [ ] **Step 3: Add the route to `apps/api/src/app.ts`**

Insert this block right after the `POST /rule-sets` route (before `return app;`):

```typescript
  app.get("/rule-sets", async () => {
    const rows = await deps.db.select().from(ruleSets);
    return RuleSetSummarySchema.array().parse(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        uploadedAt: row.uploadedAt.toISOString(),
      }))
    );
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add GET /rule-sets"
```

---

### Task 4: `POST /runs`

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/runs.test.ts`

**Interfaces:**
- Consumes: `runs`/`fileJobs`/`ruleSets` tables (`@ifc-qa/db`), `EngineIdSchema`, `PARSE_JOB_QUEUE_NAME`, `ParseJobPayloadSchema`, `CreateRunResponseSchema` (`@ifc-qa/shared-types`), `LocalDiskStorageAdapter.write` semantics (`@ifc-qa/storage`, sub-plan 00), `eq` (`drizzle-orm`).
- Produces: nothing new consumed by other tasks in this plan, but this is the contract the worker sub-plan (05) reads from — one BullMQ job per file job on `PARSE_JOB_QUEUE_NAME`, payload `ParseJobPayload`.
- **Implementation note (multipart field ordering):** `@fastify/multipart`'s `request.parts()` yields parts in wire order. A field's value is only known to code that runs *after* that field's part has been read. This route therefore requires the client to send the `ruleSetId` and `engine` fields **before** the file parts in the multipart body (i.e. call `form.append("ruleSetId", ...)` and `form.append("engine", ...)` before any `form.append("file", ...)` — see the test below, and flag this to the frontend sub-plan (06) when it builds its upload form).

- [ ] **Step 1: Add `drizzle-orm` as a direct dependency**

`apps/api/src/app.ts` needs `eq(...)` from `drizzle-orm` directly (not just re-exported table objects from `@ifc-qa/db`). Edit `apps/api/package.json`'s `dependencies` block to:

```json
  "dependencies": {
    "fastify": "^5.10.0",
    "@fastify/multipart": "^10.1.0",
    "bullmq": "^5.80.7",
    "ioredis": "^5.11.1",
    "drizzle-orm": "^0.36.1",
    "@ifc-qa/shared-types": "workspace:*",
    "@ifc-qa/db": "workspace:*",
    "@ifc-qa/storage": "workspace:*"
  },
```

Run: `pnpm install`
Expected: exits 0.

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/src/runs.test.ts
import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import FormData from "form-data";
import { eq } from "drizzle-orm";
import { buildApp } from "./app";
import { createTestDeps, closeTestDeps, migrateTestDb } from "./test/test-helpers";
import { ruleSets, runs, fileJobs } from "@ifc-qa/db";

describe("POST /runs", () => {
  const deps = createTestDeps();
  const app = buildApp(deps);
  let ruleSetId: string;

  beforeAll(async () => {
    migrateTestDb();
    const [ruleSet] = await deps.db
      .insert(ruleSets)
      .values({ name: "Test Rule Set", idsXml: "<ids/>" })
      .returning();
    ruleSetId = ruleSet.id;
  });

  afterEach(async () => {
    await deps.db.delete(fileJobs);
    await deps.db.delete(runs);
  });

  afterAll(async () => {
    await deps.db.delete(ruleSets);
    await deps.queue.obliterate({ force: true });
    await app.close();
    await closeTestDeps(deps);
  });

  it("creates a run, one file job per file, and enqueues one parse job per file", async () => {
    const form = new FormData();
    form.append("ruleSetId", ruleSetId);
    form.append("engine", "web-ifc");
    form.append("file", Buffer.from("ISO-10303-21;"), { filename: "model-a.ifc" });
    form.append("file", Buffer.from("ISO-10303-21;"), { filename: "model-b.ifc" });

    const response = await app.inject({
      method: "POST",
      url: "/runs",
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.runId).toEqual(expect.any(String));
    expect(body.fileJobIds).toHaveLength(2);

    const storedFileJobs = await deps.db
      .select()
      .from(fileJobs)
      .where(eq(fileJobs.runId, body.runId));
    expect(storedFileJobs).toHaveLength(2);
    expect(storedFileJobs.every((job) => job.status === "queued")).toBe(true);

    for (const fileJobId of body.fileJobIds as string[]) {
      const job = await deps.queue.getJob(fileJobId);
      expect(job).toBeDefined();
      expect(job?.data.runId).toBe(body.runId);
      expect(job?.data.engine).toBe("web-ifc");
      expect(job?.data.ruleSetId).toBe(ruleSetId);
    }
  });

  it("rejects an unknown engine", async () => {
    const form = new FormData();
    form.append("ruleSetId", ruleSetId);
    form.append("engine", "revit");
    form.append("file", Buffer.from("ISO-10303-21;"), { filename: "model-a.ifc" });

    const response = await app.inject({
      method: "POST",
      url: "/runs",
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for an unknown rule set id", async () => {
    const form = new FormData();
    form.append("ruleSetId", "00000000-0000-0000-0000-000000000000");
    form.append("engine", "web-ifc");
    form.append("file", Buffer.from("ISO-10303-21;"), { filename: "model-a.ifc" });

    const response = await app.inject({
      method: "POST",
      url: "/runs",
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `404` (`POST /runs` not registered yet)

- [ ] **Step 4: Update `apps/api/src/app.ts`**

Full file contents:

```typescript
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { eq } from "drizzle-orm";
import type { Queue } from "bullmq";
import type { DbClient } from "@ifc-qa/db";
import { ruleSets, runs, fileJobs } from "@ifc-qa/db";
import type { StorageAdapter } from "@ifc-qa/storage";
import {
  type ParseJobPayload,
  ParseJobPayloadSchema,
  EngineIdSchema,
  RuleSetSummarySchema,
  CreateRunResponseSchema,
} from "@ifc-qa/shared-types";

export interface AppDeps {
  db: DbClient;
  storage: StorageAdapter;
  queue: Queue<ParseJobPayload>;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(multipart, {
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024,
      files: 20,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/rule-sets", async (request, reply) => {
    let name: string | undefined;
    let idsXml: string | undefined;

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "name") {
        name = String(part.value);
      } else if (part.type === "file") {
        idsXml = (await part.toBuffer()).toString("utf-8");
      }
    }

    if (!name || !idsXml) {
      return reply
        .status(400)
        .send({ error: "name field and IDS XML file are both required" });
    }

    const [row] = await deps.db
      .insert(ruleSets)
      .values({ name, idsXml })
      .returning();

    return reply.status(201).send(
      RuleSetSummarySchema.parse({
        id: row.id,
        name: row.name,
        uploadedAt: row.uploadedAt.toISOString(),
      })
    );
  });

  app.get("/rule-sets", async () => {
    const rows = await deps.db.select().from(ruleSets);
    return RuleSetSummarySchema.array().parse(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        uploadedAt: row.uploadedAt.toISOString(),
      }))
    );
  });

  app.post("/runs", async (request, reply) => {
    let ruleSetId: string | undefined;
    let engine: string | undefined;
    let runId: string | undefined;
    const fileJobIds: string[] = [];

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "ruleSetId") {
        ruleSetId = String(part.value);
        continue;
      }
      if (part.type === "field" && part.fieldname === "engine") {
        engine = String(part.value);
        continue;
      }
      if (part.type !== "file") {
        continue;
      }

      if (!ruleSetId || !engine) {
        // drain the unconsumed file stream so busboy doesn't hang the request
        part.file.resume();
        return reply.status(400).send({
          error: "ruleSetId and engine fields must be sent before the file parts",
        });
      }

      const engineResult = EngineIdSchema.safeParse(engine);
      if (!engineResult.success) {
        part.file.resume();
        return reply.status(400).send({ error: `unknown engine: ${engine}` });
      }

      if (!runId) {
        const [ruleSet] = await deps.db
          .select()
          .from(ruleSets)
          .where(eq(ruleSets.id, ruleSetId));
        if (!ruleSet) {
          part.file.resume();
          return reply
            .status(404)
            .send({ error: `rule set not found: ${ruleSetId}` });
        }

        const [run] = await deps.db
          .insert(runs)
          .values({ ruleSetId, engine: engineResult.data })
          .returning();
        runId = run.id;
      }

      const storageKey = `runs/${runId}/${part.filename}`;
      await deps.storage.write(storageKey, part.file);

      const [fileJob] = await deps.db
        .insert(fileJobs)
        .values({
          runId,
          fileName: part.filename,
          storageKey,
        })
        .returning();

      await deps.queue.add(
        "parse",
        ParseJobPayloadSchema.parse({
          fileJobId: fileJob.id,
          runId,
          engine: engineResult.data,
          filePath: storageKey,
          ruleSetId,
        }),
        { jobId: fileJob.id }
      );

      fileJobIds.push(fileJob.id);
    }

    if (!runId) {
      return reply.status(400).send({ error: "at least one file is required" });
    }

    return reply
      .status(201)
      .send(CreateRunResponseSchema.parse({ runId, fileJobIds }));
  });

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (7 tests total)

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): add POST /runs with streamed uploads and BullMQ enqueue"
```

---

### Task 5: `GET /runs/:runId/status`

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/run-status.test.ts`

**Interfaces:**
- Consumes: `runs`/`fileJobs` tables (`@ifc-qa/db`), `RunStatusResponseSchema`/`RunStatus` (`@ifc-qa/shared-types`).
- Produces: nothing new consumed elsewhere.
- **Judgment call — run status is computed on read, not persisted:** the `runs.status` column (from sub-plan 00's schema) is written once at creation (`"queued"`, via its column default) and never updated by this route. `GET /runs/:runId/status` recomputes the status from the current `fileJobs` rows on every request: `"completed"` if every file job is `"succeeded"` or `"failed"`, else `"running"` if any file job has left `"queued"`, else `"queued"`. Given the spec's stated volume (1–2 batches/week, ~20 files/batch), recomputing over a handful of rows per poll is cheap and avoids a second place that can drift out of sync with the file jobs. No background job flips `runs.status`; if the worker sub-plan wants to also update `runs.status` as a denormalized cache, that's an optional optimization, not a correctness requirement, since this route never reads that column.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/run-status.test.ts
import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { buildApp } from "./app";
import { createTestDeps, closeTestDeps, migrateTestDb } from "./test/test-helpers";
import { ruleSets, runs, fileJobs } from "@ifc-qa/db";

describe("GET /runs/:runId/status", () => {
  const deps = createTestDeps();
  const app = buildApp(deps);
  let ruleSetId: string;

  beforeAll(async () => {
    migrateTestDb();
    const [ruleSet] = await deps.db
      .insert(ruleSets)
      .values({ name: "Test Rule Set", idsXml: "<ids/>" })
      .returning();
    ruleSetId = ruleSet.id;
  });

  afterEach(async () => {
    await deps.db.delete(fileJobs);
    await deps.db.delete(runs);
  });

  afterAll(async () => {
    await deps.db.delete(ruleSets);
    await app.close();
    await closeTestDeps(deps);
  });

  it("reports queued while no file job has started", async () => {
    const [run] = await deps.db
      .insert(runs)
      .values({ ruleSetId, engine: "web-ifc" })
      .returning();
    await deps.db.insert(fileJobs).values({
      runId: run.id,
      fileName: "model-a.ifc",
      storageKey: `runs/${run.id}/model-a.ifc`,
    });

    const response = await app.inject({
      method: "GET",
      url: `/runs/${run.id}/status`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("queued");
  });

  it("reports running when some file jobs have started but not all finished", async () => {
    const [run] = await deps.db
      .insert(runs)
      .values({ ruleSetId, engine: "web-ifc" })
      .returning();
    await deps.db.insert(fileJobs).values([
      {
        runId: run.id,
        fileName: "model-a.ifc",
        storageKey: `runs/${run.id}/model-a.ifc`,
        status: "succeeded",
        parseMs: 100,
      },
      {
        runId: run.id,
        fileName: "model-b.ifc",
        storageKey: `runs/${run.id}/model-b.ifc`,
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/runs/${run.id}/status`,
    });

    expect(response.json().status).toBe("running");
  });

  it("reports completed once every file job has succeeded or failed (mixed outcomes allowed)", async () => {
    const [run] = await deps.db
      .insert(runs)
      .values({ ruleSetId, engine: "ifc-lite" })
      .returning();
    await deps.db.insert(fileJobs).values([
      {
        runId: run.id,
        fileName: "model-a.ifc",
        storageKey: `runs/${run.id}/model-a.ifc`,
        status: "succeeded",
        parseMs: 100,
      },
      {
        runId: run.id,
        fileName: "model-b.ifc",
        storageKey: `runs/${run.id}/model-b.ifc`,
        status: "failed",
        errorMessage: "corrupt IFC header",
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/runs/${run.id}/status`,
    });

    const body = response.json();
    expect(body.status).toBe("completed");
    expect(body.fileJobs).toHaveLength(2);
    expect(
      body.fileJobs.map((j: { status: string }) => j.status).sort()
    ).toEqual(["failed", "succeeded"]);
  });

  it("returns 404 for an unknown run id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/runs/00000000-0000-0000-0000-000000000000/status",
    });
    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `404` (`GET /runs/:runId/status` not registered yet)

- [ ] **Step 3: Add the route to `apps/api/src/app.ts`**

Add `RunStatusResponseSchema` and `type RunStatus` to the `@ifc-qa/shared-types` import:

```typescript
import {
  type ParseJobPayload,
  ParseJobPayloadSchema,
  EngineIdSchema,
  RuleSetSummarySchema,
  CreateRunResponseSchema,
  RunStatusResponseSchema,
  type RunStatus,
} from "@ifc-qa/shared-types";
```

Insert this route right after the `POST /runs` route (before `return app;`):

```typescript
  app.get<{ Params: { runId: string } }>(
    "/runs/:runId/status",
    async (request, reply) => {
      const { runId } = request.params;

      const [run] = await deps.db.select().from(runs).where(eq(runs.id, runId));
      if (!run) {
        return reply.status(404).send({ error: `run not found: ${runId}` });
      }

      const jobs = await deps.db
        .select()
        .from(fileJobs)
        .where(eq(fileJobs.runId, runId));

      const allFinished = jobs.every(
        (job) => job.status === "succeeded" || job.status === "failed"
      );
      const anyStarted = jobs.some((job) => job.status !== "queued");
      const status: RunStatus = allFinished
        ? "completed"
        : anyStarted
          ? "running"
          : "queued";

      return reply.send(
        RunStatusResponseSchema.parse({
          runId: run.id,
          status,
          fileJobs: jobs.map((job) => ({
            id: job.id,
            fileName: job.fileName,
            status: job.status,
            engine: run.engine,
            parseMs: job.parseMs,
            errorMessage: job.errorMessage,
          })),
        })
      );
    }
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (11 tests total)

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add GET /runs/:runId/status"
```

---

### Task 6: `GET /runs/:runId/results`

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/run-results.test.ts`

**Interfaces:**
- Consumes: `runs`/`fileJobs`/`elementResults` tables (`@ifc-qa/db`), `RunResultsResponseSchema` (`@ifc-qa/shared-types`).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/run-results.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "./app";
import { createTestDeps, closeTestDeps, migrateTestDb } from "./test/test-helpers";
import { ruleSets, runs, fileJobs, elementResults } from "@ifc-qa/db";

describe("GET /runs/:runId/results", () => {
  const deps = createTestDeps();
  const app = buildApp(deps);
  let runId: string;

  beforeAll(async () => {
    migrateTestDb();

    const [ruleSet] = await deps.db
      .insert(ruleSets)
      .values({ name: "Test Rule Set", idsXml: "<ids/>" })
      .returning();

    const [run] = await deps.db
      .insert(runs)
      .values({ ruleSetId: ruleSet.id, engine: "web-ifc" })
      .returning();
    runId = run.id;

    const [fileJobA] = await deps.db
      .insert(fileJobs)
      .values({
        runId,
        fileName: "model-a.ifc",
        storageKey: `runs/${runId}/model-a.ifc`,
        status: "succeeded",
        parseMs: 250,
      })
      .returning();

    await deps.db.insert(elementResults).values([
      {
        fileJobId: fileJobA.id,
        elementGlobalId: "g1",
        elementType: "IFCWALL",
        ruleId: "naming-prefix",
        severity: "error",
        message: "Name must start with 'W-'",
      },
      {
        fileJobId: fileJobA.id,
        elementGlobalId: "g2",
        elementType: "IFCDOOR",
        ruleId: "fire-rating-required",
        severity: "warning",
        message: "Missing FireRating property",
      },
    ]);
  });

  afterAll(async () => {
    await deps.db.delete(elementResults);
    await deps.db.delete(fileJobs);
    await deps.db.delete(runs);
    await deps.db.delete(ruleSets);
    await app.close();
    await closeTestDeps(deps);
  });

  it("returns every element result joined with its source file name", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/runs/${runId}/results`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.runId).toBe(runId);
    expect(body.results).toHaveLength(2);
    expect(
      body.results.every((r: { fileName: string }) => r.fileName === "model-a.ifc")
    ).toBe(true);
    expect(body.results.map((r: { ruleId: string }) => r.ruleId).sort()).toEqual([
      "fire-rating-required",
      "naming-prefix",
    ]);
  });

  it("returns 404 for an unknown run id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/runs/00000000-0000-0000-0000-000000000000/results",
    });
    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `404` (`GET /runs/:runId/results` not registered yet)

- [ ] **Step 3: Add the route to `apps/api/src/app.ts`**

Add `elementResults` to the `@ifc-qa/db` import and `RunResultsResponseSchema` to the `@ifc-qa/shared-types` import:

```typescript
import { ruleSets, runs, fileJobs, elementResults } from "@ifc-qa/db";
```

```typescript
import {
  type ParseJobPayload,
  ParseJobPayloadSchema,
  EngineIdSchema,
  RuleSetSummarySchema,
  CreateRunResponseSchema,
  RunStatusResponseSchema,
  type RunStatus,
  RunResultsResponseSchema,
} from "@ifc-qa/shared-types";
```

Insert this route right after the `GET /runs/:runId/status` route (before `return app;`):

```typescript
  app.get<{ Params: { runId: string } }>(
    "/runs/:runId/results",
    async (request, reply) => {
      const { runId } = request.params;

      const [run] = await deps.db.select().from(runs).where(eq(runs.id, runId));
      if (!run) {
        return reply.status(404).send({ error: `run not found: ${runId}` });
      }

      const rows = await deps.db
        .select({
          id: elementResults.id,
          fileJobId: elementResults.fileJobId,
          elementGlobalId: elementResults.elementGlobalId,
          elementType: elementResults.elementType,
          ruleId: elementResults.ruleId,
          severity: elementResults.severity,
          message: elementResults.message,
          fileName: fileJobs.fileName,
        })
        .from(elementResults)
        .innerJoin(fileJobs, eq(elementResults.fileJobId, fileJobs.id))
        .where(eq(fileJobs.runId, runId));

      return reply.send(
        RunResultsResponseSchema.parse({ runId: run.id, results: rows })
      );
    }
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (13 tests total)

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add GET /runs/:runId/results"
```

---

### Task 7: `GET /runs/:runId/report.pdf` and `GET /runs/:runId/report.xlsx`

> **Sequencing:** this task has a soft dependency on sub-plan 03 (`@ifc-qa/report-generator`). If `packages/report-generator/package.json` does not exist yet when you reach this task, stop here, note that 03 hasn't landed, and leave Tasks 1–6 as the completed state of this plan until 03 ships — do not stub `generatePdfReport`/`generateExcelReport`.

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/reports.test.ts`

**Interfaces:**
- Consumes: `generatePdfReport(data: RunReportData): Promise<Buffer>`, `generateExcelReport(data: RunReportData): Promise<Buffer>`, `RunReportData` (`@ifc-qa/report-generator`, sub-plan 03) where `RunReportData = { runId: string; ruleSetName: string; engine: EngineId; generatedAt: string; results: Array<ElementResult & { fileName: string }> }`.
- Produces: nothing new consumed elsewhere — this is the last task in this plan.

- [ ] **Step 1: Confirm sub-plan 03 has landed**

Run: `ls packages/report-generator`
Expected: a `package.json` exporting `generatePdfReport` and `generateExcelReport` exists. If it doesn't, stop this task now (see the sequencing note above).

- [ ] **Step 2: Add `@ifc-qa/report-generator` as a dependency**

Edit `apps/api/package.json`'s `dependencies` block to:

```json
  "dependencies": {
    "fastify": "^5.10.0",
    "@fastify/multipart": "^10.1.0",
    "bullmq": "^5.80.7",
    "ioredis": "^5.11.1",
    "drizzle-orm": "^0.36.1",
    "@ifc-qa/shared-types": "workspace:*",
    "@ifc-qa/db": "workspace:*",
    "@ifc-qa/storage": "workspace:*",
    "@ifc-qa/report-generator": "workspace:*"
  },
```

Run: `pnpm install`
Expected: exits 0.

- [ ] **Step 3: Write the failing test**

```typescript
// apps/api/src/reports.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "./app";
import { createTestDeps, closeTestDeps, migrateTestDb } from "./test/test-helpers";
import { ruleSets, runs, fileJobs, elementResults } from "@ifc-qa/db";

describe("report export routes", () => {
  const deps = createTestDeps();
  const app = buildApp(deps);
  let runId: string;

  beforeAll(async () => {
    migrateTestDb();

    const [ruleSet] = await deps.db
      .insert(ruleSets)
      .values({ name: "Test Rule Set", idsXml: "<ids/>" })
      .returning();

    const [run] = await deps.db
      .insert(runs)
      .values({ ruleSetId: ruleSet.id, engine: "web-ifc" })
      .returning();
    runId = run.id;

    const [fileJob] = await deps.db
      .insert(fileJobs)
      .values({
        runId,
        fileName: "model-a.ifc",
        storageKey: `runs/${runId}/model-a.ifc`,
        status: "succeeded",
        parseMs: 512,
      })
      .returning();

    await deps.db.insert(elementResults).values({
      fileJobId: fileJob.id,
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
    });
  });

  afterAll(async () => {
    await deps.db.delete(elementResults);
    await deps.db.delete(fileJobs);
    await deps.db.delete(runs);
    await deps.db.delete(ruleSets);
    await app.close();
    await closeTestDeps(deps);
  });

  it("streams a PDF report with the correct headers", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/runs/${runId}/report.pdf`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("streams an Excel report with the correct headers", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/runs/${runId}/report.xlsx`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.rawPayload.subarray(0, 2).toString()).toBe("PK");
  });

  it("returns 404 for an unknown run id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/runs/00000000-0000-0000-0000-000000000000/report.pdf",
    });
    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/api test`
Expected: FAIL — `Cannot find module '@ifc-qa/report-generator'` (or `404`, if the package resolves but the routes aren't registered yet)

- [ ] **Step 5: Update `apps/api/src/app.ts`**

Full file contents:

```typescript
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { eq } from "drizzle-orm";
import type { Queue } from "bullmq";
import type { DbClient } from "@ifc-qa/db";
import { ruleSets, runs, fileJobs, elementResults } from "@ifc-qa/db";
import type { StorageAdapter } from "@ifc-qa/storage";
import {
  type ParseJobPayload,
  ParseJobPayloadSchema,
  EngineIdSchema,
  RuleSetSummarySchema,
  CreateRunResponseSchema,
  RunStatusResponseSchema,
  type RunStatus,
  RunResultsResponseSchema,
} from "@ifc-qa/shared-types";
import {
  generatePdfReport,
  generateExcelReport,
  type RunReportData,
} from "@ifc-qa/report-generator";

export interface AppDeps {
  db: DbClient;
  storage: StorageAdapter;
  queue: Queue<ParseJobPayload>;
}

async function loadRunReportData(
  deps: AppDeps,
  runId: string
): Promise<RunReportData | null> {
  const [run] = await deps.db
    .select({
      id: runs.id,
      engine: runs.engine,
      ruleSetName: ruleSets.name,
    })
    .from(runs)
    .innerJoin(ruleSets, eq(runs.ruleSetId, ruleSets.id))
    .where(eq(runs.id, runId));

  if (!run) {
    return null;
  }

  const rows = await deps.db
    .select({
      id: elementResults.id,
      fileJobId: elementResults.fileJobId,
      elementGlobalId: elementResults.elementGlobalId,
      elementType: elementResults.elementType,
      ruleId: elementResults.ruleId,
      severity: elementResults.severity,
      message: elementResults.message,
      fileName: fileJobs.fileName,
    })
    .from(elementResults)
    .innerJoin(fileJobs, eq(elementResults.fileJobId, fileJobs.id))
    .where(eq(fileJobs.runId, runId));

  return {
    runId: run.id,
    ruleSetName: run.ruleSetName,
    engine: run.engine,
    generatedAt: new Date().toISOString(),
    results: rows,
  };
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(multipart, {
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024,
      files: 20,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/rule-sets", async (request, reply) => {
    let name: string | undefined;
    let idsXml: string | undefined;

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "name") {
        name = String(part.value);
      } else if (part.type === "file") {
        idsXml = (await part.toBuffer()).toString("utf-8");
      }
    }

    if (!name || !idsXml) {
      return reply
        .status(400)
        .send({ error: "name field and IDS XML file are both required" });
    }

    const [row] = await deps.db
      .insert(ruleSets)
      .values({ name, idsXml })
      .returning();

    return reply.status(201).send(
      RuleSetSummarySchema.parse({
        id: row.id,
        name: row.name,
        uploadedAt: row.uploadedAt.toISOString(),
      })
    );
  });

  app.get("/rule-sets", async () => {
    const rows = await deps.db.select().from(ruleSets);
    return RuleSetSummarySchema.array().parse(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        uploadedAt: row.uploadedAt.toISOString(),
      }))
    );
  });

  app.post("/runs", async (request, reply) => {
    let ruleSetId: string | undefined;
    let engine: string | undefined;
    let runId: string | undefined;
    const fileJobIds: string[] = [];

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "ruleSetId") {
        ruleSetId = String(part.value);
        continue;
      }
      if (part.type === "field" && part.fieldname === "engine") {
        engine = String(part.value);
        continue;
      }
      if (part.type !== "file") {
        continue;
      }

      if (!ruleSetId || !engine) {
        part.file.resume();
        return reply.status(400).send({
          error: "ruleSetId and engine fields must be sent before the file parts",
        });
      }

      const engineResult = EngineIdSchema.safeParse(engine);
      if (!engineResult.success) {
        part.file.resume();
        return reply.status(400).send({ error: `unknown engine: ${engine}` });
      }

      if (!runId) {
        const [ruleSet] = await deps.db
          .select()
          .from(ruleSets)
          .where(eq(ruleSets.id, ruleSetId));
        if (!ruleSet) {
          part.file.resume();
          return reply
            .status(404)
            .send({ error: `rule set not found: ${ruleSetId}` });
        }

        const [run] = await deps.db
          .insert(runs)
          .values({ ruleSetId, engine: engineResult.data })
          .returning();
        runId = run.id;
      }

      const storageKey = `runs/${runId}/${part.filename}`;
      await deps.storage.write(storageKey, part.file);

      const [fileJob] = await deps.db
        .insert(fileJobs)
        .values({
          runId,
          fileName: part.filename,
          storageKey,
        })
        .returning();

      await deps.queue.add(
        "parse",
        ParseJobPayloadSchema.parse({
          fileJobId: fileJob.id,
          runId,
          engine: engineResult.data,
          filePath: storageKey,
          ruleSetId,
        }),
        { jobId: fileJob.id }
      );

      fileJobIds.push(fileJob.id);
    }

    if (!runId) {
      return reply.status(400).send({ error: "at least one file is required" });
    }

    return reply
      .status(201)
      .send(CreateRunResponseSchema.parse({ runId, fileJobIds }));
  });

  app.get<{ Params: { runId: string } }>(
    "/runs/:runId/status",
    async (request, reply) => {
      const { runId } = request.params;

      const [run] = await deps.db.select().from(runs).where(eq(runs.id, runId));
      if (!run) {
        return reply.status(404).send({ error: `run not found: ${runId}` });
      }

      const jobs = await deps.db
        .select()
        .from(fileJobs)
        .where(eq(fileJobs.runId, runId));

      const allFinished = jobs.every(
        (job) => job.status === "succeeded" || job.status === "failed"
      );
      const anyStarted = jobs.some((job) => job.status !== "queued");
      const status: RunStatus = allFinished
        ? "completed"
        : anyStarted
          ? "running"
          : "queued";

      return reply.send(
        RunStatusResponseSchema.parse({
          runId: run.id,
          status,
          fileJobs: jobs.map((job) => ({
            id: job.id,
            fileName: job.fileName,
            status: job.status,
            engine: run.engine,
            parseMs: job.parseMs,
            errorMessage: job.errorMessage,
          })),
        })
      );
    }
  );

  app.get<{ Params: { runId: string } }>(
    "/runs/:runId/results",
    async (request, reply) => {
      const { runId } = request.params;

      const [run] = await deps.db.select().from(runs).where(eq(runs.id, runId));
      if (!run) {
        return reply.status(404).send({ error: `run not found: ${runId}` });
      }

      const rows = await deps.db
        .select({
          id: elementResults.id,
          fileJobId: elementResults.fileJobId,
          elementGlobalId: elementResults.elementGlobalId,
          elementType: elementResults.elementType,
          ruleId: elementResults.ruleId,
          severity: elementResults.severity,
          message: elementResults.message,
          fileName: fileJobs.fileName,
        })
        .from(elementResults)
        .innerJoin(fileJobs, eq(elementResults.fileJobId, fileJobs.id))
        .where(eq(fileJobs.runId, runId));

      return reply.send(
        RunResultsResponseSchema.parse({ runId: run.id, results: rows })
      );
    }
  );

  app.get<{ Params: { runId: string } }>(
    "/runs/:runId/report.pdf",
    async (request, reply) => {
      const data = await loadRunReportData(deps, request.params.runId);
      if (!data) {
        return reply
          .status(404)
          .send({ error: `run not found: ${request.params.runId}` });
      }

      const buffer = await generatePdfReport(data);
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `attachment; filename="run-${data.runId}.pdf"`
      );
      return reply.send(buffer);
    }
  );

  app.get<{ Params: { runId: string } }>(
    "/runs/:runId/report.xlsx",
    async (request, reply) => {
      const data = await loadRunReportData(deps, request.params.runId);
      if (!data) {
        return reply
          .status(404)
          .send({ error: `run not found: ${request.params.runId}` });
      }

      const buffer = await generateExcelReport(data);
      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      reply.header(
        "Content-Disposition",
        `attachment; filename="run-${data.runId}.xlsx"`
      );
      return reply.send(buffer);
    }
  );

  return app;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/api test`
Expected: PASS (16 tests total)

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): add GET /runs/:runId/report.pdf and report.xlsx"
```

---

## Self-Review Notes

**Spec coverage:**
- Architecture's API bullet ("Chunked upload endpoint (files up to 2GB), creates a Run with one FileJob per uploaded file, enqueues jobs, exposes status/results/rule-set endpoints") → Tasks 1–7 cover rule-set upload/list, run creation, status, results, and report export.
- Data Flow step 2 ("API stores files, creates a Run + one FileJob per file (status: queued), returns the Run ID immediately") → Task 4, `POST /runs` responds with `CreateRunResponse` as soon as all parts are streamed, before any parsing happens (parsing is the worker's job, not this plan's).
- Data Flow step 3 ("Frontend polls/subscribes for Run status") → Task 5, `GET /runs/:runId/status`.
- Data Flow step 6/7 ("aggregated issue table" / "PDF/Excel export generated on demand") → Tasks 6 and 7.
- Error Handling ("A corrupt or unparseable IFC file fails only its own FileJob... Mixed pass/fail per file is expected — not all-or-nothing") → Task 5's three status tests explicitly cover queued/running/completed-with-mixed-outcomes.
- "No auth" → no auth middleware anywhere in this plan, matching the Global Constraints.
- 2GB/20-file batch limits → Task 1's `@fastify/multipart` registration sets `limits: { fileSize: 2GB, files: 20 }`; Task 4 streams every file straight to disk via `storage.write(key, part.file)`, never buffering into memory.

**Placeholder scan:** no TBD/TODO markers; every step shows complete, runnable code; no "similar to Task N" shorthand — Tasks 3, 5, 6, 7 each re-show the full `app.ts` (or the exact insertion block plus updated imports) rather than referring back.

**Type consistency:** `AppDeps` is defined once (Task 1) and never redeclared; every task's route handlers use the exact field names from `@ifc-qa/shared-types` (`RuleSetSummary.uploadedAt`, `CreateRunResponse.fileJobIds`, `RunStatusResponse.fileJobs[].engine`, `RunResultsResponse.results[].fileName`) and from `@ifc-qa/db`'s schema (`fileJobs.storageKey`, `runs.engine`, `elementResults.severity`) verbatim, matching the foundation plan's Task 2/4/7 definitions. `RunReportData`'s shape in Task 7 matches the fixed signature given in this plan's brief field-for-field.
