import { cameraPosition, viewProjection, type OrbitCamera } from "./camera.js";
import { packBatch, visibilityBytes, visibilityTextureSize, type PackedBatch } from "./meshBatch.js";
import { pickColorToExpressId, type ViewerMesh } from "./meshMapping.js";
import { sectionPlanes, type SectionBox } from "./sectionBox.js";

// A small WebGL2 renderer rather than a general-purpose engine. What it has to
// do is narrow — flat batches, six clip planes, a colour-pick pass — and two of
// the three are things a library would have us fight anyway. Doing it directly
// also keeps the deterministic single-frame hook the verification harness needs.

const VISIBILITY_ROW = 2048;

const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aColor;
layout(location = 3) in uint aSlot;

uniform mat4 uViewProjection;
uniform vec3 uBatchOrigin;
uniform highp usampler2D uVisibility;
uniform uint uSelectedSlot;
uniform bool uPickPass;
uniform highp usampler2D uPickIds;

out vec3 vNormal;
out vec4 vColor;
out vec3 vWorld;

vec4 pickColorFor(uint slot) {
  uint id = texelFetch(uPickIds, ivec2(int(slot) % ${VISIBILITY_ROW}, int(slot) / ${VISIBILITY_ROW}), 0).r;
  return vec4(
    float((id >> 16u) & 255u) / 255.0,
    float((id >> 8u) & 255u) / 255.0,
    float(id & 255u) / 255.0,
    1.0
  );
}

void main() {
  uint visible = texelFetch(
    uVisibility,
    ivec2(int(aSlot) % ${VISIBILITY_ROW}, int(aSlot) / ${VISIBILITY_ROW}),
    0
  ).r;

  if (visible == 0u) {
    // Outside the clip volume, so the whole triangle is dropped before
    // rasterization — cheaper than discarding it fragment by fragment.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vNormal = vec3(0.0);
    vColor = vec4(0.0);
    vWorld = vec3(0.0);
    return;
  }

  vWorld = aPosition + uBatchOrigin;
  vNormal = aNormal;
  vColor = uPickPass
    ? pickColorFor(aSlot)
    : (aSlot == uSelectedSlot ? vec4(1.0, 0.62, 0.16, aColor.a) : aColor);
  gl_Position = uViewProjection * vec4(vWorld, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec4 vColor;
in vec3 vWorld;

uniform vec4 uClipPlanes[6];
uniform bool uClipEnabled;
uniform bool uPickPass;
uniform vec3 uCameraPosition;

out vec4 outColor;

void main() {
  if (uClipEnabled) {
    for (int i = 0; i < 6; i++) {
      if (dot(uClipPlanes[i].xyz, vWorld) + uClipPlanes[i].w < 0.0) discard;
    }
  }

  if (uPickPass) {
    outColor = vColor;
    return;
  }

  // The pipeline documents its winding order as unreliable and its meshes as
  // double-sided, so shading uses the absolute facing rather than the sign —
  // otherwise half the model renders black.
  vec3 normal = normalize(vNormal);
  vec3 toCamera = normalize(uCameraPosition - vWorld);
  float facing = abs(dot(normal, toCamera));
  float shade = 0.35 + 0.65 * facing;

  outColor = vec4(vColor.rgb * shade, vColor.a);
}
`;

interface Batch {
  modelKey: string;
  packed: PackedBatch;
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  visibilityTexture: WebGLTexture;
  pickIdTexture: WebGLTexture;
  /** Slot of the selected element in this batch, or a value no slot can take. */
  selectedSlot: number;
}

export interface RendererOptions {
  /**
   * Keeps the drawing buffer readable after the frame returns. The
   * verification harness reads pixels outside the frame callback, where a
   * discarded buffer reads back as zeros.
   */
  preserveDrawingBuffer?: boolean;
  /** Background, RGBA 0..1. */
  clearColor?: readonly [number, number, number, number];
}

export class WebGLUnavailableError extends Error {
  constructor() {
    super("This browser did not provide a WebGL2 context");
    this.name = "WebGLUnavailableError";
  }
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create program");
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program failed to link: ${log}`);
  }
  return program;
}

