# Viewer: migrate to @ifc-lite/renderer (WebGPU)

Branch: `feat/3d-viewer-restart`. Status: design approved, not yet implemented.

## Why

`apps/web/src/viewer/renderer.ts` is a hand-rolled WebGL2 engine: custom shaders, one VAO/
buffer-set/texture per streamed batch, one draw call per batch every frame, a texture-lookup
visibility scheme, no frustum/contribution culling. A perf complaint (orbit/pan lag scaling
with model size) was root-caused and fixed (a redundant per-frame `setVisibility`/texture
rebuild on camera-only moves), but draw-call count still scales linearly with batch count
forever and there is no culling — an architectural ceiling, not a bug.

`@ifc-lite/renderer` (MPL-2.0, already a dependency, v1.50.0) is the same WebGPU engine
ifclite.com's own demo viewer uses, built by the ifc-lite team behind `@ifc-lite/geometry`
(already a dependency for geometry extraction). Its public API takes `MeshData[]`/
`GeometryResult` directly — the shape `geometryLoader.ts` already produces. A throwaway POC
(code since deleted) rendered a real 38MB/2223-mesh fixture, federated up to 8x (17784
meshes), with render cost flat at 0.05–0.18ms/frame and zero extra cost for camera-only
movement at every scale tested — the exact class of problem the old renderer can't fix
without a rewrite of its own.

## Decisions

**Browser support: WebGPU-only, no fallback.** `renderer.ts` and `meshBatch.ts` are deleted
outright. Unsupported browsers (pre-Chrome/Edge 113, pre-Firefox 141, pre-Safari 26) see an
error message instead of the 3D view, via the existing `onError` toast path. No feature-detect
dual-backend — decided over keeping WebGL2 alive as a fallback, which would roughly double the
renderer surface this migration has to keep working.

**Camera: the engine's `Camera` is the sole source of truth.** The app's `OrbitCamera` type and
all of `camera.ts` (orbit/pan/dolly/frameBounds/viewMatrix/projectionMatrix/fitDistance) are
deleted. `ViewerCanvas` holds one `Camera` instance (`renderer.getCamera()`) instead of React
state; pointer handlers call `camera.orbit()/pan()/zoom()` directly. Framing call sites (zoom
to fit, zoom to selection, reset view, focus-triggered framing) go through an imperative handle
method that calls the engine's `camera.frameBounds()`/`fitToBounds()` (animated), not a
hand-computed pose. This was chosen over keeping the app's immutable `OrbitCamera` as source of
truth and replaying it onto the engine's camera every render, which would fight the engine's
internal state and animation/inertia for nothing — the engine's `Camera` is a stateful class
with orbit/pan/zoom, inertia, and `animateTo` tweening built in; there is no clean way to
express that behind an immutable value type. Known trade-off: the engine's south-east-isometric
fit pose differs slightly from the app's current corner-sampling `fitDistance` — a minor,
accepted visual change, not worth re-deriving against a new camera class.

