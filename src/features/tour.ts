/**
 * Play-turen: autopiloten warpar genom hela rutten och stannar vid varje
 * stopp med en kort berättartext. Scroll/Esc/klick kliver av exakt där man
 * är; Space/→ hoppar vidare. En fullbordad resa — guidad eller på egen hand —
 * markerar pf-journey-done och låser upp diplomet Rymdresenär.
 */
import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";
import { local, readJsonArray } from "../app/storage";
import { projects, ui } from "../data/content";
import type { JourneyApi } from "./journey";

const DONE_KEY = "pf-journey-done";
const VISITED_KEY = "pf-visited";
const DWELL_MS = 6500;

const LINES: Record<string, { sv: string; en: string }> = {
  hem: {
    sv: "Välkommen ombord. Åtta stopp ligger på rutten — spänn fast dig.",
    en: "Welcome aboard. Eight stops on the route — buckle up.",
  },
  meritvo: {
    sv: "Första stoppet: Meritvo. En hel SaaS där AI föreslår och du godkänner — CV:n byggda från en enda masterdatamodell.",
    en: "First stop: Meritvo. A full SaaS where AI proposes and you approve — CVs built from a single masterdata model.",
  },
  pilot: {
    sv: "Pilot — en lokal AI-agent som inte litar på sig själv: den samlar bevis och svarar bara på det den verifierat.",
    en: "Pilot — a local AI agent that doesn't trust itself: it gathers evidence and only answers from what it verified.",
  },
  "design-pilot": {
    sv: "Design-Pilot: ett Figma-likt canvas där riktiga React-komponenter renderas — och koden blir din, inte ett beroende.",
    en: "Design-Pilot: a Figma-like canvas rendering real React components — and the code becomes yours, not a dependency.",
  },
  viska: {
    sv: "Viska. Tryck F9 och prata — svensktränad Whisper på egen GPU skriver där markören står. Inget moln.",
    en: "Viska. Press F9 and speak — Swedish-trained Whisper on a local GPU types where the cursor is. No cloud.",
  },
  referat: {
    sv: "referat spelar in mötet och skriver protokollet — med talardiarisering, helt lokalt. Ingen bot i samtalet.",
    en: "referat records the meeting and writes the minutes — with speaker diarization, fully local. No bot in the call.",
  },
  smask: {
    sv: "Smask! Familjens kokbok: fota en kokbokssida, få ett recept — och veckans mat blir en färdig handlingslista.",
    en: "Smask! The family cookbook: photograph a page, get a recipe — and the week's meals become a shopping list.",
  },
  kontakt: {
    sv: "Sista stoppet. Gillade du resan? Mejlen är närmast till hands — och loggen gömmer fler hemligheter.",
    en: "Final stop. Enjoyed the ride? Email is one click away — and the log hides more secrets.",
  },
};

const CSS = `
.tour-caption {
  position: fixed; left: 50%; bottom: 5.4rem; transform: translateX(-50%);
  z-index: 46; width: min(560px, 92vw); padding: 1rem 1.2rem;
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  border: 1px solid var(--faint); border-radius: 14px; backdrop-filter: blur(10px);
  animation: tour-in 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes tour-in { from { opacity: 0; transform: translate(-50%, 10px); } }
.tour-progress { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.45rem; }
.tour-progress .mono { color: var(--accent); font-size: 0.7rem; }
.tour-dots { display: flex; gap: 0.3rem; }
.tour-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--faint); }
.tour-dots i.is-done { background: var(--accent); }
.tour-text { font-size: 0.92rem; line-height: 1.5; }
.tour-hint { margin-top: 0.5rem; color: var(--muted); font-size: 0.68rem; font-family: var(--font-mono); }
@media (max-width: 720px) { .tour-caption { bottom: 4.6rem; } }
`;

