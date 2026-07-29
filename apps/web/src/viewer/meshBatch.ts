import type { ViewerMesh } from "./meshMapping.js";

// Meshes packed into the flat arrays a single draw call wants. Visibility is
// the reason this shape exists: a federated model has far too many meshes to
// give each one a draw call, and re-uploading vertex data every time something
// is hidden would be worse. So every vertex carries a *slot*, and visibility
// is a one-byte-per-slot lookup the vertex shader reads — hiding an element is
// then a single texel write rather than any change to the geometry.

export interface PackedBatch {
  /** Vertex positions, already offset by each mesh's origin into batch-local space. */
  positions: Float32Array<ArrayBuffer>;
  normals: Float32Array<ArrayBuffer>;
  /** RGBA, one per vertex, 0..255. */
  colors: Uint8Array<ArrayBuffer>;
  /** Visibility-texture index, one per vertex. */
  slots: Uint32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
  /** Express id per slot, for resolving a colour-pick read. */
  expressIdBySlot: Uint32Array<ArrayBuffer>;
  /** The world-space point `positions` are relative to. */
  origin: readonly [number, number, number];
  vertexCount: number;
  indexCount: number;
}

/**
 * One slot per *mesh*, not per element: an element with several material parts
 * gets several slots, all resolving to the same express id, so hiding it means
 * writing each of its slots. The alternative — slot per element — would need a
 * second indirection in the vertex shader for no benefit at this scale.
 */
export function packBatch(meshes: readonly ViewerMesh[]): PackedBatch {
  let vertexCount = 0;
  let indexCount = 0;
  for (const mesh of meshes) {
    vertexCount += mesh.positions.length / 3;
    indexCount += mesh.indices.length;
  }

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Uint8Array(vertexCount * 4);
  const slots = new Uint32Array(vertexCount);
  const indices = new Uint32Array(indexCount);
  const expressIdBySlot = new Uint32Array(meshes.length);

  // Positions are stored relative to the first mesh's origin so a site with
  // large world coordinates keeps float32 precision — the same reason the
  // pipeline hands out per-element origins in the first place.
  const origin = meshes.length > 0 ? meshes[0].origin : ([0, 0, 0] as const);

  let vertexOffset = 0;
  let indexOffset = 0;

  meshes.forEach((mesh, slot) => {
    const meshVertices = mesh.positions.length / 3;
    expressIdBySlot[slot] = mesh.expressId;

    const dx = mesh.origin[0] - origin[0];
    const dy = mesh.origin[1] - origin[1];
    const dz = mesh.origin[2] - origin[2];

    for (let i = 0; i < meshVertices; i++) {
      const source = i * 3;
      const target = (vertexOffset + i) * 3;
      positions[target] = mesh.positions[source] + dx;
      positions[target + 1] = mesh.positions[source + 1] + dy;
      positions[target + 2] = mesh.positions[source + 2] + dz;
      normals[target] = mesh.normals[source];
      normals[target + 1] = mesh.normals[source + 1];
      normals[target + 2] = mesh.normals[source + 2];

      const colorTarget = (vertexOffset + i) * 4;
      colors[colorTarget] = Math.round(mesh.color[0] * 255);
      colors[colorTarget + 1] = Math.round(mesh.color[1] * 255);
      colors[colorTarget + 2] = Math.round(mesh.color[2] * 255);
      colors[colorTarget + 3] = Math.round(mesh.color[3] * 255);

      slots[vertexOffset + i] = slot;
    }

    for (let i = 0; i < mesh.indices.length; i++) {
      indices[indexOffset + i] = mesh.indices[i] + vertexOffset;
    }

    vertexOffset += meshVertices;
    indexOffset += mesh.indices.length;
  });

  return { positions, normals, colors, slots, indices, expressIdBySlot, origin, vertexCount, indexCount };
}

/** Dimensions of the R8 visibility texture that covers `slotCount` slots. */
export function visibilityTextureSize(slotCount: number, width = 2048): { width: number; height: number } {
  return { width, height: Math.max(1, Math.ceil(slotCount / width)) };
}

/**
 * The visibility byte array for a batch. 255 is visible, 0 is not; the vertex
 * shader throws hidden vertices outside the clip volume so their triangles are
 * dropped before rasterization rather than discarded per fragment.
 */
export function visibilityBytes(
  expressIdBySlot: Uint32Array,
  isSlotVisible: (expressId: number) => boolean,
  width = 2048
): Uint8Array<ArrayBuffer> {
  const { height } = visibilityTextureSize(expressIdBySlot.length, width);
  const bytes = new Uint8Array(width * height);
  for (let slot = 0; slot < expressIdBySlot.length; slot++) {
    bytes[slot] = isSlotVisible(expressIdBySlot[slot]) ? 255 : 0;
  }
  return bytes;
}
