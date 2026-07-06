/**
 * Jobbmatchning: klistra in en jobbannons var som helst på sidan → lokal
 * matchrapport + partikelfältet morfar till en 6-axlig radar. Noll nätverk.
 */
import type { FeatureContext } from "../app/contracts";
import { injectStyle, el } from "../app/dom";

type Axis = "frontend" | "backend" | "ai" | "devops" | "data" | "product";

interface Skill {
  id: string;
  label: string;
  /** Gemener, sv+en. Matchas med ordgräns mot annonstexten. */
  aliases: string[];
  axis: Axis;
  weight: 1 | 2;
  /** false ⇒ vanlig teknik som INTE finns i portfolion — ger gap-analysen. */
  have: boolean;
}

const AXES: Axis[] = ["frontend", "backend", "ai", "devops", "data", "product"];

const SKILLS: Skill[] = [
  // — finns i portfolion —
  { id: "typescript", label: "TypeScript", aliases: ["typescript"], axis: "frontend", weight: 2, have: true },
  { id: "javascript", label: "JavaScript", aliases: ["javascript", "ecmascript"], axis: "frontend", weight: 2, have: true },
  { id: "react", label: "React", aliases: ["react", "reactjs", "react.js"], axis: "frontend", weight: 2, have: true },
  { id: "nextjs", label: "Next.js", aliases: ["next.js", "nextjs"], axis: "frontend", weight: 2, have: true },
  { id: "html", label: "HTML", aliases: ["html", "html5"], axis: "frontend", weight: 1, have: true },
  { id: "css", label: "CSS", aliases: ["css", "css3"], axis: "frontend", weight: 1, have: true },
  { id: "tailwind", label: "Tailwind", aliases: ["tailwind", "tailwindcss", "tailwind css"], axis: "frontend", weight: 1, have: true },
  { id: "threejs", label: "three.js/WebGL", aliases: ["three.js", "threejs", "webgl"], axis: "frontend", weight: 1, have: true },
  {
    id: "pwa",
    label: "PWA",
    aliases: ["pwa", "progressive web app", "progressive web apps", "service worker", "service workers"],
    axis: "frontend",
    weight: 1,
    have: true,
  },
  { id: "vite", label: "Vite", aliases: ["vite"], axis: "frontend", weight: 1, have: true },
  { id: "electron", label: "Electron", aliases: ["electron"], axis: "frontend", weight: 1, have: true },
  {
    id: "performance",
    label: "Web performance",
    aliases: ["web performance", "core web vitals", "lighthouse", "prestanda", "prestandaoptimering"],
    axis: "frontend",
    weight: 1,
    have: true,
  },
  { id: "node", label: "Node.js", aliases: ["node", "node.js", "nodejs"], axis: "backend", weight: 2, have: true },
  { id: "python", label: "Python", aliases: ["python"], axis: "backend", weight: 2, have: true },
  { id: "fastapi", label: "FastAPI", aliases: ["fastapi"], axis: "backend", weight: 1, have: true },
  // "rest" ensamt kolliderar med engelskans "rest" — kräv tydligare form
  { id: "rest", label: "REST", aliases: ["restful", "rest api", "rest apis", "rest-api", "rest-apier"], axis: "backend", weight: 1, have: true },
  { id: "websocket", label: "WebSocket", aliases: ["websocket", "websockets", "socket.io"], axis: "backend", weight: 1, have: true },
  { id: "stripe", label: "Stripe", aliases: ["stripe"], axis: "backend", weight: 1, have: true },
  { id: "oauth", label: "OAuth/NextAuth", aliases: ["oauth", "oauth2", "nextauth", "openid connect", "sso"], axis: "backend", weight: 1, have: true },
  { id: "postgresql", label: "PostgreSQL", aliases: ["postgresql", "postgres"], axis: "data", weight: 2, have: true },
  { id: "sql", label: "SQL", aliases: ["sql"], axis: "data", weight: 2, have: true },
  { id: "prisma", label: "Prisma", aliases: ["prisma"], axis: "data", weight: 1, have: true },
  { id: "supabase", label: "Supabase", aliases: ["supabase"], axis: "data", weight: 1, have: true },
  { id: "openai", label: "OpenAI", aliases: ["openai", "chatgpt"], axis: "ai", weight: 1, have: true },
  { id: "anthropic", label: "Anthropic/Claude", aliases: ["anthropic", "claude"], axis: "ai", weight: 1, have: true },
  {
    id: "llm",
    label: "LLM/AI",
    aliases: [
      "llm",
      "llms",
      "large language model",
      "large language models",
      "språkmodell",
      "språkmodeller",
      "generative ai",
      "generativ ai",
      "genai",
      "machine learning",
      "maskininlärning",
    ],
    axis: "ai",
    weight: 2,
    have: true,
  },
  {
    id: "rag",
    label: "RAG",
    aliases: ["rag", "retrieval augmented generation", "retrieval-augmented generation", "vector database", "vektordatabas", "embeddings"],
    axis: "ai",
    weight: 1,
    have: true,
  },
  { id: "ollama", label: "Ollama", aliases: ["ollama"], axis: "ai", weight: 1, have: true },
  { id: "mcp", label: "MCP", aliases: ["mcp", "model context protocol"], axis: "ai", weight: 1, have: true },
  {
    id: "prompt",
    label: "Prompt engineering",
    aliases: ["prompt engineering", "prompting", "promptteknik", "prompt design"],
    axis: "ai",
    weight: 1,
    have: true,
  },
  {
    id: "cicd",
    label: "CI/CD",
    aliases: ["ci/cd", "cicd", "continuous integration", "continuous delivery", "continuous deployment"],
    axis: "devops",
    weight: 2,
    have: true,
  },
  { id: "githubactions", label: "GitHub Actions", aliases: ["github actions"], axis: "devops", weight: 1, have: true },
  { id: "docker", label: "Docker", aliases: ["docker"], axis: "devops", weight: 2, have: true },
  { id: "git", label: "Git", aliases: ["git", "github"], axis: "devops", weight: 1, have: true },
  {
    id: "testing",
    label: "Testing/TDD",
    aliases: [
      "vitest",
      "jest",
      "tdd",
      "test-driven",
      "testdriven",
      "unit testing",
      "unit tests",
      "enhetstester",
      "enhetstestning",
      "playwright",
      "cypress",
      "automated testing",
      "automatiserade tester",
    ],
    axis: "devops",
    weight: 2,
    have: true,
  },
  { id: "monorepo", label: "Monorepo/pnpm", aliases: ["monorepo", "monorepos", "pnpm", "turborepo", "workspaces"], axis: "devops", weight: 1, have: true },
  { id: "security", label: "Security", aliases: ["security", "owasp", "säkerhet", "informationssäkerhet"], axis: "devops", weight: 1, have: true },
  { id: "accessibility", label: "Accessibility/WCAG", aliases: ["wcag", "a11y", "accessibility", "tillgänglighet"], axis: "product", weight: 1, have: true },
  {
    id: "i18n",
    label: "i18n",
    aliases: ["i18n", "internationalization", "internationalisering", "localization", "lokalisering", "flerspråkig", "flerspråkighet"],
    axis: "product",
    weight: 1,
    have: true,
  },
  { id: "agile", label: "Agile/Scrum", aliases: ["agile", "agilt", "agila", "scrum", "kanban"], axis: "product", weight: 2, have: true },

  // — vanliga krav som inte finns i portfolion (för "saknas"-gruppen) —
  { id: "java", label: "Java", aliases: ["java"], axis: "backend", weight: 2, have: false },
  { id: "csharp", label: "C#/.NET", aliases: ["c#", "csharp", ".net", "dotnet", "asp.net"], axis: "backend", weight: 2, have: false },
  { id: "php", label: "PHP", aliases: ["php", "laravel", "symfony"], axis: "backend", weight: 1, have: false },
  { id: "ruby", label: "Ruby", aliases: ["ruby", "ruby on rails", "rails"], axis: "backend", weight: 1, have: false },
  { id: "golang", label: "Go", aliases: ["golang"], axis: "backend", weight: 1, have: false },
  { id: "rust", label: "Rust", aliases: ["rust"], axis: "backend", weight: 1, have: false },
  { id: "cpp", label: "C++", aliases: ["c++"], axis: "backend", weight: 1, have: false },
  { id: "graphql", label: "GraphQL", aliases: ["graphql", "apollo"], axis: "backend", weight: 1, have: false },
  { id: "angular", label: "Angular", aliases: ["angular", "angularjs"], axis: "frontend", weight: 2, have: false },
  { id: "vue", label: "Vue", aliases: ["vue", "vuejs", "vue.js", "nuxt"], axis: "frontend", weight: 1, have: false },
  { id: "svelte", label: "Svelte", aliases: ["svelte", "sveltekit"], axis: "frontend", weight: 1, have: false },
  { id: "reactnative", label: "React Native", aliases: ["react native"], axis: "frontend", weight: 1, have: false },
  { id: "flutter", label: "Flutter", aliases: ["flutter"], axis: "frontend", weight: 1, have: false },
  { id: "kubernetes", label: "Kubernetes", aliases: ["kubernetes", "k8s", "helm"], axis: "devops", weight: 2, have: false },
  { id: "aws", label: "AWS", aliases: ["aws", "amazon web services"], axis: "devops", weight: 2, have: false },
  { id: "azure", label: "Azure", aliases: ["azure"], axis: "devops", weight: 2, have: false },
  { id: "gcp", label: "Google Cloud", aliases: ["gcp", "google cloud"], axis: "devops", weight: 1, have: false },
  { id: "terraform", label: "Terraform", aliases: ["terraform"], axis: "devops", weight: 1, have: false },
  { id: "mongodb", label: "MongoDB", aliases: ["mongodb", "mongo"], axis: "data", weight: 1, have: false },
  { id: "mysql", label: "MySQL", aliases: ["mysql", "mariadb"], axis: "data", weight: 1, have: false },
  { id: "redis", label: "Redis", aliases: ["redis"], axis: "data", weight: 1, have: false },
  { id: "elasticsearch", label: "Elasticsearch", aliases: ["elasticsearch", "opensearch"], axis: "data", weight: 1, have: false },
  { id: "kafka", label: "Kafka", aliases: ["kafka"], axis: "data", weight: 1, have: false },
];

