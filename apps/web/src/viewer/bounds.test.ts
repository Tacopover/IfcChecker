import { describe, expect, it } from "vitest";
import {
  boundsCenter,
  boundsRadius,
  boundsSize,
  emptyBounds,
  fitDistance,
  growByPoint,
  isEmptyBounds,
  robustBounds,
  unionBounds,
  type Bounds,
} from "./bounds.js";

const box = (min: number, max: number) => ({
  min: { x: min, y: min, z: min },
  max: { x: max, y: max, z: max },
});

describe("emptyBounds", () => {
  it("reports itself empty and absorbs the first real bounds unchanged", () => {
    expect(isEmptyBounds(emptyBounds())).toBe(true);
    expect(unionBounds(emptyBounds(), box(1, 3))).toEqual(box(1, 3));
    expect(unionBounds(box(1, 3), emptyBounds())).toEqual(box(1, 3));
  });

  it("has zero radius, so framing nothing does not divide by it", () => {
    expect(boundsRadius(emptyBounds())).toBe(0);
  });
});

describe("growByPoint", () => {
  it("expands on each axis independently", () => {
    const grown = growByPoint(box(0, 1), { x: -5, y: 0.5, z: 9 });
    expect(grown.min).toEqual({ x: -5, y: 0, z: 0 });
    expect(grown.max).toEqual({ x: 1, y: 1, z: 9 });
  });
});

describe("boundsCenter / boundsSize", () => {
  it("describe an off-origin box", () => {
    const bounds = { min: { x: 2, y: 4, z: 6 }, max: { x: 8, y: 4, z: 10 } };
    expect(boundsCenter(bounds)).toEqual({ x: 5, y: 4, z: 8 });
    expect(boundsSize(bounds)).toEqual({ x: 6, y: 0, z: 4 });
  });
});

describe("fitDistance", () => {
  it("fits the box itself, never looser than the sphere around it", () => {
    // A cube is the case the old bounding-sphere fit handled well, so the
    // corner fit should land just inside it rather than anywhere far off.
    const fovY = Math.PI / 2;
    const distance = fitDistance(box(-1, 1), fovY, 1, 1);
    const sphereFit = Math.sqrt(3) / Math.sin(fovY / 2);

    expect(distance).toBeLessThan(sphereFit);
    expect(distance).toBeGreaterThan(sphereFit * 0.9);
  });

  it("frames a long shallow model on its width, not on its diagonal", () => {
    // The case that made the viewer unusable: a 900 m run of services only a
    // few metres tall. Its width is what the camera has to clear; the old
    // bounding-sphere fit charged for the diagonal and pushed the model under
    // a pixel high.
    const longAndFlat = { min: { x: 0, y: 0, z: 0 }, max: { x: 900, y: 4, z: 12 } };
    const fovY = Math.PI / 4;
    const aspect = 16 / 9;

    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
    const radius = Math.hypot(900, 4, 12) / 2;
    const sphereFit = (radius / Math.sin(Math.min(fovY, fovX) / 2)) * 1.15;

    // Two thirds of the old distance, which is the difference between a model
    // a couple of pixels high and one you can actually work with.
    expect(fitDistance(longAndFlat, fovY, aspect)).toBeLessThan(sphereFit * 0.7);
  });

  it("keeps the model in frame at any yaw it is later orbited to", () => {
    // The guarantee the bounding sphere used to give for free, and the reason
    // the corner fit sweeps yaw rather than solving for one direction.
    const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 40, y: 6, z: 8 } };
    const distance = fitDistance(bounds, Math.PI / 4, 16 / 9, 1, Math.PI / 6);
    const facingLongSide = fitDistance(
      { min: { x: 0, y: 0, z: 0 }, max: { x: 8, y: 6, z: 40 } },
      Math.PI / 4,
      16 / 9,
      1,
      Math.PI / 6
    );

    // Turning the same box a quarter turn asks for the same camera.
    expect(distance).toBeCloseTo(facingLongSide, 6);
  });

  it("backs off further on a narrow viewport, where horizontal fov binds", () => {
    const wide = fitDistance(box(-1, 1), Math.PI / 2, 2, 1);
    const narrow = fitDistance(box(-1, 1), Math.PI / 2, 0.5, 1);
    expect(narrow).toBeGreaterThan(wide);
  });

  it("applies padding as a factor", () => {
    const bare = fitDistance(box(-1, 1), Math.PI / 3, 1.5, 1);
    expect(fitDistance(box(-1, 1), Math.PI / 3, 1.5, 1.15)).toBeCloseTo(bare * 1.15, 9);
  });

  it("never returns zero for empty bounds, so the camera stays somewhere real", () => {
    expect(fitDistance(emptyBounds(), Math.PI / 3, 1)).toBeGreaterThan(0);
  });

  it("frames a flat element — zero thickness on one axis is still framable", () => {
    const slab = { min: { x: -5, y: 0, z: -5 }, max: { x: 5, y: 0, z: 5 } };
    expect(fitDistance(slab, Math.PI / 3, 1.5)).toBeGreaterThan(0);
  });
});

describe("robustBounds", () => {
  const at = (x: number, size = 1): Bounds => ({
    min: { x, y: 0, z: 0 },
    max: { x: x + size, y: size, z: size },
  });

  it("drops the stray element left behind at the project origin", () => {
    // What an exported model actually looks like: a cluster of real geometry a
    // long way from the origin, plus one proxy nobody moved.
    const cluster = Array.from({ length: 40 }, (_, i) => at(900 + i * 0.5));
    const trimmed = robustBounds([...cluster, at(0)]);

    expect(trimmed.min.x).toBeGreaterThan(500);
    expect(trimmed.max.x).toBeCloseTo(920.5, 6);
  });

  it("keeps a genuinely spread-out model whole rather than cropping it", () => {
    // Evenly spaced across a kilometre — no outlier to reject, so the answer
    // must still cover every element.
    const spread = Array.from({ length: 40 }, (_, i) => at(i * 25));
    const trimmed = robustBounds(spread);

    expect(trimmed.min.x).toBeCloseTo(0, 6);
    expect(trimmed.max.x).toBeCloseTo(976, 6);
  });

  it("leaves a small set alone, where one element is too big a share to judge", () => {
    const few = [at(0), at(5), at(900)];
    expect(robustBounds(few)).toEqual(few.reduce(unionBounds, emptyBounds()));
  });

  it("ignores empty boxes and reports empty when there is nothing at all", () => {
    expect(robustBounds([])).toEqual(emptyBounds());
    expect(isEmptyBounds(robustBounds([emptyBounds(), emptyBounds()]))).toBe(true);
  });
});
