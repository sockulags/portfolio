/**
 * GitHub-puls: senaste publika aktiviteten + stjärnor för utvalda repos.
 * Oautentiserade anrop med ETag-cache i localStorage — tyst fallback vid fel.
 */

import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";

const CACHE_KEY = "pf-gh";
const MAX_AGE_MS = 10 * 60 * 1000;
const TRACKED_REPOS = ["pilot", "rep-counter", "portfolio"];

interface PulseEvent {
  type: string;
  repo: string;
  when: string; // ISO-tid
}

interface GhCache {
  etag_events?: string;
  etag_repos?: string;
  events?: PulseEvent;
  repos?: Record<string, number>;
  ts: number;
}

const CSS = `
[data-github-pulse] {
  display: block;
  margin-top: 1.1rem;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.5s ease;
}
[data-github-pulse].is-loaded {
  opacity: 1;
}
[data-gh] {
  color: var(--muted);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  [data-github-pulse] {
    transition: none;
  }
}
`;

function loadCache(): GhCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GhCache;
    return typeof parsed.ts === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function saveCache(c: GhCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // localStorage kan vara blockerad — cachen är bara en optimering
  }
}

function ghHeaders(etag?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (etag) h["If-None-Match"] = etag;
  return h;
}

export function initGithubPulse(ctx: FeatureContext): void {
  injectStyle("gh-pulse-style", CSS);

  let cache = loadCache();

  const activeLabel = { sv: "Senast aktiv på GitHub", en: "Last active on GitHub" };

  function eventText(e: PulseEvent): string {
    const map: Record<string, { sv: string; en: string }> = {
      PushEvent: { sv: `push till ${e.repo}`, en: `push to ${e.repo}` },
      CreateEvent: { sv: `skapade ${e.repo}`, en: `created ${e.repo}` },
      WatchEvent: { sv: `stjärnmärkte ${e.repo}`, en: `starred ${e.repo}` },
      PullRequestEvent: { sv: `PR i ${e.repo}`, en: `PR in ${e.repo}` },
      IssuesEvent: { sv: `issue i ${e.repo}`, en: `issue in ${e.repo}` },
    };
    return ctx.t(map[e.type] ?? { sv: `aktivitet i ${e.repo}`, en: `activity in ${e.repo}` });
  }

  function relTime(iso: string): string {
    const rtf = new Intl.RelativeTimeFormat(ctx.lang(), { numeric: "auto", style: "short" });
    const diffSec = Math.round((Date.parse(iso) - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, secs] of steps) {
      if (abs >= secs) return rtf.format(Math.sign(diffSec) * Math.floor(abs / secs), unit);
    }
    return rtf.format(diffSec, "second");
  }

  function markLoaded(node: HTMLElement): void {
    if (ctx.engine.reducedMotion) node.classList.add("is-loaded");
    else requestAnimationFrame(() => node.classList.add("is-loaded"));
  }

  function renderPulse(): void {
    const slot = document.querySelector<HTMLElement>("[data-github-pulse]");
    const e = cache?.events;
    if (!slot || !e || !e.when) return;
    slot.classList.add("mono");
    slot.textContent = `⚡ ${ctx.t(activeLabel)}: ${relTime(e.when)} — ${eventText(e)}`;
    markLoaded(slot);
  }

  function renderStars(): void {
    const repos = cache?.repos;
    if (!repos) return;
    document.querySelectorAll<HTMLElement>("[data-gh]").forEach((slot) => {
      const stars = repos[slot.dataset.gh ?? ""];
      if (stars === undefined) return;
      slot.classList.add("mono");
      slot.textContent = `★ ${stars}`;
    });
  }

  function renderAll(): void {
    renderPulse();
    renderStars();
  }

  async function refreshEvents(c: GhCache): Promise<boolean> {
    try {
      const res = await fetch(`https://api.github.com/users/${ctx.GITHUB_USER}/events/public`, {
        headers: ghHeaders(c.etag_events),
      });
      if (res.status === 304) return true;
      if (!res.ok) return false;
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return false;
      const first = data[0] as { type?: string; repo?: { name?: string }; created_at?: string } | undefined;
      if (first?.created_at) {
        c.events = {
          type: first.type ?? "",
          repo: (first.repo?.name ?? "").split("/").pop() ?? "",
          when: first.created_at,
        };
      }
      const etag = res.headers.get("ETag");
      if (etag) c.etag_events = etag;
      return true;
    } catch {
      return false;
    }
  }

  async function refreshRepos(c: GhCache): Promise<boolean> {
    try {
      const res = await fetch(`https://api.github.com/users/${ctx.GITHUB_USER}/repos?per_page=100`, {
        headers: ghHeaders(c.etag_repos),
      });
      if (res.status === 304) return true;
      if (!res.ok) return false;
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return false;
      const stars: Record<string, number> = {};
      for (const r of data as { name?: string; stargazers_count?: number }[]) {
        if (r.name && TRACKED_REPOS.includes(r.name)) stars[r.name] = r.stargazers_count ?? 0;
      }
      c.repos = stars;
      const etag = res.headers.get("ETag");
      if (etag) c.etag_repos = etag;
      return true;
    } catch {
      return false;
    }
  }

  async function refresh(): Promise<void> {
    const next: GhCache = cache ? { ...cache } : { ts: 0 };
    const [evOk, repoOk] = await Promise.all([refreshEvents(next), refreshRepos(next)]);
    // total miss (nät/ratelimit): behåll ev. gammal cache tyst, rör inte DOM
    if (!evOk && !repoOk) return;
    next.ts = Date.now();
    cache = next;
    saveCache(next);
    renderAll();
  }

  if (cache) renderAll();
  if (!cache || Date.now() - cache.ts > MAX_AGE_MS) void refresh();

  ctx.bus.on("lang", () => {
    // main.ts bygger om DOM:en synkront vid språkbyte — rita om efteråt
    queueMicrotask(renderAll);
  });
}
