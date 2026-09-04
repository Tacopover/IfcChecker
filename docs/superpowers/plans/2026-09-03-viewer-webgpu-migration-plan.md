# Viewer WebGPU Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled WebGL2 renderer in `apps/web/src/viewer` with `@ifc-lite/renderer` (WebGPU), preserving every shipped viewer feature (orbit/pan/zoom, click/hover pick, section box, isolate/highlight/hide, multi-model federation) with no old-browser fallback.

**Architecture:** The engine's `Camera` becomes the sole camera state (no more app-level `OrbitCamera`/`camera.ts`). A new `viewer/federation.ts` offsets each model's element ids into a disjoint numeric range so the engine's flat, un-scoped `hiddenIds`/`selectedId` sets can't collide across federated files. `ViewerCanvas.tsx` is rewritten around the engine's async `Renderer`/`Camera`/`pick()`; every other viewer module (`visibility.ts`, `meshMapping.ts`, `geometryLoader.ts`, `focusRequest.ts`, the overlay/rail components) is untouched, since they only ever spoke `{modelKey, expressId}` app-space, not renderer internals.

**Tech Stack:** React 19, `@ifc-lite/renderer` 1.50.0 (WebGPU), `@ifc-lite/geometry` 4.1.0, vitest.

**Spec:** [.claude/plans/2026-09-03-viewer-webgpu-migration.md](../../../.claude/plans/2026-09-03-viewer-webgpu-migration.md)

## Global Constraints

- No WebGL2 fallback. Unsupported browsers see an error via the existing `onError` toast path.
- The engine's `Camera` is the only camera state. No React state, no app-level camera math.
- Federated element ids are offset at the `ViewerCanvas` boundary only. Every other module keeps using bare `{modelKey, expressId}`.
- `node scripts/verify.mjs` (build + typecheck + tests) must pass after every task that touches source.
- Headless Chromium on this host cannot obtain a real WebGPU adapter (confirmed twice during the POC) — the `viewer` visual-check scenario is expected to print a skip line here, not to actually draw. Real coverage is the manual pass in Task 8.

## Plan corrections found while grounding this plan against the actual `@ifc-lite/renderer` `.d.ts` files (not re-litigating the approved spec, just resolving detail the spec left implicit)

1. **`ViewerCanvasHandle.aspect()` is dropped, not kept.** The engine's `Camera.frameBounds(min, max, duration?)` takes no aspect argument — the camera tracks its own aspect internally via `setAspect()`, called from the resize handler. Grepped: nothing outside `viewportAspect` (itself only feeding the old `frameBounds` calls) ever called `.aspect()`. Removing it is in scope because `ViewerCanvas.tsx` is already being rewritten whole.
2. **`ViewerCanvasHandle.pick()` is dropped, not made async.** Grepped: nothing outside `ViewerCanvas.tsx`'s own pointer handlers ever called the handle's `pick` — the handlers already called `rendererRef.current` directly. Async pick is real (see below) but it never needed a public handle method.
3. **A new handle method, `frameBounds(bounds)`, is required** — this is what "framing call sites go through an imperative handle method" (spec, Camera section) cashes out to. It wraps the engine's animated `camera.frameBounds(min, max)`.
4. **A new handle method, `frameStats()`, is required** — the spec's own Verification section says the draw-check switches to `renderer.getFrameStats()`, which means the handle has to expose it.
5. **Driving the engine's camera tween requires an explicit per-frame pump.** `Camera.update(deltaTime): boolean` advances animation/inertia and must be called by the host every frame while it returns `true`; nothing in the engine self-drives this. Direct-manipulation orbit/pan/zoom from pointer handlers are called with `addVelocity: false` (no inertia — matches today's feel exactly) and need only one immediate `render()` call, no pump. Only the animated `frameBounds()` tween needs the pump loop (Task 6).
6. **`visibility.highlighted` maps to `RenderOptions.selectedIds`; `selection` maps to `RenderOptions.selectedId`.** The engine has one highlight concept ("selection highlight"), not the old renderer's two independent tints (amber highlight vs. orange select). Both now render with the engine's own selection highlight. Accepted visual simplification, same spirit as the spec's already-accepted southeast-isometric fit-pose trade-off — flag this to the user after implementing in case the merged look reads as a regression worth a follow-up.
7. **Model removal goes through `renderer.getScene().removeMeshesForEntities(globalIds)`**, not a `Renderer`-level "remove model" method — the public `Renderer` class has no such method; `Scene.removeMeshesForEntities(expressIds: Iterable<number>): number` (global id space) is the real primitive.
8. **All camera framing uses `camera.frameBounds()`, never `camera.fitToBounds()`.** `fitToBounds` snaps to a fixed southeast-isometric pose; `frameBounds` keeps the current view direction and animates. Every existing call site (zoom to fit, zoom to selection, reset view, focus-follow, the initial establishing shot) today preserves yaw/pitch — `fitToBounds` would silently change that behaviour everywhere, which nobody asked for.

## Task 1: `viewer/federation.ts` — the model-id offset map

**Files:**
- Create: `apps/web/src/viewer/federation.ts`
- Test: `apps/web/src/viewer/federation.test.ts`

**Interfaces:**
- Produces: `ModelFederation` class — `offsetFor(modelKey: string): number`, `toGlobalId(modelKey: string, expressId: number): number`, `fromGlobalId(globalId: number): { modelKey: string; expressId: number } | null`, `removeModel(modelKey: string): void`. Consumed by Task 6 (`ViewerCanvas.tsx`).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/viewer/federation.test.ts
import { describe, expect, it } from "vitest";
import { ModelFederation } from "./federation.js";

