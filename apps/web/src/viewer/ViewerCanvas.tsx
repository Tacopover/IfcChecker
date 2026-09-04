// apps/web/src/viewer/ViewerCanvas.tsx
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Camera, Renderer, type ClipBox, type FrameStats, type RenderOptions } from "@ifc-lite/renderer";
import type { MeshData } from "@ifc-lite/geometry";
import { isEmptyBounds, type Bounds, type Vec3 } from "./bounds.js";
import { ModelFederation } from "./federation.js";
import type { ViewerMesh } from "./meshMapping.js";
import type { SectionBox } from "./sectionBox.js";
import { parseRefKey, type VisibilityState } from "./visibility.js";

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
  /** Call once a model's geometry has fully streamed in — merges streaming fragments into real batches. */
  finishLoad: () => void;
  batchCount: () => number;
  frameStats: () => FrameStats | null;
}

interface ViewerCanvasProps {
  section: SectionBox | null;
  selection: { modelKey: string; expressId: number } | null;
  /**
   * The raw state, not a derived per-element callback — so isolate/highlight
   * translate into GPU id sets in time proportional to what changed (the
   * isolated/highlighted set), not to every element ever loaded. See
   * `buildRenderOptions`'s three independent caches below.
   */
  visibility: VisibilityState;
  onPick: (hit: { modelKey: string; expressId: number } | null) => void;
  onError: (message: string) => void;
  /**
   * World-space center of whatever counts as "selected" right now (picked
   * element, else isolated/highlighted set), or null when nothing is. Read at
   * the start of every orbit drag to decide the pivot — see `onPointerDown`.
   */
  getOrbitPivot: () => Vec3 | null;
  handleRef?: Ref<ViewerCanvasHandle>;
}

/** Shortest gap between two hover picks. Well under a pointer event stream, well over a frame. */
const HOVER_PICK_INTERVAL_MS = 80;

/** Shared empty id set for the isolated case: isolation is absolute, so nothing else needs hiding. Never mutated. */
const EMPTY_IDS: Set<number> = new Set();

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
 * Settle whatever the streaming upload path left behind into real batches.
 * Both halves are guarded no-ops on their own, so this is safe to call at any
 * point: `finalizeStreaming` returns early when no streaming fragments are
 * outstanding, `rebuildPendingBatches` returns early when no bucket is marked
 * dirty. The second half is what makes a removal actually take —
 * `removeMeshesForEntities` only marks the affected buckets, and nothing in
 * the engine drains that queue on its own.
 */
function finalizeStreamedGeometry(renderer: Renderer): void {
  const device = renderer.getGPUDevice();
  const pipeline = renderer.getPipeline();
  if (!device || !pipeline) return;
  const scene = renderer.getScene();
  scene.finalizeStreaming(device, pipeline);
  scene.rebuildPendingBatches(device, pipeline);
}

/**
 * Upload one model's meshes to an already-initialised renderer. Split out of
 * the imperative handle's `addMeshes` so both the live call and the queued
 * replay (see `pendingMeshesRef`) share the exact same offset/bookkeeping
 * logic. Deliberately does not render — callers render once, after either a
 * single call or a whole queue has been applied.
 */
