// Axis-aligned bounds and the camera maths that frames them. Kept apart from
// the renderer because "where should the camera go to show these elements" is
// the question the results-to-viewer navigation asks, and it should be
// answerable without a GPU.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** An empty range, so unioning into it yields the first real bounds unchanged. */
export function emptyBounds(): Bounds {
  return {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
}

export function isEmptyBounds(bounds: Bounds): boolean {
  return bounds.min.x > bounds.max.x || bounds.min.y > bounds.max.y || bounds.min.z > bounds.max.z;
}

export function growByPoint(bounds: Bounds, point: Vec3): Bounds {
  return {
    min: {
      x: Math.min(bounds.min.x, point.x),
      y: Math.min(bounds.min.y, point.y),
      z: Math.min(bounds.min.z, point.z),
    },
    max: {
      x: Math.max(bounds.max.x, point.x),
      y: Math.max(bounds.max.y, point.y),
      z: Math.max(bounds.max.z, point.z),
    },
  };
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  if (isEmptyBounds(a)) return b;
  if (isEmptyBounds(b)) return a;
  return growByPoint(growByPoint(a, b.min), b.max);
}

export function boundsCenter(bounds: Bounds): Vec3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}

export function boundsSize(bounds: Bounds): Vec3 {
  return {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  };
}

/** Half the diagonal — the radius of the sphere that contains the box. */
export function boundsRadius(bounds: Bounds): number {
  if (isEmptyBounds(bounds)) return 0;
  const size = boundsSize(bounds);
  return Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z) / 2;
}

/**
 * How far the camera must sit from the centre for the bounds to fit inside the
 * frustum. Fits the bounding sphere rather than the box so the answer does not
 * change as the model is orbited — a box that just fits head-on would clip at
 * 45°. When the viewport is narrower than it is tall the horizontal field of
 * view is the binding constraint, so both are considered.
 *
 * `fovY` is in radians. Returns a distance with `padding` applied as a factor,
 * and never zero — framing a single flat element must still leave the camera
 * somewhere it can see it from.
 */
export function fitDistance(bounds: Bounds, fovY: number, aspect: number, padding = 1.15): number {
  const radius = boundsRadius(bounds);
  if (radius === 0) return padding;

  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
  const binding = Math.min(fovY, fovX);
  return (radius / Math.sin(binding / 2)) * padding;
}
