/**
 * Cosmos — rymdlagret: sajten tittar uppåt. ISS-passager över Stockholm
 * (verklig position), meteorregn enligt den astronomiska kalendern och
 * norrsken när Kp-index och natten tillåter. Allt kan förhandsvisas via
 * bus-eventet "cosmos-preview" (fuskkoderna). Alla nätverksanrop failar tyst.
 */
import type { FeatureContext, OverlayApi } from "../app/contracts";
import { local, session } from "../app/storage";

const STHLM_LAT = 59.33;
const STHLM_LON = 18.07;

const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_KEY = "pf-cosmos-iss";
const ISS_SHOWN_KEY = "pf-cosmos-iss-shown";
const ISS_POLL_MS = 5 * 60_000;
const ISS_COOLDOWN_MS = 45 * 60_000;
// ISS-banans inklination är 51,6° — marklinjen når aldrig norr om ~51,8°N.
// Från Stockholm (59,33°N) är minsta möjliga avstånd ~830 km, så tröskeln
// måste ligga över det för att en passage någonsin ska kunna trigga.
// 1100 km ≈ ISS syns lågt över södra horisonten.
const ISS_NEAR_KM = 1100;
const ISS_FLIGHT_S = 22;
const ISS_GLYPH = 46;
const ISS_TRAIL = 8;
const ISS_COUNT = ISS_GLYPH + ISS_TRAIL;

const METEOR_MAX = 4;
const METEOR_TRAIL = 14;
const SHOWER_TOAST_KEY = "pf-cosmos-shower";

const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const KP_KEY = "pf-cosmos-kp";
const WEATHER_KEY = "pf-weather";
const KP_FRESH_MS = 30 * 60_000;
const AURORA_CHECK_MS = 30 * 60_000;
const AURORA_MIN_KP = 5;
const AURORA_PREVIEW_S = 45;
const AURORA_COLS = 200;
const AURORA_ROWS = 8;
const AURORA_COUNT = AURORA_COLS * AURORA_ROWS;

/** Större meteorregn — datum som md = månad*100+dag, Europe/Stockholm. */
interface Shower {
  name: { sv: string; en: string };
  from: number;
  to: number;
  peak: number[];
}

const SHOWERS: Shower[] = [
  { name: { sv: "Kvadrantiderna", en: "The Quadrantids" }, from: 101, to: 107, peak: [103, 104] },
  { name: { sv: "Lyriderna", en: "The Lyrids" }, from: 416, to: 425, peak: [422] },
  { name: { sv: "Eta Aquariiderna", en: "The Eta Aquariids" }, from: 429, to: 508, peak: [505] },
  { name: { sv: "Perseiderna", en: "The Perseids" }, from: 717, to: 824, peak: [812, 813] },
  { name: { sv: "Orioniderna", en: "The Orionids" }, from: 1002, to: 1107, peak: [1021] },
  { name: { sv: "Leoniderna", en: "The Leonids" }, from: 1106, to: 1130, peak: [1117] },
  { name: { sv: "Geminiderna", en: "The Geminids" }, from: 1204, to: 1217, peak: [1213, 1214] },
  { name: { sv: "Ursiderna", en: "The Ursids" }, from: 1217, to: 1226, peak: [1222] },
];

interface IssPos {
  lat: number;
  lon: number;
  alt: number;
  vel: number;
}

interface IssCache extends IssPos {
  ts: number;
}

interface Meteor {
  age: number;
  life: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  trail: number;
}

