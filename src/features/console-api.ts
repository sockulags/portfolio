/**
 * Konsol-API — mottagningskommittén för den som öppnar DevTools.
 * window.lucas byggs med getters så att `lucas.hire` triggar direkt
 * vid egenskapsåtkomst, utan parenteser.
 */
import type { FeatureContext } from "../app/contracts";
import { projects } from "../data/content";

declare global {
  interface Window {
    lucas: unknown;
  }
}

// Konsolen ärver inte sidans CSS-variabler — läs ut faktiska värden vid varje
// anrop så att temabyte följer med.
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function styles(): { muted: string; accent: string } {
  const font = `font-family:${cssVar("--font-mono", "ui-monospace, monospace")};`;
  return {
    muted: `${font}color:${cssVar("--muted", "rgba(236,234,246,0.55)")};`,
    accent: `${font}color:${cssVar("--accent", "#7c6cff")};font-weight:600;`,
  };
}

// Punktmatris-"LS", 6 rader.
const LOGO = [
  "●·····  ·●●●●",
  "●·····  ●····",
  "●·····  ·●●●·",
  "●·····  ····●",
  "●·····  ····●",
  "●●●●●●  ●●●●·",
].join("\n");

const COMMANDS: { cmd: string; desc: { sv: string; en: string } }[] = [
  { cmd: "lucas.help", desc: { sv: "den här listan", en: "this list" } },
  { cmd: "lucas.cv", desc: { sv: "projekten som tabell + CV", en: "the projects as a table + CV" } },
  { cmd: "lucas.stack", desc: { sv: "vad sajten är byggd med — och varför", en: "what this site is built with — and why" } },
  { cmd: "lucas.secrets", desc: { sv: "dina fynd + en kryptisk ledtråd", en: "your finds + one cryptic hint" } },
  { cmd: "lucas.hire", desc: { sv: "öppnar mejlen. Du vet vad du gör.", en: "opens email. You know what you're doing." } },
  { cmd: "lucas.gravity", desc: { sv: "fyra sekunder av tyngdlag", en: "four seconds of gravity" } },
  { cmd: "lucas.burst", desc: { sv: "partiklar. Många.", en: "particles. Lots of them." } },
  { cmd: "lucas.source", desc: { sv: "koden bakom sajten", en: "the code behind this site" } },
];

const STACK: { name: { sv: string; en: string }; why: { sv: string; en: string } }[] = [
  {
    name: { sv: "three.js", en: "three.js" },
    why: { sv: "partiklarna bor på GPU:n — DOM:en hade gett upp", en: "the particles live on the GPU — the DOM would give up" },
  },
  {
    name: { sv: "TypeScript (strict)", en: "TypeScript (strict)" },
    why: { sv: "felen fångas i bygget, inte i din konsol", en: "errors are caught at build time, not in your console" },
  },
  {
    name: { sv: "Vite", en: "Vite" },
    why: { sv: "dev-server på millisekunder, noll konfig-tjafs", en: "millisecond dev server, zero config fuss" },
  },
  {
    name: { sv: "Inga ramverk", en: "No frameworks" },
    why: { sv: "vanilla DOM räcker — mindre JS att skicka till dig", en: "vanilla DOM is enough — less JS shipped to you" },
  },
  {
    name: { sv: "Ingen spårning", en: "No tracking" },
    why: { sv: "inga cookies, ingen analys — bara en sajt", en: "no cookies, no analytics — just a site" },
  },
];

export function initConsoleApi(ctx: FeatureContext): void {
  // dubbel-init-skydd: definiera aldrig om window.lucas
  if (Object.getOwnPropertyDescriptor(window, "lucas")) return;

  const repoUrl = `${ctx.GITHUB_URL}/portfolio`;
  const cvUrl = `${ctx.SITE_URL.replace(/\/+$/, "")}/cv.txt`;
  let gravityTimer: number | undefined;

  const api = {};
  const cmd = (name: string, get: () => unknown): void => {
    Object.defineProperty(api, name, { get, enumerable: true });
  };

  cmd("help", () => {
    const s = styles();
    const fmt = COMMANDS.map((c) => `%c${c.cmd.padEnd(16)}%c${ctx.t(c.desc)}`).join("\n");
    console.log(fmt, ...COMMANDS.flatMap(() => [s.accent, s.muted]));
    return ctx.t({ sv: "(skriv kommandot utan parenteser)", en: "(type a command — no parentheses needed)" });
  });

  cmd("cv", () => {
    console.table(projects.map((p) => ({ name: p.name, tagline: ctx.t(p.tagline), tech: p.tech.join(", ") })));
    const s = styles();
    console.log(`%cCV: %c${cvUrl}`, s.muted, s.accent);
    return "📄";
  });

  cmd("stack", () => {
    const s = styles();
    const fmt = STACK.map((row) => `%c${ctx.t(row.name).padEnd(21)}%c${ctx.t(row.why)}`).join("\n");
    console.log(fmt, ...STACK.flatMap(() => [s.accent, s.muted]));
    return "🛠️";
  });

  cmd("secrets", () => {
    const s = styles();
    const unfound = ctx.secrets.list().filter((x) => !x.found);
    const status = `${ctx.secrets.count()}/${ctx.secrets.total()}`;
    console.log(`%c${ctx.t({ sv: "Hemligheter hittade", en: "Secrets found" })}: %c${status}`, s.muted, s.accent);
    if (unfound.length === 0) {
      console.log(`%c${ctx.t({ sv: "Allihop. Du är klar här. Eller?", en: "All of them. You're done here. Or are you?" })}`, s.accent);
    } else {
      const hint = unfound[Math.floor(Math.random() * unfound.length)].hint;
      console.log(`%c“${ctx.t(hint)}”`, `${s.muted}font-style:italic;`);
    }
    return "🗝️";
  });

  cmd("hire", () => {
    window.open(`mailto:${ctx.EMAIL}`);
    ctx.secrets.found("hire");
    return "🤝";
  });

  cmd("gravity", () => {
    if (ctx.engine.reducedMotion) {
      return ctx.t({ sv: "(reducerad rörelse — partiklarna får vila)", en: "(reduced motion — the particles get to rest)" });
    }
    ctx.engine.setGravity(true);
    window.clearTimeout(gravityTimer);
    gravityTimer = window.setTimeout(() => ctx.engine.setGravity(false), 4000);
    return ctx.t({ sv: "släpper taget…", en: "letting go…" });
  });

  cmd("burst", () => {
    if (ctx.engine.reducedMotion) {
      return ctx.t({ sv: "(reducerad rörelse — partiklarna får vila)", en: "(reduced motion — the particles get to rest)" });
    }
    ctx.engine.burst(1);
    return "✨";
  });

  cmd("source", () => {
    window.open(repoUrl, "_blank", "noopener");
    return repoUrl;
  });

  Object.defineProperty(window, "lucas", { value: api, configurable: true });

  const s = styles();
  console.log(`%c${LOGO}`, `${s.accent}line-height:1.25;`);
  console.log("%cHej! Du hittade konsolen. Testa: %cwindow.lucas", s.muted, s.accent);
  console.log("%cHi! You found the console. Try: %cwindow.lucas", s.muted, s.accent);
}
