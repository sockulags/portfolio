/**
 * Diplom i lager: Rymdresenär (fullborda resan) + Kadett/Pilot/Kapten/Kommendör
 * (3/6/9/alla hemligheter). Varje rank ritas mer påkostat än den förra och
 * laddas ner som PNG. Speedrun-läget nollställer och jagar full pott.
 */
import type { FeatureContext } from "../app/contracts";
import { questStartedAt } from "../app/secrets";
import { injectStyle } from "../app/dom";
import { local } from "../app/storage";
import { RANKS, rankEarned, type Rank, type RankProgress } from "../data/ranks";

function formatElapsed(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d} d`;
  return `${h} h ${mins % 60} min`;
}

function progress(ctx: FeatureContext): RankProgress {
  return {
    secretCount: ctx.secrets.count(),
    secretTotal: ctx.secrets.total(),
    journeyDone: local.getItem("pf-journey-done") === "1",
  };
}

function drawDiploma(ctx: FeatureContext, rank: Rank): string {
  const c = document.createElement("canvas");
  c.width = 1000;
  c.height = 680;
  const g = c.getContext("2d")!;
  const color = rank.color;

  g.fillStyle = "#0a0a0f";
  g.fillRect(0, 0, 1000, 680);

  // ramar — en per tier, allt tätare och tydligare
  for (let i = 0; i < rank.tier; i++) {
    const inset = 22 + i * 9;
    g.strokeStyle = i === 0 ? color : `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${0.45 - i * 0.08})`;
    g.lineWidth = i === 0 ? 3 : 1;
    g.strokeRect(inset, inset, 1000 - inset * 2, 680 - inset * 2);
  }

  // hörnornament från tier 3
  if (rank.tier >= 3) {
    g.strokeStyle = color;
    g.lineWidth = 2;
    const L = 34;
    for (const [cx, cy, sx, sy] of [
      [58, 58, 1, 1],
      [942, 58, -1, 1],
      [58, 622, 1, -1],
      [942, 622, -1, -1],
    ]) {
      g.beginPath();
      g.moveTo(cx + sx * L, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + sy * L);
      g.stroke();
    }
  }

  // partikelstänk — mer och vidare per tier
  const dots = 140 + rank.tier * 70;
  for (let i = 0; i < dots; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * (90 + rank.tier * 22);
    g.fillStyle = `${color}${Math.floor(16 + Math.random() * 60).toString(16).padStart(2, "0")}`;
    g.beginPath();
    g.arc(500 + Math.cos(a) * r * 1.9, 140 + Math.sin(a) * r * 0.5, 1 + Math.random() * 2, 0, 7);
    g.fill();
  }

  // rankmärke: vinklar (chevroner) ovanför titeln, en per tier
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.lineCap = "round";
  for (let i = 0; i < rank.tier; i++) {
    const y = 150 - i * 14;
    g.beginPath();
    g.moveTo(470, y);
    g.lineTo(500, y - 16);
    g.lineTo(530, y);
    g.stroke();
  }

  g.textAlign = "center";
  if (rank.tier === 5) {
    const grad = g.createLinearGradient(300, 0, 700, 0);
    grad.addColorStop(0, "#9ff0ff");
    grad.addColorStop(0.5, "#ffffff");
    grad.addColorStop(1, "#c9b8ff");
    g.fillStyle = grad;
  } else {
    g.fillStyle = "#eceaf6";
  }
  g.font = "700 58px 'Space Grotesk', sans-serif";
  g.fillText(ctx.t(rank.name).toUpperCase(), 500, 268);

  const p = progress(ctx);
  g.fillStyle = color;
  g.font = "500 22px 'JetBrains Mono', monospace";
  const sub =
    rank.need === "journey"
      ? ctx.t({ sv: "Fullbordade resan — alla åtta stopp", en: "Completed the journey — all eight stops" })
      : ctx.t({
          sv: `${rank.need === "all" ? p.secretTotal : rank.need} av ${p.secretTotal} hemligheter hittade`,
          en: `${rank.need === "all" ? p.secretTotal : rank.need} of ${p.secretTotal} secrets found`,
        });
  g.fillText(sub, 500, 318);

  g.fillStyle = "#8886a0";
  g.font = "400 18px 'Inter', sans-serif";
  const date = new Intl.DateTimeFormat(ctx.lang() === "sv" ? "sv-SE" : "en-GB", { dateStyle: "long" }).format(new Date());
  const time = rank.need === "journey" ? date : `${ctx.t({ sv: "Tid", en: "Time" })}: ${formatElapsed(Date.now() - questStartedAt())} · ${date}`;
  g.fillText(time, 500, 372);

  g.font = "24px monospace";
  g.fillStyle = color;
  g.fillText(Array.from({ length: rank.tier * 2 + 2 }, () => "✦").join(" "), 500, 438);

  g.fillStyle = "#55536a";
  g.font = "400 15px 'JetBrains Mono', monospace";
  g.fillText("sockulags.github.io/portfolio", 500, 590);

  return c.toDataURL("image/png");
}

export function initDiploma(ctx: FeatureContext): void {
  let timerEl: HTMLElement | null = null;
  let timerInterval: number | undefined;

  const download = (rank: Rank) => {
    const a = document.createElement("a");
    a.href = drawDiploma(ctx, rank);
    a.download = `diplom-${rank.id}.png`;
    a.click();
  };

  for (const rank of RANKS) {
    ctx.registerCommand({
      id: `diploma-${rank.id}`,
      label: () => ctx.t({ sv: `Diplom: ${rank.name.sv} 🏆`, en: `Diploma: ${rank.name.en} 🏆` }),
      group: () => ctx.t({ sv: "Hemligheter", en: "Secrets" }),
      visible: () => rankEarned(rank, progress(ctx)),
      run: () => download(rank),
    });
  }

  // fira varje ny rank exakt en gång
  const celebrated = new Set(
    RANKS.filter((r) => rankEarned(r, progress(ctx))).map((r) => r.id)
  );
  const celebrate = () => {
    const p = progress(ctx);
    for (const rank of RANKS) {
      if (!rankEarned(rank, p) || celebrated.has(rank.id)) continue;
      celebrated.add(rank.id);
      setTimeout(() => {
        ctx.toast(
          ctx.t({
            sv: `🎖 Ny rank: ${rank.name.sv} — diplomet väntar i uppdragsloggen`,
            en: `🎖 New rank: ${rank.name.en} — the diploma awaits in the quest log`,
          })
        );
        ctx.engine.burst(rank.tier >= 4 ? 3 : 2);
      }, 800);
    }
  };
  ctx.bus.on("secret", celebrate);
  ctx.bus.on("journey-complete", celebrate);

  // ---------- speedrun (nollställer och jagar full pott) ----------

  ctx.registerCommand({
    id: "speedrun",
    label: () => ctx.t({ sv: "Speedrun-läge (nollställer allt)", en: "Speedrun mode (resets everything)" }),
    group: () => ctx.t({ sv: "Hemligheter", en: "Secrets" }),
    visible: () => ctx.secrets.count() >= 3,
    run: () => {
      ctx.secrets.reset();
      celebrated.clear();
      if (local.getItem("pf-journey-done") === "1") celebrated.add("resenar");
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
      ctx.toast(ctx.t({ sv: `Speedrun! Hitta alla ${ctx.secrets.total()}.`, en: `Speedrun! Find all ${ctx.secrets.total()}.` }));
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
        ctx.toast(ctx.t({ sv: "🏆 100 % — Kommendörsdiplomet väntar i loggen.", en: "🏆 100% — the Commander diploma awaits in the log." }));
        ctx.engine.burst(3);
      }, 800);
    }
  });
}
