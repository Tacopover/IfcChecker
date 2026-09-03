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
 * Upload one model's meshes to an already-initialised renderer. Split out of
 * the imperative handle's `addMeshes` so both the live call and the queued
 * replay (see `pendingMeshesRef`) share the exact same offset/bookkeeping
 * logic. Deliberately does not render — callers render once, after either a
 * single call or a whole queue has been applied.
 */
function applyMeshes(
  renderer: Renderer,
  federation: ModelFederation,
  modelExpressIds: Map<string, Set<number>>,
  batchCountRef: { current: number },
  modelKey: string,
  meshes: readonly ViewerMesh[]
): void {
  if (meshes.length === 0) return;
  const offset = federation.offsetFor(modelKey);
  const known = modelExpressIds.get(modelKey) ?? new Set<number>();
  const meshData = meshes.map((mesh) => {
    known.add(mesh.expressId);
    return toMeshData(mesh, offset);
  });
  modelExpressIds.set(modelKey, known);
  renderer.addMeshes(meshData, true);
  batchCountRef.current += 1;
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
  /** addMeshes calls that arrived before async init() resolved — replayed once the renderer exists. */
  const pendingMeshesRef = useRef<Array<{ modelKey: string; meshes: readonly ViewerMesh[] }>>([]);

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
        // Replay any addMeshes calls that arrived while init() was still in flight.
        for (const pending of pendingMeshesRef.current) {
          applyMeshes(renderer, federationRef.current, modelExpressIdsRef.current, batchCountRef, pending.modelKey, pending.meshes);
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
        if (meshes.length === 0) return;
        if (!renderer) {
          // init() hasn't resolved yet — queue for the replay in its .then().
          pendingMeshesRef.current.push({ modelKey, meshes });
          return;
        }
        applyMeshes(renderer, federationRef.current, modelExpressIdsRef.current, batchCountRef, modelKey, meshes);
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
        // hiddenIds must be passed explicitly — pick() has no fallback to the
        // last render()'s visibility, unlike the old renderer's shader-side hide.
        void renderer.pick(pixel[0], pixel[1], { hiddenIds: buildRenderOptions().hiddenIds }).then((result) => {
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
      void renderer.pick(pixel[0], pixel[1], { hiddenIds: buildRenderOptions().hiddenIds }).then((result) => {
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
