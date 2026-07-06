import * as THREE from "three";
import { GPUComputationRenderer, type Variable } from "three/addons/misc/GPUComputationRenderer.js";
import type { EngineApi, EngineStats, OverlayApi, ShapeId, SkinId } from "../app/contracts";
import { shapes } from "./shapes";
import { textToPoints } from "./text-targets";

/** Ashima 3D simplex noise + billig curl-approximation. */
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
vec3 curlNoise(vec3 p){
  const float e = 0.12;
  float n1 = snoise(vec3(p.x, p.y + e, p.z));
  float n2 = snoise(vec3(p.x, p.y - e, p.z));
  float n3 = snoise(vec3(p.x, p.y, p.z + e));
  float n4 = snoise(vec3(p.x, p.y, p.z - e));
  float n5 = snoise(vec3(p.x + e, p.y, p.z));
  float n6 = snoise(vec3(p.x - e, p.y, p.z));
  return normalize(vec3(n2 - n1 - n4 + n3, n4 - n3 - n6 + n5, n6 - n5 - n2 + n1) + 1e-6) * 0.8;
}
`;

const VELOCITY_SHADER = /* glsl */ `
uniform float uTime;
uniform float uDt;
uniform float uAttract;
uniform float uDamp;
uniform float uCurlAmp;
uniform float uCurlScale;
uniform float uGravity;
uniform float uFloorY;
uniform float uDrift;
uniform float uFlowX;
uniform vec4 uShock[4];
uniform vec4 uVortex;
uniform sampler2D uTarget;

${NOISE_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(texturePosition, uv).xyz;
  vec3 vel = texture2D(textureVelocity, uv).xyz;
  vec3 target = texture2D(uTarget, uv).xyz;

  if (uGravity < 0.5) {
    vel += (target - pos) * uAttract * uDt;
  }
  vel += curlNoise(pos * uCurlScale + vec3(0.0, 0.0, uTime * 0.07)) * uCurlAmp * uDt;
  vel.x += uFlowX * uDt;
  vel.y -= uDrift * 1.6 * uDt;

  for (int i = 0; i < 4; i++) {
    float age = uTime - uShock[i].z;
    if (uShock[i].w > 0.0 && age > 0.0 && age < 1.4) {
      float r = age * 6.5;
      vec2 d2 = pos.xy - uShock[i].xy;
      float dist = length(d2) + 0.0001;
      float band = exp(-pow((dist - r) * 2.0, 2.0));
      vel.xy += (d2 / dist) * band * uShock[i].w * 7.0 * uDt / (0.4 + age);
    }
  }

  if (uVortex.w > 0.5) {
    vec2 toC = uVortex.xy - pos.xy;
    float d = length(toC) + 0.001;
    vec2 tangent = vec2(-toC.y, toC.x) / d;
    float f = uVortex.z / (0.6 + d * d * 0.22);
    vel.xy += (tangent * f * 1.7 + (toC / d) * f * 0.8) * uDt;
  }

  if (uGravity > 0.5) {
    vel.y -= 7.5 * uDt;
    if (pos.y <= uFloorY && vel.y < 0.0) {
      vel.y *= -0.34;
      vel.xz *= 0.9;
    }
  }

  vel *= pow(uDamp, uDt * 60.0);
  gl_FragColor = vec4(vel, 1.0);
}
`;

const POSITION_SHADER = /* glsl */ `
uniform float uDt;
uniform float uGravity;
uniform float uFloorY;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posW = texture2D(texturePosition, uv);
  vec3 vel = texture2D(textureVelocity, uv).xyz;
  vec3 pos = posW.xyz + vel * uDt;
  if (uGravity > 0.5 && pos.y < uFloorY) pos.y = uFloorY;
  gl_FragColor = vec4(pos, posW.w);
}
`;

const RENDER_VERTEX = /* glsl */ `
uniform sampler2D uPosTex;
uniform float uSize;
varying float vRand;
varying float vDepth;

