import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { dolly, orbit, pan, type OrbitCamera } from "./camera.js";
import { ViewerRenderer, WebGLUnavailableError } from "./renderer.js";
import type { ViewerMesh } from "./meshMapping.js";
import type { SectionBox } from "./sectionBox.js";

// The canvas and the GL context, and nothing else. Everything it is told to
// draw arrives as already-decided state, so the interesting behaviour stays in
// the modules next door where it can be tested without a GPU.

export interface ViewerCanvasHandle {
  addMeshes: (modelKey: string, meshes: readonly ViewerMesh[]) => void;
  removeModel: (modelKey: string) => void;
  /** Draws one frame immediately. Never waits on requestAnimationFrame. */
  renderFrame: () => void;
  pick: (clientX: number, clientY: number) => { modelKey: string; expressId: number } | null;
  readPixel: (x: number, y: number) => [number, number, number, number] | null;
  batchCount: () => number;
  /**
   * Width over height of the drawing buffer. Framing has to be told the shape
   * of the viewport it is framing into, and only the canvas knows it.
   */
  aspect: () => number;
}

interface ViewerCanvasProps {
  camera: OrbitCamera;
  onCameraChange: (camera: OrbitCamera) => void;
  section: SectionBox | null;
  selection: { modelKey: string; expressId: number } | null;
  /** 0 hidden / 1 visible / 2 visible-and-highlighted — see visibility.ts's `visibilityCode`. */
  isVisible: (modelKey: string, expressId: number) => 0 | 1 | 2;
  onPick: (hit: { modelKey: string; expressId: number } | null) => void;
  onError: (message: string) => void;
  handleRef?: Ref<ViewerCanvasHandle>;
}

/**
 * The harness reads pixels after the frame callback has returned, where a
 * discarded drawing buffer reads back as zeros. `__smokeErrors` is the marker
 * the browser check injects before any app script runs, so its presence is a
 * reliable "we are under the gate" signal without a build-time flag.
 */
/** Shortest gap between two hover picks. Well under a pointer event stream, well over a frame. */
const HOVER_PICK_INTERVAL_MS = 80;

function underTestHarness(): boolean {
  return typeof window !== "undefined" && Array.isArray((window as { __smokeErrors?: unknown }).__smokeErrors);
}

export function ViewerCanvas({
  camera,
  onCameraChange,
  section,
  selection,
  isVisible,
  onPick,
  onError,
  handleRef,
}: ViewerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ViewerRenderer | null>(null);
  const dragRef = useRef<{ x: number; y: number; button: number } | null>(null);
  // Read through a ref so the pointer handlers never close over a stale camera.
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Both drive the cursor and nothing else, so they are the only pointer state
  // that is allowed to re-render: a drag begins and ends once, and the hover
  // pick below only reports whether the pointer is over geometry at all.
  const [dragMode, setDragMode] = useState<"orbit" | "pan" | null>(null);
  const [overElement, setOverElement] = useState(false);
  const lastHoverRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      rendererRef.current = new ViewerRenderer(canvas, {
        preserveDrawingBuffer: underTestHarness(),
      });
    } catch (error) {
      onError(
        error instanceof WebGLUnavailableError
          ? "This browser did not provide a WebGL2 context, so the 3D view cannot be shown."
          : error instanceof Error
            ? error.message
            : String(error)
      );
      return;
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [onError]);

  // Sizing follows the element, not the window: the tree rail and property
  // panel change the canvas's share of the page without the window resizing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      rendererRef.current?.renderFrame();
    };

    resize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Four effects, not one: a single effect keyed on all four would re-run
  // setVisibility (a texSubImage2D upload per batch) on every pure camera
  // move, since React re-runs a whole effect body when any one of its
  // dependencies changes. Splitting them means an orbit/pan drag — which
  // only ever changes `camera` — touches nothing but the camera and redraws.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setCamera(camera);
    renderer.renderFrame();
  }, [camera]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setSection(section);
    renderer.renderFrame();
  }, [section]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setSelected(selection?.modelKey ?? null, selection?.expressId ?? null);
    renderer.renderFrame();
  }, [selection]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setVisibility(isVisible);
    renderer.renderFrame();
  }, [isVisible]);

  useImperativeHandle(
    handleRef,
    (): ViewerCanvasHandle => ({
      addMeshes: (modelKey, meshes) => {
        // isVisible seeds the new batch's texture directly (see
        // ViewerRenderer.addMeshes) instead of a follow-up setVisibility
        // pass over every batch loaded so far.
        rendererRef.current?.addMeshes(modelKey, meshes, isVisible);
        rendererRef.current?.renderFrame();
      },
      removeModel: (modelKey) => {
        rendererRef.current?.removeModel(modelKey);
        rendererRef.current?.renderFrame();
      },
      renderFrame: () => rendererRef.current?.renderFrame(),
      pick: (clientX, clientY) => {
        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        if (!canvas || !renderer) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return renderer.pick(
          Math.round((clientX - rect.left) * scaleX),
          Math.round((clientY - rect.top) * scaleY)
        );
      },
      readPixel: (x, y) => {
        const canvas = canvasRef.current;
        const gl = canvas?.getContext("webgl2");
        if (!canvas || !gl) return null;
        const pixel = new Uint8Array(4);
        gl.readPixels(x, canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return [pixel[0], pixel[1], pixel[2], pixel[3]];
      },
      batchCount: () => rendererRef.current?.batchCount ?? 0,
      aspect: () => {
        const canvas = canvasRef.current;
        if (!canvas || canvas.height === 0) return 16 / 9;
        return canvas.width / canvas.height;
      },
    }),
    [isVisible]
  );

  /** Client coordinates to drawing-buffer pixels, which is what `pick` takes. */
  const canvasPixel = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return [
      Math.round((clientX - rect.left) * (canvas.width / rect.width)),
      Math.round((clientY - rect.top) * (canvas.height / rect.height)),
    ];
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, button: event.button };
    setDragMode(event.button === 0 ? "orbit" : "pan");
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) {
        // A pick is a full render into the pick target plus a readPixels stall,
        // so hovering is rate-limited rather than run on every pointer event.
        const now = performance.now();
        if (now - lastHoverRef.current < HOVER_PICK_INTERVAL_MS) return;
        lastHoverRef.current = now;

        const renderer = rendererRef.current;
        const pixel = canvasPixel(event.clientX, event.clientY);
        if (!renderer || !pixel) return;
        setOverElement(renderer.pick(pixel[0], pixel[1]) !== null);
        return;
      }

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      dragRef.current = { ...drag, x: event.clientX, y: event.clientY };

      const current = cameraRef.current;
      if (drag.button === 0) {
        onCameraChange(orbit(current, -dx * 0.01, dy * 0.01));
      } else {
        // Pan by a fraction of the orbit distance so the model tracks the
        // pointer at any zoom instead of crawling when far out.
        const scale = current.distance * 0.002;
        onCameraChange(pan(current, -dx * scale, dy * scale));
      }
    },
    [onCameraChange, canvasPixel]
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
      onPick(renderer.pick(pixel[0], pixel[1]));
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
      onCameraChange(dolly(cameraRef.current, event.deltaY > 0 ? 1.1 : 1 / 1.1));
    },
    [onCameraChange]
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
      onPointerLeave={() => setOverElement(false)}
      onWheel={onWheel}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