describe("ModelFederation", () => {
  it("gives the first model offset 0 and the next a disjoint range", () => {
    const federation = new ModelFederation();
    expect(federation.offsetFor("a")).toBe(0);
    expect(federation.offsetFor("b")).toBeGreaterThan(0);
    expect(federation.offsetFor("a")).toBe(0);
  });

  it("round-trips a global id back to its model and express id", () => {
    const federation = new ModelFederation();
    federation.offsetFor("a");
    const globalId = federation.toGlobalId("b", 42);
    expect(federation.fromGlobalId(globalId)).toEqual({ modelKey: "b", expressId: 42 });
  });

  it("keeps two models' identical express ids apart", () => {
    const federation = new ModelFederation();
    const a = federation.toGlobalId("a", 100);
    const b = federation.toGlobalId("b", 100);
    expect(a).not.toBe(b);
    expect(federation.fromGlobalId(a)).toEqual({ modelKey: "a", expressId: 100 });
    expect(federation.fromGlobalId(b)).toEqual({ modelKey: "b", expressId: 100 });
  });

  it("returns null for a global id belonging to no registered model", () => {
    const federation = new ModelFederation();
    federation.offsetFor("a");
    expect(federation.fromGlobalId(999_999_999)).toBeNull();
  });

  it("never reuses an offset after removeModel", () => {
    const federation = new ModelFederation();
    const first = federation.offsetFor("a");
    federation.removeModel("a");
    const second = federation.offsetFor("a");
    expect(second).not.toBe(first);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm --filter @ifc-qa/web exec vitest run src/viewer/federation.test.ts`
Expected: FAIL — `Cannot find module './federation.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/viewer/federation.ts

// Federated files can share expressId numbers — each IFC file numbers its own
// entities starting near 1. The renderer's hidden/isolated/selected sets are a
// flat Set<number> with no per-id model scoping, so this module hands out a
// disjoint numeric range per model and offsets every id into it before it
// reaches the renderer, translating results back on the way out.

/**
 * Numeric ids-per-model ceiling. meshMapping.ts's pick-colour comment
 * documents 24 bits (~16.7M) as "well past the 14 M entities of the largest
 * file the pipeline documents" — this stays comfortably under that headroom
 * while leaving room for a model larger than any seen so far.
 */
const MODEL_ID_SPACE = 20_000_000;

export interface ModelRef {
  modelKey: string;
  expressId: number;
}

/**
 * One instance per `ViewerCanvas` mount, not a module singleton — a singleton
 * would leak offsets across unrelated `ViewerPage` mounts and tests.
 */
export class ModelFederation {
  private readonly offsets = new Map<string, number>();
  private nextIndex = 0;

  /** Assigns a fresh offset the first time a modelKey is seen, then returns the same one. */
  offsetFor(modelKey: string): number {
    let offset = this.offsets.get(modelKey);
    if (offset === undefined) {
      offset = this.nextIndex * MODEL_ID_SPACE;
      this.offsets.set(modelKey, offset);
      this.nextIndex += 1;
    }
    return offset;
  }

  toGlobalId(modelKey: string, expressId: number): number {
    return this.offsetFor(modelKey) + expressId;
  }

  /** Null when the global id belongs to no currently-registered model. */
  fromGlobalId(globalId: number): ModelRef | null {
    for (const [modelKey, offset] of this.offsets) {
      if (globalId >= offset && globalId < offset + MODEL_ID_SPACE) {
        return { modelKey, expressId: globalId - offset };
      }
    }
    return null;
  }

  /**
   * Forgets the model's offset. A later reload gets a NEW offset — offsets
   * are never reused — so a pick/hover result still in flight from before the
   * unload can never be misread as belonging to whatever loads next.
   */
  removeModel(modelKey: string): void {
    this.offsets.delete(modelKey);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm --filter @ifc-qa/web exec vitest run src/viewer/federation.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/viewer/federation.ts apps/web/src/viewer/federation.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add the viewer's model-id federation map

@ifc-lite/renderer's hidden/isolated/selected sets are flat numbers with no
per-model scoping, so federated files sharing express ids need an offset
before either reaches the renderer. ModelFederation owns that mapping.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 2: Delete the WebGL2 renderer, camera math, and mesh batching — and their now-dead consumers

**Files:**
- Delete: `apps/web/src/viewer/renderer.ts`
- Delete: `apps/web/src/viewer/camera.ts`
- Delete: `apps/web/src/viewer/camera.test.ts`
- Delete: `apps/web/src/viewer/meshBatch.ts`
- Delete: `apps/web/src/viewer/meshBatch.test.ts`
- Modify: `apps/web/src/viewer/meshMapping.ts` (drop the pick-colour helpers, whose only consumer was `renderer.ts`)
- Modify: `apps/web/src/viewer/meshMapping.test.ts` (drop their tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a pure deletion task. `ViewerCanvas.tsx` (Task 5) and `ViewerPage.tsx` (Task 6) still import from `camera.ts`/`renderer.ts` until those tasks run, so this repo will not typecheck between Task 2 and Task 6 — that is expected; do not stop to "fix" the resulting errors, they are resolved by Task 5/6.

- [ ] **Step 1: Delete the four files**

```bash
git rm apps/web/src/viewer/renderer.ts apps/web/src/viewer/camera.ts apps/web/src/viewer/camera.test.ts apps/web/src/viewer/meshBatch.ts apps/web/src/viewer/meshBatch.test.ts
```

- [ ] **Step 2: Remove the pick-colour helpers from `meshMapping.ts`**

In `apps/web/src/viewer/meshMapping.ts`, delete this block (currently the last ~15 lines of the file):

```typescript
/**
 * Encode an express id as an RGB triple for the colour-pick pass, and read it
 * back. Id 0 is reserved for "nothing here", so the buffer can be cleared to
 * black and a miss is simply a zero read. 24 bits carries ~16.7 M ids, well
 * past the 14 M entities of the largest file the pipeline documents.
 */
export function expressIdToPickColor(expressId: number): [number, number, number] {
  return [(expressId >> 16) & 0xff, (expressId >> 8) & 0xff, expressId & 0xff];
}

export function pickColorToExpressId(r: number, g: number, b: number): number | null {
  const expressId = (r << 16) | (g << 8) | b;
  return expressId === 0 ? null : expressId;
}
```

- [ ] **Step 3: Remove their tests from `meshMapping.test.ts`**

Delete the `describe("colour-pick encoding", ...)` block (lines 136-154) and remove `expressIdToPickColor` and `pickColorToExpressId` from the import list at the top of the file.

- [ ] **Step 4: Run the remaining viewer tests to confirm nothing else broke**

Run: `corepack pnpm --filter @ifc-qa/web exec vitest run src/viewer/meshMapping.test.ts`
Expected: PASS (the deleted-file typecheck errors from `ViewerCanvas.tsx`/`ViewerPage.tsx` do not affect this file, which has no dependency on either)

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/viewer
git commit -m "$(cat <<'EOF'
refactor(web): delete the WebGL2 viewer renderer, camera math, and batching

Superseded by @ifc-lite/renderer (WebGPU). The pick-colour helpers in
meshMapping.ts had no consumer left once renderer.ts's colour-pick pass went
with it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 3: Drop the dead section-plane math from `sectionBox.ts`

**Files:**
- Modify: `apps/web/src/viewer/sectionBox.ts`
- Modify: `apps/web/src/viewer/sectionBox.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SectionBox`, `SECTION_AXES`, `SectionAxis`, `sectionBoxFromBounds`, `moveSectionFace`, `sectionAround`, `sectionBoxCenter` — unchanged, still consumed by `ViewerOverlay.tsx` and `ViewerPage.tsx`.

- [ ] **Step 1: Remove `ClipPlane`, `sectionPlanes`, and `isInsideSection` from `sectionBox.ts`**

In `apps/web/src/viewer/sectionBox.ts`, delete:

```typescript
/** `[nx, ny, nz, d]`. A point is kept where `dot(n, p) + d >= 0`. */
export type ClipPlane = readonly [number, number, number, number];
```

and:

```typescript
/**
 * The six planes, in min-x, max-x, min-y, max-y, min-z, max-z order. Always six
 * even when disabled — the shader takes a fixed-size array and a single
 * uniform switch, which is cheaper than recompiling for a varying plane count.
 */
export function sectionPlanes(box: SectionBox): ClipPlane[] {
  const { min, max } = box.bounds;
  return [
    [1, 0, 0, -min.x],
    [-1, 0, 0, max.x],
    [0, 1, 0, -min.y],
    [0, -1, 0, max.y],
    [0, 0, 1, -min.z],
    [0, 0, -1, max.z],
  ];
}

export function isInsideSection(box: SectionBox, point: Vec3): boolean {
  if (!box.enabled) return true;
  const { min, max } = box.bounds;
  return (
    point.x >= min.x && point.x <= max.x &&
    point.y >= min.y && point.y <= max.y &&
    point.z >= min.z && point.z <= max.z
  );
}
```

Also drop the now-unused `Vec3` import if nothing else in the file uses it — check: `sectionBoxCenter` returns `Vec3` and imports it in the `boundsCenter, boundsSize, isEmptyBounds, type Bounds, type Vec3` line, so `Vec3` stays; only remove `ClipPlane`/`sectionPlanes`/`isInsideSection`.

- [ ] **Step 2: Update `sectionBox.test.ts`**

Remove `isInsideSection` and `sectionPlanes` from the import list. Delete the entire `describe("sectionPlanes", ...)` block and the entire `describe("isInsideSection", ...)` block. In the remaining tests that reference `isInsideSection` as an assertion helper (inside `describe("sectionBoxFromBounds", ...)`, `describe("moveSectionFace", ...)`, and `describe("sectionAround", ...)`), replace each call with a direct bounds check using the surviving `SectionBox`/`Bounds` shape, since `isInsideSection` no longer exists:

Replace:
```typescript
  it("starts disabled and slightly larger than the model, so nothing is cut until asked", () => {
    const section = sectionBoxFromBounds(bounds);
    expect(section.enabled).toBe(false);
    expect(section.bounds.min.x).toBeLessThan(bounds.min.x);
    expect(section.bounds.max.x).toBeGreaterThan(bounds.max.x);
    expect(isInsideSection({ ...section, enabled: true }, bounds.max)).toBe(true);
  });
```
with:
```typescript
  it("starts disabled and slightly larger than the model, so nothing is cut until asked", () => {
    const section = sectionBoxFromBounds(bounds);
    expect(section.enabled).toBe(false);
    expect(section.bounds.min.x).toBeLessThan(bounds.min.x);
    expect(section.bounds.max.x).toBeGreaterThan(bounds.max.x);
    expect(section.bounds.max.x).toBeGreaterThanOrEqual(bounds.max.x);
    expect(section.bounds.max.y).toBeGreaterThanOrEqual(bounds.max.y);
    expect(section.bounds.max.z).toBeGreaterThanOrEqual(bounds.max.z);
  });
```

Replace:
```typescript
  it("moves the named face on the named axis and leaves the others alone", () => {
    const moved = moveSectionFace(box(), "x", "min", 3);
    expect(moved.bounds.min).toEqual({ x: 3, y: 0, z: 0 });
    expect(moved.bounds.max).toEqual(bounds.max);
    expect(isInsideSection(moved, { x: 2, y: 2, z: 3 })).toBe(false);
  });
```
with:
```typescript
  it("moves the named face on the named axis and leaves the others alone", () => {
    const moved = moveSectionFace(box(), "x", "min", 3);
    expect(moved.bounds.min).toEqual({ x: 3, y: 0, z: 0 });
    expect(moved.bounds.max).toEqual(bounds.max);
    expect(moved.bounds.min.x).toBeGreaterThan(2);
  });
```

Replace:
```typescript
describe("sectionAround", () => {
  it("switches clipping on and wraps the given extent", () => {
    const section = sectionAround({ min: { x: 1, y: 1, z: 1 }, max: { x: 2, y: 2, z: 2 } });
    expect(section.enabled).toBe(true);
    expect(isInsideSection(section, { x: 1.5, y: 1.5, z: 1.5 })).toBe(true);
    expect(isInsideSection(section, { x: 5, y: 1.5, z: 1.5 })).toBe(false);
  });
});
```
with:
```typescript
describe("sectionAround", () => {
  it("switches clipping on and wraps the given extent", () => {
    const section = sectionAround({ min: { x: 1, y: 1, z: 1 }, max: { x: 2, y: 2, z: 2 } });
    expect(section.enabled).toBe(true);
    expect(section.bounds.min.x).toBeLessThanOrEqual(1);
    expect(section.bounds.max.x).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `corepack pnpm --filter @ifc-qa/web exec vitest run src/viewer/sectionBox.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/viewer/sectionBox.ts apps/web/src/viewer/sectionBox.test.ts
git commit -m "$(cat <<'EOF'
refactor(web): drop the section box's dead clip-plane math

sectionPlanes/ClipPlane/isInsideSection only ever fed the WebGL2 renderer's
shader uniforms; @ifc-lite/renderer takes the box directly as a ClipBox.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 4: Drop the dead camera-fit solver from `bounds.ts`

**Files:**
- Modify: `apps/web/src/viewer/bounds.ts`
- Modify: `apps/web/src/viewer/bounds.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Vec3`, `Bounds`, `emptyBounds`, `isEmptyBounds`, `growByPoint`, `unionBounds`, `boundsCenter`, `boundsSize`, `boundsRadius`, `robustBounds` — unchanged, still consumed by `meshMapping.ts` and `ViewerPage.tsx`.

- [ ] **Step 1: Remove `fitDistance` from `bounds.ts`**

Delete the `YAW_SAMPLES` constant and the entire `fitDistance` function (currently lines 73-146 of `apps/web/src/viewer/bounds.ts`, from `/** Yaw positions the fit is tested at... */` through the closing brace of `fitDistance`).

- [ ] **Step 2: Remove its tests from `bounds.test.ts`**

Remove `fitDistance` from the import list at the top of the file. Delete the entire `describe("fitDistance", ...)` block (lines 48-114).

- [ ] **Step 3: Run the tests**

Run: `corepack pnpm --filter @ifc-qa/web exec vitest run src/viewer/bounds.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/viewer/bounds.ts apps/web/src/viewer/bounds.test.ts
git commit -m "$(cat <<'EOF'
refactor(web): drop the app's camera-fit distance solver

fitDistance only served the app's own OrbitCamera projection math, which
@ifc-lite/renderer's Camera now owns. Framing *targets* (robustBounds etc.)
are unaffected — only how far back the camera sits was ever fitDistance's job.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 5: Rewrite `ViewerCanvas.tsx` onto `@ifc-lite/renderer`

**Files:**
- Modify (full rewrite): `apps/web/src/viewer/ViewerCanvas.tsx`

**Interfaces:**
- Consumes: `ModelFederation` from `./federation.js` (Task 1); `ViewerMesh` from `./meshMapping.js`; `SectionBox` from `./sectionBox.js`; `Bounds`, `isEmptyBounds` from `./bounds.js`; `Renderer`, `Camera`, `RenderOptions`, `ClipBox`, `FrameStats` from `@ifc-lite/renderer`; `MeshData` from `@ifc-lite/geometry`.
- Produces (new `ViewerCanvasHandle` shape — Task 6 depends on this exact shape):
  ```typescript
  export interface ViewerCanvasHandle {
    addMeshes: (modelKey: string, meshes: readonly ViewerMesh[]) => void;
    removeModel: (modelKey: string) => void;
    renderFrame: () => void;
    frameBounds: (bounds: Bounds) => void;
    batchCount: () => number;
    frameStats: () => FrameStats | null;
  }
  ```
  `aspect()` and `pick()` are dropped from the handle (see plan-correction notes 1-2 above; `pick` becomes purely internal to this file's own pointer handlers).
  `ViewerCanvasProps` drops `camera`/`onCameraChange` (the engine's `Camera` is not driven from React state); `section`, `selection`, `isVisible`, `onPick`, `onError`, `handleRef` are unchanged.

There is no dedicated `ViewerCanvas.test.tsx` today (canvas/GPU code isn't unit-testable in jsdom — confirmed, no such file exists) and this plan does not add one; correctness here is established by typecheck (Step 2) and the manual browser pass in Task 8, matching how the file it replaces was verified.

- [ ] **Step 1: Replace the whole file**

```typescript
// apps/web/src/viewer/ViewerCanvas.tsx
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Camera, Renderer, type ClipBox, type FrameStats, type RenderOptions } from "@ifc-lite/renderer";
import type { MeshData } from "@ifc-lite/geometry";
import { isEmptyBounds, type Bounds } from "./bounds.js";
import { ModelFederation } from "./federation.js";
import type { ViewerMesh } from "./meshMapping.js";
import type { SectionBox } from "./sectionBox.js";

// The canvas and the GPU device, and nothing else. Everything it is told to
// draw arrives as already-decided state, so the interesting behaviour stays in
// the modules next door where it can be tested without a GPU.

export interface ViewerCanvasHandle {
  addMeshes: (modelKey: string, meshes: readonly ViewerMesh[]) => void;
  removeModel: (modelKey: string) => void;
  /** Draws one frame immediately. Never waits on requestAnimationFrame. */
  renderFrame: () => void;
  /** Animated, direction-preserving — see camera.frameBounds(). No-op on empty bounds. */
  frameBounds: (bounds: Bounds) => void;
  batchCount: () => number;
  frameStats: () => FrameStats | null;
}

interface ViewerCanvasProps {
  section: SectionBox | null;
  selection: { modelKey: string; expressId: number } | null;
  /** 0 hidden / 1 visible / 2 visible-and-highlighted — see visibility.ts's `visibilityCode`. */
  isVisible: (modelKey: string, expressId: number) => 0 | 1 | 2;
  onPick: (hit: { modelKey: string; expressId: number } | null) => void;
  onError: (message: string) => void;
  handleRef?: Ref<ViewerCanvasHandle>;
}

/** Shortest gap between two hover picks. Well under a pointer event stream, well over a frame. */
const HOVER_PICK_INTERVAL_MS = 80;

function toMeshData(mesh: ViewerMesh, offset: number): MeshData {
  return {
    expressId: offset + mesh.expressId,
    ifcType: mesh.ifcType,
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    color: [...mesh.color] as [number, number, number, number],
    origin: [...mesh.origin] as [number, number, number],
    localBounds: mesh.localBounds
      ? {
          min: [...mesh.localBounds.min] as [number, number, number],
          max: [...mesh.localBounds.max] as [number, number, number],
        }
      : undefined,
  };
}

/**
 * Drives `camera.update(dt)` + a render every frame while the camera reports
 * itself still animating — the engine ties frameBounds()/animateTo() tweens
 * and orbit/pan/zoom inertia to this being pumped; nothing self-drives it.
 * `animRef` cancels a still-running previous pump so two framing calls in
 * quick succession don't race each other's rAF loop.
 */
function pumpCameraAnimation(
  renderer: Renderer,
  camera: Camera,
  animRef: { current: number | null },
  getOptions: () => RenderOptions
): void {
  if (animRef.current !== null) cancelAnimationFrame(animRef.current);
  let last = performance.now();
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    const animating = camera.update(dt);
    renderer.render(getOptions());
    animRef.current = animating ? requestAnimationFrame(tick) : null;
  };
  animRef.current = requestAnimationFrame(tick);
}

export function ViewerCanvas({ section, selection, isVisible, onPick, onError, handleRef }: ViewerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const federationRef = useRef(new ModelFederation());
  /** Every expressId this canvas has ever been given for a model, so a render pass can enumerate what to hide. */
  const modelExpressIdsRef = useRef(new Map<string, Set<number>>());
  const batchCountRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; button: number } | null>(null);

  // Read through refs so pointer handlers, the imperative handle, and the
  // animation pump never close over stale props.
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  // Both drive the cursor and nothing else, so they are the only pointer state
  // that is allowed to re-render: a drag begins and ends once, and the hover
  // pick below only reports whether the pointer is over geometry at all.
  const [dragMode, setDragMode] = useState<"orbit" | "pan" | null>(null);
  const [overElement, setOverElement] = useState(false);
  const lastHoverRef = useRef(0);
  const hoverTokenRef = useRef(0);

  const buildRenderOptions = useCallback((): RenderOptions => {
    const hiddenIds = new Set<number>();
    const highlightedIds = new Set<number>();
    for (const [modelKey, expressIds] of modelExpressIdsRef.current) {
      const offset = federationRef.current.offsetFor(modelKey);
      for (const expressId of expressIds) {
        const code = isVisibleRef.current(modelKey, expressId);
        if (code === 0) hiddenIds.add(offset + expressId);
        else if (code === 2) highlightedIds.add(offset + expressId);
      }
    }

    const selected = selectionRef.current;
    const selectedId = selected
      ? federationRef.current.toGlobalId(selected.modelKey, selected.expressId)
      : null;

    const currentSection = sectionRef.current;
    const clipBox: ClipBox | undefined = currentSection
      ? {
          min: [currentSection.bounds.min.x, currentSection.bounds.min.y, currentSection.bounds.min.z],
          max: [currentSection.bounds.max.x, currentSection.bounds.max.y, currentSection.bounds.max.z],
          enabled: currentSection.enabled,
        }
      : undefined;

    return {
      hiddenIds,
      selectedIds: highlightedIds.size > 0 ? highlightedIds : undefined,
      selectedId: selectedId ?? undefined,
      clipBox,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new Renderer(canvas);
    let active = true;

    renderer
      .init()
      .then(() => {
        if (!active) return;
        rendererRef.current = renderer;
        cameraRef.current = renderer.getCamera();
        renderer.onDeviceLost((info) => onError(`3D rendering stopped: ${info.message}`));
        renderer.resize(canvas.width, canvas.height);
        cameraRef.current.setAspect(canvas.width / Math.max(1, canvas.height));
        renderer.render(buildRenderOptions());
      })
      .catch((error: unknown) => {
        if (!active) return;
        onError(
          error instanceof Error
            ? `This browser could not start WebGPU: ${error.message}`
            : "This browser does not support WebGPU, so the 3D view cannot be shown."
        );
      });

    return () => {
      active = false;
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      modelExpressIdsRef.current = new Map();
      federationRef.current = new ModelFederation();
      batchCountRef.current = 0;
      renderer.destroy();
    };
  }, [onError, buildRenderOptions]);

  // Sizing follows the element, not the window: the tree rail and property
  // panel change the canvas's share of the page without the window resizing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      const changed = canvas.width !== width || canvas.height !== height;
      if (changed) {
        canvas.width = width;
        canvas.height = height;
      }
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!renderer || !camera) return;
      if (changed) {
        renderer.resize(width, height);
        camera.setAspect(width / height);
      }
      renderer.render(buildRenderOptions());
    };

    resize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [buildRenderOptions]);

  // Section/selection/visibility all funnel into one RenderOptions object per
  // call — the engine diffs hiddenIds/selectedIds by CONTENT, not reference,
  // so there is no per-camera-move texture-rebuild tax to dodge the way the
  // old renderer's four split effects existed to avoid.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render(buildRenderOptions());
  }, [section, selection, isVisible, buildRenderOptions]);

  useImperativeHandle(
    handleRef,
    (): ViewerCanvasHandle => ({
      addMeshes: (modelKey, meshes) => {
        const renderer = rendererRef.current;
        if (!renderer || meshes.length === 0) return;
        const offset = federationRef.current.offsetFor(modelKey);
        const known = modelExpressIdsRef.current.get(modelKey) ?? new Set<number>();
        const meshData = meshes.map((mesh) => {
          known.add(mesh.expressId);
          return toMeshData(mesh, offset);
        });
        modelExpressIdsRef.current.set(modelKey, known);
        renderer.addMeshes(meshData, true);
        batchCountRef.current += 1;
        renderer.render(buildRenderOptions());
      },
      removeModel: (modelKey) => {
        const renderer = rendererRef.current;
        const ids = modelExpressIdsRef.current.get(modelKey);
        modelExpressIdsRef.current.delete(modelKey);
        if (renderer && ids && ids.size > 0) {
          const offset = federationRef.current.offsetFor(modelKey);
          renderer.getScene().removeMeshesForEntities([...ids].map((id) => offset + id));
        }
        federationRef.current.removeModel(modelKey);
        renderer?.render(buildRenderOptions());
      },
      renderFrame: () => rendererRef.current?.render(buildRenderOptions()),
      frameBounds: (bounds) => {
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        if (!renderer || !camera || isEmptyBounds(bounds)) return;
        void camera.frameBounds(bounds.min, bounds.max);
        pumpCameraAnimation(renderer, camera, animRef, buildRenderOptions);
      },
      batchCount: () => batchCountRef.current,
      frameStats: () => rendererRef.current?.getFrameStats() ?? null,
    }),
    [buildRenderOptions]
  );

  /** Client coordinates to drawing-buffer (CSS) pixels — what `pick` takes. */
  const canvasPixel = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, button: event.button };
    setDragMode(event.button === 0 ? "orbit" : "pan");
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      const renderer = rendererRef.current;
      const camera = cameraRef.current;

      if (!drag) {
        // A pick is a full GPU round trip, so hovering is rate-limited rather
        // than run on every pointer event.
        const now = performance.now();
        if (now - lastHoverRef.current < HOVER_PICK_INTERVAL_MS) return;
        lastHoverRef.current = now;

        const pixel = canvasPixel(event.clientX, event.clientY);
        if (!renderer || !pixel) return;
        const token = ++hoverTokenRef.current;
        void renderer.pick(pixel[0], pixel[1]).then((result) => {
          if (hoverTokenRef.current !== token || dragRef.current) return;
          setOverElement(result !== null);
        });
        return;
      }

      if (!renderer || !camera) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      dragRef.current = { ...drag, x: event.clientX, y: event.clientY };

      // addVelocity: false — no inertia, matching the direct-manipulation feel
      // the app has always had. Sensitivity lives inside the engine now, not
      // as an app-side multiplier, so raw pixel deltas go straight through.
      if (drag.button === 0) camera.orbit(-dx, dy, false);
      else camera.pan(-dx, dy, false);
      renderer.render(buildRenderOptions());
    },
    [canvasPixel, buildRenderOptions]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragMode(null);
      if (!drag) return;

      const moved = Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y);
      if (drag.button !== 0 || moved > 2) return;

      const renderer = rendererRef.current;
      const pixel = canvasPixel(event.clientX, event.clientY);
      if (!renderer || !pixel) return;
      void renderer.pick(pixel[0], pixel[1]).then((result) => {
        onPick(result ? federationRef.current.fromGlobalId(result.expressId) : null);
      });
    },
    [onPick, canvasPixel]
  );

  /** A cancelled drag is not a click: it ends the drag without selecting anything. */
  const onPointerCancel = useCallback(() => {
    dragRef.current = null;
    setDragMode(null);
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!renderer || !camera) return;
      camera.zoom(event.deltaY, false);
      renderer.render(buildRenderOptions());
    },
    [buildRenderOptions]
  );

  return (
    <canvas
      ref={canvasRef}
      className="viewer-canvas"
      data-smoke-viewer-canvas
      data-drag={dragMode ?? undefined}
      data-hover={overElement ? "element" : undefined}
      aria-label="3D view"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => {
        hoverTokenRef.current += 1;
        setOverElement(false);
      }}
      onWheel={onWheel}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm --filter @ifc-qa/web exec tsc --noEmit`
Expected: errors remain in `ViewerPage.tsx` (it still imports the deleted `camera.js` and passes the now-removed `camera`/`onCameraChange` props) — that's Task 6. No error should originate from `ViewerCanvas.tsx` itself; read the output and confirm every error's file is `ViewerPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/viewer/ViewerCanvas.tsx
git commit -m "$(cat <<'EOF'
feat(web): rewrite ViewerCanvas onto @ifc-lite/renderer (WebGPU)

