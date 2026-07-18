# IFC Model QA Tool — Design

## Overview

Internal MEPover web app for checking naming/parameter compliance on uploaded IFC models. No auth (trusted internal network, whole-company self-serve). Typical usage: 1-2 batch uploads/week, ~20 files per batch, files up to 2GB each.

Users upload a batch of IFC files, pick a rule set (buildingSMART IDS format) and a parsing engine, and get back an in-browser filterable issue table plus a downloadable PDF/Excel report. The parsing engine is a first-class, per-run choice (not a hidden implementation detail) so real throughput on the company's own files can be compared directly instead of trusting vendor benchmarks.

## Architecture

- **Frontend** (`apps/web`): React. Batch upload, engine picker (web-ifc / IFCLite), run history, filterable issue table, rule-set management (upload/manage IDS XML files — no custom IDS authoring UI; existing tools like IfcTester already cover authoring).
- **API** (`apps/api`): Node/Fastify. Chunked upload endpoint (files up to 2GB), creates a Run with one FileJob per uploaded file, enqueues jobs, exposes status/results/rule-set endpoints.
- **Queue**: BullMQ + Redis. Parsing must not block HTTP requests; a full batch can take minutes.
- **Worker** (`apps/worker`): Pulls each FileJob, runs the selected parser adapter, normalizes its output, validates against the Run's IDS rule set, persists results.
- **Parser adapter interface** (`packages/parser-adapters`):
  ```ts
  interface IfcParserAdapter {
    parse(filePath: string): Promise<{ elements: NormalizedElement[]; parseMs: number }>;
  }
  ```
  Two implementations — `WebIfcAdapter` (That Open Company's `web-ifc`) and `IfcLiteAdapter` (`ifc-lite`) — both feeding the same downstream IDS validator, so a run compares parse speed only, not parse speed tangled with different rule logic.
- **IDS validator** (`packages/ids-validator`): Evaluates buildingSMART IDS XML rule files against normalized element data (likely building on `bsdd-ids-validator`'s IDS→JSON-Schema approach), engine-agnostic.
- **Shared types** (`packages/shared-types`): `NormalizedElement`, `Run`, `FileJob`, `ElementResult`.
- **DB**: Postgres. Rule sets (IDS XML + metadata), Runs, FileJobs (status, engine used, timing), ElementResults.
- **Storage**: uploaded files + generated reports behind a small storage interface — local disk initially, swappable to Azure Blob later without touching the rest of the system (hosting choice deferred).

## Data Flow

1. User uploads a batch (up to ~20 files) and picks a rule set + engine.
2. API stores files, creates a Run + one FileJob per file (status: queued), returns the Run ID immediately.
3. Frontend polls/subscribes for Run status.
4. Workers process each FileJob: parse (chosen engine) → normalize → validate against the Run's IDS rule set → persist ElementResults + FileJob summary (counts, timing, engine).
5. Run is marked complete once all its FileJobs finish. Mixed pass/fail per file is expected — not all-or-nothing.
6. Frontend renders the aggregated issue table (filterable by file / element type / rule / severity) from stored results.
7. PDF/Excel export is generated on demand from the same stored results.

## Error Handling

- A corrupt or unparseable IFC file fails only its own FileJob; the rest of the batch continues.
- A parser timeout or crash marks the FileJob failed and records which engine was in use — itself a useful data point for the engine comparison.
- No auth means Run history is global/shared, matching the "trusted internal network" decision.

## Testing

- Unit tests for the normalization layer against small fixture IFC files (`fixtures/ifc`), independent of which engine produced them.
- Unit tests for IDS rule evaluation against fixture rule files (`fixtures/ids`) and known-good/known-bad fixture data, isolated from parsing.
- One integration test per adapter running a real fixture file end-to-end, asserting the job completes, results persist, and timing is recorded.
- No load-test suite at this volume (1-2 uploads/week) — the per-run engine toggle on real files is the perf comparison.

## Explicit Non-Goals (v1)

- No clash/geometry checks — naming/parameter compliance only.
- No custom IDS rule authoring UI — rule files are authored externally and uploaded.
- No auth/RBAC — trusted internal network only.
- No multi-tenant/per-client rule isolation beyond selecting which IDS rule set a Run uses.
- No in-browser 3D geometry viewer in v1 — the priority for this phase is fast, comparable parse/QA throughput across engines (the per-run engine picker + timing comparison). A 3D viewer to visually inspect a run's flagged elements is a likely v2 addition once the QA pipeline is proven; it is out of scope here and would need its own design pass (geometry extraction, WebGL rendering, streaming for 2GB files) since parsing today only produces `NormalizedElement` metadata, not geometry.

## Feasibility Assessment (2026-07-17)

No hard blockers. Corrections made to the stack described above, verified against npm/GitHub/context7 before any sub-plan was written:

- **`web-ifc`** — real, npm `0.0.77`, with an explicit Node.js build (`web-ifc-api-node.js` / `web-ifc-node.wasm`) confirmed via the project's own README. Usable in the worker as designed.
- **`ifc-lite`** — the spec's original package name is wrong. The real, current package is the scoped `@ifc-lite/parser` (npm `3.10.1`, GitHub `louistrue/ifc-lite`), which explicitly supports server-side use. Sub-plans reference the corrected name.
- **`bsdd-ids-validator`** — not published to npm under that name or any scope; it exists only as a GitHub TypeScript repo (`BIM-Tools/bsdd-ids-validator`). Treated as a design reference only, not an installable dependency — `packages/ids-validator` is built from scratch against the real, verified buildingSMART IDS XML schema (cross-checked directly against buildingSMART's own official IDS implementer test corpus on GitHub).
- Fastify, `@fastify/multipart`, BullMQ, Postgres, Drizzle ORM, Redis, `pdfkit`, `exceljs`, React, Vite, TanStack Query/Table — all real, current, and version-pinned in the sub-plans below.
- The repository was empty (spec doc only) at planning time — genuinely greenfield, no existing code to reconcile.
- Two small packages beyond the ones named in the Architecture section above were added during planning: `packages/storage` (the "small storage interface" the Architecture section calls for, shared identically by `apps/api` and `apps/worker` so neither duplicates it) and `packages/db` (the Drizzle schema + client, shared the same way). Both are minimal and follow directly from the spec's own architecture, not new scope.

## Implementation Sub-Plans

The build is broken into 8 sub-plans under `docs/superpowers/plans/`, each independently executable by a fresh agent. **00 must land first** — it defines every cross-cutting contract (domain types, DB schema, queue payloads, API DTOs, storage interface) the rest import verbatim. Once 00 is done, **01–06 are all parallelizable** (each was briefed with 00's exact contracts so they don't collide); **07 runs last**, after all of 01–06 land, to wire together the handful of seams that only become visible once the parallel pieces meet (it also resolves the one real cross-plan bug — a multipart field-ordering mismatch between the frontend and API — that self-review caught).

**Execution priority within the parallel tier:** per product priority, fast/comparable parsing is the core value proposition of this tool (the per-run engine picker exists specifically to compare real throughput on the company's own files). **Sub-plan 01 (parser-adapters) should be built and proven first**, even though it has no technical dependency forcing that order — get both engines actually parsing a real fixture file end-to-end, with timing recorded, before investing in the surrounding UI/reporting/validation polish. 02–06 can follow in any order/parallel once 00 is done.

| # | Sub-plan | Depends on | Builds |
|---|----------|-----------|--------|
| [00](../plans/2026-07-17-ifc-qa-00-foundation-and-contracts.md) | Foundation & Contracts | — | pnpm monorepo scaffold, `@ifc-qa/shared-types` (domain/queue/API contracts), `@ifc-qa/storage`, `@ifc-qa/db`, Docker Compose (Postgres/Redis) |
| [01](../plans/2026-07-17-ifc-qa-01-parser-adapters.md) | Parser Adapters — **build first** | 00 | `WebIfcAdapter`, `IfcLiteAdapter` (`@ifc-qa/parser-adapters`), IFC fixture files |
| [02](../plans/2026-07-17-ifc-qa-02-ids-validator.md) | IDS Validator | 00 | `validateElements` (`@ifc-qa/ids-validator`), IDS/element fixtures |
| [03](../plans/2026-07-17-ifc-qa-03-report-generator.md) | Report Generator | 00 | `generatePdfReport`/`generateExcelReport` (`@ifc-qa/report-generator`) |
| [04](../plans/2026-07-17-ifc-qa-04-api-service.md) | API Service | 00 (soft: 03 for its last task) | `apps/api` — Fastify routes, chunked upload, BullMQ producer |
| [05](../plans/2026-07-17-ifc-qa-05-worker-service.md) | Worker Service | 00 (hard: 01+02 for its last task) | `apps/worker` — BullMQ consumer, parse → validate → persist |
| [06](../plans/2026-07-17-ifc-qa-06-frontend.md) | Frontend | 00 | `apps/web` — upload, rule-set management, run history, filterable issue table |
| [07](../plans/2026-07-17-ifc-qa-07-integration-and-wireup.md) | Integration & Wire-up | 00–06 all | `GET /runs` (closes a gap 06 flagged), executes 04/05's blocked final tasks, one real end-to-end test per engine, Docker Compose for the full stack, smoke test |
