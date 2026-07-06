/**
 * Asteroids i partikelfältet. Skepp, skott och asteroider är overlay-moln
 * ovanpå motorn — själva fältet pausas i "scatter" medan spelet pågår.
 */
import type { EngineApi, FeatureContext, OverlayApi } from "../../app/contracts";
import { el, injectStyle } from "../../app/dom";

const HI_KEY = "pf-asteroids-hi";
const STYLE_ID = "pf-asteroids-style";

const SHIP_PARTS = 24;
const SHIP_SCALE = 0.3;
const SHIP_R = 0.26;
const ROT_SPEED = 4; // rad/s
const THRUST = 6; // u/s²
const MAX_SPEED = 5;
const DAMPING = 0.995; // per frame vid 60 fps
const INVULN_MS = 2000;
const START_LIVES = 3;

const BULLETS_MAX = 5;
const TRAIL = 8; // partiklar per skott ⇒ pool om 40
const COOLDOWN_MS = 180;
const BULLET_SPEED = 9;
const BULLET_LIFE = 1.1;

const AST_PARTS = 70;
const RADII: Record<1 | 2 | 3, number> = { 1: 0.3, 2: 0.55, 3: 0.9 };
const SCORES: Record<1 | 2 | 3, number> = { 1: 100, 2: 50, 3: 20 };
const START_AST = 6;
const MAX_AST = 9;

const OFF = 1e4; // parkering för inaktiva skottpartiklar

// skeppets triangel i lokala koordinater, nosen åt +x
const TRI: [number, number][] = [
  [1.2, 0],
  [-0.8, 0.75],
  [-0.8, -0.75],
];

type GameKey = "left" | "right" | "thrust" | "fire";

const KEYMAP: Partial<Record<string, GameKey>> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  arrowup: "thrust",
  w: "thrust",
  " ": "fire",
};

const PREVENT = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "]);

interface Asteroid {
  overlay: OverlayApi;
  offs: Float32Array;
  tier: 1 | 2 | 3;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
}

interface Bullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dx: number;
  dy: number;
  life: number;
}

const CSS = `
.ast-hud {
  position: fixed;
  inset: 0;
  z-index: 45;
  pointer-events: none;
  font-family: var(--font-mono);
}
.ast-hud-score {
  position: absolute;
  top: 4.4rem;
  left: clamp(1.25rem, 4vw, 3rem);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: var(--fg);
  white-space: pre;
}
.ast-hud-hint {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--muted);
  white-space: pre;
}
.ast-hud-quit {
  position: absolute;
  top: 4.2rem;
  right: clamp(1.25rem, 4vw, 3rem);
  pointer-events: auto;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 1px solid var(--faint);
  background: var(--bg-elevated);
  color: var(--fg);
  font-size: 1rem;
  cursor: pointer;
}
body.game-active {
  overflow: hidden;
}
html:has(body.game-active) {
  overflow: hidden;
}
`;

let wired = false;
let active = false;

/**
 * Startar Asteroids-featuren. Första anropet (boot) registrerar bara
 * palettkommandot "game-asteroids" — spelet startar via paletten eller
 * ctx.runCommand("game-asteroids"). Senare direktanrop startar spelet.
 */
export function startAsteroids(ctx: FeatureContext): void {
  if (active) return;
  if (!wired) {
    wired = true;
    ctx.registerCommand({
      id: "game-asteroids",
      label: () => ctx.t({ sv: "Starta Asteroids", en: "Play Asteroids" }),
      group: () => ctx.t({ sv: "Spel", en: "Games" }),
      hint: "play",
      run: () => launch(ctx),
    });
    return;
  }
  launch(ctx);
}

