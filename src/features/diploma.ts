import type { FeatureContext } from "../app/contracts";
import { questStartedAt } from "../app/secrets";
import { injectStyle } from "../app/dom";

function formatElapsed(ms: number, lang: "sv" | "en"): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return lang === "sv" ? `${mins} min` : `${mins} min`;
  const h = Math.floor(mins / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return lang === "sv" ? `${d} dagar` : `${d} days`;
  return `${h} h ${mins % 60} min`;
}

function drawDiploma(ctx: FeatureContext): string {
  const c = document.createElement("canvas");
  c.width = 1000;
  c.height = 680;
  const g = c.getContext("2d")!;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7c6cff";

  g.fillStyle = "#0a0a0f";
  g.fillRect(0, 0, 1000, 680);
  g.strokeStyle = accent;
  g.lineWidth = 3;
  g.strokeRect(28, 28, 944, 624);
  g.strokeStyle = "rgba(124,108,255,0.3)";
  g.lineWidth = 1;
  g.strokeRect(40, 40, 920, 600);

  // partikelstänk
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 120;
    g.fillStyle = `rgba(124,108,255,${0.06 + Math.random() * 0.2})`;
    g.beginPath();
    g.arc(500 + Math.cos(a) * r * 1.8, 150 + Math.sin(a) * r * 0.5, 1 + Math.random() * 2, 0, 7);
    g.fill();
  }

  g.textAlign = "center";
  g.fillStyle = "#eceaf6";
  g.font = "700 52px 'Space Grotesk', sans-serif";
  g.fillText("CERTIFIED SITE EXPLORER", 500, 250);
  g.fillStyle = accent;
  g.font = "500 22px 'JetBrains Mono', monospace";
  g.fillText(ctx.t({ sv: "12 av 12 hemligheter hittade", en: "12 of 12 secrets found" }), 500, 300);

  g.fillStyle = "#8886a0";
  g.font = "400 18px 'Inter', sans-serif";
  const elapsed = formatElapsed(Date.now() - questStartedAt(), ctx.lang());
  const date = new Intl.DateTimeFormat(ctx.lang() === "sv" ? "sv-SE" : "en-GB", { dateStyle: "long" }).format(
    new Date()
  );
  g.fillText(ctx.t({ sv: `Tid: ${elapsed} · ${date}`, en: `Time: ${elapsed} · ${date}` }), 500, 360);

  g.font = "26px monospace";
  g.fillStyle = accent;
  g.fillText("✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦", 500, 430);

  g.fillStyle = "#55536a";
  g.font = "400 15px 'JetBrains Mono', monospace";
  g.fillText("sockulags.github.io/portfolio", 500, 590);

  return c.toDataURL("image/png");
}

/** 100 %-diplom + speedrun-läge. */
export function initDiploma(ctx: FeatureContext): void {
  let timerEl: HTMLElement | null = null;
  let timerInterval: number | undefined;

  const download = () => {
    const a = document.createElement("a");
    a.href = drawDiploma(ctx);
    a.download = "certified-site-explorer.png";
    a.click();
  };

  ctx.registerCommand({
    id: "diploma",
    label: () => ctx.t({ sv: "Hämta ditt diplom 🏆", en: "Download your diploma 🏆" }),
    group: () => ctx.t({ sv: "Hemligheter", en: "Secrets" }),
    visible: () => ctx.secrets.count() >= ctx.secrets.total(),
    run: download,
  });

  ctx.registerCommand({
    id: "speedrun",
    label: () => ctx.t({ sv: "Speedrun-läge (nollställer allt)", en: "Speedrun mode (resets everything)" }),
    group: () => ctx.t({ sv: "Hemligheter", en: "Secrets" }),
    visible: () => ctx.secrets.count() >= 3,
    run: () => {
      ctx.secrets.reset();
      injectStyle(
        "speedrun-css",
        `.speedrun-timer{position:fixed;top:0.6rem;left:50%;transform:translateX(-50%);z-index:56;font-family:var(--font-mono);font-size:0.85rem;color:var(--accent);background:var(--bg-elevated);border:1px solid var(--faint);border-radius:999px;padding:0.3rem 1rem;}`
      );
      timerEl?.remove();
      timerEl = document.createElement("div");
      timerEl.className = "speedrun-timer";
      document.body.append(timerEl);
      const start = Date.now();
      window.clearInterval(timerInterval);
      timerInterval = window.setInterval(() => {
        const s = Math.floor((Date.now() - start) / 1000);
        timerEl!.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} · ${ctx.secrets.count()}/${ctx.secrets.total()}`;
      }, 250);
      ctx.toast(ctx.t({ sv: "Speedrun! Hitta alla 12.", en: "Speedrun! Find all 12." }));
    },
  });

  ctx.bus.on("secret", ({ count, total }) => {
    if (count >= total) {
      window.clearInterval(timerInterval);
      if (timerEl) {
        const best = Number(localStorage.getItem("pf-speedrun-best") ?? Infinity);
        const elapsed = Date.now() - questStartedAt();
        if (elapsed < best) localStorage.setItem("pf-speedrun-best", String(elapsed));
        timerEl.remove();
        timerEl = null;
      }
      setTimeout(() => {
        ctx.toast(ctx.t({ sv: "🏆 100 % — diplomet väntar i paletten.", en: "🏆 100% — your diploma awaits in the palette." }));
        ctx.engine.burst(3);
      }, 800);
    }
  });
}
