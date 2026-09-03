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

/** Yaw positions the fit is tested at. The worst case moves smoothly, so this resolves it to well inside the padding. */
const YAW_SAMPLES = 64;

/**
 * How far the camera must sit from the centre for the bounds to fit inside the
 * frustum. Solves the real perspective constraint at every corner of the box —
 * a corner clears the frustum when its sideways offset is within its own depth
 * times the field of view, so the distance each corner demands is
 * `offset / tan(fov/2) - depth`, and the answer is the largest of those.
 *
 * Done corner by corner rather than by fitting the sphere around the box, which
 * is what this used to do: a building model is routinely hundreds of metres
 * long and a few metres tall, and its diagonal asks the camera to back off far
 * enough to leave the model under a pixel high.
 *
 * Still orbit-invariant, which is what the sphere was bought for — the corners
 * are tested at yaws all the way round, so the model cannot swing out of frame
 * once it has been framed. `fovY` and `pitch` are in radians. Returns a
 * distance with `padding` applied as a factor, and never zero: framing a single
 * flat element must still leave the camera somewhere it can see it from.
 */
export function fitDistance(
  bounds: Bounds,
  fovY: number,
  aspect: number,
  padding = 1.15,
  pitch = 0
): number {
  if (isEmptyBounds(bounds)) return padding;

  const size = boundsSize(bounds);
  const half = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
  const tanV = Math.tan(fovY / 2);
  // tan(fovX / 2) for fovX = 2 * atan(tan(fovY / 2) * aspect).
  const tanH = tanV * aspect;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  let required = 0;

  for (let sample = 0; sample < YAW_SAMPLES; sample++) {
    const yaw = (sample / YAW_SAMPLES) * Math.PI * 2;
    const forward = {
      x: -cosPitch * Math.sin(yaw),
      y: -sinPitch,
      z: -cosPitch * Math.cos(yaw),
    };

    // The same basis the view matrix builds — right from forward × world up.
    const rightLength = Math.hypot(-forward.z, forward.x) || 1;
    const right = { x: -forward.z / rightLength, z: forward.x / rightLength };
    const up = {
      x: -right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y,
    };

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const corner = { x: sx * half.x, y: sy * half.y, z: sz * half.z };
          const depth = corner.x * forward.x + corner.y * forward.y + corner.z * forward.z;
          const sideways = Math.abs(corner.x * up.x + corner.y * up.y + corner.z * up.z);
          const across = Math.abs(corner.x * right.x + corner.z * right.z);

          const need = Math.max(sideways / tanV, across / tanH) - depth;
          if (need > required) required = need;
        }
      }
    }
  }

  return required > 0 ? required * padding : padding;
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