Async Renderer/Camera lifecycle, the engine's Camera as the only camera
state, async pick() with a stale-hover guard, and one RenderOptions build per
section/selection/visibility change instead of four split effects — the
engine content-diffs hiddenIds/selectedIds, so the old renderer's per-camera-
move texture-rebuild tax this file used to dodge doesn't exist here.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 6: Update `ViewerPage.tsx` for the new camera + handle shape

**Files:**
- Modify: `apps/web/src/viewer/ViewerPage.tsx`

**Interfaces:**
- Consumes: the `ViewerCanvasHandle` shape from Task 5 (`frameBounds(bounds)` replaces the old `setCamera(current => frameBounds(current, bounds, aspect))` pattern; `camera`/`onCameraChange` props no longer exist on `<ViewerCanvas>`).
- Produces: nothing new — `ViewerPage`'s own exported surface (`ViewerPageProps`) is unchanged.

- [ ] **Step 1: Drop the camera import and state**

Change:
```typescript
import { emptyBounds, isEmptyBounds, robustBounds, unionBounds, type Bounds } from "./bounds.js";
import { frameBounds, initialCamera, type OrbitCamera } from "./camera.js";
```
to:
```typescript
import { emptyBounds, isEmptyBounds, robustBounds, unionBounds, type Bounds } from "./bounds.js";
```

