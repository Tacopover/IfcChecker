# IFC QA Tool — 06: Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/web`, the React frontend for batch IFC upload, engine selection, rule-set management, run history, and a per-run filterable issue table — developed and fully tested against mocked HTTP responses (MSW) for the sub-plan 04 API contract, so no backend needs to be running to build or verify this plan.

**Architecture:** A Vite + React 19 + TypeScript single-page app using `react-router-dom` for four views (Upload, Rule Sets, Run History, Run Detail), TanStack Query for all server-state and polling (`GET /runs/:runId/status` via `refetchInterval`), and TanStack Table for the filterable/sortable issue table. Every HTTP call funnels through one `src/api/client.ts` module built directly against `@ifc-qa/shared-types` DTOs. Every test mocks the network at the HTTP layer with MSW (`msw/node`), so components exercise real `fetch`/`FormData` behavior against a fake server, not hand-rolled fakes.

**Tech Stack:** `vite@^8.1.5`, `@vitejs/plugin-react@^6.0.3`, `react@^19.2.7`, `react-dom@^19.2.7`, `typescript@^5.6.3`, `@tanstack/react-query@^5.101.2`, `@tanstack/react-table@^8.21.3`, `react-router-dom@^7.18.1`, `vitest@^2.1.4`, `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^6.9.1`, `@testing-library/user-event@^14.6.1`, `msw@^2.15.0`, `jsdom@^29.1.1`.

## Global Constraints

- No auth — trusted internal network (per spec); no login/session UI anywhere in this app.
- Package scope for internal packages is `@ifc-qa/*` (per sub-plan 00); this app is named `@ifc-qa/web`.
- No custom IDS rule-authoring UI — the rule-set page is upload-only, per the spec's explicit non-goal ("existing tools like IfcTester already cover authoring").
- A run batches up to ~20 IFC files — the upload form enforces this client-side and blocks submission above the cap.
- Every DTO this app consumes (`EngineId`, `RunStatus`, `FileJobStatus`, `Severity`, `CreateRunResponse`, `FileJobSummary`, `RunStatusResponse`, `ElementResult`, `RunResultsResponse`, `RuleSetSummary`) is imported from `@ifc-qa/shared-types` — never redeclared locally.
- Every test in this plan mocks the network via MSW against the documented HTTP contract; no task requires a running API, worker, or database.

## Dependency Notes for Orchestration

This plan depends **only** on sub-plan 00 (foundation) for the `@ifc-qa/shared-types` DTOs and the pnpm workspace root (`pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`) — sub-plan 00's own dependency notes require it to complete before any other sub-plan starts, so by the time this plan executes, `packages/shared-types` already exists and builds. This plan's Task 1 scaffolds `apps/web` only; it does not touch the workspace root.

Once sub-plan 00 is done, this plan runs **fully in parallel** with sub-plans 01 (parser-adapters), 02 (ids-validator), 03 (report-generator), 04 (api-service), and 05 (worker-service) — every task here is built and verified against MSW-mocked HTTP responses matching sub-plan 04's documented contract, never against a live server. Real end-to-end wiring against the running API (base URL / dev-server proxy configuration, CORS, etc.) happens in sub-plan 07 (integration), not here.

**Known cross-cutting gap: `GET /runs` (Run History).** The confirmed sub-plan 04 contract has no endpoint listing runs — only per-run `GET /runs/:runId/status` and `GET /runs/:runId/results`. The design spec states plainly that "No auth means Run history is global/shared, matching the 'trusted internal network' decision" (Error Handling section) — i.e., every user is expected to see every run created by anyone, not just runs they personally created. A client-side-only history (e.g. tracking created run IDs in `localStorage`) would silently violate that: a different machine, or the same machine after clearing storage, would show an incomplete or empty history despite runs existing server-side. Given that, this plan makes the call to flag `GET /runs` as a **necessary missing endpoint** and builds `RunHistoryPage` (Task 5) against it as a documented assumption, rather than building a fake local-only history. The assumed shape is defined once, in `apps/web/src/api/types.ts`, as `RunSummary`/`RunListResponse`, following the naming convention already established by `RuleSetSummary`/`FileJobSummary` in `@ifc-qa/shared-types`:

```typescript
export interface RunSummary {
  id: string;
  status: RunStatus;
  engine: EngineId;
  ruleSetId: string;
  createdAt: string;
  fileCount: number;
}
export interface RunListResponse {
  runs: RunSummary[];
}
```

**Sub-plan 07 must resolve this with sub-plan 04's owner**: either sub-plan 04 adds a real `GET /runs` route returning this shape (at which point it should move into `@ifc-qa/shared-types` alongside the other API DTOs, per sub-plan 00's constraint that cross-service contracts live there), or, if the owner rejects adding it, `RunHistoryPage` must be redesigned in sub-plan 07 around whatever mechanism is agreed instead. This plan does not invent the endpoint on the server side — it only assumes it exists for frontend development purposes, exactly as instructed.

