/**
 * Terminal-overlay: en lekbar shell ovanpå sajten. Ingen kod körs vid
 * import — allt byggs lazily vid första open().
 */
import type { FeatureContext } from "../app/contracts";
import { injectStyle, el } from "../app/dom";
import { projects, ui } from "../data/content";

const PROMPT = "lucas@portfolio:~$";
const HIST_KEY = "pf-term-history";
const HIST_MAX = 50;

const CSS = `
.term-overlay {
  position: fixed;
  inset: 0;
  z-index: 65;
  display: none;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.term-overlay.is-open {
  display: flex;
}
.term {
  display: flex;
  flex-direction: column;
  width: min(720px, 94vw);
  height: min(480px, 80vh);
  background: var(--bg-elevated);
  border: 1px solid var(--faint);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  animation: term-in 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes term-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }
}
.term-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid var(--faint);
  color: var(--muted);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  user-select: none;
}
.term-bar i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--faint);
}
.term-bar i:first-child {
  background: var(--accent);
}
.term-bar-label {
  margin-left: 0.4rem;
}
.term-out {
  flex: 1;
  overflow-y: auto;
  padding: 0.9rem 1rem;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  line-height: 1.5;
}
.term-line {
  min-height: 1.2em;
}
.term-muted {
  color: var(--muted);
}
.term-accent {
  color: var(--accent);
}
.term-err {
  color: #e5484d;
}
.term-in-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 1rem 0.8rem;
  border-top: 1px solid var(--faint);
}
.term-prompt {
  color: var(--accent);
  white-space: nowrap;
}
.term-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  color: var(--fg);
  font: inherit;
  caret-color: var(--accent);
}
.term-input:focus,
.term-input:focus-visible {
  outline: none;
}
@media (prefers-reduced-motion: reduce) {
  .term {
    animation: none;
  }
}
`;

interface TermDom {
  root: HTMLElement;
  out: HTMLElement;
  input: HTMLInputElement;
  barLabel: HTMLElement;
}

