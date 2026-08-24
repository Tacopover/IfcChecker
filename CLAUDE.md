## Machines

This repo is worked on from two hosts, and a session may be running on either — never assume which.

- **Windows box** — repo at `C:\Users\taco\source\repos\IfcChecker`.
- **Synology NAS** — a tmux session inside the `vscode-tunnel` Docker container, repo at
  `/workspace/ifcchecker`. Debian + Node 20; no global `pnpm` binary, so scripts reach it through
  `corepack`.

The repo is **not** synced between them — the NAS side is a plain `git clone`, so anything gitignored
exists only on the host that created or fetched it: the real-world `fixtures/ifc/E_AIH_*.ifc` models,
`.conformance/`, `apps/web/public/wasm/`, `.verify-output/`. Check before assuming a file is present.
`apps/api/` and `apps/worker/` are empty untracked dirs on some hosts; the backend was designed then
paused, and nothing under them is in git.

The notes folder **is** synced, automatically, by Synology Drive: `C:\Users\taco\notes` on Windows is
the same content the container sees under `/taco/notes`. Edits from either side propagate.

## Documentation Hub

- Hub: `Project Docs\IfcChecker\` under the notes root (see path mapping above)
- Temp plans: `.claude\plans\` — delete when task done; save 2–3 line summary to Decisions-Log first
- Session end: run `/session-handoff` — writes Claude memory + Obsidian Session-Summary + Decisions-Log entries
- Cross-project patterns: check `Project Docs\_Cross-Project\` before implementing a known pattern
- Do NOT log to hub: git history, code structure, CLAUDE.md content, or anything already in the repo

## Verify

`node scripts/verify.mjs` — build + typecheck + all tests. Required before reporting any change done.
`--visual` adds headless-Chromium render checks (jsdom has no layout engine). `--fast` = tests only,
for iterating, never to finish.

`--visual` SKIPS with exit 0 when it finds no Chromium, and its candidate paths are Linux-only — on
Windows, set `CHROME_BIN` or the visual stage silently checks nothing while the gate reports success.

## Layout

pnpm workspace. `apps/web` (React 19 + Vite/Rolldown) is the only live app. Packages:
`parser-adapters` (two IFC engines), `ids-validator` (IDS XML parse/build/evaluate), `shared-types`
(zod domain + generated IFC entity table), `report-generator` (pdf/excel, not wired into the UI).
Everything runs client-side; no server-side storage of an uploaded IFC or IDS file.

Workspace packages export TypeScript source (`main: ./src/index.ts`) — importers need no build;
`tsc -p` is a typecheck gate. Tests are vitest, colocated as `*.test.ts` beside the source.

## Gotchas

- Two parse engines, `web-ifc` and `ifc-lite`, both WASM in the browser and both user-selectable.
  `adapter-parity.test.ts` pins them to the same output. `web-ifc` cannot name a type outside its
  own schema; `ifc-lite` can.
- `dev`/`build` run `copy-web-ifc-wasm.mjs` first — web-ifc fetches its `.wasm` over HTTP and Rolldown
  can't resolve it through the export map. Running `vite` directly parses nothing.
- The IDS conformance suite is a separate config, excluded from the default test run: fetch it with
  `node scripts/fetch-conformance-cases.mjs`, then
  `pnpm --filter @ifc-qa/ids-validator test:conformance`. `verify` does not cover it.

## Work

`goals.md` holds planned work with a "done when" per goal. Completed work is not tracked there.
Commits: conventional prefix, lowercase prose subject.
