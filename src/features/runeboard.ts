import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";

const CSS = `
.runeboard-overlay {
  position: fixed; inset: 0; z-index: 60; display: none;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(6px);
}
.runeboard-overlay.is-open { display: block; }
.runeboard {
  width: min(520px, 92vw); margin: 14vh auto 0; padding: 1.8rem;
  background: var(--bg-elevated); border: 1px solid var(--faint); border-radius: 16px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.45);
  animation: palette-in 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.runeboard h3 { font-family: var(--font-display); margin-bottom: 0.3rem; }
.runeboard .runeboard-sub { color: var(--muted); font-size: 0.85rem; margin-bottom: 1.2rem; }
.runeboard-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
.rune {
  padding: 0.7rem 0.6rem; border: 1px solid var(--faint); border-radius: 10px;
  text-align: center; min-height: 4.6rem;
}
.rune-glyph { font-size: 1.2rem; display: block; margin-bottom: 0.25rem; color: var(--faint); }
.rune.is-found { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.rune.is-found .rune-glyph { color: var(--accent); }
.rune-name { font-family: var(--font-mono); font-size: 0.66rem; color: var(--fg); display: block; }
.rune-hint { font-size: 0.66rem; color: var(--muted); line-height: 1.35; display: block; margin-top: 0.2rem; }
`;

/** Runtavlan: översikt över hittade hemligheter med kryptiska ledtrådar. */
export function initRuneboard(ctx: FeatureContext): void {
  let overlay: HTMLElement | null = null;

  const render = () => {
    const list = ctx.secrets.list();
    const runes = list
      .map((s) => {
        const glyph = s.found ? "✦" : "✧";
        const name = s.found ? s.id : "???";
        const hint = s.found ? "" : `<span class="rune-hint">${ctx.t(s.hint)}</span>`;
        return `<div class="rune${s.found ? " is-found" : ""}">
          <span class="rune-glyph">${glyph}</span>
          <span class="rune-name">${name}</span>${hint}
        </div>`;
      })
      .join("");
    overlay!.innerHTML = `
      <div class="runeboard" role="dialog" aria-modal="true" tabindex="-1" aria-label="${ctx.t({
        sv: "Runtavlan — hittade hemligheter",
        en: "The rune board — found secrets",
      })}">
        <h3>${ctx.t({ sv: "Runtavlan", en: "The rune board" })}</h3>
        <p class="runeboard-sub">${ctx.secrets.count()}/${ctx.secrets.total()} ${ctx.t({
          sv: "hemligheter hittade",
          en: "secrets found",
        })}</p>
        <div class="runeboard-grid">${runes}</div>
      </div>`;
  };

  let returnFocus: HTMLElement | null = null;

  const close = () => {
    if (!overlay?.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    returnFocus?.focus();
    returnFocus = null;
  };

  const open = () => {
    injectStyle("runeboard-css", CSS);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "runeboard-overlay";
      document.body.append(overlay);
      overlay.addEventListener("pointerdown", (e) => {
        if (e.target === overlay) close();
      });
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
    }
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render();
    overlay.classList.add("is-open");
    overlay.querySelector<HTMLElement>(".runeboard")?.focus();
  };

  ctx.registerCommand({
    id: "runeboard",
    label: () => `${ctx.t({ sv: "Runtavlan", en: "The rune board" })} (${ctx.secrets.count()}/${ctx.secrets.total()})`,
    group: () => ctx.t({ sv: "Hemligheter", en: "Secrets" }),
    run: open,
  });
}