function launch(ctx: FeatureContext): void {
  if (active) return;
  // ett spel i taget — Snake kan redan äga motorn
  if (document.body.classList.contains("game-active")) {
    ctx.toast(ctx.t({ sv: "Ett spel är redan igång.", en: "A game is already running." }));
    return;
  }
  const { engine, bus } = ctx;
  if (engine.reducedMotion) {
    ctx.toast(
      ctx.t({
        sv: "Spelet kräver animationer — stäng av reducerad rörelse.",
        en: "The game needs animation — turn off reduced motion first.",
      })
    );
    return;
  }
  active = true;

  const prevShape = engine.currentShape();
  engine.paused = true;
  engine.setShape("scatter");
  bus.emit("game-start", { game: "asteroids" });
  ctx.secrets.found("asteroids-play");

  const savedScroll = window.scrollY;
  injectStyle(STYLE_ID, CSS);
  document.body.classList.add("game-active");

  // ---------- HUD ----------

  const hud = el("div", { class: "ast-hud" });
  const hudScore = el("div", { class: "ast-hud-score" });
  const hudHint = el("div", { class: "ast-hud-hint" });
  // tryckbar utväg för pekskärmar — Escape finns inte där
  const hudQuit = el("button", { class: "ast-hud-quit", "aria-label": "Quit" }, "✕");
  hudQuit.addEventListener("click", () => endGame(false));
  hud.append(hudScore, hudHint, hudQuit);
  document.body.append(hud);

  const storedHi = Number(localStorage.getItem(HI_KEY)) || 0;
  let score = 0;
  let lives = START_LIVES;
  let wave = 1;

  function updateHud(): void {
    const hi = Math.max(storedHi, score);
    const hearts = "▲".repeat(Math.max(0, lives));
    hudScore.textContent = ctx.t({
      sv: `POÄNG ${score}   LIV ${hearts}   REKORD ${hi}`,
      en: `SCORE ${score}   LIVES ${hearts}   BEST ${hi}`,
    });
    hudHint.textContent = ctx.t({
      sv: "←→ styr · ↑ gas · SPACE skjut · ESC avsluta",
      en: "←→ steer · ↑ thrust · SPACE shoot · ESC quit",
    });
  }
  const offLang = bus.on("lang", updateHud);
  updateHud();

  // ---------- entiteter ----------

  const ship = { x: 0, y: 0, vx: 0, vy: 0, a: Math.PI / 2 };
  let invulnUntil = performance.now() + INVULN_MS;
  let lastShot = -1e9;

  const shipOv = engine.createOverlay(SHIP_PARTS);
  for (let i = 0; i < SHIP_PARTS; i++) {
    shipOv.colors[i * 3] = 0.75;
    shipOv.colors[i * 3 + 1] = 0.85;
    shipOv.colors[i * 3 + 2] = 1;
  }

  const bulletOv = engine.createOverlay(BULLETS_MAX * TRAIL);
  const bullets: Bullet[] = [];
  for (let s = 0; s < BULLETS_MAX; s++) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, dx: 0, dy: 0, life: 0 });
    for (let k = 0; k < TRAIL; k++) {
      const i = s * TRAIL + k;
      const f = 1 - k * 0.11; // svansen tonar av
      bulletOv.colors[i * 3] = f;
      bulletOv.colors[i * 3 + 1] = f * 0.96;
      bulletOv.colors[i * 3 + 2] = f * 0.85;
      bulletOv.positions[i * 3] = OFF;
      bulletOv.positions[i * 3 + 1] = OFF;
    }
  }
  bulletOv.sync();

  const asteroids: Asteroid[] = [];

  function spawnWave(count: number): void {
    const { halfW, halfH } = engine.worldBounds();
    for (let n = 0; n < count; n++) {
      let x = halfW;
      let y = halfH;
      // placera en bit från skeppet
      for (let tries = 0; tries < 24; tries++) {
        x = (Math.random() * 2 - 1) * halfW;
        y = (Math.random() * 2 - 1) * halfH;
        if (Math.hypot(x - ship.x, y - ship.y) > 2.6) break;
      }
      asteroids.push(makeAsteroid(engine, 3, x, y, 1));
    }
  }
  spawnWave(START_AST);

  // ---------- input ----------

  const keys = new Set<GameKey>();

  function onKeyDown(e: KeyboardEvent): void {
    const tgt = e.target as HTMLElement | null;
    if (tgt && tgt.tagName === "INPUT") return;
    if (PREVENT.has(e.key)) e.preventDefault();
    if (e.key === "Escape") {
      e.stopPropagation();
      endGame(false);
      return;
    }
    const action = KEYMAP[e.key.toLowerCase()];
    if (!action) return;
    e.stopPropagation();
    keys.add(action);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const action = KEYMAP[e.key.toLowerCase()];
    if (action) keys.delete(action);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    shoot(performance.now());
  }

  function onBlur(): void {
    keys.clear();
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("blur", onBlur);

  // ---------- spelhändelser ----------

  function shoot(now: number): void {
    if (now - lastShot < COOLDOWN_MS) return;
    const b = bullets.find((s) => !s.active);
    if (!b) return;
    lastShot = now;
    const cos = Math.cos(ship.a);
    const sin = Math.sin(ship.a);
    b.active = true;
    b.life = BULLET_LIFE;
    b.x = ship.x + cos * SHIP_SCALE * 1.2;
    b.y = ship.y + sin * SHIP_SCALE * 1.2;
    b.dx = cos;
    b.dy = sin;
    b.vx = cos * BULLET_SPEED;
    b.vy = sin * BULLET_SPEED;
    bus.emit("audio-blip", { kind: "shoot" });
  }

  function hitAsteroid(index: number): void {
    const a = asteroids[index];
    asteroids.splice(index, 1);
    a.overlay.dispose();
    score += SCORES[a.tier];
    engine.shockwaveWorld(a.x, a.y, 1.2);
    bus.emit("audio-blip", { kind: "hit" });
    if (a.tier > 1) {
      const childTier = (a.tier - 1) as 1 | 2;
      const mul = a.tier === 3 ? 1.4 : 1.8;
      asteroids.push(makeAsteroid(engine, childTier, a.x, a.y, mul));
      asteroids.push(makeAsteroid(engine, childTier, a.x, a.y, mul));
    }
    updateHud();
  }

  function loseLife(now: number): void {
    lives--;
    engine.shockwaveWorld(ship.x, ship.y, 2.5);
    bus.emit("audio-blip", { kind: "hit" });
    ship.x = 0;
    ship.y = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.a = Math.PI / 2;
    invulnUntil = now + INVULN_MS;
    updateHud();
    if (lives <= 0) endGame(true);
  }

  // ---------- rendering ----------

  function renderShip(): void {
    const p = shipOv.positions;
    const cos = Math.cos(ship.a);
    const sin = Math.sin(ship.a);
    const per = SHIP_PARTS / 3;
    let i = 0;
    for (let edge = 0; edge < 3; edge++) {
      const [ax, ay] = TRI[edge];
      const [bx, by] = TRI[(edge + 1) % 3];
      for (let k = 0; k < per; k++) {
        const t = k / per;
        const lx = (ax + (bx - ax) * t) * SHIP_SCALE;
        const ly = (ay + (by - ay) * t) * SHIP_SCALE;
        p[i * 3] = ship.x + lx * cos - ly * sin;
        p[i * 3 + 1] = ship.y + lx * sin + ly * cos;
        p[i * 3 + 2] = 0;
        i++;
      }
    }
    shipOv.sync();
  }

  function renderBullets(): void {
    const p = bulletOv.positions;
    for (let s = 0; s < BULLETS_MAX; s++) {
      const b = bullets[s];
      for (let k = 0; k < TRAIL; k++) {
        const i = (s * TRAIL + k) * 3;
        if (b.active) {
          p[i] = b.x - b.dx * k * 0.07;
          p[i + 1] = b.y - b.dy * k * 0.07;
          p[i + 2] = 0;
        } else {
          p[i] = OFF;
          p[i + 1] = OFF;
        }
      }
    }
    bulletOv.sync();
  }

  renderShip();

  // ---------- huvudloop ----------

  let rafId = 0;
  let frame = 0;
  let last = performance.now();

  function tick(now: number): void {
    if (!active) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(Math.max(now - last, 0) / 1000, 0.05);
    last = now;
    frame++;
    const { halfW, halfH } = engine.worldBounds();

    // skepp
    const turn = (keys.has("left") ? 1 : 0) - (keys.has("right") ? 1 : 0);
    ship.a += turn * ROT_SPEED * dt;
    if (keys.has("thrust")) {
      ship.vx += Math.cos(ship.a) * THRUST * dt;
      ship.vy += Math.sin(ship.a) * THRUST * dt;
    }
    const damp = Math.pow(DAMPING, dt * 60);
    ship.vx *= damp;
    ship.vy *= damp;
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > MAX_SPEED) {
      ship.vx *= MAX_SPEED / sp;
      ship.vy *= MAX_SPEED / sp;
    }
    ship.x = wrap(ship.x + ship.vx * dt, halfW, 0.3);
    ship.y = wrap(ship.y + ship.vy * dt, halfH, 0.3);

    if (keys.has("fire")) shoot(now);

    // skott
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      b.x = wrap(b.x + b.vx * dt, halfW, 0.1);
      b.y = wrap(b.y + b.vy * dt, halfH, 0.1);
    }

    // asteroider
    for (const a of asteroids) {
      a.x = wrap(a.x + a.vx * dt, halfW, a.radius);
      a.y = wrap(a.y + a.vy * dt, halfH, a.radius);
      a.rot += a.spin * dt;
    }

    // skott ↔ asteroid
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      for (const b of bullets) {
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy < a.radius * a.radius) {
          b.active = false;
          hitAsteroid(i);
          break;
        }
      }
    }

    // skepp ↔ asteroid
    if (now >= invulnUntil) {
      for (const a of asteroids) {
        const dx = ship.x - a.x;
        const dy = ship.y - a.y;
        const r = a.radius + SHIP_R;
        if (dx * dx + dy * dy < r * r) {
          loseLife(now);
          break;
        }
      }
    }
    if (!active) return; // game over inne i loseLife — overlays är borta

    // våg avklarad
    if (asteroids.length === 0) {
      wave++;
      spawnWave(Math.min(START_AST + wave - 1, MAX_AST));
      ctx.toast(ctx.t({ sv: `Våg ${wave}`, en: `Wave ${wave}` }));
    }

    // odödlighetsblink: hoppa över varannan frame
    const blink = now < invulnUntil && (frame & 1) === 1;
    shipOv.setVisible(!blink);
    renderShip();
    for (const a of asteroids) renderAsteroid(a);
    renderBullets();
  }
  rafId = requestAnimationFrame(tick);

  // ---------- städning ----------

  function endGame(gameOver: boolean): void {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);

    shipOv.dispose();
    bulletOv.dispose();
    for (const a of asteroids) a.overlay.dispose();
    asteroids.length = 0;

    hud.remove();
    document.body.classList.remove("game-active");
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("blur", onBlur);
    offLang();

    // återställ scrollpositionen utan smooth-glid
    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, savedScroll);
    root.style.scrollBehavior = prevBehavior;

    const record = score > storedHi;
    if (record) localStorage.setItem(HI_KEY, String(score));

    engine.setShape(prevShape);
    engine.paused = false;
    bus.emit("game-end", { game: "asteroids", score });

    if (gameOver) {
      engine.morphToText("GG", 2500);
      ctx.toast(
        ctx.t({
          sv: `Slut — ${score} poäng${record ? " · nytt rekord!" : ""}`,
          en: `Game over — ${score} points${record ? " · new high score!" : ""}`,
        })
      );
    }
  }
}

