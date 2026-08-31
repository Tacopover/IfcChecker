import { boundsCenter, boundsSize, isEmptyBounds, type Bounds, type Vec3 } from "./bounds.js";

// A box clip: six axis-aligned half-spaces, open rather than capped, so a cut
// solid reads as a hollow shell. Capping wants a stencil pass in the renderer;
// the maths here is what decides *what* is cut, and it is the same either way.

/** `[nx, ny, nz, d]`. A point is kept where `dot(n, p) + d >= 0`. */
export type ClipPlane = readonly [number, number, number, number];

export interface SectionBox {
  enabled: boolean;
  bounds: Bounds;
}

export const SECTION_AXES = ["x", "y", "z"] as const;
export type SectionAxis = (typeof SECTION_AXES)[number];

/**
 * Start the box at the model's own extent, grown very slightly so that nothing
 * is clipped until the user actually drags a face. A box sitting exactly on the
 * bounds would cut the outermost triangles by floating-point luck alone.
 */
export function sectionBoxFromBounds(bounds: Bounds, enabled = false): SectionBox {
  if (isEmptyBounds(bounds)) return { enabled, bounds };
  const size = boundsSize(bounds);
  const margin = Math.max(size.x, size.y, size.z) * 1e-3;
  return {
    enabled,
    bounds: {
      min: { x: bounds.min.x - margin, y: bounds.min.y - margin, z: bounds.min.z - margin },
      max: { x: bounds.max.x + margin, y: bounds.max.y + margin, z: bounds.max.z + margin },
    },
  };
}

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

/**
 * Drag one face. `side` picks which of the pair moves; the moving face is
 * stopped at the opposite one rather than allowed through it, because a box
 * inverted by an over-drag clips everything and looks like a crash.
 */
export function moveSectionFace(
  box: SectionBox,
  axis: SectionAxis,
  side: "min" | "max",
  value: number
): SectionBox {
  const min = { ...box.bounds.min };
  const max = { ...box.bounds.max };

  if (side === "min") min[axis] = Math.min(value, max[axis]);
  else max[axis] = Math.max(value, min[axis]);

  return { ...box, bounds: { min, max } };
}

/** Collapse the box onto one element's extent — "section through this thing". */
export function sectionAround(bounds: Bounds): SectionBox {
  return sectionBoxFromBounds(bounds, true);
}

export function sectionBoxCenter(box: SectionBox): Vec3 {
  return boundsCenter(box.bounds);
}