Delete:
```typescript
  const [camera, setCamera] = useState<OrbitCamera>(initialCamera);
```
(keep the other `useState` lines around it unchanged).

- [ ] **Step 2: Drop `viewportAspect`**

Delete:
```typescript
  // Framing has to be told the shape of the viewport it frames into. This used
  // to be a hardcoded 16/9 while the canvas is nothing of the sort once the two
  // rails take their share, which left every fit noticeably off.
  const viewportAspect = useCallback(() => canvasRef.current?.aspect() ?? 16 / 9, []);
```

- [ ] **Step 3: Replace the four `frameBounds` call sites**

In `loadModel` (the "establishing shot" on load), change:
```typescript
          // Establishing shot for a file with nothing on screen yet — not a
          // selection event, so it is exempt from "camera never auto-moves".
          setCamera((current) => frameBounds(current, framingBounds, viewportAspect()));
          setSection(sectionBoxFromBounds(bounds));
```
to:
```typescript
          // Establishing shot for a file with nothing on screen yet — not a
          // selection event, so it is exempt from "camera never auto-moves".
          canvasRef.current?.frameBounds(framingBounds);
          setSection(sectionBoxFromBounds(bounds));
```
and remove `viewportAspect` from `loadModel`'s dependency array:
```typescript
    [busyModelKey, parsedModels, viewportAspect]
```
becomes:
```typescript
    [busyModelKey, parsedModels]
```

