/**
 * Äventyrsläget: cockpit-HUD, warpflygningar (1,5–2,5 s) till varje stopp och
 * WASD-löpning genom rymden. Klassisk vy är alltid ett klick bort — reduced
 * motion tvingar den. Rälsen ÄR sidans scroll: warpen och löpningen animerar
 * scrollY, så klassisk vy och äventyr delar samma innehåll och tillstånd.
 */
import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";
import { local } from "../app/storage";
import { projects, ui } from "../data/content";

const MODE_KEY = "pf-mode";

export interface JourneyApi {
  active(): boolean;
  setMode(mode: "journey" | "classic"): void;
  /** Flyg till en sektion. Resolvar true om skeppet kom fram, false om
   *  användaren tog över spakarna (scroll/Esc) under flygningen. */
  warpTo(sectionId: string): Promise<boolean>;
  warping(): boolean;
}

const CSS = `
.cockpit { pointer-events: none; }
.cockpit-canopy { position: fixed; inset: 0; z-index: 36; pointer-events: none; opacity: 0; transition: opacity 0.6s ease; }
body.mode-journey .cockpit-canopy { opacity: 1; }
.cockpit-canopy::before, .cockpit-canopy::after {
  content: ""; position: absolute; width: clamp(70px, 12vw, 150px); height: clamp(70px, 12vw, 150px);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); transition: border-color 0.5s ease;
}
.cockpit-canopy::before { left: 0.9rem; bottom: 5.2rem; border-right: 0; border-top: 0; border-radius: 0 0 0 26px; }
.cockpit-canopy::after { right: 0.9rem; bottom: 5.2rem; border-left: 0; border-top: 0; border-radius: 0 0 26px 0; }

.cockpit-console {
  position: fixed; left: 50%; bottom: 0.9rem; transform: translate(-50%, 130%); z-index: 44;
  display: flex; align-items: center; gap: 0.5rem; max-width: min(96vw, 880px);
  padding: 0.45rem 0.6rem; border: 1px solid var(--faint); border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  pointer-events: auto;
  /* visibility håller den dolda konsolens elva knappar utanför tab-ordningen */
  opacity: 0; visibility: hidden;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease, visibility 0s linear 0.45s;
}
body.mode-journey .cockpit-console { transform: translate(-50%, 0); opacity: 1; visibility: visible; transition-delay: 0s; }
body.mode-journey.game-active .cockpit-console, body.mode-journey.idle-mode .cockpit-console {
  transform: translate(-50%, 130%); opacity: 0; visibility: hidden; transition-delay: 0s, 0s, 0.45s;
}

.ck-btn {
  display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid var(--faint);
  background: transparent; color: var(--fg); border-radius: 999px; padding: 0.42rem 0.7rem;
  font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.03em; cursor: pointer;
  white-space: nowrap; transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.ck-btn:hover { border-color: var(--accent); color: var(--accent); }
.ck-play { background: var(--accent); border-color: var(--accent); color: var(--bg); font-weight: 600; }
.ck-play:hover { color: var(--bg); filter: brightness(1.12); }

.ck-tracks { display: flex; gap: 0.3rem; overflow-x: auto; scrollbar-width: none; }
.ck-tracks::-webkit-scrollbar { display: none; }
.ck-track { position: relative; }
.ck-track kbd { font-size: 0.68em; padding: 0.1em 0.42em; border-color: color-mix(in srgb, var(--fg) 20%, transparent); }
.ck-track.is-here { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.ck-velocity { color: var(--muted); font-size: 0.68rem; min-width: 4.2rem; text-align: right; }

@media (max-width: 720px) {
  .ck-track span, .ck-velocity { display: none; }
  .ck-track kbd { font-size: 0.8em; }
  .cockpit-console { gap: 0.4rem; bottom: 0.6rem; }
  .cockpit-canopy::before, .cockpit-canopy::after { bottom: 4rem; }
}

.mode-chip {
  position: fixed; right: 1rem; bottom: 1rem; z-index: 44;
  border: 1px solid var(--faint); background: color-mix(in srgb, var(--bg-elevated) 85%, transparent);
  color: var(--fg); border-radius: 999px; padding: 0.5rem 0.9rem; cursor: pointer;
  font-family: var(--font-mono); font-size: 0.72rem; backdrop-filter: blur(8px);
  display: none;
}
.mode-chip:hover { border-color: var(--accent); color: var(--accent); }
body.mode-classic .mode-chip { display: block; }

.warp-canvas { position: fixed; inset: 0; z-index: 35; width: 100%; height: 100%; pointer-events: none; }
body.is-warping main { filter: blur(2.5px) brightness(1.06); }
main { transition: filter 0.35s ease; transform: translateX(var(--strafe, 0px)); }
body.is-warping .dots { opacity: 0; }
`;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface Star {
  angle: number;
  dist: number;
  speed: number;
  size: number;
}

