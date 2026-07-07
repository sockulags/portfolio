import "./style.css";
import { createEngine } from "./engine";
import { projects, ui, marqueeWords, type Lang } from "./data/content";
import type { FeatureContext, ShapeId } from "./app/contracts";
import { createBus } from "./app/bus";
import { createSecrets } from "./app/secrets";
import { registerCommand, allCommands, runCommand } from "./app/commands";
import { toast, initToast } from "./app/toast";
import { local, session, readJsonArray } from "./app/storage";
import { initCursor } from "./ui/cursor";
import { CommandPalette, type Command } from "./ui/palette";
import { initCheats, skinAccentOverride } from "./features/cheats";
import { handleKonami, initRunaway, initCalendar } from "./features/eggs";
import { initHud } from "./features/hud";
import { initRuneboard } from "./features/runeboard";
import { initDiploma } from "./features/diploma";
import { initIdle } from "./features/idle";
import { initNarrator } from "./features/narrator";

const EMAIL = "lucasskog@gmail.com";
const GITHUB_USER = "sockulags";
const GITHUB = `https://github.com/${GITHUB_USER}`;
const SITE_URL = "https://sockulags.github.io/portfolio/";

type SectionDef = { id: string; shape: ShapeId; accent: string; offsetX: number };

// projektkorten alternerar höger/vänster (nth-of-type) — formen glider åt motsatt håll
const sections: SectionDef[] = [
  { id: "hem", shape: "galaxy", accent: "#7c6cff", offsetX: 0 },
  ...projects.map((p, i) => ({ id: p.id, shape: shapeFor(p.id), accent: p.accent, offsetX: i % 2 === 0 ? -2.1 : 2.1 })),
  { id: "kontakt", shape: "ring", accent: "#7c6cff", offsetX: 0 },
];

export function shapeFor(id: string): ShapeId {
  const map: Record<string, ShapeId> = {
    meritvo: "layers",
    pilot: "knot",
    "design-pilot": "lattice",
    "rep-counter": "wave",
    smask: "blob",
    kontakt: "ring",
  };
  return map[id] ?? "galaxy";
}

// ---------- state ----------

let lang: Lang = (local.getItem("pf-lang") as Lang) ?? "sv";
let theme: "dark" | "light" = (local.getItem("pf-theme") as "dark" | "light") ?? "dark";
let currentSection: SectionDef = sections[0];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const engine = createEngine(document.querySelector<HTMLCanvasElement>("#gl")!);
engine.setReducedMotion(reducedMotion);
// odokumenterat debughandtag — devtools-folket hittar det ändå
(window as unknown as { __pf: unknown }).__pf = engine;

const bus = createBus();
const secrets = createSecrets(bus, () => lang, toast);

// ---------- helpers ----------

const t = (entry: { sv: string; en: string }) => entry[lang];

function greeting(): string {
  const h = Number(
    new Intl.DateTimeFormat("sv-SE", { hour: "numeric", hour12: false, timeZone: "Europe/Stockholm" }).format(new Date())
  );
  if (h >= 5 && h < 10) return t(ui.greetingMorning);
  if (h >= 18 || h < 5) return t(ui.greetingEvening);
  return t(ui.greetingDay);
}

function applyThemeDom(): void {
  document.documentElement.dataset.theme = theme;
  engine.setTheme(theme);
  local.setItem("pf-theme", theme);
  const btn = document.querySelector("#theme-btn");
  if (btn) btn.textContent = theme === "dark" ? "☀" : "☾";
}

function setAccent(hex: string): void {
  document.documentElement.style.setProperty("--accent", skinAccentOverride() ?? hex);
  engine.setAccent(hex);
}

function reapplyAccent(): void {
  setAccent(currentSection.accent);
}

function goTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
}

// ---------- feature-kontext ----------

