import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { isEmptyBounds } from "./bounds.js";
import {
  boundsOfElements,
  expressIdToPickColor,
  indexElementsByGlobalId,
  mapMeshesToElements,
  meshBounds,
  pickColorToExpressId,
  type ViewerMesh,
} from "./meshMapping.js";

function element(expressId: number, overrides: Partial<NormalizedElement> = {}): NormalizedElement {
  return {
    globalId: `g${expressId}`,
    expressId,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${expressId}`,
    attributes: {},
    propertySets: {},
    ...overrides,
  };
}

function mesh(expressId: number, overrides: Partial<ViewerMesh> = {}): ViewerMesh {
  return {
    expressId,
    ifcType: "IfcWall",
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    color: [0.85, 0.85, 0.85, 1],
    origin: [0, 0, 0],
    ...overrides,
  };
}

describe("mapMeshesToElements", () => {
  // The geometry pipeline documents this explicitly: one element commonly
  // yields several meshes, one per material or part.
  it("groups several meshes under the one element they belong to", () => {
    const mapping = mapMeshesToElements([mesh(100), mesh(100), mesh(200)], [element(100), element(200)]);
    expect(mapping.meshesByExpressId.get(100)).toHaveLength(2);
    expect(mapping.meshesByExpressId.get(200)).toHaveLength(1);
  });

  it("resolves an element record for the property browser", () => {
    const mapping = mapMeshesToElements([mesh(100)], [element(100, { name: "Wall A" })]);
    expect(mapping.elementByExpressId.get(100)?.name).toBe("Wall A");
  });

  // Openings and type-library geometry are dropped before they become elements,
  // so meshes with no record are expected. Reported rather than silently kept,
  // so a click on one can decline instead of showing an empty panel.
  it("reports meshes that match no element instead of dropping or faking them", () => {
    const mapping = mapMeshesToElements([mesh(100), mesh(900), mesh(800)], [element(100)]);
    expect(mapping.orphanExpressIds).toEqual([800, 900]);
  });

  it("reports elements that have no geometry at all", () => {
    const mapping = mapMeshesToElements([mesh(100)], [element(100), element(300), element(200)]);
    expect(mapping.geometrylessExpressIds).toEqual([200, 300]);
  });

  it("copes with a model that produced no geometry whatsoever", () => {
    const mapping = mapMeshesToElements([], [element(100)]);
    expect(mapping.meshesByExpressId.size).toBe(0);
    expect(mapping.orphanExpressIds).toEqual([]);
    expect(mapping.geometrylessExpressIds).toEqual([100]);
  });
});

describe("indexElementsByGlobalId", () => {
  it("gives check results, which carry only a GlobalId, a way in", () => {
    const index = indexElementsByGlobalId([element(100), element(200)]);
    expect(index.get("g200")?.expressId).toBe(200);
  });
});

describe("meshBounds", () => {
  it("offsets the captured object-space AABB by the mesh origin", () => {
    const bounds = meshBounds(
      mesh(100, {
        localBounds: new Float32Array([0, 0, -0.2, 4, 3, 0]),
        origin: [10, 1, 2],
      })
    );
    expect(bounds.min.x).toBe(10);
    expect(bounds.min.y).toBe(1);
    // Float32 storage, so the AABB comes back a hair off the authored -0.2.
    expect(bounds.min.z).toBeCloseTo(1.8, 6);
    expect(bounds.max).toEqual({ x: 14, y: 4, z: 2 });
  });

  it("falls back to walking the vertices when the pipeline captured no AABB", () => {
    const bounds = meshBounds(mesh(100, { origin: [5, 0, 0] }));
    expect(bounds.min).toEqual({ x: 5, y: 0, z: 0 });
    expect(bounds.max).toEqual({ x: 6, y: 1, z: 0 });
  });
});

describe("boundsOfElements", () => {
  it("unions every mesh of every requested element", () => {
    const mapping = mapMeshesToElements(
      [
        mesh(100, { localBounds: new Float32Array([0, 0, 0, 1, 1, 1]) }),
        mesh(200, { localBounds: new Float32Array([0, 0, 0, 1, 1, 1]), origin: [5, 0, 0] }),
      ],
      [element(100), element(200)]
    );

    const bounds = boundsOfElements(mapping, [100, 200]);
    expect(bounds.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(bounds.max).toEqual({ x: 6, y: 1, z: 1 });
  });

  // Framing must not collapse onto the origin because one of the requested
  // elements happens to be a non-renderable type.
  it("ignores elements with no geometry rather than pulling the box to the origin", () => {
    const mapping = mapMeshesToElements(
      [mesh(200, { localBounds: new Float32Array([0, 0, 0, 1, 1, 1]), origin: [5, 0, 0] })],
      [element(100), element(200)]
    );

    expect(boundsOfElements(mapping, [100, 200])).toEqual(boundsOfElements(mapping, [200]));
  });

  it("returns empty bounds when nothing requested has geometry", () => {
    const mapping = mapMeshesToElements([], [element(100)]);
    expect(isEmptyBounds(boundsOfElements(mapping, [100]))).toBe(true);
  });
});

describe("colour-pick encoding", () => {
  it("round-trips across the whole 24-bit range", () => {
    for (const expressId of [1, 2, 255, 256, 65535, 65536, 1_000_003, 16_777_215]) {
      const [r, g, b] = expressIdToPickColor(expressId);
      expect(pickColorToExpressId(r, g, b)).toBe(expressId);
    }
  });

  it("reads a cleared black buffer as a miss, not as element zero", () => {
    expect(pickColorToExpressId(0, 0, 0)).toBeNull();
  });

  it("stays within a byte per channel at the top of the range", () => {
    for (const value of expressIdToPickColor(16_777_215)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
    }
  });
});
