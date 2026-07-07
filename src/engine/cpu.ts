import * as THREE from "three";
import type { EngineApi, EngineStats, OverlayApi, ShapeId, SkinId } from "../app/contracts";
import { shapes } from "./shapes";
import { textToPoints } from "./text-targets";
import { easeInOutCubic } from "./gpgpu";

const CPU_VERTEX = /* glsl */ `
attribute float aRand;
uniform float uTime;
uniform float uSize;
uniform float uWobble;
varying float vRand;
varying float vDepth;

void main() {
  vRand = aRand;
  vec3 pos = position;
  float w = uWobble * (0.5 + aRand * 0.5);
  pos.x += sin(uTime * 0.55 + aRand * 6.2831 + position.y * 1.7) * 0.05 * w;
  pos.y += cos(uTime * 0.48 + aRand * 6.2831 + position.x * 1.3) * 0.05 * w;
  pos.z += sin(uTime * 0.62 + aRand * 6.2831 + position.z * 1.5) * 0.05 * w;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vDepth = clamp(1.0 - (-mv.z - 4.0) / 14.0, 0.15, 1.0);
  gl_PointSize = uSize * (0.5 + aRand * 0.9) * (36.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const CPU_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uWhite;
uniform float uOpacity;
varying float vRand;
varying float vDepth;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.08, d) * uOpacity * vDepth;
  if (alpha < 0.01) discard;
  vec3 col = mix(uColor, uWhite, vRand * 0.55);
  gl_FragColor = vec4(col, alpha);
}
`;

class Overlay implements OverlayApi {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
  private points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private mat: THREE.PointsMaterial;
  private scene: THREE.Scene;
  private onDispose: (() => void) | null = null;