// ---------- asteroider ----------

function makeAsteroid(engine: EngineApi, tier: 1 | 2 | 3, x: number, y: number, speedMul: number): Asteroid {
  const radius = RADII[tier];
  const overlay = engine.createOverlay(AST_PARTS);
  const offs = new Float32Array(AST_PARTS * 3);
  for (let i = 0; i < AST_PARTS; i++) {
    // skal runt centroiden, lite djupjitter
    const ang = Math.random() * Math.PI * 2;
    const r = radius * (0.72 + Math.random() * 0.33);
    offs[i * 3] = Math.cos(ang) * r;
    offs[i * 3 + 1] = Math.sin(ang) * r;
    offs[i * 3 + 2] = (Math.random() - 0.5) * radius * 0.25;
    const v = 0.45 + Math.random() * 0.3;
    overlay.colors[i * 3] = v * 0.9;
    overlay.colors[i * 3 + 1] = v * 0.96;
    overlay.colors[i * 3 + 2] = Math.min(1, v * 1.1);
  }
  const dir = Math.random() * Math.PI * 2;
  const speed = (0.3 + Math.random() * 0.5) * speedMul;
  const a: Asteroid = {
    overlay,
    offs,
    tier,
    radius,
    x,
    y,
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.2,
  };
  renderAsteroid(a);
  return a;
}

function renderAsteroid(a: Asteroid): void {
  const p = a.overlay.positions;
  const c = Math.cos(a.rot);
  const s = Math.sin(a.rot);
  for (let i = 0; i < AST_PARTS; i++) {
    const ox = a.offs[i * 3];
    const oy = a.offs[i * 3 + 1];
    p[i * 3] = a.x + ox * c - oy * s;
    p[i * 3 + 1] = a.y + ox * s + oy * c;
    p[i * 3 + 2] = a.offs[i * 3 + 2];
  }
  a.overlay.sync();
}

/** Wrap-around vid spelplanens kant, med marginal så objektet hinner ut helt. */
function wrap(v: number, half: number, margin: number): number {
  if (v > half + margin) return -half - margin;
  if (v < -half - margin) return half + margin;
  return v;
}
