import { describe, expect, it } from "vitest";
import {
  boundsCenter,
  boundsRadius,
  boundsSize,
  emptyBounds,
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
