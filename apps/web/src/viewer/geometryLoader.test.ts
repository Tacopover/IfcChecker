import { describe, expect, it, vi } from "vitest";
import type { MeshData } from "@ifc-lite/geometry";
import {
  GeometryLoadAbortedError,
  streamModelGeometry,
  type StreamingProcessor,
} from "./geometryLoader.js";
import type { ViewerMesh } from "./meshMapping.js";

function meshData(expressId: number, overrides: Partial<MeshData> = {}): MeshData {
  return {
    expressId,
    ifcType: "IfcWall",
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    color: [1, 1, 1, 1],
    ...overrides,
  };
}

type Event = {
  type: string;
  meshes?: MeshData[];
  coordinateInfo?: { originShift?: { x: number; y: number; z: number } };
};

function fakeProcessor(events: Event[]): StreamingProcessor & { disposed: boolean } {
  const processor = {
    disposed: false,
    async *processAdaptive() {
      for (const event of events) yield event;
    },
    dispose() {
      processor.disposed = true;
    },
  };
  return processor as StreamingProcessor & { disposed: boolean };
}

const collector = () => {
  const meshes: ViewerMesh[] = [];
  return { meshes, onMeshes: (batch: ViewerMesh[]) => meshes.push(...batch) };
};

const buffer = new Uint8Array([1, 2, 3]);

describe("streamModelGeometry", () => {
  it("hands each batch to the consumer as it arrives, rather than accumulating", async () => {
    const seen: number[] = [];
    const summary = await streamModelGeometry(
      fakeProcessor([
        { type: "batch", meshes: [meshData(100)] },
        { type: "batch", meshes: [meshData(200), meshData(300)] },
        { type: "complete" },
      ]),
      buffer,
      { onMeshes: (batch) => seen.push(batch.length) },
      { renderableExpressIds: new Set([100, 200, 300]) }
    );

    expect(seen).toEqual([1, 2]);
    expect(summary.meshCount).toBe(3);
  });

  // Openings are dropped before they ever become elements, so they arrive here
  // with no record. Drawing them puts solid blobs inside the walls they cut.
  it("never uploads a mesh with no element record, and says which it skipped", async () => {
    const sink = collector();
    const summary = await streamModelGeometry(
      fakeProcessor([{ type: "batch", meshes: [meshData(100), meshData(900), meshData(800)] }]),
      buffer,
      sink,
      { renderableExpressIds: new Set([100]) }
    );

    expect(sink.meshes.map((mesh) => mesh.expressId)).toEqual([100]);
    expect(summary.skippedExpressIds).toEqual([800, 900]);
  });

  // geometryClass 2 is a type-library template whose occurrences are already
  // emitted separately — rendering it draws the same shape twice.
  it("drops instanced type templates without counting them as skipped elements", async () => {
    const sink = collector();
    const summary = await streamModelGeometry(
      fakeProcessor([
        { type: "batch", meshes: [meshData(100), meshData(100, { geometryClass: 2 })] },
      ]),
      buffer,
      sink,
      { renderableExpressIds: new Set([100]) }
    );

    expect(sink.meshes).toHaveLength(1);
    expect(summary.skippedExpressIds).toEqual([]);
  });

  it("keeps orphan type geometry, which has no occurrence to duplicate", async () => {
    const sink = collector();
    await streamModelGeometry(
      fakeProcessor([{ type: "batch", meshes: [meshData(100, { geometryClass: 1 })] }]),
      buffer,
      sink,
      { renderableExpressIds: new Set([100]) }
    );

    expect(sink.meshes).toHaveLength(1);
  });

  it("defaults a missing origin to the model origin rather than leaving it undefined", async () => {
    const sink = collector();
    await streamModelGeometry(
      fakeProcessor([{ type: "batch", meshes: [meshData(100), meshData(200, { origin: [5, 0, 1] })] }]),
      buffer,
      sink,
      { renderableExpressIds: new Set([100, 200]) }
    );

    expect(sink.meshes[0].origin).toEqual([0, 0, 0]);
    expect(sink.meshes[1].origin).toEqual([5, 0, 1]);
  });

  it("carries the RTC origin shift through to the summary", async () => {
    const summary = await streamModelGeometry(
      fakeProcessor([
        { type: "batch", meshes: [meshData(100)] },
        { type: "complete", coordinateInfo: { originShift: { x: 1000, y: 0, z: 2000 } } },
      ]),
      buffer,
      collector(),
      { renderableExpressIds: new Set([100]) }
    );

    expect(summary.originShift).toEqual({ x: 1000, y: 0, z: 2000 });
  });

  it("reports an empty load rather than throwing when a model has no geometry", async () => {
    const summary = await streamModelGeometry(
      fakeProcessor([{ type: "complete" }]),
      buffer,
      collector(),
      { renderableExpressIds: new Set([100]) }
    );

    expect(summary.meshCount).toBe(0);
    expect(summary.originShift).toBeNull();
  });

  it("does not call the consumer for a batch where everything was filtered out", async () => {
    const onMeshes = vi.fn();
    await streamModelGeometry(
      fakeProcessor([{ type: "batch", meshes: [meshData(900)] }]),
      buffer,
      { onMeshes },
      { renderableExpressIds: new Set([100]) }
    );

    expect(onMeshes).not.toHaveBeenCalled();
  });

  // Loading a federated model is minutes long, so leaving the tab must stop it
  // rather than run the worker pool to completion against a dead renderer.
  it("aborts between batches when the signal is raised", async () => {
    const controller = new AbortController();
    const sink = {
      onMeshes: () => controller.abort(),
    };

    await expect(
      streamModelGeometry(
        fakeProcessor([
          { type: "batch", meshes: [meshData(100)] },
          { type: "batch", meshes: [meshData(200)] },
        ]),
        buffer,
        sink,
        { renderableExpressIds: new Set([100, 200]), signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(GeometryLoadAbortedError);
  });

  it("reports progress as a running total, not a per-batch count", async () => {
    const progress: number[] = [];
    await streamModelGeometry(
      fakeProcessor([
        { type: "batch", meshes: [meshData(100)] },
        { type: "batch", meshes: [meshData(200), meshData(300)] },
      ]),
      buffer,
      { onMeshes: () => {}, onProgress: (total) => progress.push(total) },
      { renderableExpressIds: new Set([100, 200, 300]) }
    );

    expect(progress).toEqual([1, 3]);
  });
});
