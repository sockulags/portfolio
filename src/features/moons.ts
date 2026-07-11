/**
 * Månarna: små sidoprojekt som kretsar kring sina värdplaneter. De dyker upp
 * när man är vid rätt sektion, och att öppna en räknas som en (lätt) hemlighet.
 * Renderas i DOM med partikelaktig glöd — synliga i både äventyr och klassiskt.
 */
import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";
import { moons, type Moon } from "../data/content";

const CSS = `
.moon {
  position: fixed; z-index: 38; width: 46px; height: 46px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--moon-accent) 55%, transparent);
  background: radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--moon-accent) 65%, transparent), color-mix(in srgb, var(--moon-accent) 12%, transparent) 65%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--moon-accent) 35%, transparent);
  cursor: pointer; opacity: 0; pointer-events: none; transform: scale(0.6);
  /* visibility håller dolda månar utanför tab-ordning och skärmläsare */
  visibility: hidden;
  transition: opacity 0.6s ease, transform 0.6s ease, visibility 0s linear 0.6s;
}
.moon.is-visible { visibility: visible; opacity: 1; pointer-events: auto; transform: scale(1); transition-delay: 0s; animation: moon-orbit 7s ease-in-out infinite; }
.moon.is-found::after {
  content: "✦"; position: absolute; inset: 0; display: grid; place-items: center;
  color: var(--bg); font-size: 0.9rem;
}
@keyframes moon-orbit {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -14px; }
}
@media (prefers-reduced-motion: reduce) { .moon.is-visible { animation: none; } }
.moon-label {
  position: absolute; top: 105%; left: 50%; transform: translateX(-50%);
  font-family: var(--font-mono); font-size: 0.62rem; color: var(--muted); white-space: nowrap;
}

.moon-overlay {
  position: fixed; inset: 0; z-index: 60; display: none;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.moon-overlay.is-open { display: block; }
.moon-card {
  width: min(460px, 92vw); margin: 16vh auto 0; padding: 1.8rem;
  background: var(--bg-elevated); border: 1px solid var(--faint); border-radius: 16px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.45);
  animation: moon-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes moon-in { from { opacity: 0; transform: translateY(10px); } }
.moon-card h3 { font-family: var(--font-display); margin-bottom: 0.2rem; }
.moon-card .moon-tagline { color: var(--moon-accent); font-family: var(--font-mono); font-size: 0.75rem; margin-bottom: 0.9rem; }
.moon-card p { color: var(--muted); font-size: 0.92rem; margin-bottom: 1.1rem; }
.moon-card .moon-links { display: flex; gap: 0.6rem; flex-wrap: wrap; }
`;

export function initMoons(ctx: FeatureContext): void {
  injectStyle("moons-css", CSS);

  let overlay: HTMLElement | null = null;
  let returnFocus: HTMLElement | null = null;

  const closeCard = () => {
    overlay?.classList.remove("is-open");
    returnFocus?.focus();
    returnFocus = null;
  };

  const openCard = (moon: Moon) => {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "moon-overlay";
      document.body.append(overlay);
      overlay.addEventListener("pointerdown", (e) => {
        if (e.target === overlay) closeCard();
      });
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeCard();
      });
    }
    overlay.style.setProperty("--moon-accent", moon.accent);
    overlay.innerHTML = `
      <div class="moon-card" role="dialog" aria-modal="true" aria-label="${moon.name}" tabindex="-1">
        <h3>${moon.name}</h3>
        <div class="moon-tagline">${ctx.t(moon.tagline)}</div>
        <p>${ctx.t(moon.description)}</p>
        <div class="moon-links">
          <a class="btn btn-primary" href="${moon.liveUrl}" target="_blank" rel="noopener noreferrer" data-hover>${ctx.t({ sv: "Testa live", en: "Try it live" })} <span aria-hidden="true">&nearr;</span></a>
          <a class="btn" href="${moon.repoUrl}" target="_blank" rel="noopener noreferrer" data-hover>GitHub <span aria-hidden="true">&nearr;</span></a>
        </div>
      </div>`;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.classList.add("is-open");
    overlay.querySelector<HTMLElement>(".moon-card")?.focus();
    ctx.secrets.found(moon.secretId);
  };

  moons.forEach((moon, i) => {
    const btn = document.createElement("button");
    btn.className = "moon";
    btn.style.setProperty("--moon-accent", moon.accent);
    // varannan måne till vänster/höger, en bit upp — utanför innehållskortet
    btn.style.top = `${18 + i * 9}%`;
    btn.style[i % 2 === 0 ? "right" : "left"] = "clamp(0.8rem, 6vw, 5rem)";
    btn.setAttribute("aria-label", ctx.t({ sv: `Månen ${moon.name}`, en: `The moon ${moon.name}` }));
    btn.innerHTML = `<span class="moon-label">${moon.name}</span>`;
    btn.addEventListener("click", () => openCard(moon));
    if (ctx.secrets.has(moon.secretId)) btn.classList.add("is-found");
    document.body.append(btn);

    ctx.bus.on("section", ({ id }) => {
      btn.classList.toggle("is-visible", id === moon.host);
    });
    ctx.bus.on("secret", ({ id }) => {
      if (id === moon.secretId) btn.classList.add("is-found");
    });
    ctx.bus.on("secrets-reset", () => {
      btn.classList.toggle("is-found", ctx.secrets.has(moon.secretId));
    });

    ctx.registerCommand({
      id: `moon-${moon.id}`,
      label: () => ctx.t({ sv: `Besök månen ${moon.name} 🌙`, en: `Visit the moon ${moon.name} 🌙` }),
      group: () => ctx.t({ sv: "Navigera", en: "Navigate" }),
      run: () => {
        ctx.goTo(moon.host);
        window.setTimeout(() => openCard(moon), 650);
      },
    });
  });
}