export function initTerminal(ctx: FeatureContext): { open(): void } {
  const t = (entry: { sv: string; en: string }): string => ctx.t(entry);

  let dom: TermDom | null = null;
  let history = loadHistory();
  let histIdx = history.length;

  const projectIds = projects.map((p) => p.id);
  const COMMANDS = [
    "help", "ls", "cat", "open", "goto", "theme", "lang", "whoami",
    "neofetch", "date", "echo", "clear", "history", "play", "snake",
    "sudo", "exit", "quit",
  ];
  const ARG_POOL: Record<string, string[]> = {
    ls: ["projects"],
    cat: ["cv.md", "uses.txt", "secrets"],
    open: [...projectIds, "github", "email"],
    goto: ["hem", "kontakt", ...projectIds],
    theme: ["dark", "light"],
    lang: ["sv", "en"],
    sudo: ["hire-me"],
  };

  // ---------- lagring ----------

  function loadHistory(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(HIST_KEY) ?? "[]");
      if (Array.isArray(raw)) {
        return raw.filter((x): x is string => typeof x === "string").slice(-HIST_MAX);
      }
    } catch {
      // trasig lagring — börja om tomt
    }
    return [];
  }

  function pushHistory(cmd: string): void {
    if (history[history.length - 1] !== cmd) {
      history = [...history, cmd].slice(-HIST_MAX);
      try {
        localStorage.setItem(HIST_KEY, JSON.stringify(history));
      } catch {
        // lagring full/blockad — historik blir sessionslokal
      }
    }
    histIdx = history.length;
  }

  // ---------- utskrift ----------

  function scrollBottom(): void {
    if (dom) dom.out.scrollTop = dom.out.scrollHeight;
  }

  function print(text = "", cls = ""): void {
    if (!dom) return;
    const line = el("div", { class: `term-line${cls ? ` ${cls}` : ""}` });
    line.textContent = text;
    dom.out.append(line);
    scrollBottom();
  }

  /** Rad med två färgfält — används av neofetch (accentkonst + specs). */
  function printRow(left: string, right: string): void {
    if (!dom) return;
    const line = el("div", { class: "term-line" });
    const a = el("span", { class: "term-accent" });
    a.textContent = left;
    const b = el("span");
    b.textContent = right;
    line.append(a, b);
    dom.out.append(line);
    scrollBottom();
  }

  function echoPrompt(cmdText: string): void {
    if (!dom) return;
    const line = el("div", { class: "term-line" });
    const p = el("span", { class: "term-prompt" });
    p.textContent = PROMPT;
    const c = el("span");
    c.textContent = ` ${cmdText}`;
    line.append(p, c);
    dom.out.append(line);
    scrollBottom();
  }

  /** 20 ms/rad för ASCII-block — hoppas över vid reducedMotion. */
  function stagger(steps: (() => void)[], done?: () => void): void {
    if (ctx.engine.reducedMotion) {
      steps.forEach((s) => s());
      done?.();
      return;
    }
    steps.forEach((s, i) =>
      window.setTimeout(() => {
        s();
        if (i === steps.length - 1) done?.();
      }, i * 20)
    );
  }

  // ---------- kommandon: ren utdata (pipe-bara) ----------

  function helpLines(): string[] {
    const row = (cmd: string, desc: { sv: string; en: string }) => `  ${cmd.padEnd(29)}${t(desc)}`;
    return [
      t({ sv: "── filer ──", en: "── files ──" }),
      row("ls [projects]", { sv: "projekttabell", en: "project table" }),
      row("cat cv.md", { sv: "läs CV:t", en: "read the CV" }),
      row("cat uses.txt", { sv: "verktygskedjan", en: "the toolchain" }),
      row("cat secrets", { sv: "hemlighetsstatus", en: "secrets progress" }),
      row("… | grep <ord>", { sv: "filtrera rader (ls, cat, history)", en: "filter lines (ls, cat, history)" }),
      "",
      t({ sv: "── navigering ──", en: "── navigation ──" }),
      row("open <projekt|github|email>", { sv: "öppna & stäng terminalen", en: "open & close the terminal" }),
      row("goto <sektion>", { sv: "scrolla till sektion", en: "scroll to a section" }),
      "",
      t({ sv: "── sajten ──", en: "── site ──" }),
      row("theme dark|light", { sv: "byt tema", en: "switch theme" }),
      row("lang sv|en", { sv: "byt språk", en: "switch language" }),
      row("whoami", { sv: "kort bio", en: "short bio" }),
      row("neofetch", { sv: "systeminfo", en: "system info" }),
      row("date", { sv: "datum & tid", en: "date & time" }),
      "",
      t({ sv: "── kul ──", en: "── fun ──" }),
      row("play", { sv: "asteroids", en: "asteroids" }),
      row("snake", { sv: "snake", en: "snake" }),
      row("sudo hire-me", { sv: "?", en: "?" }),
      "",
      t({ sv: "── terminal ──", en: "── terminal ──" }),
      row("echo <text>", { sv: "eka text", en: "echo text" }),
      row("history", { sv: "kommandohistorik", en: "command history" }),
      row("clear", { sv: "rensa skärmen", en: "clear the screen" }),
      row("exit", { sv: "stäng (även Esc)", en: "close (Esc works too)" }),
    ];
  }

  function lsLines(arg?: string): string[] {
    const a = (arg ?? "").toLowerCase();
    if (a && a !== "projects") {
      return [`ls: ${arg}: ${t({ sv: "finns inte", en: "no such file or directory" })}`];
    }
    const header = [
      t({ sv: "NAMN", en: "NAME" }),
      t({ sv: "STATUS", en: "STATUS" }),
      t({ sv: "TECH", en: "TECH" }),
    ];
    const rows = projects.map((p) => [p.name, t(p.status), String(p.tech.length)]);
    const w0 = Math.max(...[header, ...rows].map((r) => r[0].length)) + 3;
    const w1 = Math.max(...[header, ...rows].map((r) => r[1].length)) + 3;
    return [header, ...rows].map((r) => r[0].padEnd(w0) + r[1].padEnd(w1) + r[2]);
  }

  function cvLines(): string[] {
    const lines = [
      "# LUCAS SKOG",
      t(ui.role),
      "",
      t(ui.heroLine),
      "",
      `## ${t({ sv: "Projekt", en: "Projects" })}`,
    ];
    for (const p of projects) {
      lines.push(`${p.index}. ${p.name} — ${t(p.tagline)}  [${t(p.status)}]`);
      lines.push(`    ${p.tech.join(" · ")}`);
    }
    lines.push("", `## ${t({ sv: "Kontakt", en: "Contact" })}`, ctx.EMAIL, ctx.GITHUB_URL, ctx.SITE_URL);
    return lines;
  }

  function usesLines(): string[] {
    return [
      "editor      VS Code + Claude Code",
      "os          Windows 11",
      "runtime     Node 22",
      "bundler     Vite 6",
      "graphics    three.js",
      "language    TypeScript 5.7",
    ];
  }

  function secretLines(): string[] {
    const lines = [
      `${ctx.secrets.count()}/${ctx.secrets.total()} ${t({ sv: "hittade", en: "found" })}`,
      "",
    ];
    for (const s of ctx.secrets.list()) {
      // ledtrådar visas bara för ännu ej upphittade
      lines.push(s.found ? `  * ${s.id}` : `  ? ${t(s.hint)}`);
    }
    return lines;
  }

  function catLines(file?: string): string[] {
    switch ((file ?? "").toLowerCase()) {
      case "cv.md":
        return cvLines();
      case "uses.txt":
        return usesLines();
      case "secrets":
        return secretLines();
      case "":
        return [t({ sv: "cat: ange fil — cv.md, uses.txt eller secrets", en: "cat: missing operand — try cv.md, uses.txt or secrets" })];
      default:
        return [`cat: ${file}: ${t({ sv: "filen finns inte", en: "no such file" })}`];
    }
  }

  function pureLines(cmd: string, args: string[]): string[] | null {
    switch (cmd) {
      case "help":
        return helpLines();
      case "ls":
        return lsLines(args[0]);
      case "cat":
        return catLines(args[0]);
      case "history":
        return history.map((h, i) => `${String(i + 1).padStart(3)}  ${h}`);
      default:
        return null;
    }
  }

  // ---------- kommandon: med sidoeffekter ----------

  function cmdOpen(arg?: string): void {
    const id = (arg ?? "").toLowerCase();
    if (!id) {
      print(t({ sv: "användning: open <projekt>|github|email", en: "usage: open <project>|github|email" }), "term-muted");
      return;
    }
    if (id === "github") {
      window.open(ctx.GITHUB_URL, "_blank", "noopener");
      print("→ GitHub");
      return;
    }
    if (id === "email") {
      location.href = `mailto:${ctx.EMAIL}`;
      print(`→ ${ctx.EMAIL}`);
      return;
    }
    if (!projectIds.includes(id)) {
      print(`open: ${id}: ${t({ sv: "okänt projekt", en: "unknown project" })}`, "term-err");
      return;
    }
    ctx.goTo(id);
    closeTerminal();
  }

  function cmdGoto(arg?: string): void {
    const alias: Record<string, string> = { home: "hem", contact: "kontakt" };
    const raw = (arg ?? "").toLowerCase();
    const id = alias[raw] ?? raw;
    const valid = ["hem", "kontakt", ...projectIds];
    if (!valid.includes(id)) {
      print(`goto: ${t({ sv: "okänd sektion — prova", en: "unknown section — try" })} ${valid.join(", ")}`, "term-muted");
      return;
    }
    ctx.goTo(id);
    print(`→ ${id}`);
  }

  function cmdTheme(arg?: string): void {
    const want = (arg ?? "").toLowerCase();
    if (want !== "dark" && want !== "light") {
      print(t({ sv: "användning: theme dark|light", en: "usage: theme dark|light" }), "term-muted");
      return;
    }
    if (ctx.theme() !== want) ctx.actions.toggleTheme();
    print(`theme: ${want}`);
  }

  function cmdLang(arg?: string): void {
    const want = (arg ?? "").toLowerCase();
    if (want !== "sv" && want !== "en") {
      print(t({ sv: "användning: lang sv|en", en: "usage: lang sv|en" }), "term-muted");
      return;
    }
    if (ctx.lang() !== want) ctx.actions.toggleLang();
    print(`lang: ${want}`);
  }

  function cmdNeofetch(): void {
    const s = ctx.engine.stats();
    const up = Math.max(0, Math.floor(performance.now() / 1000));
    const uptime =
      up >= 3600
        ? `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`
        : up >= 60
          ? `${Math.floor(up / 60)}m ${up % 60}s`
          : `${up}s`;
    const art = [
      "        ·∙•●●●•∙·",
      "      ∙●●●●●●●●●∙",
      "     •●●●●●●●●●●●•",
      "    ∙●●●●●●●●●●●●●∙",
      "    •●●∙··∙●∙··∙●●•",
      "    •●∙ ∙●∙ ∙●∙ ∙●•",
      "    •●●∙ ··∙·· ∙●●•",
      "     ∙●●∙ ∙∙∙ ∙●●∙",
      "      ∙●●●∙·∙●●●∙",
      "        ·∙●●●∙·",
      "        ∙●∙ ∙●∙",
      "     ∙●●●●●●●●●●●∙",
      "   ∙●●●●●●●●●●●●●●●∙",
      "  •●●●●●●●●●●●●●●●●●•",
    ];
    const info = [
      "lucas@portfolio",
      "───────────────",
      "os        GitHub Pages (static)",
      "shell     portfolio-sh 1.0",
      `engine    ${s.mode} · ${s.particleCount.toLocaleString("en-US")} ${t({ sv: "partiklar", en: "particles" })}`,
      `shape     ${s.shape} @ ${Math.round(s.fps)} fps`,
      "bundle    127 kB gz",
      "stack     three.js + Vite + TypeScript",
      `uptime    ${uptime}`,
      `theme     ${ctx.theme()}`,
      `lang      ${ctx.lang()}`,
      `contact   ${ctx.EMAIL}`,
    ];
    const rows = Math.max(art.length, info.length);
    const steps: (() => void)[] = [];
    for (let i = 0; i < rows; i++) {
      const left = (art[i] ?? "").padEnd(26);
      const right = info[i] ?? "";
      steps.push(() => printRow(left, right));
    }
    stagger(steps);
  }

  function cmdSudo(arg?: string): void {
    if ((arg ?? "").toLowerCase() !== "hire-me") {
      print(t({ sv: "Permission denied: snyggt försök", en: "Permission denied: nice try" }), "term-err");
      return;
    }
    ctx.secrets.found("hire");
    const steps: (() => void)[] = [
      () => print("sudo: verifying credentials … OK", "term-muted"),
      () => print("sudo: privilege escalation … GRANTED", "term-muted"),
      () => print(""),
      () => print(" ▄▀█ █▀▀ █▀▀ █▀▀ █▀ █▀", "term-accent"),
      () => print(" █▀█ █▄▄ █▄▄ ██▄ ▄█ ▄█", "term-accent"),
      () => print(" █▀▀ █▀█ ▄▀█ █▄░█ ▀█▀ █▀▀ █▀▄", "term-accent"),
      () => print(" █▄█ █▀▄ █▀█ █░▀█ ░█░ ██▄ █▄▀", "term-accent"),
      () => print(""),
      () =>
        print(
          t({
            sv: `Rekryterarläge aktiverat. Öppnar säker kanal → ${ctx.EMAIL}`,
            en: `Recruiter mode enabled. Opening secure channel → ${ctx.EMAIL}`,
          })
        ),
    ];
    stagger(steps, () => {
      window.setTimeout(() => {
        location.href = `mailto:${ctx.EMAIL}?subject=${encodeURIComponent("ACCESS GRANTED")}`;
      }, ctx.engine.reducedMotion ? 0 : 400);
    });
  }

  function cmdGame(id: string): void {
    if (ctx.runCommand(id)) closeTerminal();
    else print(t({ sv: "inte installerat ännu", en: "not installed yet" }), "term-muted");
  }

  // ---------- exekvering ----------

  function execute(raw: string): void {
    const text = raw.trim();
    echoPrompt(text);
    if (!text) return;
    pushHistory(text);

    // echo tar resten rått — ingen pipe-parsning
    if (/^echo(\s|$)/i.test(text)) {
      print(text.replace(/^echo\s?/i, ""));
      return;
    }

    const [cmdPart, ...pipeParts] = text.split("|");
    const args = cmdPart.trim().split(/\s+/);
    const cmd = (args.shift() ?? "").toLowerCase();

    let grep: string | null = null;
    if (pipeParts.length) {
      const m = pipeParts.join("|").trim().match(/^grep\s+(.+)$/i);
      if (!m) {
        print(t({ sv: "pipe: bara \"| grep <ord>\" stöds", en: "pipe: only \"| grep <term>\" is supported" }), "term-err");
        return;
      }
      grep = m[1].trim();
    }

    const pure = pureLines(cmd, args);
    if (pure) {
      let lines = pure;
      if (grep) {
        const q = grep.toLowerCase();
        lines = lines.filter((l) => l.toLowerCase().includes(q));
        if (!lines.length) lines = [t({ sv: "(inga träffar)", en: "(no matches)" })];
      }
      lines.forEach((l) => print(l));
      return;
    }
    if (grep) {
      print(t({ sv: "grep: fungerar med ls, cat och history", en: "grep: works with ls, cat and history" }), "term-muted");
      return;
    }

    switch (cmd) {
      case "clear":
        if (dom) dom.out.innerHTML = "";
        break;
      case "open":
        cmdOpen(args[0]);
        break;
      case "goto":
        cmdGoto(args[0]);
        break;
      case "theme":
        cmdTheme(args[0]);
        break;
      case "lang":
        cmdLang(args[0]);
        break;
      case "whoami":
        print("Lucas Skog");
        print(`${t(ui.role)} — ${t(ui.heroLine)}`, "term-muted");
        break;
      case "neofetch":
        cmdNeofetch();
        break;
      case "date":
        print(
          new Intl.DateTimeFormat(ctx.lang() === "sv" ? "sv-SE" : "en-GB", {
            dateStyle: "full",
            timeStyle: "medium",
          }).format(new Date())
        );
        break;
      case "play":
        cmdGame("game-asteroids");
        break;
      case "snake":
        cmdGame("game-snake");
        break;
      case "sudo":
        cmdSudo(args[0]);
        break;
      case "exit":
      case "quit":
        closeTerminal();
        break;
      default:
        print(`command not found: ${cmd} — ${t({ sv: "prova", en: "try" })} help`, "term-err");
    }
  }

  // ---------- tab-komplettering ----------

  function complete(): void {
    if (!dom) return;
    const v = dom.input.value;
    const trimmed = v.replace(/^\s+/, "");
    const spaceIdx = trimmed.search(/\s/);
    let base: string;
    let partial: string;
    let pool: string[];
    if (spaceIdx === -1) {
      base = "";
      partial = trimmed;
      pool = COMMANDS;
    } else {
      const cmd = trimmed.slice(0, spaceIdx).toLowerCase();
      pool = ARG_POOL[cmd] ?? [];
      partial = trimmed.slice(spaceIdx).trimStart();
      base = trimmed.slice(0, trimmed.length - partial.length);
    }
    const hits = pool.filter((c) => c.toLowerCase().startsWith(partial.toLowerCase()));
    if (!hits.length) return;
    if (hits.length === 1) {
      dom.input.value = `${base}${hits[0]} `;
      return;
    }
    // flera träffar: gemensamt prefix, annars lista alternativen
    let prefix = hits[0];
    for (const h of hits) {
      while (prefix && !h.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
    }
    if (prefix.length > partial.length) {
      dom.input.value = base + prefix;
    } else {
      print(hits.join("  "), "term-muted");
    }
  }

  // ---------- DOM ----------

  function applyLangTexts(): void {
    if (!dom) return;
    dom.barLabel.textContent = t({ sv: "terminal — skriv \"help\"", en: "terminal — type \"help\"" });
    dom.input.placeholder = "help";
  }

  function build(): void {
    injectStyle("terminal-css", CSS);
    const root = el("div", { class: "term-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Terminal" });
    const panel = el("div", { class: "term" });
    const bar = el("div", { class: "term-bar" });
    bar.append(el("i"), el("i"), el("i"));
    const barLabel = el("span", { class: "term-bar-label" });
    bar.append(barLabel);
    const out = el("div", { class: "term-out" });
    const input = el("input", {
      class: "term-input",
      type: "text",
      spellcheck: "false",
      autocomplete: "off",
      autocapitalize: "off",
      "aria-label": "Terminal input",
    });
    const promptEl = el("span", { class: "term-prompt" });
    promptEl.textContent = PROMPT;
    const row = el("div", { class: "term-in-row" });
    row.append(promptEl, input);
    panel.append(bar, out, row);
    root.append(panel);
    document.body.append(root);
    dom = { root, out, input, barLabel };
    applyLangTexts();

    // klick på bakgrunden stänger; klick i panelen fokuserar prompten
    root.addEventListener("pointerdown", (e) => {
      if (e.target === root) closeTerminal();
    });
    panel.addEventListener("click", () => {
      if (!window.getSelection()?.toString()) input.focus();
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeTerminal();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        execute(input.value);
        input.value = "";
      } else if (e.key === "Tab") {
        e.preventDefault();
        complete();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          input.value = history[histIdx] ?? "";
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (histIdx < history.length - 1) {
          histIdx++;
          input.value = history[histIdx] ?? "";
        } else {
          histIdx = history.length;
          input.value = "";
        }
      }
    });

    print("Lucas Skog — portfolio shell", "term-accent");
    print(
      t({
        sv: "Skriv \"help\" för kommandon. Tab kompletterar, ↑/↓ bläddrar historik, Esc stänger.",
        en: "Type \"help\" for commands. Tab completes, ↑/↓ walks history, Esc closes.",
      }),
      "term-muted"
    );
  }

  function openTerminal(): void {
    if (!dom) build();
    ctx.secrets.found("terminal");
    dom!.root.classList.add("is-open");
    histIdx = history.length;
    dom!.input.focus();
    scrollBottom();
  }

  function closeTerminal(): void {
    dom?.root.classList.remove("is-open");
  }

  ctx.bus.on("lang", () => applyLangTexts());

  ctx.registerCommand({
    id: "terminal",
    label: () => ctx.t({ sv: "Öppna terminalen", en: "Open the terminal" }),
    group: () => ctx.t({ sv: "Åtgärder", en: "Actions" }),
    hint: ">",
    run: openTerminal,
  });

  return { open: openTerminal };
}
