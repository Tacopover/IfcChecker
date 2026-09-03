import { boundsCenter, fitDistance, isEmptyBounds, type Bounds, type Vec3 } from "./bounds.js";

// Orbit camera as data plus matrix maths. Separated from the canvas so
// "where does the camera end up when I frame these elements" is answerable in
// a unit test rather than only by looking at pixels.

export interface OrbitCamera {
  /** What the camera looks at and orbits around. */
  target: Vec3;
  distance: number;
  /** Radians, around the world Y axis. */
  yaw: number;
  /** Radians, from the horizon. Clamped short of the poles. */
  pitch: number;
  fovY: number;
  near: number;
  far: number;
}

/** Just short of vertical: at exactly ±90° the up vector and view direction align and the basis collapses. */
const MAX_PITCH = Math.PI / 2 - 1e-3;

export function initialCamera(): OrbitCamera {
  return {
    target: { x: 0, y: 0, z: 0 },
    distance: 10,
    yaw: Math.PI / 4,
    pitch: Math.PI / 6,
    fovY: Math.PI / 4,
    near: 0.1,
    far: 1000,
  };
}

export function orbit(camera: OrbitCamera, deltaYaw: number, deltaPitch: number): OrbitCamera {
  return {
    ...camera,
    yaw: camera.yaw + deltaYaw,
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, camera.pitch + deltaPitch)),
  };
}

/** Multiplicative so a wheel notch moves the same proportion at every scale. */
export function dolly(camera: OrbitCamera, factor: number): OrbitCamera {
  return { ...camera, distance: Math.max(camera.near * 2, camera.distance * factor) };
}

export function pan(camera: OrbitCamera, right: number, up: number): OrbitCamera {
  const basis = cameraBasis(camera);
  return {
    ...camera,
    target: {
      x: camera.target.x + basis.right.x * right + basis.up.x * up,
      y: camera.target.y + basis.right.y * right + basis.up.y * up,
      z: camera.target.z + basis.right.z * right + basis.up.z * up,
    },
  };
}

export function cameraPosition(camera: OrbitCamera): Vec3 {
  const horizontal = Math.cos(camera.pitch) * camera.distance;
  return {
    x: camera.target.x + horizontal * Math.sin(camera.yaw),
    y: camera.target.y + Math.sin(camera.pitch) * camera.distance,
    z: camera.target.z + horizontal * Math.cos(camera.yaw),
  };
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function cameraBasis(camera: OrbitCamera): { forward: Vec3; right: Vec3; up: Vec3 } {
  const position = cameraPosition(camera);
  const forward = normalize({
    x: camera.target.x - position.x,
    y: camera.target.y - position.y,
    z: camera.target.z - position.z,
  });
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  return { forward, right, up: cross(right, forward) };
}

/**
 * Point the camera at some bounds and back off far enough to hold them. Near
 * and far are re-derived from the distance rather than left fixed: a federated
 * site is kilometres across and a single valve is centimetres, and one pair of
 * planes cannot serve both without z-fighting at one end or clipping at the other.
 */
export function frameBounds(camera: OrbitCamera, bounds: Bounds, aspect: number): OrbitCamera {
  if (isEmptyBounds(bounds)) return camera;

  const distance = fitDistance(bounds, camera.fovY, aspect, 1.15, camera.pitch);
  return {
    ...camera,
    target: boundsCenter(bounds),
    distance,
    near: Math.max(distance / 10_000, 1e-3),
    far: distance * 10,
  };
}

export type Mat4 = Float32Array;

export function viewMatrix(camera: OrbitCamera): Mat4 {
  const position = cameraPosition(camera);
  const { forward, right, up } = cameraBasis(camera);

  // Row-major rotation transposed into column-major, with the translation
  // folded in — the layout WebGL expects without a uniform transpose.
  return new Float32Array([
    right.x, up.x, -forward.x, 0,
    right.y, up.y, -forward.y, 0,
    right.z, up.z, -forward.z, 0,
    -(right.x * position.x + right.y * position.y + right.z * position.z),
    -(up.x * position.x + up.y * position.y + up.z * position.z),
    forward.x * position.x + forward.y * position.y + forward.z * position.z,
    1,
  ]);
}

export function projectionMatrix(camera: OrbitCamera, aspect: number): Mat4 {
  const f = 1 / Math.tan(camera.fovY / 2);
  const range = 1 / (camera.near - camera.far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (camera.near + camera.far) * range, -1,
    0, 0, 2 * camera.near * camera.far * range, 0,
  ]);
}

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

export function viewProjection(camera: OrbitCamera, aspect: number): Mat4 {
  return multiplyMat4(projectionMatrix(camera, aspect), viewMatrix(camera));
}