function applyMeshes(
  renderer: Renderer,
  federation: ModelFederation,
  modelExpressIds: Map<string, Map<number, string>>,
  batchCountRef: { current: number },
  geometryVersionRef: { current: number },
  modelKey: string,
  meshes: readonly ViewerMesh[]
): void {
  if (meshes.length === 0) return;
  const offset = federation.offsetFor(modelKey);
  const known = modelExpressIds.get(modelKey) ?? new Map<number, string>();
  const meshData = meshes.map((mesh) => {
    known.set(mesh.expressId, mesh.ifcType);
    return toMeshData(mesh, offset);
  });
  modelExpressIds.set(modelKey, known);
  renderer.addMeshes(meshData, true);
  batchCountRef.current += 1;
  geometryVersionRef.current += 1;
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

export function ViewerCanvas({
  section,
  selection,
  visibility,
  onPick,
  onError,
  getOrbitPivot,
  handleRef,
}: ViewerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const federationRef = useRef(new ModelFederation());
  /** Every expressId this canvas has ever been given for a model, to its ifcType — so a render pass can enumerate what to hide by type without asking the app. */
  const modelExpressIdsRef = useRef(new Map<string, Map<number, string>>());
  const batchCountRef = useRef(0);
  /** Bumped whenever loaded geometry actually changes, so the caches below can key off it. */
  const geometryVersionRef = useRef(0);
  /**
   * `hiddenIds` is the one piece that genuinely requires enumerating every
   * loaded element (a hidden type/model membership test has no cheaper index),
   * so it gets its own cache keyed only on what it actually depends on —
   * unaffected by isolated/highlighted changing.
   */
  const hiddenIdsCacheRef = useRef<{
    hidden: ReadonlySet<string>;
    hiddenTypes: ReadonlySet<string>;
    hiddenModels: ReadonlySet<string>;
    geometryVersion: number;
    ids: Set<number>;
  } | null>(null);
  /** isolated/highlighted are already the exact element set — translating them costs O(selection), not O(everything loaded). */
  const isolatedIdsCacheRef = useRef<{ isolated: ReadonlySet<string> | null; ids: Set<number> | null } | null>(null);
  const highlightedIdsCacheRef = useRef<{ highlighted: ReadonlySet<string> | null; ids: Set<number> } | null>(null);
  const animRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; button: number } | null>(null);
  /** addMeshes calls that arrived before async init() resolved — replayed once the renderer exists. */
  const pendingMeshesRef = useRef<Array<{ modelKey: string; meshes: readonly ViewerMesh[] }>>([]);

  // Read through refs so pointer handlers, the imperative handle, and the
  // animation pump never close over stale props.
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;

  // Both drive the cursor and nothing else, so they are the only pointer state
  // that is allowed to re-render: a drag begins and ends once, and the hover
  // pick below only reports whether the pointer is over geometry at all.
  const [dragMode, setDragMode] = useState<"orbit" | "pan" | null>(null);
  const [overElement, setOverElement] = useState(false);
  const lastHoverRef = useRef(0);
  const hoverTokenRef = useRef(0);

  /** expressId -> federated global id, translating one model's ref keys at a time. */
  const toGlobalIds = useCallback((keys: Iterable<string>): Set<number> => {
    const ids = new Set<number>();
    for (const key of keys) {
      const { modelKey, expressId } = parseRefKey(key);
      ids.add(federationRef.current.offsetFor(modelKey) + expressId);
    }
    return ids;
  }, []);

  const getHiddenIds = useCallback((state: VisibilityState): Set<number> => {
    const cached = hiddenIdsCacheRef.current;
    if (
      cached &&
      cached.hidden === state.hidden &&
      cached.hiddenTypes === state.hiddenTypes &&
      cached.hiddenModels === state.hiddenModels &&
      cached.geometryVersion === geometryVersionRef.current
    ) {
      return cached.ids;
    }

    const ids = new Set<number>();
    for (const [modelKey, expressIds] of modelExpressIdsRef.current) {
      const offset = federationRef.current.offsetFor(modelKey);
      if (state.hiddenModels.has(modelKey)) {
        for (const expressId of expressIds.keys()) ids.add(offset + expressId);
        continue;
      }
      for (const [expressId, ifcType] of expressIds) {
        if (state.hiddenTypes.has(ifcType.toUpperCase()) || state.hidden.has(`${modelKey}#${expressId}`)) {
          ids.add(offset + expressId);
        }
      }
    }

    hiddenIdsCacheRef.current = {
      hidden: state.hidden,
      hiddenTypes: state.hiddenTypes,
      hiddenModels: state.hiddenModels,
      geometryVersion: geometryVersionRef.current,
      ids,
    };
    return ids;
  }, []);

  const getIsolatedIds = useCallback(
    (state: VisibilityState): Set<number> | null => {
      const cached = isolatedIdsCacheRef.current;
      if (cached && cached.isolated === state.isolated) return cached.ids;
      const ids = state.isolated === null ? null : toGlobalIds(state.isolated);
      isolatedIdsCacheRef.current = { isolated: state.isolated, ids };
      return ids;
    },
    [toGlobalIds]
  );

  const getHighlightedIds = useCallback(
    (state: VisibilityState): Set<number> => {
      const cached = highlightedIdsCacheRef.current;
      if (cached && cached.highlighted === state.highlighted) return cached.ids;
      const ids = state.highlighted === null ? new Set<number>() : toGlobalIds(state.highlighted);
      highlightedIdsCacheRef.current = { highlighted: state.highlighted, ids };
      return ids;
    },
    [toGlobalIds]
  );

  const buildRenderOptions = useCallback((): RenderOptions => {
    const state = visibilityRef.current;
    // Isolation is absolute (visibility.ts's `isVisible`): an isolated element
    // shows even if it is a hidden type/model, so hiddenIds is irrelevant once
    // isolatedIds is set — computing it would be wasted work every call.
    const isolatedIds = getIsolatedIds(state);
    const hiddenIds = isolatedIds ? EMPTY_IDS : getHiddenIds(state);
    const highlightedIds = getHighlightedIds(state);

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
      isolatedIds,
      selectedIds: highlightedIds.size > 0 ? highlightedIds : undefined,
      selectedId: selectedId ?? undefined,
      clipBox,
    };
  }, [getHiddenIds, getIsolatedIds, getHighlightedIds]);

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
        // Replay any addMeshes calls that arrived while init() was still in flight.
        for (const pending of pendingMeshesRef.current) {
          applyMeshes(renderer, federationRef.current, modelExpressIdsRef.current, batchCountRef, geometryVersionRef, pending.modelKey, pending.meshes);
        }
        pendingMeshesRef.current = [];
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
      // The engine's CameraAnimator runs its own internal rAF poll to drive an
      // in-flight frameBounds()/animateTo() tween; only a completed tween or
      // reset() stops it, so an unmount mid-tween would otherwise leak it.
      cameraRef.current?.reset();
      rendererRef.current = null;
      cameraRef.current = null;
      modelExpressIdsRef.current = new Map();
      federationRef.current = new ModelFederation();
      batchCountRef.current = 0;
      pendingMeshesRef.current = [];
      // None of the resets above touch the caches below — so they have to be
      // dropped by hand or a remount could serve ids built against the
      // discarded id map (stale federation offsets, stale hidden-type scans).
      hiddenIdsCacheRef.current = null;
      isolatedIdsCacheRef.current = null;
      highlightedIdsCacheRef.current = null;
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
  }, [section, selection, visibility, buildRenderOptions]);

  useImperativeHandle(
    handleRef,
    (): ViewerCanvasHandle => ({
      addMeshes: (modelKey, meshes) => {
        const renderer = rendererRef.current;
        if (meshes.length === 0) return;
        if (!renderer) {
          // init() hasn't resolved yet — queue for the replay in its .then().
          pendingMeshesRef.current.push({ modelKey, meshes });
          return;
        }
        applyMeshes(renderer, federationRef.current, modelExpressIdsRef.current, batchCountRef, geometryVersionRef, modelKey, meshes);
        renderer.render(buildRenderOptions());
      },
      removeModel: (modelKey) => {
        const renderer = rendererRef.current;
        const ids = modelExpressIdsRef.current.get(modelKey);
        modelExpressIdsRef.current.delete(modelKey);
        if (renderer && ids && ids.size > 0) {
          const offset = federationRef.current.offsetFor(modelKey);
          renderer.getScene().removeMeshesForEntities([...ids.keys()].map((id) => offset + id));
          finalizeStreamedGeometry(renderer);
        }
        geometryVersionRef.current += 1;
        federationRef.current.removeModel(modelKey);
        // Drop any batches for this model still queued behind an in-flight
        // init() — otherwise the drain in init().then() replays them after
        // the caller has already asked for the model to be gone.
        pendingMeshesRef.current = pendingMeshesRef.current.filter((pending) => pending.modelKey !== modelKey);
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
      finishLoad: () => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        finalizeStreamedGeometry(renderer);
        renderer.render(buildRenderOptions());
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

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { x: event.clientX, y: event.clientY, button: event.button };
      setDragMode(event.button === 0 ? "orbit" : "pan");
      if (event.button !== 0) return;

      // Decided once per drag, not tracked live: orbit around the current
      // selection if there is one, otherwise around whatever sits at the
      // center of the current view (a scene raycast at the canvas midpoint),
      // falling back to the engine's default (camera.target) over empty space.
      const camera = cameraRef.current;
      if (!camera) return;
      const pivot = getOrbitPivot();
      if (pivot) {
        camera.setOrbitCenter(pivot);
        return;
      }

      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) {
        camera.setOrbitCenter(null);
        return;
      }
      const pickOptions = buildRenderOptions();
      const hit = renderer.raycastScene(canvas.clientWidth / 2, canvas.clientHeight / 2, {
        hiddenIds: pickOptions.hiddenIds,
        isolatedIds: pickOptions.isolatedIds,
      });
      camera.setOrbitCenter(hit ? hit.intersection.point : null);
    },
    [getOrbitPivot, buildRenderOptions]
  );

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
        // hiddenIds/isolatedIds must be passed explicitly — pick() has no
        // fallback to the last render()'s visibility, unlike the old
        // renderer's shader-side hide.
        const pickOptions = buildRenderOptions();
        void renderer
          .pick(pixel[0], pixel[1], { hiddenIds: pickOptions.hiddenIds, isolatedIds: pickOptions.isolatedIds })
          .then((result) => {
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
      // the app has always had. Sensitivity AND sign both live inside the
      // engine now (orbit negates deltaX itself; pan's right axis is
      // cross(dir, up), which points screen-left), so raw pixel deltas go
      // straight through — negating here would invert the horizontal axis.
      if (drag.button === 0) camera.orbit(dx, dy, false);
      else camera.pan(dx, dy, false);
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
      const pickOptions = buildRenderOptions();
      void renderer
        .pick(pixel[0], pixel[1], { hiddenIds: pickOptions.hiddenIds, isolatedIds: pickOptions.isolatedIds })
        .then((result) => {
          onPick(result ? federationRef.current.fromGlobalId(result.expressId) : null);
        });
    },
    [onPick, canvasPixel, buildRenderOptions]
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
      // Sign only, fixed magnitude. camera.zoom() scales by the delta's
      // magnitude, but deltaY's own scale is a deltaMode artefact — ~100 per
      // notch in pixel mode, ~3 in line mode — so passing it raw would make
      // zoom speed a property of the browser. 100 lands exactly on the
      // engine's MAX_ZOOM_DELTA clamp, i.e. the old renderer's 1.1x step.
      camera.zoom(event.deltaY > 0 ? 100 : -100, false);
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
