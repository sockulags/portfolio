import type { FeatureContext } from "../app/contracts";
import { injectStyle, el } from "../app/dom";
import { projects, ui } from "../data/content";

/**
 * Ctrl+P förvandlar sajten till ett ATS-vänligt enkelsidigt CV.
 * Dold .print-cv-div byggs från content.ts och visas bara i @media print.
 */

const STR = {
  selectedWork: ui.selectedWork,
  techBreadth: { sv: "Teknisk bredd", en: "Technical breadth" },
  techLabel: { sv: "Teknik", en: "Tech" },
  tools: { sv: "Verktyg", en: "Tools" },
  footer: {
    sv: "Genererad från %s — CV:t är sajtens utskriftsvy",
    en: "Generated from %s — this CV is the site's print view",
  },
  command: { sv: "Ladda ner CV (PDF)", en: "Download CV (PDF)" },
} as const;

// Hårdkodad gruppering av tech-taggar; taggarna själva aggregeras från projekten.
const TECH_GROUPS: { label: { sv: string; en: string }; tags: string[] }[] = [
  {
    label: { sv: "Frontend", en: "Frontend" },
    tags: ["TypeScript", "React", "React 19", "Next.js 16", "Vite", "Tailwind 4", "three.js", "PWA", "Service Worker"],
  },
  {
    label: { sv: "Backend", en: "Backend" },
    tags: ["Python", "FastAPI", "PostgreSQL", "Prisma", "Supabase", "NextAuth", "Stripe", "WebSocket", "Node CLI", "sharp"],
  },
  {
    label: { sv: "AI", en: "AI" },
    tags: ["Anthropic API", "OpenAI", "Ollama", "MCP"],
  },
  {
    label: STR.tools,
    tags: ["GitHub Actions", "GitHub Pages", "pnpm workspaces", "Vite"],
  },
];

function uniqueTechTags(): string[] {
  const raw = [...new Set(projects.flatMap((p) => p.tech))];
  // "React" utgår om "React 19" finns — versionen säger mer.
  return raw.filter((tag) => !raw.some((other) => other !== tag && other.startsWith(tag + " ")));
}

export function initPrintCv(ctx: FeatureContext): void {
  injectStyle(
    "print-css",
    `
    .print-cv { display: none; }

    @media print {
      @page { margin: 14mm; }

      body > *:not(.print-cv),
      #gl, #app, .cursor-dot, .cursor-ring, .toast { display: none !important; }

      html, body {
        background: #fff !important;
        color: #000 !important;
      }

      .print-cv {
        display: block !important;
        background: #fff;
        color: #000;
        font-family: var(--font-body);
        font-size: 12pt;
        line-height: 1.4;
      }

      .print-cv a { color: #000; text-decoration: none; }
      .print-cv a[href]::after { content: "" !important; }

      .pcv-header::after { content: ""; display: block; clear: both; }

      .pcv-qr {
        float: right;
        width: 96px;
        height: 96px;
        margin: 0 0 6pt 10pt;
      }

      .print-cv h1 {
        margin: 0;
        font-size: 24pt;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }

      .pcv-contact { margin: 3pt 0 0; font-size: 10pt; }
      .pcv-summary { margin: 6pt 0 0; font-size: 11pt; }

      .print-cv h2 {
        margin: 14pt 0 6pt;
        padding-bottom: 2pt;
        border-bottom: 1pt solid #000;
        font-size: 12pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .pcv-project {
        page-break-inside: avoid;
        break-inside: avoid;
        margin: 0 0 8pt;
      }

      .print-cv h3 { margin: 0; font-size: 11.5pt; font-weight: 700; }
      .print-cv h3 em { font-weight: 400; font-size: 10.5pt; }

      .pcv-project ul { margin: 2pt 0 0; padding-left: 14pt; font-size: 10pt; }
      .pcv-project li { margin: 0 0 1pt; }

      .pcv-tech { margin: 2pt 0 0; font-size: 9pt; color: #333; }

      .pcv-skills p { margin: 0 0 2pt; font-size: 10pt; }

      .pcv-footer {
        margin-top: 12pt;
        padding-top: 4pt;
        border-top: 0.5pt solid #999;
        font-size: 8.5pt;
        color: #444;
      }
      .pcv-footer p { margin: 0; }
    }
    `
  );

  const root = el("div", { class: "print-cv" });
  document.body.append(root);

  let qrDataUrl = "";

  const build = (): void => {
    const lang = ctx.lang();
    const siteDisplay = ctx.SITE_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const qr = qrDataUrl
      ? `<img class="pcv-qr" src="${qrDataUrl}" alt="${siteDisplay}" width="96" height="96" />`
      : "";

    const projectBlocks = projects
      .map(
        (p) => `
        <article class="pcv-project">
          <h3>${p.name} <em>— ${ctx.t(p.tagline)}</em></h3>
          <ul>${p.highlights[lang].slice(0, 3).map((h) => `<li>${h}</li>`).join("")}</ul>
          <p class="pcv-tech">${ctx.t(STR.techLabel)}: ${p.tech.join(" · ")}</p>
        </article>`
      )
      .join("");

    const allTags = uniqueTechTags();
    const used = new Set<string>();
    const skillRows = TECH_GROUPS.map((g) => {
      const tags = allTags.filter((tag) => g.tags.includes(tag) && !used.has(tag));
      tags.forEach((tag) => used.add(tag));
      return { label: g.label, tags };
    });
    // taggar utan grupp hamnar under Verktyg
    const rest = allTags.filter((tag) => !used.has(tag));
    if (rest.length) skillRows[skillRows.length - 1].tags.push(...rest);

    const skills = skillRows
      .filter((r) => r.tags.length > 0)
      .map((r) => `<p><strong>${ctx.t(r.label)}:</strong> ${r.tags.join(" · ")}</p>`)
      .join("");

    root.innerHTML = `
      <header class="pcv-header">
        ${qr}
        <h1>Lucas Skog</h1>
        <p class="pcv-contact">${ctx.EMAIL} · github.com/${ctx.GITHUB_USER} · ${siteDisplay} · Stockholm</p>
        <p class="pcv-summary">${ctx.t(ui.role)} — ${ctx.t(ui.heroLine)}</p>
      </header>

      <section>
        <h2>${ctx.t(STR.selectedWork)}</h2>
        ${projectBlocks}
      </section>

      <section class="pcv-skills">
        <h2>${ctx.t(STR.techBreadth)}</h2>
        ${skills}
      </section>

      <footer class="pcv-footer">
        <p>${ctx.t(STR.footer).replace("%s", siteDisplay)}</p>
      </footer>
    `;
  };

  build();
  window.addEventListener("beforeprint", build);
  ctx.bus.on("lang", () => build());

  // QR-koden laddas när webbläsaren har tid över — misslyckas den tyst är CV:t ändå komplett.
  const loadQr = (): void => {
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(ctx.SITE_URL, { margin: 0, width: 96 }))
      .then((url) => {
        qrDataUrl = url;
        build();
      })
      .catch(() => {});
  };
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(loadQr);
  else setTimeout(loadQr, 3000);

  ctx.registerCommand({
    id: "print-cv",
    label: () => ctx.t(STR.command),
    group: () => ctx.t(ui.actions),
    hint: "Ctrl+P",
    run: () => window.print(),
  });
}
