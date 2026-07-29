import { describe, expect, it } from "vitest";
import {
  isInsideSection,
  moveSectionFace,
  sectionAround,
  sectionBoxFromBounds,
  sectionPlanes,
  type SectionBox,
} from "./sectionBox.js";

const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 4, z: 6 } };
const box = (min = bounds.min, max = bounds.max): SectionBox => ({ enabled: true, bounds: { min, max } });

describe("sectionBoxFromBounds", () => {
  it("starts disabled and slightly larger than the model, so nothing is cut until asked", () => {
    const section = sectionBoxFromBounds(bounds);
    expect(section.enabled).toBe(false);
    expect(section.bounds.min.x).toBeLessThan(bounds.min.x);
    expect(section.bounds.max.x).toBeGreaterThan(bounds.max.x);
    expect(isInsideSection({ ...section, enabled: true }, bounds.max)).toBe(true);
  });

  it("survives empty bounds rather than producing NaN margins", () => {
    const section = sectionBoxFromBounds({
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
    });
    expect(Number.isNaN(section.bounds.min.x)).toBe(false);
  });
});

describe("sectionPlanes", () => {
  it("returns six planes that keep points inside the box", () => {
    const planes = sectionPlanes(box());
    expect(planes).toHaveLength(6);

    const keeps = (point: { x: number; y: number; z: number }) =>
      planes.every(([nx, ny, nz, d]) => nx * point.x + ny * point.y + nz * point.z + d >= 0);

    expect(keeps({ x: 5, y: 2, z: 3 })).toBe(true);
    expect(keeps({ x: -0.1, y: 2, z: 3 })).toBe(false);
    expect(keeps({ x: 5, y: 2, z: 6.5 })).toBe(false);
  });

  it("agrees with isInsideSection on the same points", () => {
    const section = box();
    const planes = sectionPlanes(section);
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 4, z: 6 },
      { x: 5, y: 5, z: 3 },
      { x: -1, y: 2, z: 3 },
      { x: 5, y: 2, z: 3 },
    ];

    for (const point of points) {
      const byPlanes = planes.every(([nx, ny, nz, d]) => nx * point.x + ny * point.y + nz * point.z + d >= 0);
      expect(byPlanes).toBe(isInsideSection(section, point));
    }
  });

  it("still yields six planes when disabled, so the shader's array is fixed-size", () => {
    expect(sectionPlanes({ ...box(), enabled: false })).toHaveLength(6);
  });
});

describe("isInsideSection", () => {
  it("keeps everything while disabled", () => {
    expect(isInsideSection({ ...box(), enabled: false }, { x: 1e6, y: 1e6, z: 1e6 })).toBe(true);
  });

  it("treats the faces themselves as inside", () => {
    expect(isInsideSection(box(), { x: 0, y: 0, z: 0 })).toBe(true);
    expect(isInsideSection(box(), { x: 10, y: 4, z: 6 })).toBe(true);
  });
});

describe("moveSectionFace", () => {
  it("moves the named face on the named axis and leaves the others alone", () => {
    const moved = moveSectionFace(box(), "x", "min", 3);
    expect(moved.bounds.min).toEqual({ x: 3, y: 0, z: 0 });
    expect(moved.bounds.max).toEqual(bounds.max);
    expect(isInsideSection(moved, { x: 2, y: 2, z: 3 })).toBe(false);
  });

  it("stops a face at its opposite rather than letting the box invert", () => {
    const overDragged = moveSectionFace(box(), "y", "min", 99);
    expect(overDragged.bounds.min.y).toBe(bounds.max.y);
    expect(overDragged.bounds.min.y).toBeLessThanOrEqual(overDragged.bounds.max.y);

    const under = moveSectionFace(box(), "z", "max", -99);
    expect(under.bounds.max.z).toBe(bounds.min.z);
    expect(under.bounds.max.z).toBeGreaterThanOrEqual(under.bounds.min.z);
  });

  it("does not mutate the box it was given", () => {
    const original = box();
    moveSectionFace(original, "x", "max", 1);
    expect(original.bounds.max.x).toBe(10);
  });
});

describe("sectionAround", () => {
  it("switches clipping on and wraps the given extent", () => {
    const section = sectionAround({ min: { x: 1, y: 1, z: 1 }, max: { x: 2, y: 2, z: 2 } });
    expect(section.enabled).toBe(true);
    expect(isInsideSection(section, { x: 1.5, y: 1.5, z: 1.5 })).toBe(true);
    expect(isInsideSection(section, { x: 5, y: 1.5, z: 1.5 })).toBe(false);
  });
});
