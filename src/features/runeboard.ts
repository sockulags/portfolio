/**
 * Uppdragsloggen (fd Runtavlan): alla hemligheter med kryptiska ledtrådar,
 * en tydligare ledtråd som låses upp på begäran (utom för de kluriga som
 * ska förbli kryptiska), och rankstegen med nedladdningsbara diplom.
 */
import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";
import { local, readJsonArray } from "../app/storage";
import { RANKS, rankEarned, nextRank } from "../data/ranks";

const REVEALED_KEY = "pf-hints-revealed";

const CSS = `
.runeboard-overlay {
  position: fixed; inset: 0; z-index: 60; display: none; overflow-y: auto;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.runeboard-overlay.is-open { display: block; }
.runeboard {
  width: min(640px, 94vw); margin: 8vh auto 8vh; padding: 1.8rem;
  background: var(--bg-elevated); border: 1px solid var(--faint); border-radius: 16px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.45);
  animation: palette-in 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.runeboard h3 { font-family: var(--font-display); margin-bottom: 0.3rem; }
.runeboard .runeboard-sub { color: var(--muted); font-size: 0.85rem; margin-bottom: 1rem; }

.rank-ladder { display: flex; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 1.3rem; }
.rank-chip {
  display: inline-flex; align-items: center; gap: 0.4rem;
  border: 1px solid var(--faint); border-radius: 999px; padding: 0.35rem 0.8rem;
  font-family: var(--font-mono); font-size: 0.7rem; color: var(--muted);
  background: transparent; cursor: default;
}
.rank-chip.is-earned {
  color: var(--rank-color); border-color: color-mix(in srgb, var(--rank-color) 60%, transparent);
  cursor: pointer;
}
.rank-chip.is-earned:hover { background: color-mix(in srgb, var(--rank-color) 12%, transparent); }
.rank-chip .rank-req { font-size: 0.62rem; opacity: 0.75; }

.runeboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
@media (max-width: 540px) { .runeboard-grid { grid-template-columns: 1fr; } }
.rune {
  padding: 0.75rem 0.8rem; border: 1px solid var(--faint); border-radius: 10px;
  text-align: left;
}
.rune-head { display: flex; align-items: baseline; gap: 0.45rem; }
.rune-glyph { color: var(--faint); }
.rune.is-found { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.rune.is-found .rune-glyph { color: var(--accent); }
.rune-name { font-family: var(--font-mono); font-size: 0.7rem; color: var(--fg); }
.rune-hint { font-size: 0.72rem; color: var(--muted); line-height: 1.4; display: block; margin-top: 0.3rem; }
.rune-hint.is-clear { color: var(--fg); }
.rune-reveal {
  margin-top: 0.4rem; border: 1px solid var(--faint); background: transparent; color: var(--muted);
  border-radius: 999px; padding: 0.2rem 0.7rem; cursor: pointer;
  font-family: var(--font-mono); font-size: 0.62rem;
}
.rune-reveal:hover { color: var(--accent); border-color: var(--accent); }
.rune-cryptic { display: inline-block; margin-top: 0.4rem; font-family: var(--font-mono); font-size: 0.62rem; color: var(--faint); }
`;