In the focus-resolution effect, change:
```typescript
    if (withGeometry.length > 0) {
      const focused = boundsOfElements(loaded.mapping, withGeometry);
      setCamera((current) => frameBounds(current, focused, viewportAspect()));
    }
```
to:
```typescript
    if (withGeometry.length > 0) {
      const focused = boundsOfElements(loaded.mapping, withGeometry);
      canvasRef.current?.frameBounds(focused);
    }
```
and remove `viewportAspect` from that effect's dependency array:
```typescript
  }, [activeFocus, geometry, parsedModels, busyModelKey, loadModel, requestedFocusMode, viewportAspect]);
```
becomes:
```typescript
  }, [activeFocus, geometry, parsedModels, busyModelKey, loadModel, requestedFocusMode]);
```

In the `<ViewerOverlay>` JSX, change:
```typescript
        <ViewerOverlay
          onZoomToFit={() =>
            setCamera((current) => frameBounds(current, zoomToFitTarget(), viewportAspect()))
          }
          onZoomToSelection={() => {
            const target = zoomToSelectionTarget();
            if (!isEmptyBounds(target)) {
              setCamera((current) => frameBounds(current, target, viewportAspect()));
            }
          }}
```
to:
```typescript
        <ViewerOverlay
          onZoomToFit={() => canvasRef.current?.frameBounds(zoomToFitTarget())}
          onZoomToSelection={() => {
            const target = zoomToSelectionTarget();
            if (!isEmptyBounds(target)) canvasRef.current?.frameBounds(target);
          }}
```

