import { describe, expect, it } from "vitest";
import { packBatch, visibilityBytes, visibilityTextureSize } from "./meshBatch.js";
import type { ViewerMesh } from "./meshMapping.js";

function mesh(expressId: number, overrides: Partial<ViewerMesh> = {}): ViewerMesh {
  return {
    expressId,
    ifcType: "IfcWall",
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    color: [1, 0, 0, 1],
    origin: [0, 0, 0],
    ...overrides,
  };
}

describe("packBatch", () => {
  it("concatenates vertices and counts them", () => {
    const batch = packBatch([mesh(100), mesh(200)]);
    expect(batch.vertexCount).toBe(6);
    expect(batch.indexCount).toBe(6);
    expect(batch.positions).toHaveLength(18);
  });

  // The bug this guards: a second mesh's indices still pointing at the first
  // mesh's vertices, which draws a plausible-looking wrong shape.
  it("rebases each mesh's indices onto its own vertices", () => {
    const batch = packBatch([mesh(100), mesh(200)]);
    expect([...batch.indices]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("gives every mesh its own slot, resolving back to its express id", () => {
    const batch = packBatch([mesh(100), mesh(200), mesh(100)]);
    expect([...batch.expressIdBySlot]).toEqual([100, 200, 100]);
    expect([...batch.slots]).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });

  // Large-coordinate sites lose float32 precision if every vertex carries its
  // absolute position, which is why the pipeline hands out per-element origins.
  it("rebases positions onto the batch origin so float32 precision survives", () => {
    const batch = packBatch([
      mesh(100, { origin: [1000, 0, 0] }),
      mesh(200, { origin: [1003, 0, 0] }),
    ]);

    expect(batch.origin).toEqual([1000, 0, 0]);
    expect(batch.positions[0]).toBe(0);
    // Second mesh sits 3 metres along X from the batch origin.
    expect(batch.positions[9]).toBe(3);
  });

  it("expands colour to a byte per channel per vertex", () => {
    const batch = packBatch([mesh(100, { color: [1, 0.5, 0, 1] })]);
    expect([...batch.colors.slice(0, 4)]).toEqual([255, 128, 0, 255]);
    expect(batch.colors).toHaveLength(12);
  });

  it("copies normals across unchanged — they are direction, not position", () => {
    const batch = packBatch([mesh(100, { origin: [500, 500, 500] })]);
    expect([...batch.normals.slice(0, 3)]).toEqual([0, 0, 1]);
  });

  it("packs an empty batch without producing NaN or a bogus origin", () => {
    const batch = packBatch([]);
    expect(batch.vertexCount).toBe(0);
    expect(batch.indexCount).toBe(0);
    expect(batch.origin).toEqual([0, 0, 0]);
  });

  it("handles meshes of differing vertex counts", () => {
    const big = mesh(200, {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 1, 3, 2]),
    });

    const batch = packBatch([mesh(100), big]);
    expect(batch.vertexCount).toBe(7);
    expect([...batch.indices]).toEqual([0, 1, 2, 3, 4, 5, 4, 6, 5]);
    expect([...batch.slots]).toEqual([0, 0, 0, 1, 1, 1, 1]);
  });
});

describe("visibilityTextureSize", () => {
  it("grows in rows, so a slot count over the row width still fits", () => {
    expect(visibilityTextureSize(1, 2048)).toEqual({ width: 2048, height: 1 });
    expect(visibilityTextureSize(2048, 2048)).toEqual({ width: 2048, height: 1 });
    expect(visibilityTextureSize(2049, 2048)).toEqual({ width: 2048, height: 2 });
  });

  it("is at least one row even with no slots at all", () => {
    expect(visibilityTextureSize(0, 2048).height).toBe(1);
  });
});

describe("visibilityBytes", () => {
  it("writes one byte per slot, keyed on the slot's express id", () => {
    const expressIds = new Uint32Array([100, 200, 300]);
    const bytes = visibilityBytes(expressIds, (id) => (id !== 200 ? 1 : 0), 8);
    expect([...bytes.slice(0, 3)]).toEqual([1, 0, 1]);
  });

  // Two meshes of one element share its express id, so hiding the element must
  // take both down — a half-hidden wall is worse than one that never hid.
  it("hides every slot belonging to a hidden element", () => {
    const expressIds = new Uint32Array([100, 100, 200]);
    const bytes = visibilityBytes(expressIds, (id) => (id !== 100 ? 1 : 0), 8);
    expect([...bytes.slice(0, 3)]).toEqual([0, 0, 1]);
  });

  it("fills the whole texture, so slots past the end read as hidden", () => {
    const bytes = visibilityBytes(new Uint32Array([100]), () => 1, 8);
    expect(bytes).toHaveLength(8);
    expect(bytes[1]).toBe(0);
  });

  // The third state: visible but tinted, for highlight-only mode.
  it("writes 2 for a highlighted slot, distinct from plain visible or hidden", () => {
    const expressIds = new Uint32Array([100, 200, 300]);
    const bytes = visibilityBytes(expressIds, (id) => (id === 200 ? 2 : id === 300 ? 0 : 1), 8);
    expect([...bytes.slice(0, 3)]).toEqual([1, 2, 0]);
  });
});
