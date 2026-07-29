import { describe, expect, it } from "vitest";
import {
  boundsCenter,
  boundsRadius,
  boundsSize,
  emptyBounds,
  fitDistance,
  growByPoint,
  isEmptyBounds,
  unionBounds,
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
  it("puts the bounding sphere exactly on the frustum edge, times the padding", () => {
    // A 2-unit cube has radius sqrt(3). At a 90° vertical fov and square
    // aspect, sin(45°) = 1/sqrt(2), so the distance is radius * sqrt(2).
    const distance = fitDistance(box(-1, 1), Math.PI / 2, 1, 1);
    expect(distance).toBeCloseTo(Math.sqrt(3) * Math.SQRT2, 6);
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