const ctx: FeatureContext = {
  engine,
  bus,
  secrets,
  lang: () => lang,
  t: (entry) => entry[lang],
  toast,
  registerCommand,
  runCommand,
  goTo,
  actions: {
    toggleTheme: () => toggleTheme(),
    toggleLang: () => toggleLang(),
    openPalette: () => palette.open(),
    copyEmail: () => copyEmail(),
  },
  theme: () => theme,
  EMAIL,
  GITHUB_USER,
  GITHUB_URL: GITHUB,
  SITE_URL,
};

// ---------- render ----------

function projectSection(p: (typeof projects)[number]): string {
  const links = p.links
    .map(
      (l) =>
        `<a class="btn" href="${l.href}" target="_blank" rel="noopener noreferrer" data-hover>${l.label[lang]} <span aria-hidden="true">&nearr;</span></a>`
    )
    .join("");
  const privateBadge = p.links.length === 0 ? `<span class="badge badge-muted">${t(ui.privateRepo)}</span>` : "";
  return `
    <section class="section project" id="${p.id}" data-shape="${shapeFor(p.id)}" style="--project-accent:${p.accent}">
      <div class="project-inner reveal">
        <div class="project-meta">
          <span class="project-index">${p.index}</span>
          <span class="badge">${p.status[lang]}</span>
          ${privateBadge}
          <span class="gh-stars mono" data-gh="${p.id}"></span>
        </div>
        <h2 class="project-title">${p.name}</h2>
        <p class="project-tagline">${p.tagline[lang]}</p>
        <p class="project-desc">${p.description[lang]}</p>
        <ul class="project-highlights">
          ${p.highlights[lang].map((h) => `<li>${h}</li>`).join("")}
        </ul>
        <div class="project-tech">${p.tech.map((tech) => `<span class="tag">${tech}</span>`).join("")}</div>
        <div class="project-links">${links}</div>
      </div>
    </section>`;
}