export function initJourney(
  ctx: FeatureContext,
  deps: { onArrive(sectionId: string): void; onCancel(): void }
): JourneyApi {
  injectStyle("journey-css", CSS);

  const reduced = ctx.engine.reducedMotion;
  const saved = local.getItem(MODE_KEY) as "journey" | "classic" | null;
  let mode: "journey" | "classic" = reduced ? "classic" : (saved ?? "journey");
  let isWarping = false;

  // ---------- starlinjer + löpfysik: en gemensam rAF-loop, igång bara vid behov ----------

  const canvas = document.createElement("canvas");
  canvas.className = "warp-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const c2d = canvas.getContext("2d")!;
  const stars: Star[] = Array.from({ length: 150 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: Math.random(),
    speed: 0.5 + Math.random(),
    size: 0.6 + Math.random() * 1.6,
  }));

  let intensity = 0; // 0..1 — hur mycket fart som syns (warp eller löpning)
  let targetIntensity = 0;
  let loopActive = false;
  let lastT = 0;

  // löpning (WASD)
  const held = new Set<string>();
  let vel = 0; // px/s längs rälsen
  let strafe = 0;
  let runDistance = 0;

  const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7c6cff";

  const drawStars = (dt: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    c2d.clearRect(0, 0, w, h);
    if (intensity < 0.02) return;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(cx, cy);
    c2d.globalCompositeOperation = "lighter";
    c2d.strokeStyle = accent();
    c2d.lineCap = "round";
    for (const s of stars) {
      s.dist += s.speed * intensity * dt * 1.1;
      if (s.dist > 1) {
        s.dist = Math.random() * 0.25;
        s.angle = Math.random() * Math.PI * 2;
      }
      const r0 = Math.pow(s.dist, 2.2) * maxR;
      const len = Math.max(2, r0 * intensity * 0.22 * s.speed);
      const x = cx + Math.cos(s.angle) * r0;
      const y = cy + Math.sin(s.angle) * r0;
      const x2 = cx + Math.cos(s.angle) * (r0 + len);
      const y2 = cy + Math.sin(s.angle) * (r0 + len);
      c2d.globalAlpha = Math.min(0.75, 0.1 + s.dist * 0.8) * intensity;
      c2d.lineWidth = s.size;
      c2d.beginPath();
      c2d.moveTo(x, y);
      c2d.lineTo(x2, y2);
      c2d.stroke();
    }
    c2d.globalAlpha = 1;
    c2d.globalCompositeOperation = "source-over";
  };

  const velocityEl = () => console_.querySelector<HTMLElement>(".ck-velocity");

  const stepRun = (dt: number) => {
    if (mode !== "journey" || isWarping) return;
    const thrust = (held.has("w") ? 1 : 0) - (held.has("s") ? 1 : 0);
    const sprint = held.has("shift") ? 1.9 : 1;
    if (thrust !== 0) {
      vel += thrust * 3400 * sprint * dt;
      runDistance += Math.abs(vel) * dt;
      if (runDistance > window.innerHeight * 2.2) ctx.secrets.found("free-flight");
    } else {
      vel *= Math.exp(-3.4 * dt);
      if (Math.abs(vel) < 4) vel = 0;
    }
    const cap = 2400 * sprint;
    vel = Math.max(-cap, Math.min(cap, vel));
    if (vel !== 0) {
      const before = window.scrollY;
      // instant — annars kapar CSS scroll-behavior:smooth varje steg
      window.scrollBy({ top: vel * dt, behavior: "instant" });
      if (window.scrollY === before && thrust === 0) vel = 0; // nådde kanten
    }
    const sTarget = ((held.has("d") ? 1 : 0) - (held.has("a") ? 1 : 0)) * 26;
    strafe += (sTarget - strafe) * Math.min(1, dt * 8);
    document.documentElement.style.setProperty("--strafe", `${strafe.toFixed(1)}px`);
    if (!isWarping) targetIntensity = Math.min(1, Math.abs(vel) / 2600);
  };

  const loop = (t: number) => {
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    stepRun(dt);
    intensity += (targetIntensity - intensity) * Math.min(1, dt * 6);
    drawStars(dt);
    const vEl = velocityEl();
    if (vEl) vEl.textContent = `${(intensity * 0.98).toFixed(2)} c`;
    if (intensity < 0.015 && targetIntensity === 0 && held.size === 0 && !isWarping && vel === 0 && Math.abs(strafe) < 0.5) {
      loopActive = false;
      strafe = 0;
      document.documentElement.style.setProperty("--strafe", "0px");
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    requestAnimationFrame(loop);
  };

  const ensureLoop = () => {
    if (loopActive) return;
    loopActive = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  };

  // ---------- WASD ----------

  const typingTarget = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  };

  const uiBlocked = () =>
    document.body.classList.contains("game-active") ||
    !!document.querySelector(
      ".palette-overlay.is-open, .term-overlay.is-open, .runeboard-overlay.is-open, .help-overlay.is-open, .moon-overlay.is-open"
    );

  const WASD = ["w", "a", "s", "d"];
  let lastOtherLetterAt = 0;

  window.addEventListener("keydown", (e) => {
    if (mode !== "journey" || reduced || typingTarget(e) || uiBlocked()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "shift") {
      held.add("shift");
      return;
    }
    if (k.length === 1 && /[a-z]/.test(k) && !WASD.includes(k)) {
      // annan bokstav mitt i = användaren skriver (fuskkod) — släpp spakarna
      lastOtherLetterAt = performance.now();
      if (held.size) {
        held.clear();
        vel *= 0.2;
      }
      return;
    }
    if (!WASD.includes(k)) return;
    // färsk wasd-tangent tätt efter andra bokstäver = mitt i ett skrivet ord
    if (!e.repeat && performance.now() - lastOtherLetterAt < 600) return;
    held.add(k);
    ensureLoop();
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === "shift") held.delete("shift");
    if (["w", "a", "s", "d"].includes(k)) held.delete(k);
  });
  window.addEventListener("blur", () => held.clear());

  // free-flight utan tangentbord: touch- och reduced motion-besökare kan aldrig
  // hålla W — de förtjänar hemligheten via färdsträcka i stället. Lyssnaren
  // lever kvar (och mätaren nollställs) så speedrun-omstarter kan tjäna om den.
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (reduced || coarse) {
    let travelled = 0;
    let lastY = window.scrollY;
    ctx.bus.on("secrets-reset", () => {
      travelled = 0;
      lastY = window.scrollY;
    });
    window.addEventListener(
      "scroll",
      () => {
        travelled += Math.abs(window.scrollY - lastY);
        lastY = window.scrollY;
        if (travelled > window.innerHeight * 12) {
          travelled = 0;
          ctx.secrets.found("free-flight");
        }
      },
      { passive: true }
    );
  }

  // ---------- cockpit-DOM ----------

  const tracks: { id: string; key: string; label: () => string }[] = [
    { id: "hem", key: "0", label: () => ctx.t(ui.home) },
    ...projects.map((p, i) => ({ id: p.id, key: String(i + 1), label: () => p.name })),
    { id: "kontakt", key: "C", label: () => ctx.t(ui.contact) },
  ];

  const console_ = document.createElement("div");
  console_.className = "cockpit-console";
  console_.setAttribute("role", "toolbar");

  const chip = document.createElement("button");
  chip.className = "mode-chip";
  chip.addEventListener("click", () => setMode("journey"));

  const renderConsole = () => {
    console_.setAttribute("aria-label", ctx.t({ sv: "Skeppets konsol", en: "Ship console" }));
    console_.innerHTML = `
      <button class="ck-btn ck-play" data-ck="play" aria-label="${ctx.t(ui.playJourney)}" title="${ctx.t(ui.playJourney)}">▶</button>
      <div class="ck-tracks">
        ${tracks
          .map(
            (tr) =>
              `<button class="ck-btn ck-track" data-warp="${tr.id}" aria-label="${tr.label()}"><kbd>${tr.key}</kbd><span>${tr.label()}</span></button>`
          )
          .join("")}
      </div>
      <button class="ck-btn" data-ck="log" aria-label="${ctx.t(ui.shortcutsQuestlog)} (J)" title="${ctx.t(ui.shortcutsQuestlog)}">✦ <span data-ck-count>${ctx.secrets.count()}/${ctx.secrets.total()}</span></button>
      <button class="ck-btn" data-ck="mode" aria-label="${ctx.t({ sv: "Klassisk vy", en: "Classic view" })}" title="${ctx.t({ sv: "Klassisk vy", en: "Classic view" })}">▢</button>
      <span class="ck-velocity" aria-hidden="true">0.00 c</span>`;
    chip.textContent = ctx.t({ sv: "🚀 Äventyrsläge", en: "🚀 Journey mode" });
  };

  console_.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!btn) return;
    if (btn.dataset.warp) void warpTo(btn.dataset.warp);
    else if (btn.dataset.ck === "play") ctx.runCommand("tour-start");
    else if (btn.dataset.ck === "log") ctx.runCommand("runeboard");
    else if (btn.dataset.ck === "mode") setMode("classic");
  });

  const canopy = document.createElement("div");
  canopy.className = "cockpit-canopy";
  canopy.setAttribute("aria-hidden", "true");
  document.body.append(canopy, console_, chip);
  renderConsole();

  ctx.bus.on("section", ({ id }) => {
    console_.querySelectorAll<HTMLElement>(".ck-track").forEach((b) => {
      b.classList.toggle("is-here", b.dataset.warp === id);
    });
  });
  ctx.bus.on("secret", ({ count, total }) => {
    const el = console_.querySelector("[data-ck-count]");
    if (el) el.textContent = `${count}/${total}`;
  });
  ctx.bus.on("secrets-reset", () => renderConsole());
  ctx.bus.on("lang", () => renderConsole());

  // ---------- läge ----------

  const applyMode = () => {
    document.body.classList.toggle("mode-journey", mode === "journey");
    document.body.classList.toggle("mode-classic", mode === "classic");
  };

  function setMode(next: "journey" | "classic"): void {
    if (reduced && next === "journey") {
      ctx.toast(ctx.t({ sv: "Äventyrsläget respekterar reducerad rörelse — klassisk vy gäller.", en: "Journey mode respects reduced motion — classic view it is." }));
      return;
    }
    if (mode === next) return;
    mode = next;
    local.setItem(MODE_KEY, mode);
    if (mode !== "journey") {
      // släpp spakarna helt — annars fryser fart/strafe/streck kvar i klassisk vy
      held.clear();
      vel = 0;
      targetIntensity = 0;
      strafe = 0;
      document.documentElement.style.setProperty("--strafe", "0px");
    }
    applyMode();
    ctx.bus.emit("mode", { mode });
    ctx.toast(
      mode === "journey"
        ? ctx.t({ sv: "🚀 Äventyrsläge — 1–6 warpar, WASD springer", en: "🚀 Journey mode — 1–6 warps, WASD runs" })
        : ctx.t({ sv: "Klassisk vy", en: "Classic view" })
    );
  }
  applyMode();

  ctx.registerCommand({
    id: "mode-toggle",
    label: () =>
      mode === "journey" ? ctx.t({ sv: "Växla till klassisk vy", en: "Switch to classic view" }) : ctx.t({ sv: "Växla till äventyrsläge 🚀", en: "Switch to journey mode 🚀" }),
    group: () => ctx.t(ui.actions),
    run: () => setMode(mode === "journey" ? "classic" : "journey"),
  });

  // ---------- warp ----------

  async function warpTo(sectionId: string): Promise<boolean> {
    const target = document.getElementById(sectionId);
    if (!target) return false;
    if (mode !== "journey" || reduced || document.body.classList.contains("game-active")) {
      ctx.goTo(sectionId);
      return true;
    }
    if (isWarping) return false;

    const startY = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const targetY = Math.max(0, Math.min(max, startY + target.getBoundingClientRect().top));
    const dist = Math.abs(targetY - startY);
    if (dist < 60) {
      deps.onArrive(sectionId);
      return true;
    }

    // dold flik = ingen rAF — landa direkt utan flygning
    if (document.hidden) {
      window.scrollTo({ top: targetY, behavior: "instant" });
      deps.onArrive(sectionId);
      return true;
    }

    // 1,5 s bas + lite per skärmhöjd, tak 2,5 s
    const duration = Math.min(2500, 1500 + (dist / window.innerHeight) * 170);
    isWarping = true;
    document.body.classList.add("is-warping");
    ctx.bus.emit("audio-blip", { kind: "warp" });
    const wasPaused = ctx.engine.paused;
    ctx.engine.paused = true; // scrollspyn får inte morpha former vi bara passerar
    ctx.engine.shockwave(window.innerWidth / 2, window.innerHeight / 2, 0.7);
    ensureLoop();

    return new Promise<boolean>((resolve) => {
      const t0 = performance.now();
      let raf = 0;
      let done = false;

      const finish = (completed: boolean) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        removeCancelers();
        isWarping = false;
        targetIntensity = 0;
        document.body.classList.remove("is-warping");
        // startade ett spel mitt i flygningen äger spelet nu paused-flaggan
        const gameActive = document.body.classList.contains("game-active");
        if (!gameActive) ctx.engine.paused = wasPaused;
        if (completed) {
          window.scrollTo({ top: targetY, behavior: "instant" });
          if (!gameActive) {
            deps.onArrive(sectionId);
            ctx.engine.shockwave(window.innerWidth / 2, window.innerHeight / 2, 1.5);
          }
          ctx.secrets.found("first-warp");
        } else if (!gameActive) {
          // avbruten flygning: scrollspyn hann uppdatera sektionen medan motorn
          // var pausad — rita om formen där vi faktiskt hamnade
          deps.onCancel();
        }
        resolve(completed);
      };

      const cancel = () => finish(false);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") cancel();
      };
      // göms fliken mitt i flygningen pausas rAF — landa direkt i stället
      const onHide = () => {
        if (document.hidden) finish(true);
      };
      const removeCancelers = () => {
        window.removeEventListener("wheel", cancel);
        window.removeEventListener("touchmove", cancel);
        window.removeEventListener("keydown", onKey);
        document.removeEventListener("visibilitychange", onHide);
      };
      window.addEventListener("wheel", cancel, { passive: true });
      window.addEventListener("touchmove", cancel, { passive: true });
      window.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onHide);

      const step = (now: number) => {
        const raw = Math.min((now - t0) / duration, 1);
        const e = easeInOutCubic(raw);
        // fartkuvertet: accelerera in, bromsa ut
        targetIntensity = Math.sin(raw * Math.PI);
        // instant — annars kapar CSS scroll-behavior:smooth varje steg
        window.scrollTo({ top: startY + (targetY - startY) * e, behavior: "instant" });
        if (raw >= 1) finish(true);
        else raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }

  return {
    active: () => mode === "journey",
    setMode,
    warpTo,
    warping: () => isWarping,
  };
}
