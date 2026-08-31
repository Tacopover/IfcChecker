import type { MeshData } from "@ifc-lite/geometry";
import type { ViewerMesh } from "./meshMapping.js";

// Geometry for one model, streamed. Parsing on the validate page never comes
// here: geometry is opt-in in both engines, and this is the only thing that
// asks for it, which is what keeps a 1.6 GB check as fast as it is today.
//
// Meshes are handed to the consumer batch by batch and are not accumulated
// here. At federation scale the JS-side copy is the thing that will not fit,
// so the renderer uploads each batch and lets it go.

/** Type-library templates render as duplicates of the occurrences that use them. */
const INSTANCED_TEMPLATE = 2;

export interface GeometryLoadHandlers {
  /** Called once per batch. The arrays are transferred, not retained here. */
  onMeshes: (meshes: ViewerMesh[]) => void;
  /** Total meshes accepted so far — enough to drive a progress readout. */
  onProgress?: (accepted: number) => void;
}

export interface GeometryLoadOptions {
  /**
   * Express ids that have an element record. Meshes outside it — opening
   * elements, ports, anything `classifyEntityType` dropped — are never
   * uploaded: they cannot be selected, named or inspected, so drawing them
   * only puts solid blobs inside the walls they were meant to cut.
   */
  renderableExpressIds: ReadonlySet<number>;
  signal?: AbortSignal;
}

export interface GeometryLoadSummary {
  meshCount: number;
  /** Meshes skipped for having no element record, by express id. */
  skippedExpressIds: number[];
  originShift: { x: number; y: number; z: number } | null;
  elapsedMs: number;
}

export class GeometryLoadAbortedError extends Error {
  constructor() {
    super("Geometry load cancelled");
    this.name = "GeometryLoadAbortedError";
  }
}

function toViewerMesh(mesh: MeshData): ViewerMesh {
  return {
    expressId: mesh.expressId,
    ifcType: mesh.ifcType ?? "",
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    color: mesh.color,
    origin: mesh.origin ?? [0, 0, 0],
    localBounds: mesh.localBounds,
  };
}

/**
 * `processor` is injected rather than constructed here so the flow can be
 * driven by a fake in tests — the real one spawns a worker pool and a WASM
 * instance, neither of which belongs in a unit test.
 */
export interface StreamingProcessor {
  processAdaptive(
    buffer: Uint8Array,
    options?: Record<string, unknown>
  ): AsyncGenerator<{
    type: string;
    meshes?: MeshData[];
    coordinateInfo?: { originShift?: { x: number; y: number; z: number } };
  }>;
  dispose(): void;
}

export async function streamModelGeometry(
  processor: StreamingProcessor,
  buffer: Uint8Array,
  handlers: GeometryLoadHandlers,
  options: GeometryLoadOptions
): Promise<GeometryLoadSummary> {
  const startedAt = performance.now();
  const skipped = new Set<number>();
  let meshCount = 0;
  let originShift: GeometryLoadSummary["originShift"] = null;

  for await (const event of processor.processAdaptive(buffer)) {
    if (options.signal?.aborted) throw new GeometryLoadAbortedError();

    if (event.type === "complete") {
      originShift = event.coordinateInfo?.originShift ?? originShift;
      continue;
    }
    if (event.type !== "batch" || !event.meshes) continue;

    originShift = event.coordinateInfo?.originShift ?? originShift;

    const accepted: ViewerMesh[] = [];
    for (const mesh of event.meshes) {
      if ((mesh.geometryClass ?? 0) === INSTANCED_TEMPLATE) continue;
      if (!options.renderableExpressIds.has(mesh.expressId)) {
        skipped.add(mesh.expressId);
        continue;
      }
      accepted.push(toViewerMesh(mesh));
    }

    if (accepted.length > 0) {
      meshCount += accepted.length;
      handlers.onMeshes(accepted);
      handlers.onProgress?.(meshCount);
    }
  }

  return {
    meshCount,
    skippedExpressIds: [...skipped].sort((a, b) => a - b),
    originShift,
    elapsedMs: performance.now() - startedAt,
  };
}

/**
 * The real processor. Instancing is off because these models are federated:
 * the pipeline's own note is that its instanced path is primary-model only, so
 * a federated load must keep everything on the flat path or lose the opaque
 * repeated occurrences. Staying flat also means the renderer never has to be
 * instanced-feature-complete before picking works.
 */
export async function createGeometryProcessor(): Promise<StreamingProcessor> {
  const { GeometryProcessor } = await import("@ifc-lite/geometry");
  const processor = new GeometryProcessor({ enableInstancing: false, skipSmallCuts: true });
  await processor.init();
  return processor as unknown as StreamingProcessor;
}
