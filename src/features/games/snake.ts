/**
 * Snake spelat på gitter-sektionens noder (z=0-planet).
 * startSnake() registrerar palettkommandot "game-snake" — själva spelet
 * startar när kommandot körs (t.ex. via ctx.runCommand("game-snake")).
 */
import type { FeatureContext } from "../../app/contracts";
import { injectStyle, el } from "../../app/dom";

const GRID = 14;
const PARTICLES = 200;
const FOOD_SLOT = PARTICLES - 1;
const BASE_TICK = 165;
const MIN_TICK = 95;
const HI_KEY = "pf-snake-hi";

const CSS = `
.snake-hud {
  position: fixed;
  top: 5rem;
  left: clamp(1.25rem, 4vw, 3rem);
  z-index: 45;
  display: grid;
  gap: 0.3rem;
  padding: 0.65rem 0.95rem;
  border: 1px solid var(--faint);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
}
.snake-score {
  color: var(--fg);
  font-size: 0.95rem;
  letter-spacing: 0.08em;
}
.snake-hint {
  color: var(--muted);
  font-size: 0.72rem;
}
.snake-count {
  position: fixed;
  top: 38%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 45;
  font-family: var(--font-mono);
  font-size: clamp(4rem, 12vw, 8rem);
  font-weight: 700;
  color: var(--fg);
  opacity: 0.85;
  text-shadow: 0 0 40px var(--accent);
  pointer-events: none;
}
.snake-quit {
  position: absolute;
  top: -0.7rem;
  right: -0.7rem;
  pointer-events: auto;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 50%;
  border: 1px solid var(--faint);
  background: var(--bg-elevated);
  color: var(--fg);
  font-size: 0.8rem;
  cursor: pointer;
}
`;

let initialized = false;
let running = false;

export function startSnake(ctx: FeatureContext): void {
  if (initialized) return;
  initialized = true;
  ctx.registerCommand({
    id: "game-snake",
    label: () => ctx.t({ sv: "Spela Snake (på gittret)", en: "Play Snake (on the lattice)" }),
    group: () => ctx.t({ sv: "Spel", en: "Games" }),
    run: () => beginGame(ctx),
  });
}

function beginGame(ctx: FeatureContext): void {
  if (running) return;
  // ett spel i taget — Asteroids kan redan äga motorn
  if (document.body.classList.contains("game-active")) {
    ctx.toast(ctx.t({ sv: "Ett spel är redan igång.", en: "A game is already running." }));
    return;
  }
  if (ctx.engine.reducedMotion) {
    ctx.toast(
      ctx.t({
        sv: "Snake kräver rörelse — inaktiverat när reducerad rörelse är på.",
        en: "Snake needs motion — disabled while reduced motion is on.",
      })
    );
    return;
  }
  running = true;
  ctx.goTo("design-pilot");
  window.setTimeout(() => setup(ctx), 700);
}