function render(): void {
  document.documentElement.lang = lang;
  const app = document.querySelector<HTMLElement>("#app")!;
  app.innerHTML = `
    <div class="progress" aria-hidden="true"><div class="progress-bar" id="progress-bar"></div></div>

    <header class="header">
      <a class="logo" href="#hem" data-hover>LS<span class="logo-dot">.</span></a>
      <div class="header-actions">
        <button class="icon-btn" id="lang-btn" data-hover aria-label="${t(ui.switchLang)}">${lang === "sv" ? "EN" : "SV"}</button>
        <button class="icon-btn" id="theme-btn" data-hover aria-label="${t(ui.toggleTheme)}">${theme === "dark" ? "☀" : "☾"}</button>
        <button class="kbd-hint" id="palette-btn" data-hover><kbd>Ctrl</kbd><kbd>K</kbd> <span>${t(ui.paletteHint)}</span></button>
      </div>
    </header>

    <nav class="dots" aria-label="Sections">
      ${sections
        .map(
          (s) =>
            `<a href="#${s.id}" class="dot" data-section="${s.id}" data-hover aria-label="${s.id}"><span class="dot-label">${
              s.id === "hem" ? t(ui.home) : s.id === "kontakt" ? t(ui.contact) : projects.find((p) => p.id === s.id)?.name ?? s.id
            }</span></a>`
        )
        .join("")}
    </nav>

    <main>
      <section class="section hero" id="hem" data-shape="galaxy">
        <div class="hero-inner reveal">
          <p class="hero-greeting mono">${greeting()} — ${t(ui.role).toLowerCase()}</p>
          <h1 class="hero-name">Lucas<br /><span class="hero-name-accent">Skog</span></h1>
          <p class="hero-line">${t(ui.heroLine)}</p>
          <p class="hero-pulse mono" data-github-pulse></p>
          <p class="hero-hint mono">${t(ui.scrollHint)} <kbd>1</kbd>–<kbd>5</kbd></p>
        </div>
      </section>

      <div class="marquee" aria-hidden="true">
        <div class="marquee-track">
          ${Array.from({ length: 2 }, () => marqueeWords.map((w) => `<span>${w}</span>`).join("<i>·</i>")).join("<i>·</i>")}
        </div>
      </div>

      <div class="work-label mono reveal">${t(ui.selectedWork)} — ${projects.length}</div>

      ${projects.map(projectSection).join("")}

      <section class="section contact" id="kontakt" data-shape="ring">
        <div class="contact-inner reveal">
          <h2 class="contact-title">${t(ui.contactTitle)}</h2>
          <p class="contact-body">${t(ui.contactBody)}</p>
          <div class="contact-actions">
            <button class="btn btn-primary" id="copy-email" data-hover>${t(ui.copyEmail)}</button>
            <a class="btn" href="mailto:${EMAIL}" data-hover>${EMAIL}</a>
            <a class="btn" href="${GITHUB}" target="_blank" rel="noopener noreferrer" data-hover>GitHub <span aria-hidden="true">&nearr;</span></a>
          </div>
          <footer class="footer mono">
            <span>${t(ui.localTime)} <span id="clock"></span> · Stockholm</span>
            <span data-weather></span>
            <span>${t(ui.builtWith)}</span>
            <span>© ${new Date().getFullYear()} Lucas Skog</span>
          </footer>
        </div>
      </section>
    </main>

    <div class="help-overlay" id="help-overlay">
      <div class="help" role="dialog" aria-modal="true" aria-label="${t(ui.shortcuts)}">
        <h3>${t(ui.shortcuts)}</h3>
        <dl>
          <div><dt><kbd>Ctrl</kbd>+<kbd>K</kbd></dt><dd>${t(ui.shortcutsPalette)}</dd></div>
          <div><dt><kbd>1</kbd>–<kbd>5</kbd></dt><dd>${t(ui.shortcutsSections)}</dd></div>
          <div><dt><kbd>T</kbd></dt><dd>${t(ui.shortcutsTheme)}</dd></div>
          <div><dt><kbd>L</kbd></dt><dd>${t(ui.shortcutsLang)}</dd></div>
          <div><dt><kbd>M</kbd></dt><dd>${t(ui.shortcutsAudio)}</dd></div>
          <div><dt><kbd>D</kbd></dt><dd>${t(ui.shortcutsDebug)}</dd></div>
          <div><dt><kbd>&gt;</kbd></dt><dd>${t(ui.shortcutsTerminal)}</dd></div>
          <div><dt><kbd>Ctrl</kbd>+<kbd>P</kbd></dt><dd>${t(ui.shortcutsPrint)}</dd></div>
          <div><dt><kbd>?</kbd></dt><dd>${t(ui.shortcutsHelp)}</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>${t(ui.shortcutsClose)}</dd></div>
        </dl>
      </div>
    </div>
  `;

  bind();
  observe();
}

// ---------- interaktion ----------

let clockInterval: number | undefined;

function bind(): void {
  document.querySelector("#lang-btn")!.addEventListener("click", toggleLang);
  document.querySelector("#theme-btn")!.addEventListener("click", (e) => toggleTheme(e as MouseEvent));
  document.querySelector("#palette-btn")!.addEventListener("click", () => palette.open());
  document.querySelector("#copy-email")!.addEventListener("click", copyEmail);
  document.querySelector<HTMLElement>("#help-overlay")!.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).id === "help-overlay") toggleHelp(false);
  });

  const clockEl = document.querySelector<HTMLElement>("#clock")!;
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Stockholm",
  });
  const tickClock = () => (clockEl.textContent = fmt.format(new Date()));
  tickClock();
  window.clearInterval(clockInterval);
  clockInterval = window.setInterval(tickClock, 1000);
}

function toggleLang(): void {
  const focusedId = document.activeElement instanceof HTMLElement ? document.activeElement.id : "";
  lang = lang === "sv" ? "en" : "sv";
  local.setItem("pf-lang", lang);
  render();
  // render() river hela DOM:en — ge tangentbordsanvändaren fokus tillbaka
  if (focusedId) document.getElementById(focusedId)?.focus();
  bus.emit("lang", { lang });
  secrets.found("polyglot");
}