export function initTour(ctx: FeatureContext, deps: { journey: JourneyApi }): void {
  injectStyle("tour-css", CSS);

  const order = ["hem", ...projects.map((p) => p.id), "kontakt"];
  const nameOf = (id: string) =>
    id === "hem" ? ctx.t(ui.home) : id === "kontakt" ? ctx.t(ui.contact) : projects.find((p) => p.id === id)?.name ?? id;

  let running = false;

  // ---------- fullbordad resa (delas av turen och egen upptäckt) ----------

  const complete = () => {
    if (local.getItem(DONE_KEY) === "1") return;
    local.setItem(DONE_KEY, "1");
    ctx.bus.emit("journey-complete", {});
    ctx.engine.burst(2);
  };

  const visited = new Set<string>(readJsonArray<string>(local, VISITED_KEY));
  const markVisited = (id: string) => {
    if (!order.includes(id) || visited.has(id)) return;
    visited.add(id);
    local.setItem(VISITED_KEY, JSON.stringify([...visited]));
    if (order.every((s) => visited.has(s))) complete();
  };
  ctx.bus.on("section", ({ id }) => markVisited(id));

  // startsektionens event hann fyras innan vi prenumererade — så den sektion
  // som är i vy just nu (oftast hem, men scroll-restore kan landa var som helst)
  const mid = window.innerHeight / 2;
  let nearest: string | null = null;
  let nearestDist = Infinity;
  for (const id of order) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - mid);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = id;
    }
  }
  if (nearest) markVisited(nearest);

  // ---------- själva turen ----------

  const typingTarget = (e: Event) => {
    const el = e.target as HTMLElement;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  };
  const overlayOpen = () =>
    !!document.querySelector(
      ".runeboard-overlay.is-open, .moon-overlay.is-open, .palette-overlay.is-open, .term-overlay.is-open, .help-overlay.is-open"
    );

  async function start(): Promise<void> {
    if (running || document.body.classList.contains("game-active")) return;
    running = true;
    deps.journey.setMode("journey");

    // en flygning användaren själv startade kan vara i luften — låt den landa
    for (let tries = 0; deps.journey.warping() && tries < 30; tries++) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const caption = document.createElement("div");
    caption.className = "tour-caption";
    caption.setAttribute("role", "status");
    document.body.append(caption);

    let aborted = false;
    let skipDwell: (() => void) | null = null;

    const abort = () => {
      aborted = true;
      skipDwell?.();
    };
    const onKey = (e: KeyboardEvent) => {
      // terminal/palett äger tangentbordet — mellanslag ska gå att skriva
      if (typingTarget(e)) return;
      if (e.key === "Escape") {
        // Esc stänger en öppen dialog — bara nästa Esc kliver av turen
        if (!overlayOpen()) abort();
      } else if ((e.key === " " || e.key === "ArrowRight") && !overlayOpen()) {
        e.preventDefault();
        skipDwell?.();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      // klick i captionen bläddrar vidare; interaktioner i dialoger/konsolen rör inte turen;
      // på touch är tapp = nästa (naturlig story-gest), musklick utanför kliver av
      if (t.closest(".tour-caption")) skipDwell?.();
      else if (
        t.closest(
          ".runeboard-overlay, .moon-overlay, .palette-overlay, .term-overlay, .help-overlay, .cockpit-console, .mode-chip, .moon"
        )
      )
        return;
      else if (e.pointerType === "touch") skipDwell?.();
      else abort();
    };
    const onWheel = () => {
      if (!overlayOpen()) abort();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("wheel", onWheel, { passive: true });

    const showCaption = (idx: number) => {
      caption.innerHTML = `
        <div class="tour-progress">
          <span class="mono">${idx + 1}/${order.length} · ${nameOf(order[idx])}</span>
          <span class="tour-dots">${order.map((_, i) => `<i${i <= idx ? ' class="is-done"' : ""}></i>`).join("")}</span>
        </div>
        <div class="tour-text">${ctx.t(LINES[order[idx]] ?? { sv: "", en: "" })}</div>
        <div class="tour-hint">${ctx.t({
          sv: "Space/→ eller tryck: nästa · scroll/Esc kliver av",
          en: "Space/→ or tap: next · scroll/Esc hops off",
        })}</div>`;
    };

    const dwell = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          skipDwell = null;
          resolve();
        }, ms);
        skipDwell = () => {
          window.clearTimeout(t);
          skipDwell = null;
          resolve();
        };
      });

    // resan räknas bara om VARJE stopp faktiskt flögs och visades — en avbruten
    // warp eller ett spel som startar mitt i får aldrig ge resediplomet
    let full = true;
    for (let i = 0; i < order.length; i++) {
      if (aborted || document.body.classList.contains("game-active")) {
        full = false;
        break;
      }
      const arrived = await deps.journey.warpTo(order[i]);
      if (!arrived || aborted) {
        full = false;
        break;
      }
      markVisited(order[i]);
      showCaption(i);
      await dwell(i === 0 ? 4200 : DWELL_MS);
    }
    if (aborted) full = false;

    window.removeEventListener("keydown", onKey);
    window.removeEventListener("pointerdown", onPointer);
    window.removeEventListener("wheel", onWheel);
    caption.remove();
    running = false;

    if (full) complete();
  }

  ctx.registerCommand({
    id: "tour-start",
    label: () => `▶ ${ctx.t(ui.playJourney)}`,
    group: () => ctx.t(ui.navigate),
    hint: "P",
    run: () => void start(),
  });
}