export function initCosmos(ctx: FeatureContext): void {
  // ---------- delat tillstånd ----------

  let raf = 0;
  let lastFrame = 0;
  let gameActive = false;

  let issOverlay: OverlayApi | null = null;
  let issT = 0;
  let issStatic = false;
  let issStaticTimer = 0;
  let issPollTimer = 0;
  let issPollPending = false;
  let issPts: Float32Array | null = null;

  const meteors: (Meteor | null)[] = Array.from({ length: METEOR_MAX }, () => null);
  let meteorsAlive = 0;
  let meteorOverlay: OverlayApi | null = null;
  let meteorTimer = 0;

  let auroraOverlay: OverlayApi | null = null;
  let auroraMode: "in" | "hold" | "out" = "in";
  let auroraReal = false;
  let auroraAlpha = 0;
  let auroraT = 0;
  let auroraLeft = 0;
  let auroraTimer = 0;
  let auroraStillTimer = 0;
  let aurBand: Uint8Array | null = null;
  let aurJx: Float32Array | null = null;
  let aurBase: Float32Array | null = null;

  // ---------- gemensam rAF-loop: kör bara när något fenomen lever ----------

  function active(): boolean {
    return issOverlay !== null || meteorsAlive > 0 || auroraOverlay !== null;
  }

  function ensureRaf(): void {
    if (ctx.engine.reducedMotion || raf || document.hidden || gameActive || !active()) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now: number): void {
    raf = 0;
    if (document.hidden || gameActive) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    stepIss(dt);
    stepMeteors(dt);
    stepAurora(dt);
    if (active()) raf = requestAnimationFrame(frame);
  }

  // ---------- ISS ----------

  function glyphPts(): Float32Array {
    if (issPts) return issPts;
    const p: number[] = [];
    // kroppsbalk: 10 partiklar i en horisontell linje
    for (let i = 0; i < 10; i++) p.push(-0.07 + (i * 0.14) / 9, 0);
    // två solpanelsgaller 3×6 — total bredd ~0.5 världsenheter
    for (const side of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) p.push(side * (0.09 + c * 0.032), (r - 1) * 0.032);
      }
    }
    issPts = new Float32Array(p);
    return issPts;
  }

  function renderIss(t: number): void {
    if (!issOverlay) return;
    const b = ctx.engine.worldBounds();
    const x0 = -b.halfW - 0.4;
    const x1 = b.halfW + 0.4;
    const y0 = b.halfH * 0.74;
    const y1 = b.halfH * 0.46; // svag lutning nedåt genom övre tredjedelen
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const dx = (x1 - x0) / len;
    const dy = (y1 - y0) / len;
    const env = Math.min(t / 0.05, (1 - t) / 0.05, 1);
    const pts = glyphPts();
    const pos = issOverlay.positions;
    const col = issOverlay.colors;
    for (let i = 0; i < ISS_GLYPH; i++) {
      const o = i * 3;
      pos[o] = x + pts[i * 2];
      pos[o + 1] = y + pts[i * 2 + 1];
      pos[o + 2] = 0;
      const g = (i < 10 ? 0.95 : 0.7) * env;
      col[o] = 0.8 * g;
      col[o + 1] = 0.88 * g;
      col[o + 2] = 1.0 * g;
    }
    // svagt släp bakom glyfen
    for (let k = 0; k < ISS_TRAIL; k++) {
      const o = (ISS_GLYPH + k) * 3;
      const d = 0.34 + k * 0.09;
      pos[o] = x - dx * d;
      pos[o + 1] = y - dy * d;
      pos[o + 2] = 0;
      const g = 0.3 * (1 - k / ISS_TRAIL) * env;
      col[o] = 0.7 * g;
      col[o + 1] = 0.8 * g;
      col[o + 2] = 1.0 * g;
    }
    issOverlay.sync();
  }

  function stepIss(dt: number): void {
    if (!issOverlay || issStatic) return;
    issT += dt / ISS_FLIGHT_S;
    if (issT >= 1) {
      endIss();
      return;
    }
    renderIss(issT);
  }

  function endIss(): void {
    window.clearTimeout(issStaticTimer);
    issStatic = false;
    issOverlay?.dispose();
    issOverlay = null;
  }

  function startIss(altKm: number, velKmh: number, real: boolean): void {
    if (gameActive || issOverlay) return;
    if (real) writeStr(ISS_SHOWN_KEY, String(Date.now()));
    const nf = new Intl.NumberFormat(ctx.lang() === "sv" ? "sv-SE" : "en-GB");
    const alt = nf.format(Math.round(altKm));
    const vel = nf.format(Math.round(velKmh / 100) * 100);
    ctx.toast(
      ctx.t({
        sv: `🛰 ISS passerar över Stockholm just nu — ${alt} km upp, ${vel} km/h`,
        en: `🛰 ISS is passing over Stockholm right now — ${alt} km up, ${vel} km/h`,
      })
    );
    issOverlay = ctx.engine.createOverlay(ISS_COUNT);
    issOverlay.setVisible(true);
    if (ctx.engine.reducedMotion) {
      // degradering: stilla glyf mitt på banan i några sekunder
      issStatic = true;
      renderIss(0.5);
      issStaticTimer = window.setTimeout(endIss, 6000);
      return;
    }
    issT = 0;
    renderIss(0);
    ensureRaf();
  }

  function maybeFlyover(data: IssPos): void {
    if (haversineKm(data.lat, data.lon, STHLM_LAT, STHLM_LON) >= ISS_NEAR_KM) return;
    const shown = Number(local.getItem(ISS_SHOWN_KEY)) || 0;
    if (Date.now() - shown < ISS_COOLDOWN_MS) return;
    startIss(data.alt, data.vel, true);
  }

  function scheduleIssPoll(ms: number): void {
    window.clearTimeout(issPollTimer);
    issPollTimer = window.setTimeout(() => void pollIss(), ms);
  }

  async function pollIss(): Promise<void> {
    if (document.hidden) {
      // spec: polla inte i det dolda — kedjan återupptas vid visibilitychange
      issPollPending = true;
      return;
    }
    issPollPending = false;
    scheduleIssPoll(ISS_POLL_MS);
    const data = await fetchIss();
    if (!data) return;
    writeJson(ISS_KEY, { ts: Date.now(), ...data });
    maybeFlyover(data);
  }

  function previewIss(): void {
    const c = readIssCache(); // även gammal cache duger till siffrorna
    startIss(c ? c.alt : 408, c ? c.vel : 27600, false);
  }

  // ---------- meteorer ----------

  function parkMeteor(s: number): void {
    if (!meteorOverlay) return;
    const pos = meteorOverlay.positions;
    const col = meteorOverlay.colors;
    for (let k = 0; k < METEOR_TRAIL; k++) {
      const o = (s * METEOR_TRAIL + k) * 3;
      pos[o] = 0;
      pos[o + 1] = 0;
      pos[o + 2] = -9999;
      col[o] = 0;
      col[o + 1] = 0;
      col[o + 2] = 0;
    }
  }

  function spawnMeteor(): void {
    if (ctx.engine.reducedMotion || gameActive || document.hidden) return;
    let slot = -1;
    for (let s = 0; s < METEOR_MAX; s++) {
      if (!meteors[s]) {
        slot = s;
        break;
      }
    }
    if (slot < 0) return;
    if (!meteorOverlay) {
      meteorOverlay = ctx.engine.createOverlay(METEOR_MAX * METEOR_TRAIL);
      for (let s = 0; s < METEOR_MAX; s++) parkMeteor(s);
      meteorOverlay.sync();
      meteorOverlay.setVisible(true);
    }
    const b = ctx.engine.worldBounds();
    const side = Math.random() < 0.5 ? -1 : 1; // ned-höger eller ned-vänster
    const dx = side * (0.55 + Math.random() * 0.3);
    const dy = -(0.65 + Math.random() * 0.25);
    const n = Math.hypot(dx, dy);
    const speed = b.halfW * (0.85 + Math.random() * 0.55);
    meteors[slot] = {
      age: 0,
      life: 0.9 + Math.random() * 0.4,
      x: (Math.random() * 1.6 - 0.8) * b.halfW - side * b.halfW * 0.2,
      y: b.halfH * (0.55 + Math.random() * 0.45),
      dx: dx / n,
      dy: dy / n,
      speed,
      trail: speed * (0.13 + Math.random() * 0.07),
    };
    meteorsAlive++;
    ensureRaf();
  }

  function stepMeteors(dt: number): void {
    if (!meteorOverlay) return;
    const pos = meteorOverlay.positions;
    const col = meteorOverlay.colors;
    for (let s = 0; s < METEOR_MAX; s++) {
      const m = meteors[s];
      if (!m) continue;
      m.age += dt;
      if (m.age >= m.life) {
        meteors[s] = null;
        meteorsAlive--;
        parkMeteor(s);
        continue;
      }
      const hx = m.x + m.dx * m.speed * m.age;
      const hy = m.y + m.dy * m.speed * m.age;
      const env = Math.min(m.age / 0.08, 1) * Math.min(1, (m.life - m.age) / 0.3);
      for (let k = 0; k < METEOR_TRAIL; k++) {
        const f = k / (METEOR_TRAIL - 1);
        const o = (s * METEOR_TRAIL + k) * 3;
        pos[o] = hx - m.dx * f * m.trail;
        pos[o + 1] = hy - m.dy * f * m.trail;
        pos[o + 2] = 0;
        const g = env * (1 - f) * (1 - f); // ljuset faller mot svansen
        col[o] = 0.92 * g;
        col[o + 1] = 0.95 * g;
        col[o + 2] = 1.0 * g;
      }
    }
    meteorOverlay.sync();
    if (meteorsAlive === 0) {
      meteorOverlay.dispose();
      meteorOverlay = null;
    }
  }

  function killMeteors(): void {
    meteors.fill(null);
    meteorsAlive = 0;
    meteorOverlay?.dispose();
    meteorOverlay = null;
  }

  function scheduleMeteors(): void {
    window.clearTimeout(meteorTimer);
    const act = currentShower();
    if (!act) {
      meteorTimer = window.setTimeout(scheduleMeteors, 3_600_000); // ny koll efter midnatt
      return;
    }
    const delay = act.peak ? 10_000 + Math.random() * 15_000 : 25_000 + Math.random() * 45_000;
    meteorTimer = window.setTimeout(() => {
      if (!document.hidden && !gameActive && !session.getItem(SHOWER_TOAST_KEY)) {
        session.setItem(SHOWER_TOAST_KEY, "1");
        ctx.toast(
          ctx.t({
            sv: `✨ ${act.shower.name.sv} pågår — himlen levererar ikväll`,
            en: `✨ ${act.shower.name.en} are underway — the sky delivers tonight`,
          })
        );
      }
      spawnMeteor();
      scheduleMeteors();
    }, delay);
  }

  function previewMeteors(): void {
    if (gameActive || ctx.engine.reducedMotion) return;
    for (let i = 0; i < 6; i++) window.setTimeout(spawnMeteor, i * 520);
  }

  // ---------- norrsken ----------

  function prepAurora(still: boolean): void {
    if (!aurJx || !aurBase || !aurBand) {
      aurJx = new Float32Array(AURORA_COUNT);
      aurBase = new Float32Array(AURORA_COUNT * 3);
      aurBand = new Uint8Array(AURORA_COLS);
      for (let i = 0; i < AURORA_COUNT; i++) aurJx[i] = Math.random() - 0.5;
    }
    for (let c = 0; c < AURORA_COLS; c++) aurBand[c] = still ? 0 : c % 3;
    for (let r = 0; r < AURORA_ROWS; r++) {
      const u = r / (AURORA_ROWS - 1);
      // violett högst upp → teal → grönt vid basen
      let cr: number;
      let cg: number;
      let cb: number;
      if (u < 0.45) {
        const k = u / 0.45;
        cr = 0.55 + (0.2 - 0.55) * k;
        cg = 0.3 + (0.85 - 0.3) * k;
        cb = 0.9 + (0.75 - 0.9) * k;
      } else {
        const k = (u - 0.45) / 0.55;
        cr = 0.2 + (0.25 - 0.2) * k;
        cg = 0.85 + (1.0 - 0.85) * k;
        cb = 0.75 + (0.45 - 0.75) * k;
      }
      for (let c = 0; c < AURORA_COLS; c++) {
        const i = c * AURORA_ROWS + r;
        const env = (0.3 + 0.7 * u) * (0.7 + Math.random() * 0.3);
        aurBase[i * 3] = cr * env;
        aurBase[i * 3 + 1] = cg * env;
        aurBase[i * 3 + 2] = cb * env;
      }
    }
  }

  function renderAurora(): void {
    if (!auroraOverlay || !aurBand || !aurJx || !aurBase) return;
    const b = ctx.engine.worldBounds();
    const depth = b.halfH * 0.7; // draperiet fyller vyns översta ~35 %
    const t = auroraT;
    const pulse = 0.55 + 0.45 * Math.sin(t * 0.31 + Math.sin(t * 0.113) * 1.6);
    const glow = pulse * auroraAlpha;
    const drift0 = Math.sin(t * 0.051) * b.halfW * 0.03;
    const drift1 = Math.sin(t * 0.043 + 2.1) * b.halfW * 0.03;
    const drift2 = Math.sin(t * 0.037 + 4.2) * b.halfW * 0.03;
    const pos = auroraOverlay.positions;
    const col = auroraOverlay.colors;
    for (let c = 0; c < AURORA_COLS; c++) {
      const band = aurBand[c];
      const xn = c / (AURORA_COLS - 1);
      const w = xn * Math.PI * 2;
      const ph = band * 2.09;
      // kolumnhöjd: lagrade sinusar som driver långsamt — klassisk vågridå
      let h =
        0.5 +
        0.24 * Math.sin(w * 1.7 + t * 0.21 + ph) +
        0.17 * Math.sin(w * 3.6 - t * 0.13 + ph * 1.31) +
        0.11 * Math.sin(w * 6.8 + t * 0.29 + ph * 0.7);
      h = Math.min(1, Math.max(0.18, h));
      const drift = band === 0 ? drift0 : band === 1 ? drift1 : drift2;
      const x = (xn * 2 - 1) * b.halfW * 1.02 + drift;
      const yTop = b.halfH * 0.98 - band * b.halfH * 0.045;
      for (let r = 0; r < AURORA_ROWS; r++) {
        const i = c * AURORA_ROWS + r;
        const o = i * 3;
        const yFrac = r / (AURORA_ROWS - 1);
        pos[o] = x + aurJx[i] * b.halfW * 0.02;
        pos[o + 1] = yTop - yFrac * h * depth;
        pos[o + 2] = 0;
        col[o] = aurBase[o] * glow;
        col[o + 1] = aurBase[o + 1] * glow;
        col[o + 2] = aurBase[o + 2] * glow;
      }
    }
    auroraOverlay.sync();
  }

  function stepAurora(dt: number): void {
    if (!auroraOverlay || ctx.engine.reducedMotion) return;
    auroraT += dt;
    if (auroraMode === "in") {
      auroraAlpha = Math.min(1, auroraAlpha + dt / 2.5);
      if (auroraAlpha >= 1) auroraMode = "hold";
    } else if (auroraMode === "out") {
      auroraAlpha -= dt / 3;
      if (auroraAlpha <= 0) {
        disposeAurora();
        return;
      }
    }
    if (!auroraReal && auroraMode !== "out") {
      auroraLeft -= dt;
      if (auroraLeft <= 0) auroraMode = "out";
    }
    renderAurora();
  }

  function disposeAurora(): void {
    window.clearTimeout(auroraStillTimer);
    auroraOverlay?.dispose();
    auroraOverlay = null;
    auroraAlpha = 0;
  }

  function startAurora(real: boolean): void {
    if (gameActive) return;
    if (real) auroraReal = true;
    if (auroraOverlay) {
      if (real) window.clearTimeout(auroraStillTimer);
      else if (!auroraReal) auroraLeft = AURORA_PREVIEW_S; // ny förhandsvisning förlänger
      if (auroraMode === "out") auroraMode = "in";
      return;
    }
    prepAurora(ctx.engine.reducedMotion);
    auroraOverlay = ctx.engine.createOverlay(AURORA_COUNT);
    auroraOverlay.setVisible(true);
    auroraT = Math.random() * 100;
    if (ctx.engine.reducedMotion) {
      // ett stilla, svagt band i stället för animation
      auroraAlpha = 0.3;
      renderAurora();
      if (!auroraReal) {
        window.clearTimeout(auroraStillTimer);
        auroraStillTimer = window.setTimeout(disposeAurora, AURORA_PREVIEW_S * 1000);
      }
      return;
    }
    auroraAlpha = 0;
    auroraMode = "in";
    auroraLeft = AURORA_PREVIEW_S;
    ensureRaf();
  }

  function stopAurora(): void {
    if (!auroraOverlay) return;
    if (ctx.engine.reducedMotion) {
      disposeAurora();
      return;
    }
    auroraMode = "out";
    ensureRaf();
  }

  async function auroraCheck(): Promise<void> {
    window.clearTimeout(auroraTimer);
    auroraTimer = window.setTimeout(() => void auroraCheck(), AURORA_CHECK_MS);
    if (document.hidden || gameActive) return; // nästa koll tar det
    const kp = await getKp();
    const hour = stockholmHour();
    const night = hour >= 21 || (hour >= 0 && hour < 6);
    if (kp !== null && kp >= AURORA_MIN_KP && night) {
      startAurora(true);
    } else if (auroraReal) {
      auroraReal = false;
      stopAurora();
    }
  }

  async function getKp(): Promise<number | null> {
    const hit = cachedKp();
    if (hit !== null) return hit;
    const kp = await fetchKp();
    if (kp !== null) writeJson(KP_KEY, { ts: Date.now(), kp });
    return kp;
  }

  // ---------- uppkoppling ----------

  ctx.bus.on("cosmos-preview", ({ what }) => {
    if (what === "iss") previewIss();
    else if (what === "meteor") previewMeteors();
    else startAurora(false);
  });

  ctx.bus.on("game-start", () => {
    gameActive = true;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    endIss();
    killMeteors();
    auroraOverlay?.setVisible(false);
  });

  ctx.bus.on("game-end", () => {
    gameActive = false;
    auroraOverlay?.setVisible(true);
    ensureRaf();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    } else {
      if (issPollPending) void pollIss();
      ensureRaf();
    }
  });

  // ISS: färsk cache räcker en stund — annars polla direkt
  const cached = readIssCache();
  const age = cached ? Date.now() - cached.ts : Infinity;
  if (cached && age < ISS_POLL_MS) {
    maybeFlyover(cached);
    scheduleIssPoll(ISS_POLL_MS - age);
  } else {
    void pollIss();
  }

  scheduleMeteors();

  // första Kp-kollen väntar in weather-modulens cache — sparar ett NOAA-anrop
  auroraTimer = window.setTimeout(() => void auroraCheck(), 15_000);
}

