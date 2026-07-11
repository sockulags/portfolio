import type { ShapeId } from "../app/contracts";

const TAU = Math.PI * 2;

/** Slumptal med normal-ish fördelning kring 0. */
export function gauss(): number {
  return (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
}

type ShapeFn = (count: number) => Float32Array;

export const shapes: Record<ShapeId, ShapeFn> = {
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
    const n = Math.max(8, Math.ceil(Math.cbrt(count / 24)));
    const spread = 3.4;
    for (let i = 0; i < count; i++) {
      // flera partiklar per gitternod ger tydliga noder även vid höga antal
      const node = i % (n * n * n);
      const x = node % n;
      const y = Math.floor(node / n) % n;
      const z = Math.floor(node / (n * n)) % n;
      p[i * 3] = (x / (n - 1) - 0.5) * spread + gauss() * 0.035;
      p[i * 3 + 1] = (y / (n - 1) - 0.5) * spread + gauss() * 0.035;
      p[i * 3 + 2] = (z / (n - 1) - 0.5) * spread + gauss() * 0.035;
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
      p[i * 3 + 1] =
        Math.sin(x * 2.4 + phase) * 1.1 * envelope + (row - (rowCount - 1) / 2) * 0.22 + gauss() * 0.04;
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

  // referat: talarspår — horisontella banor där yttranden klumpar sig
  lanes(count) {
    const p = new Float32Array(count * 3);
    const laneCount = 4;
    for (let i = 0; i < count; i++) {
      const lane = i % laneCount;
      // varje spår har sina egna "yttranden": kluster längs x med tysta luckor
      const seg = Math.floor(Math.random() * 5);
      const segCenter = -2.6 + seg * 1.3 + ((lane * 37 + seg * 61) % 10) * 0.06;
      const segLen = 0.35 + ((lane * 13 + seg * 29) % 8) * 0.07;
      p[i * 3] = segCenter + gauss() * segLen;
      p[i * 3 + 1] = (lane - (laneCount - 1) / 2) * 0.95 + gauss() * 0.07;
      p[i * 3 + 2] = gauss() * 0.25;
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
      p[i * 3] = (R + r * Math.cos(v)) * Math.cos(u);
      p[i * 3 + 1] = (R + r * Math.cos(v)) * Math.sin(u) * 0.92;
      p[i * 3 + 2] = r * Math.sin(v) + gauss() * 0.06;
    }
    return p;
  },

  // Spel/eastereggs: gles rymd
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
