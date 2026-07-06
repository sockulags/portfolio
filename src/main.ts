import "./style.css";
import { ParticleScene, type ShapeId } from "./three/scene";
import { projects, ui, marqueeWords, type Lang } from "./data/content";
import { initCursor } from "./ui/cursor";
import { CommandPalette, type Command } from "./ui/palette";

const EMAIL = "lucasskog@gmail.com";
const GITHUB = "https://github.com/sockulags";

type SectionDef = { id: string; shape: ShapeId; accent: string; offsetX: number };

// projektkorten alternerar höger/vänster (nth-of-type) — formen glider åt motsatt håll
const sections: SectionDef[] = [
  { id: "hem", shape: "galaxy", accent: "#7c6cff", offsetX: 0 },
  ...projects.map((p, i) => ({ id: p.id, shape: shapeFor(p.id), accent: p.accent, offsetX: i % 2 === 0 ? -2.1 : 2.1 })),
  { id: "kontakt", shape: "ring", accent: "#7c6cff", offsetX: 0 },
];

function shapeFor(id: string): ShapeId {
  const map: Record<string, ShapeId> = {
    meritvo: "layers",
    pilot: "knot",
    "design-pilot": "lattice",
    "rep-counter": "wave",
    smask: "blob",
  };
  return map[id] ?? "galaxy";
}

// ---------- state ----------

let lang: Lang = (localStorage.getItem("pf-lang") as Lang) ?? "sv";
let theme: "dark" | "light" = (localStorage.getItem("pf-theme") as "dark" | "light") ?? "dark";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = new ParticleScene(document.querySelector<HTMLCanvasElement>("#gl")!);
scene.setReducedMotion(reducedMotion);

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

function applyTheme(): void {
  document.documentElement.dataset.theme = theme;
  scene.setTheme(theme);
  localStorage.setItem("pf-theme", theme);
}

function setAccent(hex: string): void {
  document.documentElement.style.setProperty("--accent", hex);
  scene.setAccent(hex);
}

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
          <div><dt><kbd>?</kbd></dt><dd>${t(ui.shortcutsHelp)}</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>${t(ui.shortcutsClose)}</dd></div>
        </dl>
      </div>
    </div>

    <div class="toast mono" id="toast"></div>
  `;

  bind();
  observe();
}

// ---------- interaktion ----------

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  const el = document.querySelector<HTMLElement>("#toast")!;
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1800);
}

function bind(): void {
  document.querySelector("#lang-btn")!.addEventListener("click", toggleLang);
  document.querySelector("#theme-btn")!.addEventListener("click", toggleTheme);
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

let clockInterval: number | undefined;

function toggleLang(): void {
  lang = lang === "sv" ? "en" : "sv";
  localStorage.setItem("pf-lang", lang);
  render();
}

function toggleTheme(): void {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme();
  const btn = document.querySelector("#theme-btn");
  if (btn) btn.textContent = theme === "dark" ? "☀" : "☾";
}

async function copyEmail(): Promise<void> {
  try {
    await navigator.clipboard.writeText(EMAIL);
    const btn = document.querySelector<HTMLElement>("#copy-email")!;
    const original = t(ui.copyEmail);
    btn.textContent = t(ui.copied);
    setTimeout(() => (btn.textContent = original), 1500);
  } catch {
    location.href = `mailto:${EMAIL}`;
  }
}

function toggleHelp(force?: boolean): void {
  document.querySelector("#help-overlay")!.classList.toggle("is-open", force);
}

// ---------- scrollspy + reveal ----------

function observe(): void {
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        const def = sections.find((s) => s.id === id);
        if (!def) continue;
        scene.setShape(def.shape);
        scene.setOffsetX(def.offsetX);
        setAccent(def.accent);
        document.querySelectorAll(".dot").forEach((d) => {
          d.classList.toggle("is-active", (d as HTMLElement).dataset.section === id);
        });
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
    scene.setScroll(progress);
  },
  { passive: true }
);

// ---------- kommandopalett ----------

const palette = new CommandPalette({
  placeholder: () => t(ui.palettePlaceholder),
  emptyText: () => t(ui.paletteEmpty),
  getCommands: (): Command[] => [
    { id: "home", label: `${t(ui.goTo)}: ${t(ui.home)}`, group: t(ui.navigate), hint: "0", run: () => goTo("hem") },
    ...projects.map((p, i) => ({
      id: p.id,
      label: `${t(ui.goTo)}: ${p.name}`,
      group: t(ui.navigate),
      hint: String(i + 1),
      run: () => goTo(p.id),
    })),
    { id: "contact", label: `${t(ui.goTo)}: ${t(ui.contact)}`, group: t(ui.navigate), hint: "C", run: () => goTo("kontakt") },
    { id: "lang", label: t(ui.switchLang), group: t(ui.actions), hint: "L", run: toggleLang },
    { id: "theme", label: t(ui.toggleTheme), group: t(ui.actions), hint: "T", run: toggleTheme },
    { id: "email", label: `${t(ui.copyEmail)} (${EMAIL})`, group: t(ui.actions), run: copyEmail },
    { id: "github", label: t(ui.openGithub), group: t(ui.actions), run: () => window.open(GITHUB, "_blank", "noopener") },
    { id: "help", label: t(ui.shortcuts), group: t(ui.actions), hint: "?", run: () => toggleHelp(true) },
  ],
});

function goTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
}

// ---------- tangentbord ----------

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiIdx = 0;

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    palette.toggle();
    return;
  }
  if (e.key === "Escape") {
    palette.close();
    toggleHelp(false);
    return;
  }
  // skriv inte kortkommandon när ett inputfält har fokus
  if ((e.target as HTMLElement).tagName === "INPUT" || palette.isOpen) return;

  // konami
  if (e.key === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      scene.burst();
      toast(lang === "sv" ? "✨ Du hittade den." : "✨ You found it.");
    }
  } else {
    konamiIdx = e.key === KONAMI[0] ? 1 : 0;
  }

  const n = Number(e.key);
  if (n >= 1 && n <= projects.length) goTo(projects[n - 1].id);
  else if (e.key === "0") goTo("hem");
  else if (e.key.toLowerCase() === "c") goTo("kontakt");
  else if (e.key.toLowerCase() === "t") toggleTheme();
  else if (e.key.toLowerCase() === "l") toggleLang();
  else if (e.key === "?") toggleHelp();
});

// ---------- start ----------

applyTheme();
setAccent(sections[0].accent);
render();
initCursor();