export function initRuneboard(ctx: FeatureContext): void {
  let overlay: HTMLElement | null = null;

  const revealed = new Set<string>(readJsonArray<string>(local, REVEALED_KEY));

  const rankProgress = () => ({
    secretCount: ctx.secrets.count(),
    secretTotal: ctx.secrets.total(),
    journeyDone: local.getItem("pf-journey-done") === "1",
  });

  const render = () => {
    const p = rankProgress();
    const next = nextRank(p);

    const ladder = RANKS.map((r) => {
      const earned = rankEarned(r, p);
      const req = earned ? ctx.t({ sv: "hämta ↓", en: "download ↓" }) : ctx.t(r.requirement);
      return `<button class="rank-chip${earned ? " is-earned" : ""}" style="--rank-color:${r.color}"
        data-rank="${earned ? r.id : ""}" ${earned ? "" : "disabled"}>
        ${earned ? "🎖" : "✧"} ${ctx.t(r.name)} <span class="rank-req">· ${req}</span>
      </button>`;
    }).join("");

    const runes = ctx.secrets
      .list()
      .map((s) => {
        const name = s.found ? ctx.t(s.name) : "???";
        let detail = "";
        if (!s.found) {
          detail = `<span class="rune-hint">${ctx.t(s.hint)}</span>`;
          if (s.hint2 && revealed.has(s.id)) {
            detail += `<span class="rune-hint is-clear">→ ${ctx.t(s.hint2)}</span>`;
          } else if (s.hint2) {
            detail += `<button class="rune-reveal" data-reveal="${s.id}">${ctx.t({ sv: "Tydligare ledtråd", en: "Clearer hint" })}</button>`;
          } else {
            detail += `<span class="rune-cryptic">◈ ${ctx.t({ sv: "kryptiskt uppdrag", en: "cryptic quest" })}</span>`;
          }
        } else {
          detail = `<span class="rune-hint">${ctx.t(s.hint)}</span>`;
        }
        return `<div class="rune${s.found ? " is-found" : ""}">
          <div class="rune-head"><span class="rune-glyph">${s.found ? "✦" : "✧"}</span><span class="rune-name">${name}</span></div>
          ${detail}
        </div>`;
      })
      .join("");

    overlay!.innerHTML = `
      <div class="runeboard" role="dialog" aria-modal="true" tabindex="-1" aria-label="${ctx.t({
        sv: "Uppdragsloggen — hemligheter och diplom",
        en: "The quest log — secrets and diplomas",
      })}">
        <h3>${ctx.t({ sv: "Uppdragsloggen", en: "The quest log" })}</h3>
        <p class="runeboard-sub">${p.secretCount}/${p.secretTotal} ${ctx.t({ sv: "hemligheter", en: "secrets" })}${
          next
            ? ` · ${ctx.t({ sv: "nästa rank", en: "next rank" })}: ${ctx.t(next.name)}${
                typeof next.need === "number" ? ` (${Math.max(0, next.need - p.secretCount)} ${ctx.t({ sv: "kvar", en: "to go" })})` : next.need === "all" ? ` (${p.secretTotal - p.secretCount} ${ctx.t({ sv: "kvar", en: "to go" })})` : ""
              }`
            : ` · ${ctx.t({ sv: "alla ranker uppnådda", en: "every rank earned" })} 👑`
        }</p>
        <div class="rank-ladder">${ladder}</div>
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
      overlay.addEventListener("click", (e) => {
        const el = e.target as HTMLElement;
        const reveal = el.closest<HTMLElement>("[data-reveal]");
        if (reveal) {
          revealed.add(reveal.dataset.reveal!);
          local.setItem(REVEALED_KEY, JSON.stringify([...revealed]));
          render();
          // render() rev bort den fokuserade knappen — håll fokus kvar i dialogen
          overlay?.querySelector<HTMLElement>(".runeboard")?.focus();
          return;
        }
        const rank = el.closest<HTMLElement>("[data-rank]");
        if (rank?.dataset.rank) ctx.runCommand(`diploma-${rank.dataset.rank}`);
      });
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
      ctx.bus.on("secret", () => {
        if (overlay?.classList.contains("is-open")) render();
      });
      ctx.bus.on("secrets-reset", () => {
        if (overlay?.classList.contains("is-open")) render();
      });
    }
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render();
    overlay.classList.add("is-open");
    overlay.querySelector<HTMLElement>(".runeboard")?.focus();
  };

  ctx.registerCommand({
    id: "runeboard",
    label: () => `${ctx.t({ sv: "Uppdragsloggen", en: "The quest log" })} (${ctx.secrets.count()}/${ctx.secrets.total()})`,
    group: () => ctx.t({ sv: "Hemligheter", en: "Secrets" }),
    hint: "J",
    run: open,
  });
}
