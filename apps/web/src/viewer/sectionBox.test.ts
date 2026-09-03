import { describe, expect, it } from "vitest";
import {
  moveSectionFace,
  sectionAround,
  sectionBoxFromBounds,
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
    expect(section.bounds.max.x).toBeGreaterThanOrEqual(bounds.max.x);
    expect(section.bounds.max.y).toBeGreaterThanOrEqual(bounds.max.y);
    expect(section.bounds.max.z).toBeGreaterThanOrEqual(bounds.max.z);
  });

  it("survives empty bounds rather than producing NaN margins", () => {
    const section = sectionBoxFromBounds({
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
    });
    expect(Number.isNaN(section.bounds.min.x)).toBe(false);
  });
});

describe("moveSectionFace", () => {
  it("moves the named face on the named axis and leaves the others alone", () => {
    const moved = moveSectionFace(box(), "x", "min", 3);
    expect(moved.bounds.min).toEqual({ x: 3, y: 0, z: 0 });
    expect(moved.bounds.max).toEqual(bounds.max);
    expect(moved.bounds.min.x).toBeGreaterThan(2);
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
    expect(section.bounds.min.x).toBeLessThanOrEqual(1);
    expect(section.bounds.max.x).toBeGreaterThanOrEqual(2);
  });
});