and further down in the same component:
```typescript
          onResetView={() => {
            setVisibility(initialVisibility());
            setSelection(null);
            setOpenSpecIndex(null);
            clearFocus();
            setCamera((current) => frameBounds(current, allFramingBounds, viewportAspect()));
          }}
```
to:
```typescript
          onResetView={() => {
            setVisibility(initialVisibility());
            setSelection(null);
            setOpenSpecIndex(null);
            clearFocus();
            canvasRef.current?.frameBounds(allFramingBounds);
          }}
```

- [ ] **Step 4: Drop the removed props from `<ViewerCanvas>`**

Change:
```typescript
        <ViewerCanvas
          handleRef={canvasRef}
          camera={camera}
          onCameraChange={setCamera}
          section={section}
          selection={selection}
          isVisible={isVisible}
          onPick={setSelection}
          onError={setError}
        />
```
to:
```typescript
        <ViewerCanvas
          handleRef={canvasRef}
          section={section}
          selection={selection}
          isVisible={isVisible}
          onPick={setSelection}
          onError={setError}
        />
```

- [ ] **Step 5: Typecheck and run the viewer test suite**

Run: `corepack pnpm --filter @ifc-qa/web exec tsc --noEmit`
Expected: no errors.

Run: `corepack pnpm --filter @ifc-qa/web exec vitest run src/viewer`
Expected: PASS (federation.test.ts, sectionBox.test.ts, bounds.test.ts, meshMapping.test.ts, visibility.test.ts, viewerTree.test.ts, focusRequest.test.ts, geometryLoader.test.ts, ViewerOverlay.test.tsx, ViewerResultsRail.test.tsx — none of these import `camera.ts`/`renderer.ts`/`meshBatch.ts`)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/viewer/ViewerPage.tsx
git commit -m "$(cat <<'EOF'
refactor(web): drive viewer camera framing through the engine's Camera

