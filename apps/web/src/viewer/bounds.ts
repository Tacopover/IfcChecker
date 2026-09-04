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


/** Smallest share of the elements that has to survive a trim for it to count. */
const TRIM_KEEP_RATIO = 0.75;
/** Below this many elements a single one is too big a share of the model to call an outlier. */
const TRIM_MIN_ELEMENTS = 8;

function percentile(sorted: readonly number[], q: number): number {
  return sorted[Math.floor(q * (sorted.length - 1))];
}

/**
 * Bounds of a set of per-element boxes, ignoring the ones that sit nowhere near
 * the rest. Exported models routinely leave a proxy behind at the project
 * origin while the building itself is hundreds of metres away, and framing the
 * union of the two puts the camera so far back that the building is not a
 * pixel tall.
 *
 * Deliberately conservative: with too few elements to judge, or when trimming
 * would drop a real share of them, it gives back the plain union rather than
 * quietly cropping a model that is genuinely spread across a site.
 */
export function robustBounds(boxes: readonly Bounds[]): Bounds {
  const real = boxes.filter((box) => !isEmptyBounds(box));
  const union = real.reduce(unionBounds, emptyBounds());
  if (real.length < TRIM_MIN_ELEMENTS) return union;

  const centers = real.map(boundsCenter);
  const axes = ["x", "y", "z"] as const;
  const window = axes.map((axis) => {
    const sorted = centers.map((center) => center[axis]).sort((a, b) => a - b);
    const low = percentile(sorted, 0.05);
    const high = percentile(sorted, 0.95);
    // Three times the bulk's own spread on either side: wide enough that
    // nothing merely at the edge of a real model is called an outlier.
    const allowance = (high - low) * 3;
    return { low: low - allowance, high: high + allowance };
  });

  const kept = real.filter((_, index) =>
    axes.every((axis, a) => centers[index][axis] >= window[a].low && centers[index][axis] <= window[a].high)
  );

  if (kept.length < real.length * TRIM_KEEP_RATIO) return union;
  return kept.reduce(unionBounds, emptyBounds());
}
