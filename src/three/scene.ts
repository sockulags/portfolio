import * as THREE from "three";

const TAU = Math.PI * 2;

function isMobile(): boolean {
  return window.innerWidth < 768 || navigator.hardwareConcurrency <= 4;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Slumptal med normal-ish fördelning kring 0. */
function gauss(): number {
  return (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
}

type ShapeFn = (count: number) => Float32Array;

const shapes: Record<string, ShapeFn> = {
  // Hero: spiralgalax med tre armar
  galaxy(count) {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const arm = i % 3;
      const r = 0.25 + Math.pow(Math.random(), 0.85) * 3.3;
      const angle = (arm * TAU) / 3 + r * 1.15 + gauss() * 0.28;
      p[i * 3] = Math.cos(angle) * r + gauss() * 0.15;
      p[i * 3 + 1] = gauss() * 0.3 * (1 - r / 3.8);
      p[i * 3 + 2] = Math.sin(angle) * r + gauss() * 0.15;
    }
    return p;
  },

  // Meritvo: staplade "sidor" med textrader
  layers(count) {
    const p = new Float32Array(count * 3);
    const layers = 5;
    const rows = 9;
    for (let i = 0; i < count; i++) {
      const layer = i % layers;
      const row = Math.floor(Math.random() * rows);
      const y = (layer - (layers - 1) / 2) * 0.85 + gauss() * 0.02;
      const z = (row - (rows - 1) / 2) * 0.3 + gauss() * 0.02;
      // radlängden varierar som textrader
      const rowLen = 1.6 + ((layer * 31 + row * 17) % 10) * 0.14;
      p[i * 3] = (Math.random() * 2 - 1) * rowLen;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = z;
    }
    return p;
  },

  // Pilot: torusknut (2,3) — agentloopen
  knot(count) {
    const p = new Float32Array(count * 3);
    const R = 1.55;
    const r = 0.42;
    for (let i = 0; i < count; i++) {
      const t = Math.random() * TAU;
      const qx = Math.cos(2 * t) * (R + r * Math.cos(3 * t));
      const qy = Math.sin(2 * t) * (R + r * Math.cos(3 * t));
      const qz = r * Math.sin(3 * t);
      const jitter = 0.16;
      p[i * 3] = qx + gauss() * jitter;
      p[i * 3 + 1] = qy + gauss() * jitter;
      p[i * 3 + 2] = qz + gauss() * jitter;
    }
    return p;
  },

  // Design-Pilot: kubiskt rutnät — komponentregistret
  lattice(count) {
    const p = new Float32Array(count * 3);
    const n = Math.ceil(Math.cbrt(count));
    const spread = 3.4;
    let i = 0;
    outer: for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          if (i >= count) break outer;
          p[i * 3] = (x / (n - 1) - 0.5) * spread + gauss() * 0.03;
          p[i * 3 + 1] = (y / (n - 1) - 0.5) * spread + gauss() * 0.03;
          p[i * 3 + 2] = (z / (n - 1) - 0.5) * spread + gauss() * 0.03;
          i++;
        }
      }
    }
    return p;
  },

  // Rep Counter: pulserande vågrader — hjärtslag/reps
  wave(count) {
    const p = new Float32Array(count * 3);
    const rowCount = 7;
    for (let i = 0; i < count; i++) {
      const row = i % rowCount;
      const x = (Math.random() * 2 - 1) * 3.2;
      const phase = (row / rowCount) * TAU;
      const envelope = Math.exp(-Math.abs(x) * 0.35);
      p[i * 3] = x;
      p[i * 3 + 1] = Math.sin(x * 2.4 + phase) * 1.1 * envelope + (row - (rowCount - 1) / 2) * 0.22 + gauss() * 0.04;
      p[i * 3 + 2] = (row - (rowCount - 1) / 2) * 0.4 + gauss() * 0.05;
    }
    return p;
  },

  // Smask: organisk blob — en tomat, typ
  blob(count) {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * TAU;
      const bump = 1 + 0.22 * Math.sin(3 * theta) * Math.sin(3 * phi) + gauss() * 0.05;
      const r = 1.9 * bump;
      p[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      p[i * 3 + 1] = r * Math.cos(theta) * 0.88;
      p[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    }
    return p;
  },

  // Kontakt: ring — öppen förbindelse
  ring(count) {
    const p = new Float32Array(count * 3);
    const R = 3.3;
    const r = 0.22;
    for (let i = 0; i < count; i++) {
      const u = Math.random() * TAU;
      const v = Math.random() * TAU;
      const x = (R + r * Math.cos(v)) * Math.cos(u);
      const y = (R + r * Math.cos(v)) * Math.sin(u);
      const z = r * Math.sin(v);
      p[i * 3] = x;
      p[i * 3 + 1] = y * 0.92;
      p[i * 3 + 2] = z + gauss() * 0.06;
    }
    return p;
  },

  // Easter egg: total scatter
  scatter(count) {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 9;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * TAU;
      p[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      p[i * 3 + 1] = r * Math.cos(theta);
      p[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    }
    return p;
  },
};

const vertexShader = /* glsl */ `
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

const fragmentShader = /* glsl */ `
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

export type ShapeId = keyof typeof shapes;

export class ParticleScene {
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
  private currentShape: ShapeId = "galaxy";

  private targetColor = new THREE.Color("#7c6cff");
  private targetOffsetX = 0;
  private mouse = { x: 0, y: 0 };
  private smoothMouse = { x: 0, y: 0 };
  private scrollY = 0;
  private reducedMotion = false;
  private running = true;
  private clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement) {
    this.count = isMobile() ? 7000 : 15000;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
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
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: isMobile() ? 2.0 : 1.7 },
        uWobble: { value: 1 },
        uColor: { value: new THREE.Color("#7c6cff") },
        uWhite: { value: new THREE.Color("#e8e6ff") },
        uOpacity: { value: 0.42 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", () => {
      this.running = !document.hidden;
      if (this.running) this.clock.getDelta();
    });

    this.tick();
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onPointerMove = (e: PointerEvent) => {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  setShape(id: ShapeId, instant = false) {
    if (id === this.currentShape && !instant) return;
    this.currentShape = id;
    const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    this.from.set(pos.array as Float32Array);
    this.to = shapes[id](this.count);
    if (instant || this.reducedMotion) {
      (pos.array as Float32Array).set(this.to);
      pos.needsUpdate = true;
      this.morphStart = -1;
    } else {
      this.morphStart = performance.now();
    }
  }

  /** Easter egg: sprid ut allt, återgå sedan till nuvarande form. */
  burst() {
    const current = this.currentShape;
    const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    this.from.set(pos.array as Float32Array);
    this.to = shapes.scatter(this.count);
    this.morphStart = performance.now();
    this.morphDuration = 700;
    setTimeout(() => {
      this.morphDuration = 1600;
      this.currentShape = "scatter" as ShapeId;
      this.setShape(current);
      this.morphDuration = 1400;
    }, 800);
  }

  setAccent(hex: string) {
    this.targetColor.set(hex);
  }

  /** Skjut formen åt sidan så den inte hamnar bakom innehållskortet. */
  setOffsetX(x: number) {
    this.targetOffsetX = x;
  }

  setTheme(mode: "dark" | "light") {
    if (mode === "light") {
      this.material.blending = THREE.NormalBlending;
      this.material.uniforms.uWhite.value.set("#1a1a2e");
      this.material.uniforms.uOpacity.value = 0.7;
    } else {
      this.material.blending = THREE.AdditiveBlending;
      this.material.uniforms.uWhite.value.set("#e8e6ff");
      this.material.uniforms.uOpacity.value = 0.42;
    }
    this.material.needsUpdate = true;
  }

  setReducedMotion(on: boolean) {
    this.reducedMotion = on;
    this.material.uniforms.uWobble.value = on ? 0 : 1;
  }

  setScroll(y: number) {
    this.scrollY = y;
  }

  private tick = () => {
    requestAnimationFrame(this.tick);
    if (!this.running) return;

    const t = this.clock.getElapsedTime();
    this.material.uniforms.uTime.value = t;

    // morph
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

    // färg mot mål
    (this.material.uniforms.uColor.value as THREE.Color).lerp(this.targetColor, 0.04);

    // sidled offset — bara på breda skärmar
    const effectiveOffset = window.innerWidth < 900 ? 0 : this.targetOffsetX;
    this.points.position.x += (effectiveOffset - this.points.position.x) * 0.035;

    // rotation + parallax
    if (!this.reducedMotion) {
      this.points.rotation.y = t * 0.05 + this.scrollY * 0.6;
      this.points.rotation.x = -0.34 + Math.sin(t * 0.03) * 0.05;
    } else {
      this.points.rotation.x = -0.34;
    }
    this.smoothMouse.x += (this.mouse.x - this.smoothMouse.x) * 0.04;
    this.smoothMouse.y += (this.mouse.y - this.smoothMouse.y) * 0.04;
    this.camera.position.x = this.smoothMouse.x * 0.7;
    this.camera.position.y = -this.smoothMouse.y * 0.5;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  };
}
