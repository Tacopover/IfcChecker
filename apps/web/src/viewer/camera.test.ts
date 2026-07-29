import { describe, expect, it } from "vitest";
import {
  cameraBasis,
  cameraPosition,
  dolly,
  frameBounds,
  initialCamera,
  multiplyMat4,
  orbit,
  pan,
  projectionMatrix,
  viewProjection,
  type Mat4,
} from "./camera.js";

const identity = () =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) as Mat4;

/** Apply a column-major 4x4 to a point and divide through by w. */
function project(m: Mat4, p: { x: number; y: number; z: number }) {
  const x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12];
  const y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13];
  const z = m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14];
  const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  return { x: x / w, y: y / w, z: z / w, w };
}

describe("cameraPosition", () => {
  it("sits at the orbit distance from the target", () => {
    const camera = { ...initialCamera(), target: { x: 3, y: 4, z: 5 }, distance: 20 };
    const position = cameraPosition(camera);
    const away = Math.hypot(position.x - 3, position.y - 4, position.z - 5);
    expect(away).toBeCloseTo(20, 6);
  });

  it("looks down from above at positive pitch", () => {
    const camera = { ...initialCamera(), pitch: Math.PI / 4 };
    expect(cameraPosition(camera).y).toBeGreaterThan(camera.target.y);
  });
});

describe("orbit", () => {
  it("clamps pitch short of vertical, where the basis would collapse", () => {
    const straightUp = orbit(initialCamera(), 0, 10);
    expect(straightUp.pitch).toBeLessThan(Math.PI / 2);

    const basis = cameraBasis(straightUp);
    expect(Number.isNaN(basis.right.x)).toBe(false);
    expect(Math.hypot(basis.right.x, basis.right.y, basis.right.z)).toBeCloseTo(1, 6);
  });

  it("clamps in the other direction too", () => {
    expect(orbit(initialCamera(), 0, -10).pitch).toBeGreaterThan(-Math.PI / 2);
  });
});

describe("dolly", () => {
  it("scales distance, so a wheel notch moves the same proportion at any zoom", () => {
    const near = dolly({ ...initialCamera(), distance: 10 }, 0.9);
    const far = dolly({ ...initialCamera(), distance: 1000 }, 0.9);
    expect(near.distance).toBeCloseTo(9, 6);
    expect(far.distance).toBeCloseTo(900, 6);
  });

  it("refuses to pull the camera inside its own near plane", () => {
    const camera = { ...initialCamera(), distance: 10, near: 0.1 };
    expect(dolly(camera, 1e-6).distance).toBeGreaterThanOrEqual(camera.near);
  });
});

describe("pan", () => {
  it("moves the target across the view plane, not along world axes", () => {
    const camera = { ...initialCamera(), yaw: Math.PI / 2, pitch: 0 };
    const moved = pan(camera, 1, 0);
    // Looking down -X, so screen-right is world -Z.
    expect(moved.target.z).toBeCloseTo(-1, 6);
    expect(moved.target.x).toBeCloseTo(0, 6);
  });

  it("keeps the camera the same distance away", () => {
    const camera = initialCamera();
    expect(pan(camera, 3, -2).distance).toBe(camera.distance);
  });
});

describe("frameBounds", () => {
  const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 4, z: 6 } };

  it("centres on the bounds and backs off enough to hold them", () => {
    const framed = frameBounds(initialCamera(), bounds, 1.5);
    expect(framed.target).toEqual({ x: 5, y: 2, z: 3 });
    expect(framed.distance).toBeGreaterThan(6);
  });

  it("puts every corner inside the clip volume", () => {
    const framed = frameBounds(initialCamera(), bounds, 1.5);
    const matrix = viewProjection(framed, 1.5);

    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const clip = project(matrix, { x, y, z });
          expect(clip.w).toBeGreaterThan(0);
          expect(Math.abs(clip.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(clip.y)).toBeLessThanOrEqual(1);
          expect(clip.z).toBeGreaterThanOrEqual(-1);
          expect(clip.z).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  // A site kilometres across and a valve centimetres across cannot share one
  // pair of clip planes without z-fighting at one end or clipping at the other.
  it("rescales the clip planes to the framed distance", () => {
    const site = frameBounds(initialCamera(), { min: { x: 0, y: 0, z: 0 }, max: { x: 2000, y: 50, z: 2000 } }, 1.5);
    const valve = frameBounds(initialCamera(), { min: { x: 0, y: 0, z: 0 }, max: { x: 0.1, y: 0.1, z: 0.1 } }, 1.5);

    expect(site.far).toBeGreaterThan(valve.far);
    expect(valve.near).toBeLessThan(site.near);
    expect(valve.near).toBeGreaterThan(0);
  });

  it("frames a single flat element without collapsing", () => {
    const framed = frameBounds(initialCamera(), { min: { x: 1, y: 2, z: 3 }, max: { x: 1, y: 2, z: 3 } }, 1.5);
    expect(framed.target).toEqual({ x: 1, y: 2, z: 3 });
    expect(framed.distance).toBeGreaterThan(0);
    expect(framed.near).toBeGreaterThan(0);
  });

  it("leaves the camera alone when there is nothing to frame", () => {
    const camera = initialCamera();
    const empty = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
    expect(frameBounds(camera, empty, 1.5)).toEqual(camera);
  });
});

describe("matrices", () => {
  it("multiplying by the identity changes nothing", () => {
    const projection = projectionMatrix(initialCamera(), 1.5);
    expect([...multiplyMat4(projection, identity())]).toEqual([...projection]);
    expect([...multiplyMat4(identity(), projection)]).toEqual([...projection]);
  });

  it("puts the target at the centre of the screen", () => {
    const camera = { ...initialCamera(), target: { x: 7, y: -2, z: 4 } };
    const clip = project(viewProjection(camera, 1.5), camera.target);
    expect(clip.x).toBeCloseTo(0, 5);
    expect(clip.y).toBeCloseTo(0, 5);
  });

  it("projects nearer things to a smaller depth than further ones", () => {
    const camera = { ...initialCamera(), target: { x: 0, y: 0, z: 0 }, distance: 10, yaw: 0, pitch: 0 };
    const matrix = viewProjection(camera, 1);
    const near = project(matrix, { x: 0, y: 0, z: 5 });
    const far = project(matrix, { x: 0, y: 0, z: -5 });
    expect(near.z).toBeLessThan(far.z);
  });
});