  constructor(scene: THREE.Scene, count: number, size: number, onDispose?: () => void) {
    this.scene = scene;
    this.onDispose = onDispose ?? null;
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

  /** Additivt ljus syns inte på ljus botten — mörka ner via materialfärgen. */
  applyTheme(mode: "dark" | "light"): void {
    this.mat.blending = mode === "light" ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.mat.color.set(mode === "light" ? "#232340" : "#ffffff");
    this.mat.needsUpdate = true;
  }

  sync(): void {
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.onDispose?.();
    this.scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Reservmotor: CPU-lerpad morf som ursprungssajten — funkar överallt. */
export class CpuEngine implements EngineApi {
  paused = false;
  reducedMotion = false;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;
  private count: number;

  private from: Float32Array;
  private to: Float32Array;
  private morphStart = -1;
  private morphDuration = 1400;
  private shape: ShapeId = "galaxy";
  private morphToken = 0;

  private targetColor = new THREE.Color("#7c6cff");
  private accentHex = "#7c6cff";
  private skin: SkinId = "default";
  private theme: "dark" | "light" = "dark";
  private targetOffsetX = 0;
  private scrollY = 0;
  private focusUntil = 0;
  private rotY = 0;
  private mouse = { x: 0, y: 0 };
  private smoothMouse = { x: 0, y: 0 };
  private weatherDim = 0;
  private running = true;
  private clock = new THREE.Clock();
  private frameMs = 16;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private baseTilt = -0.34;

  constructor(canvas: HTMLCanvasElement) {
    this.count = window.innerWidth < 768 || navigator.hardwareConcurrency <= 4 ? 7000 : 15000;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camera.position.z = 9;

    this.geometry = new THREE.BufferGeometry();
    const initial = shapes.galaxy(this.count);
    this.from = initial.slice();
    this.to = initial.slice();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(initial, 3));
    const rand = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) rand[i] = Math.random();
    this.geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: CPU_VERTEX,
      fragmentShader: CPU_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: this.count > 10000 ? 1.7 : 2.0 },
        uWobble: { value: 1 },
        uColor: { value: new THREE.Color("#7c6cff") },
        uWhite: { value: new THREE.Color("#e8e6ff") },
        uOpacity: { value: 0.42 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.rotation.x = this.baseTilt;
    this.scene.add(this.points);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", () => {
      this.running = !document.hidden;
      if (this.running) this.clock.getDelta();
    });
    // three.js återuppladdar sina buffertar vid restore — pausa och återuppta bara
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.running = false;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.running = !document.hidden;
      if (this.running) this.clock.getDelta();
    });

    this.tick();
  }

  private startMorph(target: Float32Array, instant: boolean): void {
    const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    this.from.set(pos.array as Float32Array);
    this.to = target;
    if (instant || this.reducedMotion) {
      (pos.array as Float32Array).set(this.to);
      pos.needsUpdate = true;
      this.morphStart = -1;
    } else {
      this.morphStart = performance.now();
    }
  }

  setShape(id: ShapeId, instant = false): void {
    this.shape = id;
    this.morphToken++;
    this.focusUntil = 0;
    this.startMorph(shapes[id](this.count), instant);
  }

  currentShape(): ShapeId {
    return this.shape;
  }

  morphToPoints(points: Float32Array, holdMs = 4000): void {
    const token = ++this.morphToken;
    const target = new Float32Array(this.count * 3);
    const src = points.length / 3;
    for (let i = 0; i < this.count; i++) {
      const j = (i % src) * 3;
      target[i * 3] = points[j];
      target[i * 3 + 1] = points[j + 1];
      target[i * 3 + 2] = points[j + 2];
    }
    this.startMorph(target, false);
    this.focusUntil = performance.now() + holdMs + 600;
    setTimeout(() => {
      if (this.morphToken === token) {
        this.morphToken++;
        this.focusUntil = 0;
        this.startMorph(shapes[this.shape](this.count), false);
      }
    }, holdMs);
  }

  morphToText(text: string, holdMs = 3000): void {
    const bounds = this.worldBounds();
    void textToPoints(text, this.count, Math.min(bounds.halfW * 1.5, 8.5)).then((pts) => {
      this.morphToPoints(pts, holdMs);
    });
  }

  shockwave(): void {
    // ingen fysik i CPU-läget — tyst no-op
  }

  shockwaveWorld(): void {
    // no-op
  }

  vortex(): void {
    // no-op
  }

  setGravity(): void {
    // no-op
  }

  setSkin(skin: SkinId): void {
    this.skin = skin;
    this.applyColors();
  }

  setWeather(w: { windX: number; windY: number; drift: number; dim: number } | null): void {
    this.weatherDim = w ? w.dim : 0;
  }

  setAccent(hex: string): void {
    this.accentHex = hex;
    this.applyColors();
  }

  private applyColors(): void {
    const dark = this.theme === "dark";
    const presets: Record<SkinId, [string, string, string]> = {
      default: [this.accentHex, "#e8e6ff", "#1a1a2e"],
      matrix: ["#00ff66", "#b8ffd0", "#043d1a"],
      wire: [this.accentHex, "#9ecbff", "#10243d"],
      gold: ["#ffc14d", "#ffe9bd", "#4d3505"],
    };
    const [accent, white, whiteLight] = presets[this.skin];
    this.targetColor.set(accent);
    (this.material.uniforms.uWhite.value as THREE.Color).set(dark ? white : whiteLight);
  }

  burst(): void {
    this.morphToPoints(shapes.scatter(4096), 900);
  }

  private holeActive = false;

  blackHole(): void {
    // samma vakter som GPGPU-motorn: spel/reducerad rörelse får bara en burst
    if (this.reducedMotion || this.paused || this.holeActive) {
      this.burst();
      return;
    }
    this.holeActive = true;
    setTimeout(() => (this.holeActive = false), 2800);
    // CPU-approximation: kollapsa till en tät kärna, explodera sedan
    const core = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.35;
      core[i * 3] = Math.cos(a) * r;
      core[i * 3 + 1] = Math.sin(a) * r * 0.4;
      core[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    this.morphToPoints(core, 2600);
    setTimeout(() => this.burst(), 2700);
  }

  private overlays = new Set<Overlay>();

  createOverlay(count: number, opts?: { size?: number }): OverlayApi {
    const overlay: Overlay = new Overlay(this.scene, count, opts?.size ?? 0.06, () => this.overlays.delete(overlay));
    overlay.applyTheme(this.theme);
    this.overlays.add(overlay);
    return overlay;
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
      mode: "cpu",
      particleCount: this.count,
      fps: Math.round(1000 / Math.max(this.frameMs, 0.01)),
      frameMs: Math.round(this.frameMs * 10) / 10,
      drawCalls: this.renderer.info.render.calls,
      shape: this.shape,
    };
  }

  setTheme(mode: "dark" | "light"): void {
    this.theme = mode;
    this.material.blending = mode === "light" ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.material.needsUpdate = true;
    this.overlays.forEach((o) => o.applyTheme(mode));
    this.applyColors();
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    this.material.uniforms.uWobble.value = on ? 0 : 1;
  }

  setOffsetX(x: number): void {
    this.targetOffsetX = x;
  }

  setScroll(y: number): void {
    this.scrollY = y;
  }

  simParams(): { uniforms: Record<string, THREE.IUniform> } {
    return { uniforms: this.material.uniforms as Record<string, THREE.IUniform> };
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

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.getElapsedTime();
    this.frameMs = this.frameMs * 0.92 + dt * 1000 * 0.08;
    this.material.uniforms.uTime.value = t;

    if (this.morphStart >= 0) {
      const raw = (performance.now() - this.morphStart) / this.morphDuration;
      const e = easeInOutCubic(Math.min(raw, 1));
      const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i++) {
        arr[i] = this.from[i] + (this.to[i] - this.from[i]) * e;
      }
      pos.needsUpdate = true;
      if (raw >= 1) this.morphStart = -1;
    }

    (this.material.uniforms.uColor.value as THREE.Color).lerp(this.targetColor, 0.04);
    const baseOpacity = (this.theme === "light" ? 0.7 : 0.42) * (1 - this.weatherDim * 0.5);
    this.material.uniforms.uOpacity.value += (baseOpacity - this.material.uniforms.uOpacity.value) * 0.05;

    const focusing = performance.now() < this.focusUntil;
    if (this.paused) {
      this.points.rotation.y *= 0.94;
      this.points.rotation.x += (0 - this.points.rotation.x) * 0.06;
      this.points.position.x *= 0.92;
      this.rotY = this.points.rotation.y;
    } else if (focusing) {
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