**Other documented assumptions:**
- File uploads are sent as a single multipart `POST` via native `fetch` + `FormData` (matching the sub-plan 04 contract's documented shape). This plan does not implement client-driven chunking or resumable upload; if the real 2GB-file upload path needs a different client protocol, that is an integration-time (07) discovery, not addressed here.
- `src/api/client.ts` reads an API base URL from `import.meta.env.VITE_API_BASE_URL` (default: same-origin, empty string). Configuring this (or a dev-server proxy) to point at the real API is sub-plan 07's job.

---

### Task 1: Scaffold `apps/web` — Vite + React + TypeScript + Vitest

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/main.tsx`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `@ifc-qa/shared-types` (workspace package, produced by sub-plan 00), the pnpm workspace root (`pnpm-workspace.yaml`, `tsconfig.base.json`).
- Produces: a buildable/testable `@ifc-qa/web` package that every later task in this plan adds files to.

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "@ifc-qa/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@ifc-qa/shared-types": "workspace:*",
    "@tanstack/react-query": "^5.101.2",
    "@tanstack/react-table": "^8.21.3",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router-dom": "^7.18.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.3",
    "jsdom": "^29.1.1",
    "msw": "^2.15.0",
    "typescript": "^5.6.3",
    "vite": "^8.1.5",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "outDir": "dist",
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Write `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 4: Write `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IFC QA Tool</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `apps/web/src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 6: Write `apps/web/src/test/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Write the failing test**

```tsx
// apps/web/src/App.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("renders the app heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "IFC QA Tool" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Install workspace deps, then run test to verify it fails**

Run: `pnpm install` (from repo root)
Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — `Cannot find module './App'`

- [ ] **Step 9: Write `apps/web/src/App.tsx`**

```tsx
export function App() {
  return (
    <main>
      <h1>IFC QA Tool</h1>
      <p>Loading application...</p>
    </main>
  );
}
```

- [ ] **Step 10: Write `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 11: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (1 test)

- [ ] **Step 12: Verify the app builds**

Run: `pnpm --filter @ifc-qa/web build`
Expected: exits 0, produces `apps/web/dist/`

- [ ] **Step 13: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold Vite + React + TypeScript app shell"
```

---

### Task 2: API client + MSW test harness

**Files:**
- Create: `apps/web/src/api/types.ts`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/test/mocks/fixtures.ts`
- Create: `apps/web/src/test/mocks/handlers.ts`
- Create: `apps/web/src/test/mocks/server.ts`
- Modify: `apps/web/src/test/setup.ts`
- Test: `apps/web/src/api/client.test.ts`

**Interfaces:**
- Consumes: `EngineId`, `RunStatus`, `RuleSetSummary`, `CreateRunResponse`, `RunStatusResponse`, `RunResultsResponse` from `@ifc-qa/shared-types` (sub-plan 00).
- Produces: `fetchRuleSets()`, `createRuleSet(file, name)`, `createRun({files, ruleSetId, engine})`, `fetchRunStatus(runId)`, `fetchRunResults(runId)`, `reportDownloadUrl(runId, format)`, `fetchRunList()` — every route component in Tasks 3–7 imports these. Also produces the reusable MSW `server` + default `handlers` + fixture DTOs (`ruleSetFixtures`, `runningStatusResponse`, `completedStatusResponse`, `runResultsFixture`, `runListFixture`) that every later test imports.

- [ ] **Step 1: Write `apps/web/src/api/types.ts`**

```typescript
import type { EngineId, RunStatus } from "@ifc-qa/shared-types";

// ASSUMED types for the ASSUMED GET /runs endpoint — see the gap flagged in
// this plan's "Dependency Notes for Orchestration" section. Shape follows
// the existing summary DTO pattern (RuleSetSummary/FileJobSummary) already
// defined in @ifc-qa/shared-types.
export interface RunSummary {
  id: string;
  status: RunStatus;
  engine: EngineId;
  ruleSetId: string;
  createdAt: string;
  fileCount: number;
}

export interface RunListResponse {
  runs: RunSummary[];
}
```

- [ ] **Step 2: Write `apps/web/src/test/mocks/fixtures.ts`**

```typescript
import type { RuleSetSummary, RunResultsResponse, RunStatusResponse } from "@ifc-qa/shared-types";
import type { RunListResponse } from "../../api/types";

export const ruleSetFixtures: RuleSetSummary[] = [
  { id: "rs-1", name: "Company Naming Standard v3", uploadedAt: "2026-07-01T00:00:00.000Z" },
  { id: "rs-2", name: "MEP Fire Rating Rules", uploadedAt: "2026-07-10T00:00:00.000Z" },
];

export const runningStatusResponse: RunStatusResponse = {
  runId: "run-1",
  status: "running",
  fileJobs: [
    { id: "f1", fileName: "model-a.ifc", status: "running", engine: "web-ifc", parseMs: null, errorMessage: null },
    { id: "f2", fileName: "model-b.ifc", status: "queued", engine: "web-ifc", parseMs: null, errorMessage: null },
  ],
};

export const completedStatusResponse: RunStatusResponse = {
  runId: "run-1",
  status: "completed",
  fileJobs: [
    { id: "f1", fileName: "model-a.ifc", status: "succeeded", engine: "web-ifc", parseMs: 842, errorMessage: null },
    { id: "f2", fileName: "model-b.ifc", status: "failed", engine: "web-ifc", parseMs: null, errorMessage: "unexpected EOF" },
  ],
};

export const runResultsFixture: RunResultsResponse = {
  runId: "run-1",
  results: [
    {
      id: "e1",
      fileJobId: "f1",
      elementGlobalId: "g1",
      elementType: "IFCWALL",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
      fileName: "model-a.ifc",
    },
    {
      id: "e2",
      fileJobId: "f1",
      elementGlobalId: "g2",
      elementType: "IFCDOOR",
      ruleId: "fire-rating-required",
      severity: "warning",
      message: "Missing FireRating property",
      fileName: "model-a.ifc",
    },
  ],
};

export const runListFixture: RunListResponse = {
  runs: [
    { id: "run-1", status: "completed", engine: "web-ifc", ruleSetId: "rs-1", createdAt: "2026-07-15T09:00:00.000Z", fileCount: 2 },
    { id: "run-2", status: "running", engine: "ifc-lite", ruleSetId: "rs-2", createdAt: "2026-07-16T09:00:00.000Z", fileCount: 5 },
  ],
};
```

- [ ] **Step 3: Write `apps/web/src/test/mocks/handlers.ts`**

```typescript
import { http, HttpResponse } from "msw";
import { completedStatusResponse, ruleSetFixtures, runListFixture, runResultsFixture } from "./fixtures";

export const handlers = [
  http.get("/rule-sets", () => HttpResponse.json(ruleSetFixtures)),
  http.post("/rule-sets", async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get("name");
    return HttpResponse.json({
      id: "rs-new",
      name: typeof name === "string" ? name : "Untitled",
      uploadedAt: new Date().toISOString(),
    });
  }),
  http.post("/runs", () => HttpResponse.json({ runId: "run-1", fileJobIds: ["f1", "f2"] })),
  http.get("/runs", () => HttpResponse.json(runListFixture)),
  http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)),
  http.get("/runs/:runId/results", () => HttpResponse.json(runResultsFixture)),
];
```

- [ ] **Step 4: Write `apps/web/src/test/mocks/server.ts`**

```typescript
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