Every zoom-to-fit/selection/reset/focus-follow call site now asks the canvas
handle's frameBounds() to animate the engine's own Camera, instead of
computing a new OrbitCamera pose and pushing it through React state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 7: `scripts/visual-check.mjs` — skip cleanly without a WebGPU adapter, assert via `getFrameStats()`

**Files:**
- Modify: `scripts/visual-check.mjs`

**Interfaces:**
- Consumes: `window.__viewer.current.batchCount()` (unchanged), `.renderFrame()` (unchanged), `.frameStats()` (new, from Task 5).
- Produces: the `viewer` scenario now returns `{ skip: true, reason }` when no WebGPU adapter is available, which the Node-side driver checks after the first viewport and exits 0 without asserting.

- [ ] **Step 1: Add the WebGPU-adapter probe to the front of the `viewer` scenario**

In `scripts/visual-check.mjs`, the `viewer` scenario currently starts with:
```javascript
  viewer: `
    h.click('[data-smoke-route="validate"]');
```
Change it to probe for an adapter first and bail out cleanly if there is none:
```javascript
  viewer: `
    if (!navigator.gpu) {
      return { skip: true, reason: "navigator.gpu is undefined" };
    }
    var adapter = await navigator.gpu.requestAdapter().catch(function () { return null; });
    if (!adapter) {
      return { skip: true, reason: "requestAdapter() returned null" };
    }

    h.click('[data-smoke-route="validate"]');
```

- [ ] **Step 2: Replace the `readPixel`-based draw check with `frameStats()`**

