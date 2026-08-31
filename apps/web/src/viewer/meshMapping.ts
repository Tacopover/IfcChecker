import type { NormalizedElement } from "@ifc-qa/shared-types";
import { emptyBounds, growByPoint, unionBounds, type Bounds } from "./bounds.js";

// The join between what the geometry pipeline produces and what the parser
// produced. Both sides key on expressId; neither side guarantees the other has
// a matching record, and pretending otherwise is how a viewer ends up framing
// nothing and saying nothing.

/** One mesh as the geometry pipeline hands it over, already in Y-up metres. */
export interface ViewerMesh {
  expressId: number;
  ifcType: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** RGBA 0..1. */
  color: readonly [number, number, number, number];
  /** World offset the positions are relative to (RTC / per-element local frame). */
  origin: readonly [number, number, number];
  /** Object-space AABB, when the pipeline captured one. */
  localBounds?: { min: readonly [number, number, number]; max: readonly [number, number, number] };
}

export interface MeshMapping {
  /** expressId -> its meshes. One element commonly has several, one per material. */
  meshesByExpressId: Map<number, ViewerMesh[]>;
  /** expressId -> the parsed element record, for the property browser. */
  elementByExpressId: Map<number, NormalizedElement>;
  /**
   * Meshes whose expressId matches no element. Expected, not an error: opening
   * elements and type-library geometry are filtered out of `elements` long
   * before this point. Surfaced so the viewer can decline to select them
   * rather than show an empty property panel.
   */
  orphanExpressIds: number[];
  /** Elements with no geometry at all — the honest answer to "show me this". */
  geometrylessExpressIds: number[];
}

export function indexElements(elements: readonly NormalizedElement[]): Map<number, NormalizedElement> {
  return new Map(elements.map((element) => [element.expressId, element]));
}

export function indexElementsByGlobalId(
  elements: readonly NormalizedElement[]
): Map<string, NormalizedElement> {
  return new Map(elements.map((element) => [element.globalId, element]));
}

export function mapMeshesToElements(
  meshes: readonly ViewerMesh[],
  elements: readonly NormalizedElement[]
): MeshMapping {
  const meshesByExpressId = new Map<number, ViewerMesh[]>();
  for (const mesh of meshes) {
    const bucket = meshesByExpressId.get(mesh.expressId);
    if (bucket) bucket.push(mesh);
    else meshesByExpressId.set(mesh.expressId, [mesh]);
  }

  const elementByExpressId = indexElements(elements);
  const orphanExpressIds = [...meshesByExpressId.keys()]
    .filter((expressId) => !elementByExpressId.has(expressId))
    .sort((a, b) => a - b);
  const geometrylessExpressIds = elements
    .map((element) => element.expressId)
    .filter((expressId) => !meshesByExpressId.has(expressId))
    .sort((a, b) => a - b);

  return { meshesByExpressId, elementByExpressId, orphanExpressIds, geometrylessExpressIds };
}

/** World-space bounds of one mesh, from its object-space AABB plus its origin. */
export function meshBounds(mesh: ViewerMesh): Bounds {
  const [ox, oy, oz] = mesh.origin;

  if (mesh.localBounds) {
    const { min, max } = mesh.localBounds;
    return {
      min: { x: min[0] + ox, y: min[1] + oy, z: min[2] + oz },
      max: { x: max[0] + ox, y: max[1] + oy, z: max[2] + oz },
    };
  }

  // No captured AABB — walk the vertices. Only reached for meshes the pipeline
  // did not annotate, so it stays off the hot path.
  let bounds = emptyBounds();
  for (let i = 0; i < mesh.positions.length; i += 3) {
    bounds = growByPoint(bounds, {
      x: mesh.positions[i] + ox,
      y: mesh.positions[i + 1] + oy,
      z: mesh.positions[i + 2] + oz,
    });
  }
  return bounds;
}

/**
 * Combined bounds of a set of elements — what "zoom to fit these" needs.
 * Elements with no geometry contribute nothing rather than collapsing the box
 * to the origin, which would frame empty space next to the real result.
 */
export function boundsOfElements(
  mapping: MeshMapping,
  expressIds: Iterable<number>
): Bounds {
  let bounds = emptyBounds();
  for (const expressId of expressIds) {
    for (const mesh of mapping.meshesByExpressId.get(expressId) ?? []) {
      bounds = unionBounds(bounds, meshBounds(mesh));
    }
  }
  return bounds;
}

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