// ---------- hjälpare ----------

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Dagens datum i Stockholm som md = månad*100+dag; 0 vid fel. */
function stockholmMd(): number {
  try {
    const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" })
      .format(new Date())
      .split("-");
    const md = Number(parts[1]) * 100 + Number(parts[2]);
    return Number.isFinite(md) ? md : 0;
  } catch {
    return 0;
  }
}

/** Timme 0–23 i Stockholm; -1 vid fel (⇒ aldrig natt). */
function stockholmHour(): number {
  try {
    const h = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Stockholm",
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    );
    return Number.isFinite(h) ? h % 24 : -1;
  } catch {
    return -1;
  }
}

function currentShower(): { shower: Shower; peak: boolean } | null {
  const md = stockholmMd();
  if (md === 0) return null;
  for (const s of SHOWERS) {
    if (md >= s.from && md <= s.to) return { shower: s, peak: s.peak.includes(md) };
  }
  return null;
}

function writeStr(key: string, value: string): void {
  try {
    local.setItem(key, value);
  } catch {
    // t.ex. fullt lagringsutrymme — strunta i det
  }
}

function writeJson(key: string, value: unknown): void {
  writeStr(key, JSON.stringify(value));
}

function readIssCache(): IssCache | null {
  try {
    const raw = local.getItem(ISS_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw) as IssCache;
    const nums = [e?.ts, e?.lat, e?.lon, e?.alt, e?.vel];
    if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
    return e;
  } catch {
    return null;
  }
}