Change:
```javascript
    window.__viewer.current.renderFrame();

    // The pick framebuffer is not multisampled and framing is not pixel-exact,
    // so a single centre sample can land on an anti-aliased edge or between
    // the two walls — a grid is what actually proves a frame was drawn.
    var clear = [23, 26, 31];
    var drawn = false;
    for (var gx = 1; gx < 5 && !drawn; gx++) {
      for (var gy = 1; gy < 5 && !drawn; gy++) {
        var px = Math.round((canvas.width * gx) / 5);
        var py = Math.round((canvas.height * gy) / 5);
        var pixel = window.__viewer.current.readPixel(px, py);
        if (!pixel) continue;
        var distance = Math.abs(pixel[0] - clear[0]) + Math.abs(pixel[1] - clear[1]) + Math.abs(pixel[2] - clear[2]);
        if (distance > 30) drawn = true;
      }
    }
    if (!drawn) throw new Error("every sampled pixel matched the clear colour — nothing was drawn");

    window.scrollTo(0, 0);
    await h.settle(50);

    return { batches: window.__viewer.current.batchCount(), drawn: drawn };
  `,
```
to:
```javascript
    window.__viewer.current.renderFrame();

    var stats = window.__viewer.current.frameStats();
    if (!stats || stats.drawCalls === 0) {
      throw new Error("getFrameStats() reported no draw calls — nothing was drawn");
    }

    window.scrollTo(0, 0);
    await h.settle(50);

    return { batches: window.__viewer.current.batchCount(), drawCalls: stats.drawCalls };
  `,
```

The `var canvas = document.querySelector("[data-smoke-viewer-canvas]"); if (!canvas) throw ...` line just above stays — it is still the right check for "did the canvas element mount at all," independent of the draw-call check that replaces it a few lines down.

- [ ] **Step 3: Make the Node-side driver honour a `skip` result**

In `scripts/visual-check.mjs`, find where viewport results are aggregated (the `for (const viewport of VIEWPORTS)` loop). Immediately after:
```javascript
  firstResult ??= result;
```
add:
```javascript
  if (result.scenario && result.scenario.skip) {
    console.log(`browser check SKIPPED — viewer scenario: ${result.scenario.reason}`);
    server.close();
    if (!KEEP) {
      rmSync(BUILD, { recursive: true, force: true });
      rmSync(PROFILE_DIR, { recursive: true, force: true });
    }
    process.exit(0);
  }
```

- [ ] **Step 4: Run it**

Run (PowerShell, per this project's documented Windows workaround):
```
$env:CHROME_BIN = "<path to a real Chromium/Chrome binary on this machine>"
node scripts/visual-check.mjs --scenario viewer
```
Expected on this host: `browser check SKIPPED — viewer scenario: requestAdapter() returned null` (or `navigator.gpu is undefined`), exit code 0 — consistent with the spec's documented expectation that this host cannot obtain a WebGPU adapter headlessly. If `CHROME_BIN` is unset or points at nothing, the script prints its existing `browser check SKIPPED — no Chromium found` line instead and that is equally acceptable evidence the edit didn't break the pre-existing skip path — just note in the report which of the two skip paths actually fired.

- [ ] **Step 5: Commit**

```bash
git add scripts/visual-check.mjs
git commit -m "$(cat <<'EOF'
chore(web): skip the viewer smoke scenario without a WebGPU adapter

readPixel() has no WebGPU equivalent; the draw-call check now reads
getFrameStats() instead. Headless Chromium without a real adapter (this
host, and likely most CI runners) now skips cleanly rather than failing on
an assertion nothing here can satisfy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 8: Full verify pass and manual browser verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full verify gate**

Run: `node scripts/verify.mjs`
Expected: PASS (build + typecheck + every test file under `apps/web/src`, plus the other workspace packages' own tests).

- [ ] **Step 2: Run the visual-check default (non-scenario) pass**

Run (PowerShell, `CHROME_BIN` set as in Task 7):
```
node scripts/visual-check.mjs
```
Expected: PASS — this checks the app mounts and lays out cleanly across three viewports without driving the viewer scenario specifically, so it does not depend on WebGPU at all.

- [ ] **Step 3: Manual verification in a real WebGPU-capable browser**

This step cannot be automated on this host (no headless WebGPU adapter — see Task 7) and is load-bearing, not optional: the POC that justified this migration only exercised raw geometry loading and camera render. Picking, section box, visibility, and federation were never POC'd.

Run `pnpm --filter @ifc-qa/web dev`, open the app in Chrome/Edge 113+ (or Firefox 141+/Safari 26+), and in the 3D viewer confirm all of the following against a real fixture from `fixtures/ifc/E_AIH_*.ifc`:

1. The model renders after "Load 3D".
2. Orbit-drag (left button) rotates the view; check the direction feels natural — plan-correction note 8 above flags this as unverified against the engine's actual sign convention, and `camera.orbit(-dx, dy, false)` may need its signs flipped if it orbits backwards.
3. Pan-drag (right button) translates the view; same direction caveat as orbit.
4. Wheel zooms in/out with the same feel as before (in on scroll-up, out on scroll-down).
5. Hovering an element shows the pointer cursor; hovering empty space shows the default arrow.
6. Clicking an element selects it (visible highlight, Properties panel populates).
7. "Zoom to fit" and "zoom to selection" (the two overlay toolbar buttons) animate the camera to frame the right target.
8. Dragging a section-box face (via the section popover's sliders) visibly clips geometry.
9. Isolate / highlight / hide (via the tree rail's row actions, and via opening a failing specification in the Results rail) show the right elements.
10. Load a second copy of the same fixture under a different name (federation): hiding/isolating/selecting an element in one file must not affect the element with the same express id in the other file.

Report the outcome of each numbered check plainly; do not report the migration as complete without having actually run this list.

- [ ] **Step 4: Report**

Summarize: verify.mjs result, visual-check.mjs default-pass result, visual-check.mjs viewer-scenario result from Task 7 (and which skip path fired, if any), and the manual checklist results from Step 3. Flag plan-correction note 6 (highlighted/selected visual merge) and note 8's orbit/pan sign caveat explicitly if either was not exactly as before.