export class ViewerRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private readonly batches: Batch[] = [];
  private readonly clearColor: readonly [number, number, number, number];

  private camera: OrbitCamera | null = null;
  private section: SectionBox | null = null;
  private pickTarget: { framebuffer: WebGLFramebuffer; color: WebGLTexture; depth: WebGLRenderbuffer; width: number; height: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    });
    if (!gl) throw new WebGLUnavailableError();

    this.gl = gl;
    this.clearColor = options.clearColor ?? [0.09, 0.1, 0.12, 1];
    this.program = link(gl);
    this.uniforms = Object.fromEntries(
      [
        "uViewProjection",
        "uBatchOrigin",
        "uVisibility",
        "uPickIds",
        "uSelectedSlot",
        "uPickPass",
        "uClipPlanes[0]",
        "uClipEnabled",
        "uCameraPosition",
      ].map((name) => [name, gl.getUniformLocation(this.program, name)])
    );

    gl.enable(gl.DEPTH_TEST);
    // Winding is unreliable, so nothing may be culled by facing.
    gl.disable(gl.CULL_FACE);
  }

  addMeshes(modelKey: string, meshes: readonly ViewerMesh[]): void {
    if (meshes.length === 0) return;
    const gl = this.gl;
    const packed = packBatch(meshes);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Could not create vertex array");
    gl.bindVertexArray(vao);

    const buffers: WebGLBuffer[] = [];
    const attribute = (
      location: number,
      data: BufferSource,
      size: number,
      type: number,
      integer: boolean,
      normalized = false
    ) => {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Could not create buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      if (integer) gl.vertexAttribIPointer(location, size, type, 0, 0);
      else gl.vertexAttribPointer(location, size, type, normalized, 0, 0);
      buffers.push(buffer);
    };

    attribute(0, packed.positions, 3, gl.FLOAT, false);
    attribute(1, packed.normals, 3, gl.FLOAT, false);
    attribute(2, packed.colors, 4, gl.UNSIGNED_BYTE, false, true);
    attribute(3, packed.slots, 1, gl.UNSIGNED_INT, true);

    const indexBuffer = gl.createBuffer();
    if (!indexBuffer) throw new Error("Could not create index buffer");
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, packed.indices, gl.STATIC_DRAW);
    buffers.push(indexBuffer);

    gl.bindVertexArray(null);

    const size = visibilityTextureSize(packed.expressIdBySlot.length, VISIBILITY_ROW);
    const visibilityTexture = this.createLookupTexture(gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, size, visibilityBytes(packed.expressIdBySlot, () => true, VISIBILITY_ROW));

    const pickIds = new Uint32Array(size.width * size.height);
    pickIds.set(packed.expressIdBySlot);
    const pickIdTexture = this.createLookupTexture(gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, size, pickIds);

    this.batches.push({ modelKey, packed, vao, buffers, visibilityTexture, pickIdTexture, selectedSlot: 0xffffffff });
  }

  private createLookupTexture(
    internalFormat: number,
    format: number,
    type: number,
    size: { width: number; height: number },
    data: ArrayBufferView
  ): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Could not create texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, size.width, size.height, 0, format, type, data);
    return texture;
  }

  /** Re-evaluate every slot. A texel write per batch, never a geometry upload. */
  setVisibility(isVisible: (modelKey: string, expressId: number) => boolean): void {
    const gl = this.gl;
    for (const batch of this.batches) {
      const size = visibilityTextureSize(batch.packed.expressIdBySlot.length, VISIBILITY_ROW);
      const bytes = visibilityBytes(
        batch.packed.expressIdBySlot,
        (expressId) => isVisible(batch.modelKey, expressId),
        VISIBILITY_ROW
      );
      gl.bindTexture(gl.TEXTURE_2D, batch.visibilityTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size.width, size.height, gl.RED_INTEGER, gl.UNSIGNED_BYTE, bytes);
    }
  }

  setSelected(modelKey: string | null, expressId: number | null): void {
    for (const batch of this.batches) {
      batch.selectedSlot =
        modelKey === batch.modelKey && expressId !== null
          ? batch.packed.expressIdBySlot.indexOf(expressId)
          : -1;
      if (batch.selectedSlot < 0) batch.selectedSlot = 0xffffffff;
    }
  }

  setCamera(camera: OrbitCamera): void {
    this.camera = camera;
  }

  setSection(section: SectionBox | null): void {
    this.section = section;
  }

  removeModel(modelKey: string): void {
    const gl = this.gl;
    for (let i = this.batches.length - 1; i >= 0; i--) {
      const batch = this.batches[i];
      if (batch.modelKey !== modelKey) continue;
      gl.deleteVertexArray(batch.vao);
      for (const buffer of batch.buffers) gl.deleteBuffer(buffer);
      gl.deleteTexture(batch.visibilityTexture);
      gl.deleteTexture(batch.pickIdTexture);
      this.batches.splice(i, 1);
    }
  }

  get batchCount(): number {
    return this.batches.length;
  }

  /**
   * Draw one frame, synchronously and completely. Never scheduled through
   * requestAnimationFrame internally: under the harness's virtual time budget
   * frames are starved to a handful per second, so anything that depends on a
   * render loop converging never converges.
   */
  renderFrame(): void {
    this.drawInto(null, false);
  }

  /** The colour-pick read. Returns the express id under the pixel, or null. */
  pick(x: number, y: number): { modelKey: string; expressId: number } | null {
    const gl = this.gl;
    const target = this.ensurePickTarget();
    if (!target) return null;

    this.drawInto(target.framebuffer, true);

    const pixel = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    // Framebuffer rows run bottom-up while pointer coordinates run top-down.
    gl.readPixels(x, target.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const expressId = pickColorToExpressId(pixel[0], pixel[1], pixel[2]);
    if (expressId === null) return null;

    const batch = this.batches.find((candidate) => candidate.packed.expressIdBySlot.includes(expressId));
    return batch ? { modelKey: batch.modelKey, expressId } : null;
  }

  private ensurePickTarget() {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width === 0 || height === 0) return null;

    if (this.pickTarget && this.pickTarget.width === width && this.pickTarget.height === height) {
      return this.pickTarget;
    }
    if (this.pickTarget) {
      gl.deleteFramebuffer(this.pickTarget.framebuffer);
      gl.deleteTexture(this.pickTarget.color);
      gl.deleteRenderbuffer(this.pickTarget.depth);
    }

    const color = gl.createTexture();
    const depth = gl.createRenderbuffer();
    const framebuffer = gl.createFramebuffer();
    if (!color || !depth || !framebuffer) throw new Error("Could not create pick target");

    gl.bindTexture(gl.TEXTURE_2D, color);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.pickTarget = { framebuffer, color, depth, width, height };
    return this.pickTarget;
  }

  private drawInto(framebuffer: WebGLFramebuffer | null, pickPass: boolean): void {
    const gl = this.gl;
    const camera = this.camera;
    if (!camera) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width === 0 || height === 0) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, width, height);
    // The pick buffer clears to black because express id 0 is the reserved
    // "nothing here" value, so a miss reads back as a plain zero.
    const [cr, cg, cb, ca] = this.clearColor;
    if (pickPass) gl.clearColor(0, 0, 0, 1);
    else gl.clearColor(cr, cg, cb, ca);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, viewProjection(camera, width / height));
    gl.uniform1i(this.uniforms.uPickPass, pickPass ? 1 : 0);
    gl.uniform1i(this.uniforms.uVisibility, 0);
    gl.uniform1i(this.uniforms.uPickIds, 1);

    const position = cameraPosition(camera);
    gl.uniform3f(this.uniforms.uCameraPosition, position.x, position.y, position.z);

    const section = this.section;
    gl.uniform1i(this.uniforms.uClipEnabled, section?.enabled ? 1 : 0);
    gl.uniform4fv(this.uniforms["uClipPlanes[0]"], new Float32Array(
      (section ? sectionPlanes(section) : DISABLED_PLANES).flatMap((plane) => [...plane])
    ));

    for (const batch of this.batches) {
      gl.bindVertexArray(batch.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, batch.visibilityTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, batch.pickIdTexture);
      gl.uniform3f(this.uniforms.uBatchOrigin, batch.packed.origin[0], batch.packed.origin[1], batch.packed.origin[2]);
      gl.uniform1ui(this.uniforms.uSelectedSlot, pickPass ? 0xffffffff : batch.selectedSlot);
      gl.drawElements(gl.TRIANGLES, batch.packed.indexCount, gl.UNSIGNED_INT, 0);
    }

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const modelKey of [...new Set(this.batches.map((batch) => batch.modelKey))]) {
      this.removeModel(modelKey);
    }
    if (this.pickTarget) {
      gl.deleteFramebuffer(this.pickTarget.framebuffer);
      gl.deleteTexture(this.pickTarget.color);
      gl.deleteRenderbuffer(this.pickTarget.depth);
      this.pickTarget = null;
    }
    gl.deleteProgram(this.program);
  }
}

const DISABLED_PLANES = Array.from({ length: 6 }, () => [0, 0, 0, 1] as const);