/** Kp i första hand från weather-modulens cache, annars vår egen. */
function cachedKp(): number | null {
  for (const key of [WEATHER_KEY, KP_KEY]) {
    try {
      const raw = local.getItem(key);
      if (!raw) continue;
      const e = JSON.parse(raw) as { ts?: unknown; kp?: unknown };
      if (typeof e?.ts !== "number" || Date.now() - e.ts > KP_FRESH_MS) continue;
      if (typeof e.kp === "number" && Number.isFinite(e.kp)) return e.kp;
    } catch {
      // trasig post — prova nästa källa
    }
  }
  return null;
}

interface IssResponse {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  velocity?: number;
}

async function fetchIss(): Promise<IssPos | null> {
  try {
    const res = await fetch(ISS_URL);
    if (!res.ok) return null;
    const d = (await res.json()) as IssResponse;
    const num = (v: number | undefined): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const lat = num(d.latitude);
    const lon = num(d.longitude);
    const alt = num(d.altitude);
    const vel = num(d.velocity);
    if (lat === null || lon === null || alt === null || vel === null) return null;
    return { lat, lon, alt, vel };
  } catch {
    return null;
  }
}

async function fetchKp(): Promise<number | null> {
  try {
    const res = await fetch(KP_URL);
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const last = rows[rows.length - 1];
    if (!Array.isArray(last)) return null;
    const kp = Number(last[1]);
    return Number.isFinite(kp) ? kp : null;
  } catch {
    return null;
  }
}