- [ ] **Step 5: Modify `apps/web/src/test/setup.ts` to wire the MSW lifecycle**

```typescript
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 6: Write the failing test**

```typescript
// apps/web/src/api/client.test.ts
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import {
  createRuleSet,
  createRun,
  fetchRuleSets,
  fetchRunList,
  fetchRunResults,
  fetchRunStatus,
  reportDownloadUrl,
} from "./client";
import { completedStatusResponse, ruleSetFixtures, runListFixture, runResultsFixture } from "../test/mocks/fixtures";

describe("fetchRuleSets", () => {
  it("returns the rule sets from GET /rule-sets", async () => {
    const result = await fetchRuleSets();
    expect(result).toEqual(ruleSetFixtures);
  });

  it("throws with the response status when the request fails", async () => {
    server.use(http.get("/rule-sets", () => new HttpResponse(null, { status: 500 })));
    await expect(fetchRuleSets()).rejects.toThrow("500");
  });
});

describe("createRuleSet", () => {
  it("posts the file and name as multipart form data", async () => {
    let received: FormData | undefined;
    server.use(
      http.post("/rule-sets", async ({ request }) => {
        received = await request.formData();
        return HttpResponse.json({ id: "rs-new", name: "New Rules", uploadedAt: "2026-07-17T00:00:00.000Z" });
      })
    );

    const file = new File(["<ids/>"], "rules.xml", { type: "application/xml" });
    const result = await createRuleSet(file, "New Rules");

    expect(received?.get("name")).toBe("New Rules");
    expect((received?.get("file") as File).name).toBe("rules.xml");
    expect(result.id).toBe("rs-new");
  });
});

describe("createRun", () => {
  it("posts files, ruleSetId, and engine as multipart form data", async () => {
    let received: FormData | undefined;
    server.use(
      http.post("/runs", async ({ request }) => {
        received = await request.formData();
        return HttpResponse.json({ runId: "run-1", fileJobIds: ["f1", "f2"] });
      })
    );

    const files = [new File(["a"], "model-a.ifc"), new File(["b"], "model-b.ifc")];
    const result = await createRun({ files, ruleSetId: "rs-1", engine: "web-ifc" });

    expect(received?.getAll("files")).toHaveLength(2);
    expect(received?.get("ruleSetId")).toBe("rs-1");
    expect(received?.get("engine")).toBe("web-ifc");
    expect(result.runId).toBe("run-1");
  });
});

describe("fetchRunStatus", () => {
  it("returns the run status from GET /runs/:runId/status", async () => {
    server.use(http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)));
    const result = await fetchRunStatus("run-1");
    expect(result).toEqual(completedStatusResponse);
  });
});

describe("fetchRunResults", () => {
  it("returns the results from GET /runs/:runId/results", async () => {
    server.use(http.get("/runs/:runId/results", () => HttpResponse.json(runResultsFixture)));
    const result = await fetchRunResults("run-1");
    expect(result).toEqual(runResultsFixture);
  });
});

describe("fetchRunList", () => {
  it("returns the run list from GET /runs", async () => {
    server.use(http.get("/runs", () => HttpResponse.json(runListFixture)));
    const result = await fetchRunList();
    expect(result).toEqual(runListFixture);
  });
});

