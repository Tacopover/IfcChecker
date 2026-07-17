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