void main() {
  vec4 posW = texture2D(uPosTex, position.xy);
  vRand = posW.w;
  vec4 mv = modelViewMatrix * vec4(posW.xyz, 1.0);
  vDepth = clamp(1.0 - (-mv.z - 4.0) / 16.0, 0.12, 1.0);
  gl_PointSize = uSize * (0.5 + vRand * 0.9) * (34.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const RENDER_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uWhite;
uniform float uOpacity;
varying float vRand;
varying float vDepth;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.08, d) * uOpacity * vDepth;
  if (alpha < 0.008) discard;
  vec3 col = mix(uColor, uWhite, vRand * 0.55);
  gl_FragColor = vec4(col, alpha);
}
`;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

class Overlay implements OverlayApi {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
  private points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private mat: THREE.PointsMaterial;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, count: number, size: number) {
    this.scene = scene;
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.mat = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  setVisible(v: boolean): void {
    this.points.visible = v;
  }

  sync(): void {
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}

const SKIN_PRESETS: Record<SkinId, { accentOverride?: string; white: string; whiteLight: string; opacity: number; size: number }> = {
  default: { white: "#e8e6ff", whiteLight: "#1a1a2e", opacity: 0.42, size: 1 },
  matrix: { accentOverride: "#00ff66", white: "#b8ffd0", whiteLight: "#043d1a", opacity: 0.5, size: 1 },
  wire: { white: "#9ecbff", whiteLight: "#10243d", opacity: 0.34, size: 0.62 },
  gold: { accentOverride: "#ffc14d", white: "#ffe9bd", whiteLight: "#4d3505", opacity: 0.48, size: 1.05 },
};

export class GpgpuEngine implements EngineApi {
  paused = false;
  reducedMotion = false;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private gpu!: GPUComputationRenderer;
  private posVar!: Variable;
  private velVar!: Variable;
  private targetTex!: THREE.DataTexture;
  private points!: THREE.Points;
  private renderMat!: THREE.ShaderMaterial;
  private size: number;

  private shape: ShapeId = "galaxy";
  private morphToken = 0;
  private targetColor = new THREE.Color("#7c6cff");
  private accentHex = "#7c6cff";
  private skin: SkinId = "default";
  private theme: "dark" | "light" = "dark";
  private targetOffsetX = 0;
  private scrollY = 0;
  /** Under punkt/text-morfar rätas fältet upp så texten blir läsbar. */
  private focusUntil = 0;
  private rotY = 0;
  private shapeCache = new Map<string, Float32Array>();
  private lastWeather: { windX: number; windY: number; drift: number; dim: number } | null = null;
  private mouse = { x: 0, y: 0 };
  private smoothMouse = { x: 0, y: 0 };
  private shockSlot = 0;
  private weatherDim = 0;
  private running = true;
  private clock = new THREE.Clock();
  private simTime = 0;
  private frameMs = 16;
  private fps = 60;
  private probeDone = false;
  private probeAccum = 0;
  private probeFrames = 0;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private baseTilt = -0.34;

  constructor(canvas: HTMLCanvasElement) {
    const lowEnd = window.innerWidth < 768 || navigator.hardwareConcurrency <= 4;
    this.size = lowEnd ? 256 : 512;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.position.z = 9;

    this.initSim();
    this.initPoints();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", () => {
      this.running = !document.hidden;
      if (this.running) this.clock.getDelta();
    });
    canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
    canvas.addEventListener("webglcontextrestored", () => this.rebuild(this.size));

    this.tick();
  }

  private cachedShape(id: ShapeId): Float32Array {
    const key = `${id}:${this.size}`;
    let arr = this.shapeCache.get(key);
    if (!arr) {
      arr = shapes[id](this.size * this.size);
      this.shapeCache.set(key, arr);
    }
    return arr;
  }

  /** Kastar om GPGPU inte stöds — anroparen faller tillbaka till CPU-motorn. */
  private initSim(): void {
    this.gpu = new GPUComputationRenderer(this.size, this.size, this.renderer);
    const pos0 = this.gpu.createTexture();
    const vel0 = this.gpu.createTexture();
    this.fillPositionTexture(pos0, shapes.galaxy(this.size * this.size));

    this.velVar = this.gpu.addVariable("textureVelocity", VELOCITY_SHADER, vel0);
    this.posVar = this.gpu.addVariable("texturePosition", POSITION_SHADER, pos0);
    this.gpu.setVariableDependencies(this.velVar, [this.posVar, this.velVar]);
    this.gpu.setVariableDependencies(this.posVar, [this.posVar, this.velVar]);

    this.targetTex = this.makeTargetTexture(shapes.galaxy(this.size * this.size));

    const vu = this.velVar.material.uniforms;
    vu.uTime = { value: 0 };
    vu.uDt = { value: 0.016 };
    vu.uAttract = { value: 3.6 };
    vu.uDamp = { value: 0.9 };
    vu.uCurlAmp = { value: 0.35 };
    vu.uCurlScale = { value: 0.55 };
    vu.uGravity = { value: 0 };
    vu.uFloorY = { value: -3.6 };
    vu.uDrift = { value: 0 };
    vu.uFlowX = { value: 0 };
    vu.uShock = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
    vu.uVortex = { value: new THREE.Vector4() };
    vu.uTarget = { value: this.targetTex };

    const pu = this.posVar.material.uniforms;
    pu.uDt = { value: 0.016 };
    pu.uGravity = { value: 0 };
    pu.uFloorY = { value: -3.6 };

    const error = this.gpu.init();
    if (error !== null) {
      throw new Error(`GPGPU init failed: ${error}`);
    }
  }

  private initPoints(): void {
    const count = this.size * this.size;
    const geo = new THREE.BufferGeometry();
    const refs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      refs[i * 3] = ((i % this.size) + 0.5) / this.size;
      refs[i * 3 + 1] = (Math.floor(i / this.size) + 0.5) / this.size;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(refs, 3));

    this.renderMat = new THREE.ShaderMaterial({
      vertexShader: RENDER_VERTEX,
      fragmentShader: RENDER_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPosTex: { value: null },
        uSize: { value: this.size === 512 ? 1.15 : 2.0 },
        uColor: { value: new THREE.Color("#7c6cff") },
        uWhite: { value: new THREE.Color("#e8e6ff") },
        uOpacity: { value: 0.42 },
      },
    });

    this.points = new THREE.Points(geo, this.renderMat);
    this.points.frustumCulled = false;
    this.points.rotation.x = this.baseTilt;
    this.scene.add(this.points);
  }

  private fillPositionTexture(tex: THREE.DataTexture, shape: Float32Array): void {
    const arr = tex.image.data as Float32Array;
    const count = this.size * this.size;
    for (let i = 0; i < count; i++) {
      arr[i * 4] = shape[i * 3];
      arr[i * 4 + 1] = shape[i * 3 + 1];
      arr[i * 4 + 2] = shape[i * 3 + 2];
      arr[i * 4 + 3] = Math.random();
    }
  }

  private makeTargetTexture(shape: Float32Array): THREE.DataTexture {
    const count = this.size * this.size;
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4] = shape[i * 3];
      data[i * 4 + 1] = shape[i * 3 + 1];
      data[i * 4 + 2] = shape[i * 3 + 2];
      data[i * 4 + 3] = 1;
    }
    const tex = new THREE.DataTexture(data, this.size, this.size, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    return tex;
  }

  private setTargetFromArray(shape: Float32Array): void {
    const data = this.targetTex.image.data as Float32Array;
    const count = this.size * this.size;
    for (let i = 0; i < count; i++) {
      data[i * 4] = shape[i * 3];
      data[i * 4 + 1] = shape[i * 3 + 1];
      data[i * 4 + 2] = shape[i * 3 + 2];
    }
    this.targetTex.needsUpdate = true;
  }

  // ---------- EngineApi ----------

  setShape(id: ShapeId, instant = false): void {
    this.shape = id;
    this.morphToken++;
    this.focusUntil = 0;
    this.setTargetFromArray(this.cachedShape(id));
    if (instant || this.reducedMotion) {
      this.velVar.material.uniforms.uAttract.value = 30;
      setTimeout(() => {
        this.velVar.material.uniforms.uAttract.value = this.reducedMotion ? 30 : 3.6;
      }, 400);
    }
  }

  currentShape(): ShapeId {
    return this.shape;
  }

  morphToPoints(points: Float32Array, holdMs = 4000): void {
    const token = ++this.morphToken;
    const upscaled = this.upscale(points);
    this.setTargetFromArray(upscaled);
    // räta upp fältet under morphen — annars roteras texten oläslig
    this.focusUntil = performance.now() + holdMs + 600;
    setTimeout(() => {
      if (this.morphToken === token) {
        this.morphToken++;
        this.focusUntil = 0;
        this.setTargetFromArray(this.cachedShape(this.shape));
      }
    }, holdMs);
  }

  morphToText(text: string, holdMs = 3000): void {
    const bounds = this.worldBounds();
    void textToPoints(text, this.size * this.size, Math.min(bounds.halfW * 1.5, 8.5)).then((pts) => {
      this.morphToPoints(pts, holdMs);
    });
  }

  /** Punktmoln med färre punkter än simstorleken cyklas med jitter. */
  private upscale(points: Float32Array): Float32Array {
    const count = this.size * this.size;
    const src = points.length / 3;
    if (src >= count) return points;
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const j = (i % src) * 3;
      out[i * 3] = points[j] + (Math.random() - 0.5) * 0.05;
      out[i * 3 + 1] = points[j + 1] + (Math.random() - 0.5) * 0.05;
      out[i * 3 + 2] = points[j + 2] + (Math.random() - 0.5) * 0.05;
    }
    return out;
  }

  shockwave(clientX: number, clientY: number, strength = 1): void {
    const w = this.screenToWorld(clientX, clientY);
    this.shockwaveWorld(w.x, w.y, strength);
  }

  /** Simmen jobbar i meshens lokala rum — transformera världspunkten dit. */
  private worldToSim(x: number, y: number): { x: number; y: number } {
    this.points.updateMatrixWorld();
    const local = this.points.worldToLocal(new THREE.Vector3(x, y, 0));
    return { x: local.x, y: local.y };
  }

  shockwaveWorld(x: number, y: number, strength = 1): void {
    if (this.reducedMotion) return;
    const p = this.worldToSim(x, y);
    const slot = this.velVar.material.uniforms.uShock.value[this.shockSlot] as THREE.Vector4;
    slot.set(p.x, p.y, this.simTime, strength);
    this.shockSlot = (this.shockSlot + 1) % 4;
  }

  vortex(clientX: number, clientY: number, active: boolean): void {
    if (this.reducedMotion) return;
    const v = this.velVar.material.uniforms.uVortex.value as THREE.Vector4;
    if (active) {
      const w = this.screenToWorld(clientX, clientY);
      const p = this.worldToSim(w.x, w.y);
      v.set(p.x, p.y, 2.2, 1);
    } else {
      v.w = 0;
    }
  }

  setGravity(on: boolean): void {
    if (this.reducedMotion) return;
    this.velVar.material.uniforms.uGravity.value = on ? 1 : 0;
    this.posVar.material.uniforms.uGravity.value = on ? 1 : 0;
  }

  setSkin(skin: SkinId): void {
    this.skin = skin;
    this.applyColors();
  }

  setWeather(w: { windX: number; windY: number; drift: number; dim: number } | null): void {
    this.lastWeather = w;
    const vu = this.velVar.material.uniforms;
    vu.uFlowX.value = w ? w.windX * 0.5 : 0;
    vu.uDrift.value = w ? w.drift : 0;
    this.weatherDim = w ? w.dim : 0;
  }

  setAccent(hex: string): void {
    this.accentHex = hex;
    this.applyColors();
  }

  private applyColors(): void {
    const preset = SKIN_PRESETS[this.skin];
    this.targetColor.set(preset.accentOverride ?? this.accentHex);
    (this.renderMat.uniforms.uWhite.value as THREE.Color).set(
      this.theme === "dark" ? preset.white : preset.whiteLight
    );
    this.renderMat.uniforms.uSize.value = (this.size === 512 ? 1.15 : 2.0) * preset.size;
  }

  burst(tier: 1 | 2 | 3 = 1): void {
    if (tier === 1) {
      this.morphToPoints(shapes.scatter(4096), 900);
    } else {
      this.shockwaveWorld(0, 0, tier === 2 ? 3 : 4);
      if (tier === 3) this.morphToPoints(shapes.scatter(4096), 700);
    }
  }

  createOverlay(count: number, opts?: { size?: number }): OverlayApi {
    return new Overlay(this.scene, count, opts?.size ?? 0.06);
  }

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, hit);
    return { x: hit.x, y: hit.y };
  }

  worldBounds(): { halfW: number; halfH: number } {
    const halfH = Math.tan(((this.camera.fov / 2) * Math.PI) / 180) * 9;
    return { halfW: halfH * this.camera.aspect, halfH };
  }

  stats(): EngineStats {
    return {
      mode: "gpgpu",
      particleCount: this.size * this.size,
      fps: Math.round(this.fps),
      frameMs: Math.round(this.frameMs * 10) / 10,
      drawCalls: this.renderer.info.render.calls,
      shape: this.shape,
    };
  }

  // ---------- app-interna (utanför FeatureContext-kontraktet) ----------

  setTheme(mode: "dark" | "light"): void {
    this.theme = mode;
    this.renderMat.blending = mode === "light" ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.renderMat.needsUpdate = true;
    this.applyColors();
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    const vu = this.velVar.material.uniforms;
    vu.uCurlAmp.value = on ? 0 : 0.35;
    if (on) vu.uAttract.value = 30;
  }

  setOffsetX(x: number): void {
    this.targetOffsetX = x;
  }

  setScroll(y: number): void {
    this.scrollY = y;
  }

  /** Sim-parametrar för debug-HUD:en. */
  simParams(): { uniforms: Record<string, THREE.IUniform> } {
    return { uniforms: this.velVar.material.uniforms as Record<string, THREE.IUniform> };
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  private maybeDowngrade(dt: number): void {
    if (this.probeDone || this.size <= 256) return;
    // mät bara synlig tid — en bakgrundsflik ska inte lura proben
    this.probeAccum += dt;
    this.probeFrames++;
    if (this.probeAccum < 4 || this.probeFrames < 90) return;
    this.probeDone = true;
    if (this.frameMs > 26) {
      // för tungt — bygg om simuleringen i kvartsstorlek
      this.rebuild(256);
    }
  }

  private rebuild(size: number): void {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.renderMat.dispose();
    this.targetTex.dispose();
    this.gpu.dispose();
    this.size = size;
    this.initSim();
    this.initPoints();
    // återställ allt tillstånd som bor i sim-uniforms
    this.setShape(this.shape, true);
    this.setTheme(this.theme);
    this.setReducedMotion(this.reducedMotion);
    this.setWeather(this.lastWeather);
    this.applyColors();
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.simTime += dt;
    const t = this.simTime;
    this.frameMs = this.frameMs * 0.92 + dt * 1000 * 0.08;
    this.fps = 1000 / Math.max(this.frameMs, 0.01);
    this.maybeDowngrade(dt);

    const vu = this.velVar.material.uniforms;
    vu.uTime.value = t;
    vu.uDt.value = dt;
    this.posVar.material.uniforms.uDt.value = dt;

    this.gpu.compute();
    this.renderMat.uniforms.uPosTex.value = this.gpu.getCurrentRenderTarget(this.posVar).texture;

    // färg + väderdimning — opaciteten skalas efter partikeldensitet
    (this.renderMat.uniforms.uColor.value as THREE.Color).lerp(this.targetColor, 0.04);
    const density = this.size === 512 ? 0.4 : 0.8;
    const baseOpacity = SKIN_PRESETS[this.skin].opacity * density * (this.theme === "light" ? 1.55 : 1);
    const targetOpacity = baseOpacity * (1 - this.weatherDim * 0.5);
    this.renderMat.uniforms.uOpacity.value += (targetOpacity - this.renderMat.uniforms.uOpacity.value) * 0.05;

    // rotation + offset: paus (spel) och textmorf centrerar/rätar upp fältet
    const focusing = performance.now() < this.focusUntil;
    if (this.paused) {
      this.points.rotation.y *= 0.94;
      this.points.rotation.x += (0 - this.points.rotation.x) * 0.06;
      this.points.position.x *= 0.92;
      this.rotY = this.points.rotation.y;
    } else if (focusing) {
      // räta upp mot närmaste helvarv så texten blir läsbar — utan snäpp efteråt
      const total = this.rotY + this.scrollY * 0.6;
      const nearest = Math.round(total / (Math.PI * 2)) * Math.PI * 2;
      this.rotY += (nearest - total) * 0.08;
      this.points.rotation.y = this.rotY + this.scrollY * 0.6;
      this.points.rotation.x += (this.baseTilt * 0.3 - this.points.rotation.x) * 0.06;
      this.points.position.x *= 0.94;
    } else {
      if (!this.reducedMotion) {
        this.rotY += dt * 0.05;
        this.points.rotation.y = this.rotY + this.scrollY * 0.6;
        this.points.rotation.x = this.baseTilt + Math.sin(t * 0.03) * 0.05;
      } else {
        this.points.rotation.x = this.baseTilt;
      }
      const effectiveOffset = window.innerWidth < 900 ? 0 : this.targetOffsetX;
      this.points.position.x += (effectiveOffset - this.points.position.x) * 0.035;
    }

    this.smoothMouse.x += (this.mouse.x - this.smoothMouse.x) * 0.04;
    this.smoothMouse.y += (this.mouse.y - this.smoothMouse.y) * 0.04;
    this.camera.position.x = this.smoothMouse.x * 0.7;
    this.camera.position.y = -this.smoothMouse.y * 0.5;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  };
}

export { easeInOutCubic };