**Multi-model ids: an app-owned offset map at the `ViewerCanvas` boundary.** Federated files
share expressId numbers (each IFC file numbers its own), but the engine's `RenderOptions.
hiddenIds`/`isolatedIds`/`selectedId` are a flat `Set<number>`/`number` with no per-id model
scoping (only `selectedId` gets a paired `selectedModelIndex`). A new module,
`viewer/federation.ts`, holds a `Map<modelKey, offset>` assigned when a model first loads (like
the engine's own `FederationRegistry`, but keyed to the app's string `modelKey` rather than
using that singleton directly, to avoid shared mutable state surviving across unrelated
`ViewerPage` mounts/tests). `ViewerCanvas.addMeshes(modelKey, meshes)` adds the model's offset
to every mesh's `expressId` before calling the engine's `addMeshes`. Every other module
(`visibility.ts`, `viewerTree.ts`, `focusRequest.ts`, both rails) is untouched and keeps using
`{modelKey, expressId}` exactly as today. Translation happens only at two points inside
`ViewerCanvas`: **in** — the app's `VisibilityState`-derived hidden/isolated/selected sets are
translated to global ids right before `render()`/`pick()`; **out** — a `pick()` result's global
id is reversed back to `{modelKey, expressId}` before `onPick`/hover state sees it. The engine's
own `modelIndex` field (on `Mesh`/`PickResult`) stays unused: global-id uniqueness alone
resolves cross-model collisions, and the app doesn't use GPU instancing
(`enableInstancing: false` already, in `geometryLoader.ts`), so the modelIndex-scoped paths
(instanced template ownership, hydrated-mesh disambiguation) don't apply.

**Section box → `ClipBox`.** Direct 1:1 mapping: `SectionBox{enabled, bounds:{min,max}}` (Vec3
objects) → the engine's `ClipBox{enabled, min:[x,y,z], max:[x,y,z]}` (tuples). No design
questions here — `ViewerOverlay`'s 6-slider popover (min/max per axis) already matches an
axis-aligned box exactly. `sectionBox.ts`'s plane math (`sectionPlanes`, `isInsideSection`) was
only ever consumed by the old renderer's shader uniforms and becomes dead; the rest of
`sectionBox.ts` (the `SectionBox` type, `sectionBoxFromBounds`, `moveSectionFace`,
`sectionAround`) stays, since the app-level box-editing model doesn't change.

**Visibility → render options, one effect.** `hiddenIds`/`isolatedIds`/`selectedId` are
assembled from `VisibilityState` + the federation offset map into one `RenderOptions` object,
rebuilt fresh on every render call. The engine diffs `hiddenIds`/`isolatedIds` **by content, not
reference** (documented on `RenderOptions`) — the exact bug class the old renderer's
redundant-rebuild fix (the perf issue this migration traces back to) was patching over, absent
here architecturally. So the current 4-split-`useEffect` structure in `ViewerCanvas.tsx`
(camera/section/selection/visibility kept apart specifically to dodge a full texture rebuild on
camera-only moves) collapses to one effect over all four, each producing a fresh
`RenderOptions` and calling `renderer.render(options)`.

**Picking is async now.** `pick(x, y): Promise<PickResult | null>`, replacing the old
synchronous `pick()`. Hover-pick (`onPointerMove`, already rate-limited to one call per 80ms)
needs a stale-response guard: an incrementing request token is captured before each `pick()`
call and checked on resolution — a response whose token isn't the latest is dropped. Click-select
(`onPointerUp`) has one in-flight call per click, no race. A resolved `PickResult.expressId` is
reversed through the federation offset map back to `{modelKey, expressId}` before reaching
`onPick`.

**Renderer lifecycle is now async.** `new Renderer(canvas)` then `await renderer.init()` (a real
WebGPU adapter request) replaces the old synchronous `getContext("webgl2")`. `ViewerCanvas`'s
mount effect awaits init before storing the instance and marking ready; a resize/pick/render
that arrives before that resolves is a no-op. Init failure (no adapter) surfaces through the
existing `onError` toast with a WebGPU-specific message, replacing `WebGLUnavailableError`.
`renderer.onDeviceLost()` is wired to the same `onError` path — report only, no reload/recovery
logic, matching current scope.

**`ViewerCanvasHandle` shape changes.** `readPixel` is dropped: WebGPU has no synchronous pixel
readback, and nothing but the visual-check smoke test used it. `batchCount()` becomes a plain
counter `ViewerCanvas` increments itself on every non-empty `addMeshes` call (nothing in-app
reads it besides that same smoke test, so it doesn't need to reflect true GPU batch count).
`aspect()`, `renderFrame()`/render-on-demand, `addMeshes`, `removeModel` stay.

## Files

- **Deleted:** `renderer.ts`, `meshBatch.ts`, `camera.ts`, and their tests
  (`camera.test.ts`, and whatever `meshBatch`/`renderer` unit tests exist).
- **New:** `viewer/federation.ts` — the modelKey→offset map, `toGlobalId`/`fromGlobalId`-shaped
  helpers.
- **Rewritten:** `ViewerCanvas.tsx` — async init, `Camera`-as-state, one render effect, async
  pick with stale-guard, federation translation at the addMeshes/render/pick boundary.
- **Edited:** `ViewerPage.tsx` — camera-driving call sites (`frameBounds` calls) become
  imperative-handle calls instead of `setCamera`; `OrbitCamera` state and `initialCamera()`
  removed; `sectionBox.ts` usage unchanged.
- **Edited:** `sectionBox.ts` — `sectionPlanes`/`ClipPlane`/`isInsideSection` removed (dead once
  the old renderer's shader is gone); everything else stays.
- **Unchanged:** `geometryLoader.ts` (still produces `ViewerMesh`/`MeshData`-shaped batches —
  feeds into the new `addMeshes(meshes, isStreaming)` after federation offsetting),
  `meshMapping.ts`, `visibility.ts`, `viewerTree.ts`, `focusRequest.ts`, `bounds.ts` (minus
  `fitDistance`, now dead), `ViewerOverlay.tsx`, `ViewerTreeRail.tsx`, `ViewerResultsRail.tsx`,
  `viewerIcons.tsx`.
- **`bounds.ts`:** `fitDistance` (the corner-sampling camera-distance solver) becomes dead code
  and is deleted; everything else (`Bounds`, `unionBounds`, `robustBounds`, etc.) is still
  needed for framing *targets* (which elements to frame), independent of how the camera gets
  there.

## Verification

`node scripts/verify.mjs` (build + typecheck + tests) runs as today. On Windows its `--visual`
flag is separately known-broken (unquoted exec path under `shell:true`) — drive
`node scripts/visual-check.mjs` directly with `CHROME_BIN` set, as already documented in
project `CLAUDE.md`.

The `viewer` scenario in `visual-check.mjs` (~line 411) gets a `navigator.gpu?.requestAdapter()`
probe added at its start, skipping cleanly (exit 0, "skipped — no WebGPU adapter") the same way
the script already skips when Chromium itself is missing. This host's headless Chromium could
not obtain a real WebGPU adapter during the POC (tried twice, consistent with this host already
needing SwiftShader software fallback for plain WebGL2) — so this scenario is expected to skip
here, not to prove anything on this host. Its "did it draw" assertion, when the scenario does
run somewhere with a real adapter, switches from raw pixel-color sampling (needed `readPixel`,
now gone) to `renderer.getFrameStats()` (public, synchronous, reports draw calls).

Real coverage is manual, in an actual WebGPU-capable browser, after implementation: load
`fixtures/ifc/E_AIH_*.ifc`, confirm render, orbit/pan/zoom, click-pick, hover cursor, section
box drag, isolate/highlight/hide, and — loading a second federated file — that its element ids
don't collide with the first (hiding an element in file A must not hide the same expressId in
file B). The POC only exercised raw geometry loading + camera render; none of picking,
section box, visibility, or federation were POC'd, so this manual pass is load-bearing, not a
formality.

## Out of scope

- Any of the engine's other capabilities (point clouds, shadows, LOD, deviation, symbolic
  overlays, DXF/grid overlays, clash detection, textured meshes, GPU instancing) — the app
  doesn't use them today and this migration doesn't turn any of them on.
- Re-deriving the app's custom `fitDistance` camera-fit math against the new `Camera` class.
- Any device-loss recovery beyond reporting it.