function toggleTheme(e?: MouseEvent): void {
  const flips = Number(local.getItem("pf-theme-flips") ?? "0") + 1;
  local.setItem("pf-theme-flips", String(flips));
  if (flips >= 10) secrets.found("chameleon");

  theme = theme === "dark" ? "light" : "dark";
  bus.emit("theme", { theme });

  // temavåg via View Transitions — sveper ut från knappen
  const vtDoc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (vtDoc.startViewTransition && !reducedMotion && e) {
    const x = e.clientX || window.innerWidth - 60;
    const y = e.clientY || 30;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = vtDoc.startViewTransition(() => applyThemeDom());
    void transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
      );
    });
  } else {
    applyThemeDom();
  }
}

async function copyEmail(): Promise<void> {
  try {
    await navigator.clipboard.writeText(EMAIL);
    const btn = document.querySelector<HTMLElement>("#copy-email");
    if (btn) {
      const original = t(ui.copyEmail);
      btn.textContent = t(ui.copied);
      setTimeout(() => (btn.textContent = original), 1500);
    } else {
      toast(t(ui.copied));
    }
  } catch {
    location.href = `mailto:${EMAIL}`;
  }
}

let helpReturnFocus: HTMLElement | null = null;

function toggleHelp(force?: boolean): void {
  const overlay = document.querySelector<HTMLElement>("#help-overlay");
  if (!overlay) return;
  const willOpen = force ?? !overlay.classList.contains("is-open");
  overlay.classList.toggle("is-open", force);
  const dialog = overlay.querySelector<HTMLElement>(".help");
  if (willOpen && dialog) {
    helpReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.tabIndex = -1;
    dialog.focus();
  } else if (!willOpen) {
    helpReturnFocus?.focus();
    helpReturnFocus = null;
  }
}

// ---------- scrollspy + reveal ----------

// partiklarna stavar projektnamnet första gången en sektion besöks
const TEXT_MORPHS: Record<string, string> = {
  meritvo: "MERITVO",
  pilot: "PILOT",
  "design-pilot": "DESIGN-PILOT",
  "rep-counter": "REP COUNTER",
  smask: "SMASK!",
};
const spelled = new Set<string>(readJsonArray<string>(session, "pf-spelled"));

function applySection(def: SectionDef): void {
  currentSection = def;
  if (!engine.paused) {
    engine.setShape(def.shape);
    engine.setOffsetX(def.offsetX);
    const text = TEXT_MORPHS[def.id];
    if (text && !spelled.has(def.id) && !reducedMotion) {
      spelled.add(def.id);
      session.setItem("pf-spelled", JSON.stringify([...spelled]));
      engine.morphToText(text, 2800);
    }
  }
  setAccent(def.accent);
  document.querySelectorAll(".dot").forEach((d) => {
    d.classList.toggle("is-active", (d as HTMLElement).dataset.section === def.id);
  });
  bus.emit("section", { id: def.id });
}

function observe(): void {
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const def = sections.find((s) => s.id === entry.target.id);
        if (def && def.id !== currentSection.id) applySection(def);
      }
    },
    { threshold: 0.4 }
  );
  document.querySelectorAll(".section").forEach((s) => spy.observe(s));

  const reveal = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          reveal.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));
}

window.addEventListener(
  "scroll",
  () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? scrollY / max : 0;
    const bar = document.querySelector<HTMLElement>("#progress-bar");
    if (bar) bar.style.transform = `scaleX(${progress})`;
    engine.setScroll(progress);
  },
  { passive: true }
);

// spel klart → återställ sektionens form
bus.on("game-end", () => {
  engine.setShape(currentSection.shape);
  engine.setOffsetX(currentSection.offsetX);
});

// ---------- baskommandon ----------