const STR = {
  title: { sv: "Matchrapport", en: "Match report" },
  hits: { sv: "Träffar", en: "Matches" },
  misses: { sv: "Saknas/omnämns ej i portfolion", en: "Missing / not mentioned in the portfolio" },
  disclaimer: { sv: "Grov teknisk matchning — ersätter inte en människa.", en: "Rough technical match — not a substitute for a human." },
  tooFew: {
    sv: "Hittade för få tekniska krav i texten — prova att klistra in en hel jobbannons.",
    en: "Found too few technical requirements in the text — try pasting a full job ad.",
  },
  close: { sv: "Stäng", en: "Close" },
  cmdLabel: { sv: "Matcha mot en jobbannons (Ctrl+V)", en: "Match against a job ad (Ctrl+V)" },
  cmdGroup: { sv: "Åtgärder", en: "Actions" },
  cmdToast: {
    sv: "Kopiera en jobbannons och klistra in var som helst på sidan.",
    en: "Copy a job ad and paste it anywhere on the page.",
  },
} as const;

interface Report {
  tooFew: boolean;
  score: number;
  mentioned: number;
  hits: Skill[];
  misses: Skill[];
  axisScores: number[];
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ordgräns som även räknar åäö, # och + som ordtecken (c#, c++, säkerhet…). */
function aliasRx(alias: string): RegExp {
  return new RegExp(`(?<![\\wåäö#+])${escapeRx(alias)}(?![\\wåäö#+])`);
}

function analyze(raw: string): Report {
  const text = raw.toLowerCase();
  const hits: Skill[] = [];
  const misses: Skill[] = [];
  for (const s of SKILLS) {
    if (s.aliases.some((a) => aliasRx(a).test(text))) (s.have ? hits : misses).push(s);
  }
  const sum = (arr: Skill[]) => arr.reduce((acc, s) => acc + s.weight, 0);
  const mentioned = hits.length + misses.length;
  const total = sum(hits) + sum(misses);
  const score = total > 0 ? Math.round((100 * sum(hits)) / total) : 0;
  // per axel: matchad vikt / omnämnd vikt — bara krav som faktiskt står i annonsen
  const axisScores = AXES.map((axis) => {
    const h = sum(hits.filter((s) => s.axis === axis));
    const m = sum(misses.filter((s) => s.axis === axis));
    return h + m > 0 ? h / (h + m) : 0;
  });
  const byWeight = (a: Skill, b: Skill) => b.weight - a.weight || a.label.localeCompare(b.label);
  hits.sort(byWeight);
  misses.sort(byWeight);
  return { tooFew: mentioned < 3, score, mentioned, hits, misses, axisScores };
}

/** 6-axlig radar som punktmoln: ekrar + polygonkontur + gles fyllnad. */
function buildRadarCloud(axisScores: number[], maxR: number): Float32Array {
  const COUNT = 4000;
  const pts = new Float32Array(COUNT * 3);
  const verts = axisScores.map((s, i) => {
    const a = -Math.PI / 2 + (i / axisScores.length) * Math.PI * 2;
    const r = Math.max(0.06, Math.min(1, s)) * maxR;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
  let p = 0;
  const put = (x: number, y: number) => {
    pts[p++] = x;
    pts[p++] = y;
    pts[p++] = (Math.random() * 2 - 1) * 0.15;
  };
  const jit = () => (Math.random() * 2 - 1) * maxR * 0.015;
  const spokes = Math.floor(COUNT * 0.42);
  for (let i = 0; i < spokes; i++) {
    const [vx, vy] = verts[i % verts.length];
    const t = Math.random();
    put(vx * t + jit(), vy * t + jit());
  }
  const edges = Math.floor(COUNT * 0.45);
  for (let i = 0; i < edges; i++) {
    const k = i % verts.length;
    const [ax, ay] = verts[k];
    const [bx, by] = verts[(k + 1) % verts.length];
    const t = Math.random();
    put(ax + (bx - ax) * t + jit(), ay + (by - ay) * t + jit());
  }
  // resten: fyllnad via triangelfläkt från mitten
  while (p < COUNT * 3) {
    const k = Math.floor(Math.random() * verts.length);
    const [ax, ay] = verts[k];
    const [bx, by] = verts[(k + 1) % verts.length];
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    put(ax * u + bx * v, ay * u + by * v);
  }
  return pts;
}

const CSS = `
.jm-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: none;
}
.jm-overlay.is-open { display: block; }
.jm-card {
  position: relative;
  width: min(560px, 92vw);
  max-height: 72vh;
  overflow-y: auto;
  margin: 14vh auto 0;
  background: var(--bg-elevated);
  border: 1px solid var(--faint);
  border-radius: 16px;
  padding: 1.8rem;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  animation: jm-in 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  outline: none;
}
@keyframes jm-in {
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
}
.jm-close {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  width: 2rem;
  height: 2rem;
  background: none;
  border: 1px solid var(--faint);
  border-radius: 999px;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.25s ease, color 0.25s ease;
}
.jm-close:hover { border-color: var(--accent); color: var(--fg); }
.jm-kicker {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.jm-score {
  margin-top: 0.6rem;
  font-family: var(--font-display);
  font-size: clamp(3.4rem, 9vw, 5rem);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--accent);
}
.jm-pct { font-size: 0.4em; color: var(--muted); }
.jm-sub { margin-top: 0.4rem; color: var(--muted); font-size: 0.9rem; }
.jm-group { margin-top: 1.3rem; }
.jm-group h4 {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin-bottom: 0.55rem;
}
.jm-chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.jm-chip {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--faint);
}
.jm-chip.is-hit {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--fg);
}
.jm-chip.is-miss { color: var(--muted); }
.jm-empty { margin-top: 1rem; color: var(--muted); }
.jm-disclaimer {
  margin-top: 1.6rem;
  padding-top: 1rem;
  border-top: 1px solid var(--faint);
  color: var(--muted);
  font-size: 0.8rem;
}
@media (prefers-reduced-motion: reduce) {
  .jm-card { animation: none; }
}
`;

export function initJobMatch(ctx: FeatureContext): void {
  injectStyle("jm-style", CSS);

  let overlay: HTMLDivElement | null = null;
  let card: HTMLDivElement | null = null;
  let last: Report | null = null;

  const isOpen = () => overlay?.classList.contains("is-open") ?? false;

  function ensureOverlay(): void {
    if (overlay) return;
    overlay = el("div", { class: "jm-overlay" });
    card = el("div", { class: "jm-card", role: "dialog", "aria-modal": "true", tabindex: "-1" });
    overlay.append(card);
    overlay.addEventListener("pointerdown", (e) => {
      if (e.target === overlay) close();
    });
    document.body.append(overlay);
  }

  function close(): void {
    overlay?.classList.remove("is-open");
  }

  function chipGroup(title: string, skills: Skill[], cls: string): string {
    const chips = skills.map((s) => `<span class="jm-chip ${cls}">${s.label}</span>`).join("");
    return `<div class="jm-group"><h4>${title}</h4><div class="jm-chips">${chips}</div></div>`;
  }

  function renderCard(r: Report): void {
    if (!card) return;
    card.setAttribute("aria-label", ctx.t(STR.title));
    const head = `
      <button class="jm-close" aria-label="${ctx.t(STR.close)}" data-hover>&times;</button>
      <p class="jm-kicker">${ctx.t(STR.title)}</p>`;
    const foot = `<p class="jm-disclaimer">${ctx.t(STR.disclaimer)}</p>`;
    if (r.tooFew) {
      card.innerHTML = `${head}<p class="jm-empty">${ctx.t(STR.tooFew)}</p>${foot}`;
    } else {
      const sub = ctx.t({
        sv: `${r.mentioned} tekniska krav hittade i annonsen — ${r.hits.length} täcks av portfolion.`,
        en: `${r.mentioned} technical requirements found in the ad — ${r.hits.length} covered by the portfolio.`,
      });
      card.innerHTML =
        head +
        `<div class="jm-score">${r.score}<span class="jm-pct">%</span></div>` +
        `<p class="jm-sub">${sub}</p>` +
        (r.hits.length ? chipGroup(ctx.t(STR.hits), r.hits, "is-hit") : "") +
        (r.misses.length ? chipGroup(ctx.t(STR.misses), r.misses, "is-miss") : "") +
        foot;
    }
    card.querySelector(".jm-close")?.addEventListener("click", close);
  }

  function openReport(r: Report): void {
    ensureOverlay();
    last = r;
    renderCard(r);
    overlay!.classList.add("is-open");
    card!.focus();
    ctx.bus.emit("audio-blip", { kind: "open" });
  }

  function anyOverlayOpen(): boolean {
    return !!document.querySelector('[class*="overlay"].is-open, [class*="palette"].is-open, dialog[open]');
  }

  window.addEventListener("paste", (e) => {
    try {
      const tgt = e.target as HTMLElement | null;
      if (tgt) {
        const tag = tgt.tagName ?? "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tgt.isContentEditable === true) return;
        if (typeof tgt.closest === "function" && tgt.closest('[contenteditable=""], [contenteditable="true"]')) return;
      }
      if (anyOverlayOpen()) return;
      const text = (e as ClipboardEvent).clipboardData?.getData("text/plain") ?? "";
      if (text.length <= 300) return;
      const report = analyze(text);
      openReport(report);
      // radar-morf: hoppa över vid reduced motion eller pågående spel
      if (!report.tooFew && !ctx.engine.reducedMotion && !ctx.engine.paused) {
        const b = ctx.engine.worldBounds();
        const maxR = 0.75 * Math.min(b.halfW, b.halfH);
        ctx.engine.morphToPoints(buildRadarCloud(report.axisScores, maxR), 7000);
      }
    } catch {
      // aldrig störa inklistringen
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) close();
  });

  ctx.bus.on("lang", () => {
    if (isOpen() && last) renderCard(last);
  });

  ctx.registerCommand({
    id: "jobmatch-help",
    label: () => ctx.t(STR.cmdLabel),
    group: () => ctx.t(STR.cmdGroup),
    run: () => ctx.toast(ctx.t(STR.cmdToast)),
  });
}
