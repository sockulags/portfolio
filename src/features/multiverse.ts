/**
 * Multiverse — två fönster delar ett partikelfält (Bjørn Staal-effekten).
 * Fönster hittar varandra via BroadcastChannel och ritar en partikeltether
 * från det egna fältets centrum mot närmaste peer, i verklig skärmgeometri.
 */
import type { FeatureContext, OverlayApi } from "../app/contracts";

const CHANNEL = "pf-multiverse";
const POST_MS = 150;
const STALE_MS = 1200;
const COUNT = 240;
const FADE_MS = 500;

interface Peer {
  cx: number;
  cy: number;
  last: number;
}

type Msg =
  | { id: string; bye: true }
  | { id: string; cx: number; cy: number; t: number; bye?: undefined };

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.49, 0.42, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function initMultiverse(ctx: FeatureContext): void {
  ctx.registerCommand({
    id: "multiverse-open",
    label: () => ctx.t({ sv: "Öppna ett parallellt universum", en: "Open a parallel universe" }),
    group: () => ctx.t({ sv: "Åtgärder", en: "Actions" }),
    run: () => {
      window.open(location.href, "_blank", "popup=yes,width=900,height=700");
      ctx.toast(ctx.t({ sv: "Dra det nya fönstret åt sidan …", en: "Drag the new window aside…" }));
    },
  });

  if (typeof BroadcastChannel === "undefined") return;

  const id = Math.random().toString(36).slice(2, 10);
  const peers = new Map<string, Peer>();
  const bc = new BroadcastChannel(CHANNEL);

  let overlay: OverlayApi | null = null;
  let raf = 0;
  let lastFrame = 0;
  let alpha = 0;
  let fadingOut = false;
  let announced = false;
  let activeId: string | null = null;
  let target: Peer | null = null;

  // per-partikel: grundparameter u, flödeshastighet, sidojitter, fas
  const baseU = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const jit = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    baseU[i] = i / COUNT;
    speed[i] = 0.16 + Math.random() * 0.22;
    jit[i] = (Math.random() - 0.5) * 2;
  }
  const staticU = (i: number) => baseU[i];

  const myCenter = () => ({
    cx: window.screenX + window.outerWidth / 2,
    cy: window.screenY + window.outerHeight / 2,
  });

  function post(): void {
    const c = myCenter();
    bc.postMessage({ id, cx: c.cx, cy: c.cy, t: Date.now() });
  }

  bc.onmessage = (e: MessageEvent<Msg>) => {
    const msg = e.data;
    if (!msg || typeof msg.id !== "string" || msg.id === id) return;
    if (msg.bye) {
      peers.delete(msg.id);
      return;
    }
    if (typeof msg.cx !== "number" || typeof msg.cy !== "number") return;
    const isNew = !peers.has(msg.id);
    peers.set(msg.id, { cx: msg.cx, cy: msg.cy, last: Date.now() });
    if (msg.id === activeId) target = peers.get(msg.id)!;
    if (isNew) post(); // snabb handskakning så tethern dyker upp direkt
  };

  function establish(): void {
    overlay = ctx.engine.createOverlay(COUNT);
    alpha = ctx.engine.reducedMotion ? 1 : 0;
    overlay.setVisible(true);
    if (!announced) {
      announced = true;
      ctx.secrets.found("multiverse");
      ctx.toast(ctx.t({ sv: "⧉ Multiversum etablerat — 2 fönster, ett fält.", en: "⧉ Multiverse established — 2 windows, one field." }));
    }
    ensureRaf();
  }

  function disposeOverlay(): void {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    overlay?.dispose();
    overlay = null;
    fadingOut = false;
    alpha = 0;
    activeId = null;
    target = null;
  }

  /** Tetherns geometri: kvadratisk bezier (0,0) → klampad ändpunkt mot peern. */
  function geometry(peer: Peer) {
    const c = myCenter();
    const b = ctx.engine.worldBounds();
    const scale = (b.halfW * 2) / window.innerWidth;
    let ex = (peer.cx - c.cx) * scale;
    let ey = -(peer.cy - c.cy) * scale; // skärm-y nedåt → värld-y uppåt
    const over = Math.max(Math.abs(ex) / (b.halfW * 2.2), Math.abs(ey) / (b.halfH * 2.2));
    if (over > 1) {
      ex /= over;
      ey /= over;
    }
    const len = Math.hypot(ex, ey) || 0.0001;
    const nx = ex / len;
    const ny = ey / len;
    // teckenval via id-ordning ⇒ båda fönstren böjer bågen åt samma håll
    const sign = activeId !== null && id < activeId ? 1 : -1;
    const px = -ny * sign;
    const py = nx * sign;
    const k = len * 0.22;
    return { ex, ey, cpx: ex / 2 + px * k, cpy: ey / 2 + py * k, px, py, jAmp: b.halfW * 0.02 };
  }

  function render(u: (i: number) => number, fade: number): void {
    if (!overlay || !target) return;
    const g = geometry(target);
    const [ar, ag, ab] = parseHex(getComputedStyle(document.documentElement).getPropertyValue("--accent"));
    // accent-tonad vit
    const tr = 0.6 + 0.4 * ar;
    const tg = 0.6 + 0.4 * ag;
    const tb = 0.6 + 0.4 * ab;
    const pos = overlay.positions;
    const col = overlay.colors;
    for (let i = 0; i < COUNT; i++) {
      const t = u(i);
      const s = 1 - t;
      const x = 2 * s * t * g.cpx + t * t * g.ex;
      const y = 2 * s * t * g.cpy + t * t * g.ey;
      const env = Math.sin(Math.PI * t); // tonar mot båda ändar
      const j = jit[i] * g.jAmp * env;
      pos[i * 3] = x + g.px * j;
      pos[i * 3 + 1] = y + g.py * j;
      pos[i * 3 + 2] = 0;
      const glow = env * fade;
      col[i * 3] = tr * glow;
      col[i * 3 + 1] = tg * glow;
      col[i * 3 + 2] = tb * glow;
    }
    overlay.sync();
  }

  function frame(now: number): void {
    raf = 0;
    if (!overlay) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    if (fadingOut) {
      alpha = Math.max(0, alpha - dt * (1000 / FADE_MS));
      if (alpha <= 0) {
        disposeOverlay();
        return;
      }
    } else {
      alpha = Math.min(1, alpha + dt * 3);
    }
    for (let i = 0; i < COUNT; i++) phase[i] = (phase[i] + speed[i] * dt) % 1;
    render((i) => (baseU[i] + phase[i]) % 1, alpha);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }

  function ensureRaf(): void {
    if (ctx.engine.reducedMotion || raf || !overlay || document.hidden) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // närvaro postas via setInterval — fortsätter även när fliken är dold,
  // så det ANDRA fönstret ser oss trots att vår rAF pausar.
  // Adaptiv takt: långsam puls i ensamhet, snabb först när en peer finns.
  let beatMs = 0;
  let beatTimer = 0;
  const beat = () => {
    heartbeat();
    const want = peers.size > 0 ? POST_MS : 1200;
    if (want !== beatMs) {
      beatMs = want;
      window.clearInterval(beatTimer);
      beatTimer = window.setInterval(beat, beatMs);
    }
  };
  beatMs = 1200;
  beatTimer = window.setInterval(beat, beatMs);

  function heartbeat(): void {
    post();
    const now = Date.now();
    for (const [pid, p] of peers) if (now - p.last > STALE_MS) peers.delete(pid);

    // närmaste fräscha peer vinner
    const c = myCenter();
    let best: string | null = null;
    let bestD = Infinity;
    for (const [pid, p] of peers) {
      const d = (p.cx - c.cx) ** 2 + (p.cy - c.cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = pid;
      }
    }

    if (best) {
      activeId = best;
      target = peers.get(best)!;
      fadingOut = false;
      if (!overlay) establish();
      else ensureRaf();
      if (ctx.engine.reducedMotion) render(staticU, 1); // statisk men följer fönsterflytt
    } else if (overlay && !fadingOut) {
      if (ctx.engine.reducedMotion) disposeOverlay();
      else {
        fadingOut = true;
        ensureRaf();
      }
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    } else ensureRaf();
  });

  window.addEventListener("pagehide", () => {
    bc.postMessage({ id, bye: true });
  });

  post();
}