function registerBaseCommands(): void {
  registerCommand({
    id: "goto-hem",
    label: () => `${t(ui.goTo)}: ${t(ui.home)}`,
    group: () => t(ui.navigate),
    hint: "0",
    run: () => goTo("hem"),
  });
  projects.forEach((p, i) => {
    registerCommand({
      id: `goto-${p.id}`,
      label: () => `${t(ui.goTo)}: ${p.name}`,
      group: () => t(ui.navigate),
      hint: String(i + 1),
      run: () => goTo(p.id),
    });
  });
  registerCommand({
    id: "goto-kontakt",
    label: () => `${t(ui.goTo)}: ${t(ui.contact)}`,
    group: () => t(ui.navigate),
    hint: "C",
    run: () => goTo("kontakt"),
  });
  registerCommand({ id: "lang", label: () => t(ui.switchLang), group: () => t(ui.actions), hint: "L", run: toggleLang });
  registerCommand({ id: "theme", label: () => t(ui.toggleTheme), group: () => t(ui.actions), hint: "T", run: () => toggleTheme() });
  registerCommand({
    id: "email",
    label: () => `${t(ui.copyEmail)} (${EMAIL})`,
    group: () => t(ui.actions),
    run: () => void copyEmail(),
  });
  registerCommand({
    id: "github",
    label: () => t(ui.openGithub),
    group: () => t(ui.actions),
    run: () => window.open(GITHUB, "_blank", "noopener"),
  });
  registerCommand({ id: "help", label: () => t(ui.shortcuts), group: () => t(ui.actions), hint: "?", run: () => toggleHelp(true) });
}

// ---------- kommandopalett ----------

const palette = new CommandPalette({
  placeholder: () => t(ui.palettePlaceholder),
  emptyText: () => t(ui.paletteEmpty),
  getCommands: (): Command[] =>
    allCommands().map((c) => ({ id: c.id, label: c.label(), group: c.group(), hint: c.hint, run: c.run })),
});

// ---------- tangentbord ----------

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiIdx = 0;
let lastLetterAt = 0;

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    // terminalen är sin egen modal — låt den behålla fokus
    if (document.querySelector(".term-overlay.is-open")) return;
    e.preventDefault();
    palette.toggle();
    bus.emit("palette-open", {});
    return;
  }
  if (e.key === "Escape") {
    palette.close();
    toggleHelp(false);
    return;
  }
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || palette.isOpen) return;
  if (document.body.classList.contains("game-active")) return;
  // modifierade tangenter (Ctrl+C, Alt+Tab-rester osv.) är aldrig våra kortkommandon
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // konami
  if (e.key === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      handleKonami(ctx);
    }
  } else {
    // upp-upp-upp… ska inte nollställa det giltiga upp-upp-prefixet
    konamiIdx = e.key === "ArrowUp" ? (konamiIdx >= 2 ? 2 : 1) : 0;
  }

  if (e.repeat) return;

  // snabbskrivna bokstäver = fuskkod på väg — släpp inte igenom som kortkommando
  const isLetter = e.key.length === 1 && /[a-z]/i.test(e.key);
  if (isLetter) {
    const now = performance.now();
    const typing = now - lastLetterAt < 600;
    lastLetterAt = now;
    if (typing) return;
  }

  const n = Number(e.key);
  if (n >= 1 && n <= projects.length) goTo(projects[n - 1].id);
  else if (e.key === "0") goTo("hem");
  else if (e.key.toLowerCase() === "c") goTo("kontakt");
  else if (e.key.toLowerCase() === "t") toggleTheme();
  else if (e.key.toLowerCase() === "l") toggleLang();
  else if (e.key.toLowerCase() === "m") runCommand("audio-toggle");
  else if (e.key.toLowerCase() === "d") runCommand("debug");
  else if (e.key === ">") runCommand("terminal");
  else if (e.key === "?") toggleHelp();
});

// ---------- fysisk cursor: klick = chockvåg, håll = virvel ----------