describe("reportDownloadUrl", () => {
  it("builds the pdf and xlsx report URLs for a run", () => {
    expect(reportDownloadUrl("run-1", "pdf")).toBe("/runs/run-1/report.pdf");
    expect(reportDownloadUrl("run-1", "xlsx")).toBe("/runs/run-1/report.xlsx");
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 8: Write `apps/web/src/api/client.ts`**

```typescript
import type {
  CreateRunResponse,
  EngineId,
  RuleSetSummary,
  RunResultsResponse,
  RunStatusResponse,
} from "@ifc-qa/shared-types";
import type { RunListResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchRuleSets(): Promise<RuleSetSummary[]> {
  const res = await fetch(`${API_BASE}/rule-sets`);
  return parseJsonOrThrow<RuleSetSummary[]>(res);
}

export async function createRuleSet(file: File, name: string): Promise<RuleSetSummary> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  const res = await fetch(`${API_BASE}/rule-sets`, { method: "POST", body: form });
  return parseJsonOrThrow<RuleSetSummary>(res);
}

export interface CreateRunParams {
  files: File[];
  ruleSetId: string;
  engine: EngineId;
}

export async function createRun(params: CreateRunParams): Promise<CreateRunResponse> {
  const form = new FormData();
  // ruleSetId/engine MUST be appended before the file parts — the sub-plan 04
  // POST /runs handler reads multipart parts as a stream and 400s if either
  // field arrives after the first file part.
  form.append("ruleSetId", params.ruleSetId);
  form.append("engine", params.engine);
  for (const file of params.files) {
    form.append("files", file);
  }
  const res = await fetch(`${API_BASE}/runs`, { method: "POST", body: form });
  return parseJsonOrThrow<CreateRunResponse>(res);
}

export async function fetchRunStatus(runId: string): Promise<RunStatusResponse> {
  const res = await fetch(`${API_BASE}/runs/${runId}/status`);
  return parseJsonOrThrow<RunStatusResponse>(res);
}

export async function fetchRunResults(runId: string): Promise<RunResultsResponse> {
  const res = await fetch(`${API_BASE}/runs/${runId}/results`);
  return parseJsonOrThrow<RunResultsResponse>(res);
}

export function reportDownloadUrl(runId: string, format: "pdf" | "xlsx"): string {
  return `${API_BASE}/runs/${runId}/report.${format}`;
}

// ASSUMED endpoint. See "Dependency Notes for Orchestration" / gap flag at
// the top of this plan: GET /runs is not part of the confirmed sub-plan 04
// API contract. Sub-plan 07 must add it server-side (or this function and
// RunHistoryPage must be redesigned) once sub-plan 04's owner weighs in.
export async function fetchRunList(): Promise<RunListResponse> {
  const res = await fetch(`${API_BASE}/runs`);
  return parseJsonOrThrow<RunListResponse>(res);
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (9 tests total)

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/api apps/web/src/test
git commit -m "feat(web): add API client and MSW test harness"
```

---

### Task 3: Rule-set management page

**Files:**
- Create: `apps/web/src/test/renderWithProviders.tsx`
- Create: `apps/web/src/routes/RuleSetsPage.tsx`
- Test: `apps/web/src/routes/RuleSetsPage.test.tsx`

**Interfaces:**
- Consumes: `fetchRuleSets`, `createRuleSet` (Task 2); `server`, `ruleSetFixtures` (Task 2 test harness).
- Produces: `renderWithProviders(ui, { route?, path? })` — every later route test (Tasks 4–7) uses this helper. `RuleSetsPage` component — wired into the app shell in Task 8.

- [ ] **Step 1: Write `apps/web/src/test/renderWithProviders.tsx`**

```tsx
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface RenderWithProvidersOptions {
  route?: string;
  path?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", path = "/" }: RenderWithProvidersOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/routes/RuleSetsPage.test.tsx
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import { ruleSetFixtures } from "../test/mocks/fixtures";
import { RuleSetsPage } from "./RuleSetsPage";

describe("RuleSetsPage", () => {
  it("renders existing rule sets from GET /rule-sets", async () => {
    renderWithProviders(<RuleSetsPage />);

    expect(await screen.findByText(ruleSetFixtures[0].name)).toBeInTheDocument();
    expect(screen.getByText(ruleSetFixtures[1].name)).toBeInTheDocument();
  });

  it("uploads a new rule set and shows it in the list once the upload completes", async () => {
    const uploaded = [...ruleSetFixtures];
    server.use(
      http.get("/rule-sets", () => HttpResponse.json(uploaded)),
      http.post("/rule-sets", async ({ request }) => {
        const formData = await request.formData();
        const created = {
          id: "rs-new",
          name: String(formData.get("name")),
          uploadedAt: "2026-07-17T00:00:00.000Z",
        };
        uploaded.push(created);
        return HttpResponse.json(created);
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<RuleSetsPage />);
    await screen.findByText(ruleSetFixtures[0].name);

    await user.type(screen.getByLabelText("Name"), "MEP Structural Standard");
    const file = new File(["<ids/>"], "structural.xml", { type: "application/xml" });
    await user.upload(screen.getByLabelText("IDS XML file"), file);
    await user.click(screen.getByRole("button", { name: "Upload rule set" }));

    await waitFor(() => {
      expect(screen.getByText("MEP Structural Standard")).toBeInTheDocument();
    });
  });

  it("disables the upload button until both a name and a file are provided", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RuleSetsPage />);
    await screen.findByText(ruleSetFixtures[0].name);

    const submit = screen.getByRole("button", { name: "Upload rule set" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Only A Name");
    expect(submit).toBeDisabled();

    const file = new File(["<ids/>"], "rules.xml", { type: "application/xml" });
    await user.upload(screen.getByLabelText("IDS XML file"), file);
    expect(submit).toBeEnabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — `Cannot find module './RuleSetsPage'`

- [ ] **Step 4: Write `apps/web/src/routes/RuleSetsPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRuleSet, fetchRuleSets } from "../api/client";

export function RuleSetsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const ruleSetsQuery = useQuery({
    queryKey: ["rule-sets"],
    queryFn: fetchRuleSets,
  });

  const uploadMutation = useMutation({
    mutationFn: () => createRuleSet(file as File, name),
    onSuccess: () => {
      setName("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["rule-sets"] });
    },
  });

  const canSubmit = name.trim() !== "" && file !== null && !uploadMutation.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    uploadMutation.mutate();
  }

  return (
    <section>
      <h1>Rule Sets</h1>

      <ul aria-label="Existing rule sets">
        {ruleSetsQuery.data?.map((ruleSet) => (
          <li key={ruleSet.id}>
            {ruleSet.name} — uploaded {new Date(ruleSet.uploadedAt).toLocaleDateString()}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} aria-label="Upload rule set">
        <label htmlFor="rule-set-name">Name</label>
        <input id="rule-set-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="rule-set-file">IDS XML file</label>
        <input
          id="rule-set-file"
          type="file"
          accept=".xml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {uploadMutation.isError && <p role="alert">{(uploadMutation.error as Error).message}</p>}

        <button type="submit" disabled={!canSubmit}>
          {uploadMutation.isPending ? "Uploading..." : "Upload rule set"}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (12 tests total)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/RuleSetsPage.tsx apps/web/src/routes/RuleSetsPage.test.tsx apps/web/src/test/renderWithProviders.tsx
git commit -m "feat(web): add rule-set management page"
```

---

### Task 4: Upload page

**Files:**
- Create: `apps/web/src/routes/UploadPage.tsx`
- Test: `apps/web/src/routes/UploadPage.test.tsx`

**Interfaces:**
- Consumes: `fetchRuleSets`, `createRun` (Task 2); `renderWithProviders` (Task 3); `EngineId` (`@ifc-qa/shared-types`).
- Produces: `UploadPage` component — wired into the app shell in Task 8, and is the app's `/` route.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/UploadPage.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { ruleSetFixtures } from "../test/mocks/fixtures";
import { renderWithProviders } from "../test/renderWithProviders";
import { UploadPage } from "./UploadPage";

function makeIfcFile(name: string) {
  return new File(["ISO-10303-21;"], name, { type: "application/octet-stream" });
}

describe("UploadPage", () => {
  it("renders rule sets fetched from GET /rule-sets in the select", async () => {
    renderWithProviders(<UploadPage />);
    expect(await screen.findByRole("option", { name: ruleSetFixtures[0].name })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: ruleSetFixtures[1].name })).toBeInTheDocument();
  });

  it("disables submit until a rule set, an engine, and at least one file are chosen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />);
    await screen.findByRole("option", { name: ruleSetFixtures[0].name });

    const submit = screen.getByRole("button", { name: "Start run" });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Rule set"), ruleSetFixtures[0].id);
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    expect(submit).toBeDisabled();

    await user.upload(screen.getByLabelText(/IFC files/), makeIfcFile("model-a.ifc"));
    expect(submit).toBeEnabled();
  });

  it("shows an error and disables submit when more than 20 files are selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />);
    await screen.findByRole("option", { name: ruleSetFixtures[0].name });

    await user.selectOptions(screen.getByLabelText("Rule set"), ruleSetFixtures[0].id);
    await user.click(screen.getByRole("radio", { name: "web-ifc" }));

    const tooManyFiles = Array.from({ length: 21 }, (_, i) => makeIfcFile(`model-${i}.ifc`));
    await user.upload(screen.getByLabelText(/IFC files/), tooManyFiles);

    expect(screen.getByRole("alert")).toHaveTextContent("Select up to 20 files (21 selected).");
    expect(screen.getByRole("button", { name: "Start run" })).toBeDisabled();
  });

  it("submits the form and navigates to the run detail page on success", async () => {
    server.use(http.post("/runs", () => HttpResponse.json({ runId: "run-42", fileJobIds: ["f1"] })));

    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/runs/:runId" element={<div>Run detail for run-42</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByRole("option", { name: ruleSetFixtures[0].name });
    await user.selectOptions(screen.getByLabelText("Rule set"), ruleSetFixtures[0].id);
    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText(/IFC files/), makeIfcFile("model-a.ifc"));
    await user.click(screen.getByRole("button", { name: "Start run" }));

    expect(await screen.findByText("Run detail for run-42")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — `Cannot find module './UploadPage'`

- [ ] **Step 3: Write `apps/web/src/routes/UploadPage.tsx`**

```tsx
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { EngineId } from "@ifc-qa/shared-types";
import { createRun, fetchRuleSets } from "../api/client";

const MAX_FILES = 20;

export function UploadPage() {
  const navigate = useNavigate();
  const [ruleSetId, setRuleSetId] = useState("");
  const [engine, setEngine] = useState<EngineId | "">("");
  const [files, setFiles] = useState<File[]>([]);

  const ruleSetsQuery = useQuery({
    queryKey: ["rule-sets"],
    queryFn: fetchRuleSets,
  });

  const createRunMutation = useMutation({
    mutationFn: createRun,
    onSuccess: (data) => {
      navigate(`/runs/${data.runId}`);
    },
  });

  const tooManyFiles = files.length > MAX_FILES;
  const canSubmit =
    ruleSetId !== "" && engine !== "" && files.length > 0 && !tooManyFiles && !createRunMutation.isPending;

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || engine === "") return;
    createRunMutation.mutate({ files, ruleSetId, engine });
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Upload IFC files">
      <h1>Upload IFC Files</h1>

      <label htmlFor="rule-set-select">Rule set</label>
      <select id="rule-set-select" value={ruleSetId} onChange={(e) => setRuleSetId(e.target.value)}>
        <option value="">Select a rule set</option>
        {ruleSetsQuery.data?.map((ruleSet) => (
          <option key={ruleSet.id} value={ruleSet.id}>
            {ruleSet.name}
          </option>
        ))}
      </select>

      <fieldset>
        <legend>Engine</legend>
        <label>
          <input
            type="radio"
            name="engine"
            value="web-ifc"
            checked={engine === "web-ifc"}
            onChange={() => setEngine("web-ifc")}
          />
          web-ifc
        </label>
        <label>
          <input
            type="radio"
            name="engine"
            value="ifc-lite"
            checked={engine === "ifc-lite"}
            onChange={() => setEngine("ifc-lite")}
          />
          ifc-lite
        </label>
      </fieldset>

      <label htmlFor="ifc-files-input">IFC files (up to {MAX_FILES})</label>
      <input id="ifc-files-input" type="file" multiple accept=".ifc" onChange={handleFilesChange} />
      {tooManyFiles && (
        <p role="alert">
          Select up to {MAX_FILES} files ({files.length} selected).
        </p>
      )}

      {createRunMutation.isError && <p role="alert">{(createRunMutation.error as Error).message}</p>}

      <button type="submit" disabled={!canSubmit}>
        {createRunMutation.isPending ? "Creating run..." : "Start run"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (16 tests total)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/UploadPage.tsx apps/web/src/routes/UploadPage.test.tsx
git commit -m "feat(web): add upload page"
```

---

### Task 5: Run history page (against the assumed `GET /runs`)

**Files:**
- Create: `apps/web/src/routes/RunHistoryPage.tsx`
- Test: `apps/web/src/routes/RunHistoryPage.test.tsx`

**Interfaces:**
- Consumes: `fetchRunList` (Task 2, ASSUMED endpoint — see Dependency Notes gap flag), `RunSummary`/`RunListResponse` (Task 2 `api/types.ts`), `renderWithProviders` (Task 3), `runListFixture` (Task 2 fixtures).
- Produces: `RunHistoryPage` component — wired into the app shell in Task 8 at `/runs`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/RunHistoryPage.test.tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import { runListFixture } from "../test/mocks/fixtures";
import { RunHistoryPage } from "./RunHistoryPage";

describe("RunHistoryPage", () => {
  it("renders past runs fetched from GET /runs with links to their detail pages", async () => {
    renderWithProviders(<RunHistoryPage />);

    const firstRunLink = await screen.findByRole("link", { name: runListFixture.runs[0].id });
    expect(firstRunLink).toHaveAttribute("href", `/runs/${runListFixture.runs[0].id}`);
    expect(screen.getByText(runListFixture.runs[0].status)).toBeInTheDocument();
    expect(screen.getByText(runListFixture.runs[1].engine)).toBeInTheDocument();
  });

  it("shows an empty state when there are no runs yet", async () => {
    server.use(http.get("/runs", () => HttpResponse.json({ runs: [] })));
    renderWithProviders(<RunHistoryPage />);
    expect(await screen.findByText("No runs yet.")).toBeInTheDocument();
  });

  it("shows an error message when the run list request fails", async () => {
    server.use(http.get("/runs", () => new HttpResponse(null, { status: 500 })));
    renderWithProviders(<RunHistoryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — `Cannot find module './RunHistoryPage'`

- [ ] **Step 3: Write `apps/web/src/routes/RunHistoryPage.tsx`**

```tsx
// ASSUMED endpoint (GET /runs) — see this plan's "Dependency Notes for
// Orchestration" gap flag: sub-plan 04's confirmed contract has no run-list
// route. This page is built against the assumed RunListResponse shape until
// sub-plan 07 resolves the gap with sub-plan 04's owner.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchRunList } from "../api/client";

export function RunHistoryPage() {
  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRunList,
  });

  if (runsQuery.isLoading) {
    return <p>Loading run history...</p>;
  }

  if (runsQuery.isError) {
    return <p role="alert">{(runsQuery.error as Error).message}</p>;
  }

  const runs = runsQuery.data?.runs ?? [];

  return (
    <section>
      <h1>Run History</h1>
      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Engine</th>
              <th>Files</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link to={`/runs/${run.id}`}>{run.id}</Link>
                </td>
                <td>{run.status}</td>
                <td>{run.engine}</td>
                <td>{run.fileCount}</td>
                <td>{new Date(run.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (19 tests total)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/RunHistoryPage.tsx apps/web/src/routes/RunHistoryPage.test.tsx
git commit -m "feat(web): add run history page against assumed GET /runs"
```

---

### Task 6: Run detail page — status polling and per-file progress

**Files:**
- Create: `apps/web/src/routes/RunDetailPage.tsx`
- Test: `apps/web/src/routes/RunDetailPage.test.tsx`

**Interfaces:**
- Consumes: `fetchRunStatus`, `reportDownloadUrl` (Task 2); `renderWithProviders` (Task 3); `runningStatusResponse`, `completedStatusResponse` (Task 2 fixtures).
- Produces: `RunDetailPage` component — wired into the app shell in Task 8 at `/runs/:runId`. Task 7 extends this same file to add the results table.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/routes/RunDetailPage.test.tsx
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import { completedStatusResponse, runningStatusResponse } from "../test/mocks/fixtures";
import { RunDetailPage } from "./RunDetailPage";

describe("RunDetailPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders per-file progress including a failed file's error message", async () => {
    server.use(http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)));

    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    expect(await screen.findByText("Status: completed")).toBeInTheDocument();
    expect(screen.getByText("model-a.ifc")).toBeInTheDocument();
    expect(screen.getByText("842")).toBeInTheDocument();
    expect(screen.getByText("model-b.ifc")).toBeInTheDocument();
    expect(screen.getByText("unexpected EOF")).toBeInTheDocument();
  });

  it("shows report download links once the run is completed", async () => {
    server.use(http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)));
    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    await screen.findByText("Status: completed");
    expect(screen.getByRole("link", { name: "Download PDF report" })).toHaveAttribute(
      "href",
      "/runs/run-1/report.pdf"
    );
    expect(screen.getByRole("link", { name: "Download Excel report" })).toHaveAttribute(
      "href",
      "/runs/run-1/report.xlsx"
    );
  });

  it("polls run status every 2s while running and stops once completed", async () => {
    let callCount = 0;
    server.use(
      http.get("/runs/:runId/status", () => {
        callCount += 1;
        return HttpResponse.json(callCount === 1 ? runningStatusResponse : completedStatusResponse);
      })
    );

    vi.useFakeTimers();
    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(callCount).toBe(1);
    expect(screen.getByText("Status: running")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(callCount).toBe(2);
    expect(screen.getByText("Status: completed")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(callCount).toBe(2);
  });

  it("shows an error message when the status request fails", async () => {
    server.use(http.get("/runs/:runId/status", () => new HttpResponse(null, { status: 500 })));
    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });
    expect(await screen.findByRole("alert")).toHaveTextContent("500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — `Cannot find module './RunDetailPage'`

- [ ] **Step 3: Write `apps/web/src/routes/RunDetailPage.tsx`**

```tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRunStatus, reportDownloadUrl } from "../api/client";

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();

  const statusQuery = useQuery({
    queryKey: ["run-status", runId],
    queryFn: () => fetchRunStatus(runId as string),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data?.status === "completed" ? false : 2000),
  });

  if (!runId) {
    return <p role="alert">No run id provided.</p>;
  }

  if (statusQuery.isLoading) {
    return <p>Loading run status...</p>;
  }

  if (statusQuery.isError) {
    return <p role="alert">{(statusQuery.error as Error).message}</p>;
  }

  const run = statusQuery.data;
  if (!run) {
    return null;
  }

  const isCompleted = run.status === "completed";

  return (
    <section>
      <h1>Run {run.runId}</h1>
      <p>Status: {run.status}</p>

      <table>
        <caption>File progress</caption>
        <thead>
          <tr>
            <th>File</th>
            <th>Engine</th>
            <th>Status</th>
            <th>Parse time (ms)</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {run.fileJobs.map((job) => (
            <tr key={job.id}>
              <td>{job.fileName}</td>
              <td>{job.engine}</td>
              <td>{job.status}</td>
              <td>{job.parseMs ?? "—"}</td>
              <td>{job.errorMessage ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isCompleted && (
        <div>
          <h2>Reports</h2>
          <a href={reportDownloadUrl(run.runId, "pdf")}>Download PDF report</a>{" "}
          <a href={reportDownloadUrl(run.runId, "xlsx")}>Download Excel report</a>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (23 tests total)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/RunDetailPage.tsx apps/web/src/routes/RunDetailPage.test.tsx
git commit -m "feat(web): add run detail page status polling and file progress"
```

---

### Task 7: Filterable issue table + wire results into run detail page

**Files:**
- Create: `apps/web/src/components/IssueTable.tsx`
- Test: `apps/web/src/components/IssueTable.test.tsx`
- Modify: `apps/web/src/routes/RunDetailPage.tsx`
- Modify: `apps/web/src/routes/RunDetailPage.test.tsx`

**Interfaces:**
- Consumes: `ElementResult`, `Severity` (`@ifc-qa/shared-types`); `fetchRunResults` (Task 2); `runResultsFixture` (Task 2 fixtures).
- Produces: `IssueTable({ results })` component — the results section of `RunDetailPage`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/IssueTable.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueTable } from "./IssueTable";
import { runResultsFixture } from "../test/mocks/fixtures";

describe("IssueTable", () => {
  it("renders every result row with its file, element type, rule, severity, and message", () => {
    render(<IssueTable results={runResultsFixture.results} />);

    expect(screen.getByText("IFCWALL")).toBeInTheDocument();
    expect(screen.getByText("naming-prefix")).toBeInTheDocument();
    expect(screen.getByText("Name must start with 'W-'")).toBeInTheDocument();
    expect(screen.getByText("IFCDOOR")).toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("filters rows by element type", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={runResultsFixture.results} />);

    await user.type(screen.getByLabelText("Filter by element type"), "IFCDOOR");

    expect(screen.queryByText("naming-prefix")).not.toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("filters rows by severity", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={runResultsFixture.results} />);

    await user.selectOptions(screen.getByLabelText("Filter by severity"), "warning");

    expect(screen.queryByText("naming-prefix")).not.toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("shows an empty state when no rows match the current filters", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={runResultsFixture.results} />);

    await user.type(screen.getByLabelText("Filter by rule id"), "no-such-rule");

    expect(screen.getByText("No issues match the current filters.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — `Cannot find module './IssueTable'`

- [ ] **Step 3: Write `apps/web/src/components/IssueTable.tsx`**

```tsx
import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import type { ElementResult } from "@ifc-qa/shared-types";

type ResultRow = ElementResult & { fileName: string };

const columnHelper = createColumnHelper<ResultRow>();

const columns = [
  columnHelper.accessor("fileName", { header: "File" }),
  columnHelper.accessor("elementType", { header: "Element Type" }),
  columnHelper.accessor("ruleId", { header: "Rule" }),
  columnHelper.accessor("severity", { header: "Severity" }),
  columnHelper.accessor("message", { header: "Message" }),
];

export function IssueTable({ results }: { results: ResultRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const data = useMemo(() => results, [results]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function filterValue(columnId: string): string {
    return (table.getColumn(columnId)?.getFilterValue() as string) ?? "";
  }

  return (
    <div>
      <div role="group" aria-label="Issue filters">
        <label>
          File
          <input
            aria-label="Filter by file name"
            value={filterValue("fileName")}
            onChange={(e) => table.getColumn("fileName")?.setFilterValue(e.target.value)}
          />
        </label>
        <label>
          Element type
          <input
            aria-label="Filter by element type"
            value={filterValue("elementType")}
            onChange={(e) => table.getColumn("elementType")?.setFilterValue(e.target.value)}
          />
        </label>
        <label>
          Rule
          <input
            aria-label="Filter by rule id"
            value={filterValue("ruleId")}
            onChange={(e) => table.getColumn("ruleId")?.setFilterValue(e.target.value)}
          />
        </label>
        <label>
          Severity
          <select
            aria-label="Filter by severity"
            value={filterValue("severity")}
            onChange={(e) => table.getColumn("severity")?.setFilterValue(e.target.value || undefined)}
          >
            <option value="">All</option>
            <option value="error">error</option>
            <option value="warning">warning</option>
          </select>
        </label>
      </div>

      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {table.getRowModel().rows.length === 0 && <p>No issues match the current filters.</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (27 tests total)

- [ ] **Step 5: Add failing tests for results wiring in `apps/web/src/routes/RunDetailPage.test.tsx`**

Add these two `it` blocks inside the existing `describe("RunDetailPage", ...)` block, and add `runResultsFixture` to the fixtures import:

```tsx
// add to the existing import from "../test/mocks/fixtures":
// completedStatusResponse, runningStatusResponse, runResultsFixture

  it("fetches and renders the results table once the run is completed", async () => {
    server.use(
      http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)),
      http.get("/runs/:runId/results", () => HttpResponse.json(runResultsFixture))
    );

    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    await screen.findByText("Status: completed");
    expect(await screen.findByText("naming-prefix")).toBeInTheDocument();
    expect(screen.getByText("Name must start with 'W-'")).toBeInTheDocument();
  });

  it("does not fetch results while the run is still running", async () => {
    let resultsRequests = 0;
    server.use(
      http.get("/runs/:runId/status", () => HttpResponse.json(runningStatusResponse)),
      http.get("/runs/:runId/results", () => {
        resultsRequests += 1;
        return HttpResponse.json(runResultsFixture);
      })
    );

    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    await screen.findByText("Status: running");
    expect(resultsRequests).toBe(0);
  });
```

- [ ] **Step 6: Run test to verify the new assertions fail**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — the results table never renders because `RunDetailPage` does not fetch results yet.

- [ ] **Step 7: Modify `apps/web/src/routes/RunDetailPage.tsx` to fetch and render results**

```tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRunResults, fetchRunStatus, reportDownloadUrl } from "../api/client";
import { IssueTable } from "../components/IssueTable";

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();

  const statusQuery = useQuery({
    queryKey: ["run-status", runId],
    queryFn: () => fetchRunStatus(runId as string),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data?.status === "completed" ? false : 2000),
  });

  const isCompleted = statusQuery.data?.status === "completed";

  const resultsQuery = useQuery({
    queryKey: ["run-results", runId],
    queryFn: () => fetchRunResults(runId as string),
    enabled: Boolean(runId) && isCompleted,
  });

  if (!runId) {
    return <p role="alert">No run id provided.</p>;
  }

  if (statusQuery.isLoading) {
    return <p>Loading run status...</p>;
  }

  if (statusQuery.isError) {
    return <p role="alert">{(statusQuery.error as Error).message}</p>;
  }

  const run = statusQuery.data;
  if (!run) {
    return null;
  }

  return (
    <section>
      <h1>Run {run.runId}</h1>
      <p>Status: {run.status}</p>

      <table>
        <caption>File progress</caption>
        <thead>
          <tr>
            <th>File</th>
            <th>Engine</th>
            <th>Status</th>
            <th>Parse time (ms)</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {run.fileJobs.map((job) => (
            <tr key={job.id}>
              <td>{job.fileName}</td>
              <td>{job.engine}</td>
              <td>{job.status}</td>
              <td>{job.parseMs ?? "—"}</td>
              <td>{job.errorMessage ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isCompleted && (
        <div>
          <h2>Reports</h2>
          <a href={reportDownloadUrl(run.runId, "pdf")}>Download PDF report</a>{" "}
          <a href={reportDownloadUrl(run.runId, "xlsx")}>Download Excel report</a>
        </div>
      )}

      {isCompleted && resultsQuery.isLoading && <p>Loading results...</p>}
      {isCompleted && resultsQuery.isError && <p role="alert">{(resultsQuery.error as Error).message}</p>}
      {isCompleted && resultsQuery.data && (
        <>
          <h2>Issues</h2>
          <IssueTable results={resultsQuery.data.results} />
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (29 tests total)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components apps/web/src/routes/RunDetailPage.tsx apps/web/src/routes/RunDetailPage.test.tsx
git commit -m "feat(web): add filterable issue table and wire results into run detail page"
```

---

### Task 8: App shell — routing and navigation

**Files:**
- Modify: `apps/web/src/App.tsx` (replaces Task 1's placeholder)
- Modify: `apps/web/src/App.test.tsx` (replaces Task 1's placeholder test)

**Interfaces:**
- Consumes: `UploadPage` (Task 4), `RuleSetsPage` (Task 3), `RunHistoryPage` (Task 5), `RunDetailPage` (Task 7).
- Produces: the fully wired app — this is the last task in the plan.

- [ ] **Step 1: Write the failing test (replaces the Task 1 placeholder assertion)**

```tsx
// apps/web/src/App.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { ruleSetFixtures } from "./test/mocks/fixtures";

describe("App", () => {
  it("starts on the upload page and navigates via the nav links", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Upload IFC Files" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Rule Sets" }));
    expect(await screen.findByRole("heading", { name: "Rule Sets" })).toBeInTheDocument();
    expect(await screen.findByText(ruleSetFixtures[0].name)).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Run History" }));
    expect(await screen.findByRole("heading", { name: "Run History" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Upload" }));
    expect(await screen.findByRole("heading", { name: "Upload IFC Files" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/web test`
Expected: FAIL — the placeholder `App` has no nav links or "Upload IFC Files" heading.

- [ ] **Step 3: Write `apps/web/src/App.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { UploadPage } from "./routes/UploadPage";
import { RuleSetsPage } from "./routes/RuleSetsPage";
import { RunHistoryPage } from "./routes/RunHistoryPage";
import { RunDetailPage } from "./routes/RunDetailPage";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <nav>
          <NavLink to="/" end>
            Upload
          </NavLink>{" "}
          <NavLink to="/rule-sets">Rule Sets</NavLink>{" "}
          <NavLink to="/runs">Run History</NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/rule-sets" element={<RuleSetsPage />} />
          <Route path="/runs" element={<RunHistoryPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/web test`
Expected: PASS (30 tests total)

- [ ] **Step 5: Verify the app still builds**

Run: `pnpm --filter @ifc-qa/web build`
Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): wire app shell routing and navigation"
```

---

## Self-Review Notes

- **Spec coverage:** Batch upload with rule-set + engine selection + up to 20 files (Task 4), engine picker (`web-ifc`/`ifc-lite` radio, Task 4), rule-set management upload-only with no authoring UI (Task 3, matches explicit non-goal), run history (Task 5, with the `GET /runs` gap explicitly flagged and reasoned through rather than silently worked around), run detail with 2s status polling until completed (Task 6), per-file progress (file name/engine/status/parseMs/errorMessage, Task 6), filterable/sortable issue table with file/element-type/rule/severity filters (Task 7), and PDF/Excel report download links (Task 6) are each covered by a task.
- **No placeholders:** every step has complete, real code; no `TODO`/"implement later" markers anywhere in the plan.
- **Type consistency:** `EngineId`/`RunStatus`/`FileJobStatus`/`Severity`/`ElementResult`/`RuleSetSummary`/`CreateRunResponse`/`RunStatusResponse`/`RunResultsResponse` are used identically (names and shapes) everywhere they appear, matching `@ifc-qa/shared-types` verbatim as given. The one non-standard type, `RunSummary`/`RunListResponse`, is defined exactly once in `apps/web/src/api/types.ts` and used identically in `client.ts`, `RunHistoryPage.tsx`, and the fixtures/tests — with its ASSUMED status commented at every point of use.
- **Isolation from other sub-plans:** no task in this plan imports from `apps/api`, `packages/db`, `packages/parser-adapters`, or `packages/ids-validator`; the only cross-package import anywhere is `@ifc-qa/shared-types`, confirming this plan is safe to execute in parallel with sub-plans 01–05 as stated in the Dependency Notes.