function setup(ctx: FeatureContext): void {
  ctx.engine.setShape("lattice");
  ctx.engine.paused = true;
  ctx.bus.emit("game-start", { game: "snake" });
  document.body.classList.add("game-active");
  injectStyle("snake-style", CSS);

  // brädets nodkoordinater beräknas en gång: 72 % av synligt min-mått
  const bounds = ctx.engine.worldBounds();
  const span = Math.min(bounds.halfW, bounds.halfH) * 2 * 0.72;
  const step = span / (GRID - 1);
  const nodeX = (c: number): number => -span / 2 + c * step;
  const nodeY = (r: number): number => -span / 2 + r * step;

  const overlay = ctx.engine.createOverlay(PARTICLES);
  overlay.setVisible(true);

  // cellindex = rad * GRID + kolumn, huvudet först — startar åt höger
  const snake: number[] = [7 * GRID + 7, 7 * GRID + 6, 7 * GRID + 5];
  let dirX = 1;
  let dirY = 0;
  let nextX = 1;
  let nextY = 0;
  let score = 0;
  let tickTimer = 0;
  let raf = 0;

  const spawnFood = (): number => {
    const taken = new Set(snake);
    const free: number[] = [];
    for (let i = 0; i < GRID * GRID; i++) if (!taken.has(i)) free.push(i);
    return free.length > 0 ? free[Math.floor(Math.random() * free.length)] : -1;
  };
  let food = spawnFood();

  const hud = el("div", { class: "snake-hud mono" });
  const scoreEl = el("div", { class: "snake-score" });
  const hintEl = el("div", { class: "snake-hint" });
  const quitEl = el("button", { class: "snake-quit", "aria-label": "Quit" }, "✕");
  quitEl.addEventListener("click", () => finish(false));
  hud.append(scoreEl, hintEl, quitEl);
  document.body.append(hud);

  const renderHud = (): void => {
    scoreEl.textContent = `${ctx.t({ sv: "Poäng", en: "Score" })}: ${score}`;
    hintEl.textContent = ctx.t({
      sv: "WASD styr · ESC avslutar",
      en: "WASD steers · ESC quits",
    });
  };
  renderHud();
  const unsubLang = ctx.bus.on("lang", renderHud);

  const paint = (now: number): void => {
    const pos = overlay.positions;
    const col = overlay.colors;
    for (let i = 0; i < PARTICLES; i++) {
      const o = i * 3;
      if (i < snake.length) {
        pos[o] = nodeX(snake[i] % GRID);
        pos[o + 1] = nodeY(Math.floor(snake[i] / GRID));
        pos[o + 2] = 0;
        if (i === 0) {
          col[o] = 1;
          col[o + 1] = 1;
          col[o + 2] = 1;
        } else {
          const fade = 1 - (i / snake.length) * 0.55;
          col[o] = 0.35 * fade;
          col[o + 1] = 0.95 * fade;
          col[o + 2] = 0.55 * fade;
        }
      } else if (i === FOOD_SLOT && food >= 0) {
        const pulse = 0.55 + 0.45 * Math.sin(now * 0.006);
        pos[o] = nodeX(food % GRID);
        pos[o + 1] = nodeY(Math.floor(food / GRID));
        pos[o + 2] = 0;
        col[o] = pulse;
        col[o + 1] = 0.72 * pulse;
        col[o + 2] = 0.25 * pulse;
      } else {
        // oanvänd slot — parkeras utanför frustum
        pos[o] = 0;
        pos[o + 1] = 0;
        pos[o + 2] = -9999;
        col[o] = 0;
        col[o + 1] = 0;
        col[o + 2] = 0;
      }
    }
    overlay.sync();
  };

  const frame = (now: number): void => {
    paint(now);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const cleanup = (): void => {
    window.removeEventListener("keydown", onKey);
    window.clearTimeout(tickTimer);
    window.clearInterval(countInterval);
    countEl.remove();
    cancelAnimationFrame(raf);
    unsubLang();
    overlay.dispose();
    hud.remove();
    document.body.classList.remove("game-active");
    ctx.engine.paused = false;
    running = false;
    ctx.bus.emit("game-end", { game: "snake", score });
  };

  // gemensam avslutning: rekordet sparas oavsett om man dör eller kliver av
  const finish = (died: boolean): void => {
    const hi = Math.max(score, Number(localStorage.getItem(HI_KEY)) || 0);
    localStorage.setItem(HI_KEY, String(hi));
    if (died) {
      ctx.toast(
        ctx.t({
          sv: `Game over — ${score} poäng · rekord ${hi}`,
          en: `Game over — ${score} points · best ${hi}`,
        })
      );
    }
    cleanup();
  };

  const die = (): void => {
    ctx.engine.shockwaveWorld(nodeX(snake[0] % GRID), nodeY(Math.floor(snake[0] / GRID)), 1.5);
    finish(true);
  };

  const tick = (): void => {
    dirX = nextX;
    dirY = nextY;
    const hc = (snake[0] % GRID) + dirX;
    const hr = Math.floor(snake[0] / GRID) + dirY;
    if (hc < 0 || hc >= GRID || hr < 0 || hr >= GRID) return die();
    const head = hr * GRID + hc;
    const eating = head === food;
    if (!eating) snake.pop();
    if (snake.includes(head)) return die();
    snake.unshift(head);
    if (eating) {
      score++;
      renderHud();
      ctx.bus.emit("audio-blip", { kind: "hit" });
      if (score === 10) ctx.secrets.found("snake-10");
      food = spawnFood();
      if (food < 0) return die(); // brädet fullt
    }
    tickTimer = window.setTimeout(tick, Math.max(MIN_TICK, BASE_TICK - score * 2));
  };
  // nedräkning innan ormen kryper — hinner se brädet och läsa kontrollerna
  const countEl = el("div", { class: "snake-count", "aria-hidden": "true" });
  document.body.append(countEl);
  let countdown = 3;
  countEl.textContent = String(countdown);
  const countInterval = window.setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      window.clearInterval(countInterval);
      countEl.remove();
      tickTimer = window.setTimeout(tick, BASE_TICK);
    } else {
      countEl.textContent = String(countdown);
    }
  }, 1000);

  const onKey = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "Escape") {
      finish(false);
      return;
    }
    // enbart WASD — piltangenterna lämnas åt sidscrollen
    const k = e.key.toLowerCase();
    if (k === "w" && dirY !== -1) {
      nextX = 0;
      nextY = 1;
    } else if (k === "s" && dirY !== 1) {
      nextX = 0;
      nextY = -1;
    } else if (k === "a" && dirX !== 1) {
      nextX = -1;
      nextY = 0;
    } else if (k === "d" && dirX !== -1) {
      nextX = 1;
      nextY = 0;
    }
  };
  window.addEventListener("keydown", onKey);
}
