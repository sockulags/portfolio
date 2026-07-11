/**
 * Ombordstigningen: vid första besöket tecknar partikelfältet en pilot som
 * går över plattan och sätter sig i cockpit — sedan bootar konsolen och
 * fältet återgår till galaxen. Helt byggt på morphToPoints, inga assets.
 * Skippbar med Esc/klick, spelas aldrig vid reduced motion eller återbesök.
 */
import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";
import { local } from "../app/storage";

const SEEN_KEY = "pf-intro-seen";
const FRAME_MS = 520;

const CSS = `
.intro-overlay {
  position: fixed; inset: 0; z-index: 45; pointer-events: none;
  display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5.5rem;
  opacity: 1; transition: opacity 0.4s ease;
}
.intro-overlay.is-leaving { opacity: 0; }
.intro-card { text-align: center; }
.intro-boot {
  font-family: var(--font-mono); font-size: 0.78rem; color: var(--muted);
  min-height: 3.6em; letter-spacing: 0.05em;
}
.intro-boot div { opacity: 0; animation: intro-line 0.3s ease forwards; }
.intro-boot div:nth-child(2) { animation-delay: 0.45s; }
.intro-boot div:nth-child(3) { animation-delay: 0.9s; }
@keyframes intro-line { to { opacity: 1; } }
.intro-skip {
  pointer-events: auto; margin-top: 0.9rem; border: 1px solid var(--faint);
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent); color: var(--muted);
  border-radius: 999px; padding: 0.4rem 1rem; cursor: pointer;
  font-family: var(--font-mono); font-size: 0.72rem;
}
.intro-skip:hover { color: var(--accent); border-color: var(--accent); }
`;

const CW = 960;
const CH = 540;
const GROUND = 470;

/** Streckpilot med volym: huvud + kropp + svängande armar/ben. */
function figure(g: CanvasRenderingContext2D, x: number, phase: 0 | 1 | 2): void {
  const sw = phase === 2 ? 0 : phase === 0 ? 1 : -1; // svängriktning
  g.lineWidth = 15;
  g.lineCap = "round";
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";

  if (phase === 2) {
    // sittande i stolen: lutad rygg, benen framåt, handen på spaken
    g.beginPath();
    g.arc(x + 6, GROUND - 178, 24, 0, 7);
    g.fill();
    g.beginPath();
    g.moveTo(x, GROUND - 150); // rygg, lätt bakåtlutad
    g.lineTo(x - 14, GROUND - 78);
    g.lineTo(x + 44, GROUND - 72); // lår framåt
    g.lineTo(x + 52, GROUND - 12); // underben ner
    g.stroke();
    g.beginPath();
    g.moveTo(x - 4, GROUND - 132); // arm mot spaken
    g.lineTo(x + 52, GROUND - 108);
    g.stroke();
    return;
  }

  g.beginPath();
  g.arc(x, GROUND - 300, 24, 0, 7);
  g.fill();
  g.beginPath();
  g.moveTo(x, GROUND - 272);
  g.lineTo(x, GROUND - 140);
  g.stroke();
  // armar
  g.beginPath();
  g.moveTo(x, GROUND - 248);
  g.lineTo(x + 34 * sw, GROUND - 178);
  g.moveTo(x, GROUND - 248);
  g.lineTo(x - 30 * sw, GROUND - 182);
  g.stroke();
  // ben
  g.beginPath();
  g.moveTo(x, GROUND - 140);
  g.lineTo(x + 38 * sw, GROUND - 8);
  g.moveTo(x, GROUND - 140);
  g.lineTo(x - 26 * sw, GROUND - 14);
  g.stroke();
}

/** Skeppet: stolens siluett, konsolbågen och en antydan till huv. */
function ship(g: CanvasRenderingContext2D, seatX: number): void {
  g.lineWidth = 12;
  g.lineCap = "round";
  g.strokeStyle = "#fff";
  // stol
  g.beginPath();
  g.moveTo(seatX - 34, GROUND - 190);
  g.lineTo(seatX - 34, GROUND - 60);
  g.lineTo(seatX + 34, GROUND - 60);
  g.stroke();
  // konsol med spak
  g.beginPath();
  g.moveTo(seatX + 96, GROUND - 60);
  g.lineTo(seatX + 96, GROUND - 128);
  g.lineTo(seatX + 150, GROUND - 140);
  g.stroke();
  // huvens båge
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(seatX - 140, GROUND - 40);
  g.quadraticCurveTo(seatX + 20, GROUND - 360, seatX + 210, GROUND - 60);
  g.stroke();
  // marklinje/platta
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(80, GROUND + 14);
  g.lineTo(CW - 80, GROUND + 14);
  g.stroke();
}