function initPhysicalCursor(): void {
  if (reducedMotion) return;
  let downAt = 0;
  let downPos = { x: 0, y: 0 };
  let vortexActive = false;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;

  const interactive = (el: HTMLElement) =>
    !!el.closest("a, button, input, textarea, kbd, .palette, .help, .hud, .runeboard, [data-no-shock]");

  window.addEventListener("pointerdown", (e) => {
    if (document.body.classList.contains("game-active")) return;
    if (interactive(e.target as HTMLElement)) return;
    downAt = performance.now();
    downPos = { x: e.clientX, y: e.clientY };
    holdTimer = setTimeout(() => {
      vortexActive = true;
      engine.vortex(e.clientX, e.clientY, true);
    }, 260);
  });

  window.addEventListener(
    "pointermove",
    (e) => {
      if (vortexActive) {
        engine.vortex(e.clientX, e.clientY, true);
        return;
      }
      // rörelse före hold-tröskeln = scroll/svep — avväpna virveln
      if (downAt > 0 && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 12) {
        clearTimeout(holdTimer);
      }
    },
    { passive: true }
  );

  window.addEventListener("pointerup", (e) => {
    clearTimeout(holdTimer);
    if (vortexActive) {
      vortexActive = false;
      engine.vortex(e.clientX, e.clientY, false);
      return;
    }
    if (downAt === 0) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (performance.now() - downAt < 260 && moved < 12 && !interactive(e.target as HTMLElement)) {
      engine.shockwave(e.clientX, e.clientY, 1);
    }
    downAt = 0;
  });

  // touch-scroll avbryter med pointercancel — utan denna fastnar virveln
  window.addEventListener("pointercancel", (e) => {
    clearTimeout(holdTimer);
    downAt = 0;
    if (vortexActive) {
      vortexActive = false;
      engine.vortex(e.clientX, e.clientY, false);
    }
  });
}

// ---------- start ----------

applyThemeDom();
initToast();
render();
applySection(sections[0]);
initCursor();
registerBaseCommands();
initCheats(ctx, reapplyAccent);
initRuneboard(ctx);
initDiploma(ctx);
initHud({ ...ctx, simParams: () => engine.simParams() });
initNarrator(bus, () => lang, shapeFor);
initRunaway(ctx);
initCalendar(ctx);
initIdle(ctx, () => applySection(currentSection));
initPhysicalCursor();

// partiklarna hälsar välkommen — en gång per session
if (!reducedMotion && !sessionStorage.getItem("pf-greeted")) {
  sessionStorage.setItem("pf-greeted", "1");
  setTimeout(() => {
    if (currentSection.id === "hem" && !engine.paused) engine.morphToText("LUCAS SKOG", 3600);
  }, 900);
}

// tunga/fristående moduler laddas efter första målningen
void loadFeatureModules();

async function loadFeatureModules(): Promise<void> {
  // varje modul laddas och initieras isolerat — en trasig chunk får inte
  // släcka de andra tio funktionerna
  const features: [string, () => Promise<{ init(c: FeatureContext): unknown }>][] = [
    ["terminal", async () => ({ init: (await import("./features/terminal")).initTerminal })],
    ["audio", async () => ({ init: (await import("./features/audio")).initAudio })],
    ["print-cv", async () => ({ init: (await import("./features/print-cv")).initPrintCv })],
    ["jobmatch", async () => ({ init: (await import("./features/jobmatch")).initJobMatch })],
    ["github-pulse", async () => ({ init: (await import("./features/github-pulse")).initGithubPulse })],
    ["weather", async () => ({ init: (await import("./features/weather")).initWeather })],
    // spelens första anrop registrerar bara palettkommandot
    ["asteroids", async () => ({ init: (await import("./features/games/asteroids")).startAsteroids })],
    ["snake", async () => ({ init: (await import("./features/games/snake")).startSnake })],
    ["pix", async () => ({ init: (await import("./features/pix")).initPix })],
    ["multiverse", async () => ({ init: (await import("./features/multiverse")).initMultiverse })],
    ["console-api", async () => ({ init: (await import("./features/console-api")).initConsoleApi })],
    ["cosmos", async () => ({ init: (await import("./features/cosmos")).initCosmos })],
    ["gamepad", async () => ({ init: (await import("./features/gamepad")).initGamepad })],
  ];
  await Promise.all(
    features.map(async ([name, load]) => {
      try {
        (await load()).init(ctx);
      } catch (err) {
        console.error(`[features] "${name}" kunde inte laddas`, err);
      }
    })
  );
}