/** Rasterisera en teckning till punktmoln i världskoordinater (samma teknik som textmorphen). */
function toPoints(draw: (g: CanvasRenderingContext2D) => void, count: number, worldWidth: number): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const g = canvas.getContext("2d")!;
  draw(g);
  const img = g.getImageData(0, 0, CW, CH).data;
  const candidates: number[] = [];
  for (let y = 0; y < CH; y += 2) {
    for (let x = 0; x < CW; x += 2) {
      if (img[(y * CW + x) * 4 + 3] > 128) candidates.push(x, y);
    }
  }
  const points = new Float32Array(count * 3);
  if (candidates.length === 0) return points;
  const scale = worldWidth / CW;
  const n = candidates.length / 2;
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(Math.random() * n) * 2;
    points[i * 3] = (candidates[pick] - CW / 2) * scale + (Math.random() - 0.5) * 0.03;
    points[i * 3 + 1] = -(candidates[pick + 1] - CH / 2) * scale + (Math.random() - 0.5) * 0.03;
    points[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  return points;
}

export interface IntroApi {
  /** Spela sekvensen nu (ignorerar sett-flaggan). Resolvar när den är klar/skippad. */
  play(): Promise<void>;
  /** true om introt kommer att spelas automatiskt vid denna sidladdning. */
  willAutoplay: boolean;
}

export function initIntro(ctx: FeatureContext, opts: { journeyActive(): boolean }): IntroApi {
  const willAutoplay = opts.journeyActive() && !ctx.engine.reducedMotion && local.getItem(SEEN_KEY) !== "1";
  let running = false;

  const play = (): Promise<void> => {
    if (running || ctx.engine.reducedMotion || ctx.engine.paused) return Promise.resolve();
    running = true;
    local.setItem(SEEN_KEY, "1");
    injectStyle("intro-css", CSS);

    return new Promise<void>((resolve) => {
      const bounds = ctx.engine.worldBounds();
      const worldW = Math.min(bounds.halfW * 1.7, 10);
      const count = 22000;
      const seatX = CW / 2 + 110;
      const walkXs = [CW / 2 - 330, CW / 2 - 190, CW / 2 - 50, seatX - 40];

      const frames: Float32Array[] = [
        ...walkXs.map((x, i) => toPoints((g) => figure(g, x, (i % 2) as 0 | 1), count, worldW)),
        toPoints((g) => {
          ship(g, seatX);
          figure(g, seatX, 2);
        }, count, worldW),
      ];

      const overlay = document.createElement("div");
      overlay.className = "intro-overlay";
      overlay.innerHTML = `
        <div class="intro-card">
          <div class="intro-boot" aria-live="polite"></div>
          <button class="intro-skip">${ctx.t({ sv: "Hoppa över — Esc", en: "Skip — Esc" })}</button>
        </div>`;
      document.body.append(overlay);

      const timers: number[] = [];
      let done = false;

      const finish = (fast: boolean) => {
        if (done) return;
        done = true;
        timers.forEach((t) => window.clearTimeout(t));
        window.removeEventListener("keydown", onKey);
        overlay.removeEventListener("click", onSkip);
        overlay.classList.add("is-leaving");
        window.setTimeout(() => overlay.remove(), 420);
        if (fast) ctx.engine.setShape(ctx.engine.currentShape(), true);
        running = false;
        resolve();
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") finish(true);
      };
      const onSkip = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest(".intro-skip")) finish(true);
      };
      window.addEventListener("keydown", onKey);
      overlay.addEventListener("click", onSkip);

      // gångcykeln: varje bildruta blir nytt morph-mål — attraktorn ger stegkänslan
      frames.forEach((pts, i) => {
        const isLast = i === frames.length - 1;
        timers.push(
          window.setTimeout(() => {
            if (done) return;
            // sista rutan hålls längre, sedan släpper motorn själv tillbaka till galaxen
            ctx.engine.morphToPoints(pts, isLast ? 1500 : FRAME_MS + 400);
            if (isLast) {
              const boot = overlay.querySelector(".intro-boot");
              if (boot) {
                boot.innerHTML = ["// pilot ombord", "// partikelmotor: OK", `// ${ctx.t({ sv: "destination: portfölj", en: "destination: portfolio" })}`]
                  .map((l) => `<div>${l}</div>`)
                  .join("");
              }
              ctx.bus.emit("audio-blip", { kind: "morph" });
              timers.push(window.setTimeout(() => finish(false), 2100));
            }
          }, i * FRAME_MS)
        );
      });
    });
  };

  ctx.registerCommand({
    id: "intro-replay",
    label: () => ctx.t({ sv: "Spela ombordstigningen igen", en: "Replay the boarding scene" }),
    group: () => ctx.t({ sv: "Åtgärder", en: "Actions" }),
    // reduced motion: sekvensen spelas aldrig — visa inte ett kommando som inget gör
    visible: () => !ctx.engine.reducedMotion,
    run: () => void play(),
  });

  return { play, willAutoplay };
}
