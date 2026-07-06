import type { FeatureContext } from "../app/contracts";
import { injectStyle } from "../app/dom";

const CSS = `
.hud {
  position: fixed;
  top: 4.2rem;
  right: 1rem;
  z-index: 55;
  width: 240px;
  padding: 0.9rem 1rem;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border: 1px solid var(--faint);
  border-radius: 12px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--muted);
  backdrop-filter: blur(8px);
}
.hud h4 { color: var(--fg); font-size: 0.72rem; letter-spacing: 0.1em; margin-bottom: 0.5rem; }
.hud-row { display: flex; justify-content: space-between; margin: 0.18rem 0; }
.hud-row b { color: var(--accent); font-weight: 500; }
.hud canvas { width: 100%; height: 30px; margin: 0.4rem 0; display: block; }
.hud label { display: block; margin-top: 0.45rem; }
.hud input[type="range"] { width: 100%; accent-color: var(--accent); }
`;

/** Debug-HUD i spelmotorstil — togglas med D eller via paletten. */
export function initHud(ctx: FeatureContext & { simParams(): { uniforms: Record<string, { value: unknown }> } }): { toggle(): void } {
  let panel: HTMLElement | null = null;
  let raf = 0;
  const history: number[] = [];

  const close = () => {
    cancelAnimationFrame(raf);
    panel?.remove();
    panel = null;
  };

  const open = () => {
    injectStyle("hud-css", CSS);
    panel = document.createElement("div");
    panel.className = "hud";
    const uniforms = ctx.simParams().uniforms;
    const hasSim = "uAttract" in uniforms;
    panel.innerHTML = `
      <h4>ENGINE</h4>
      <div class="hud-row"><span>mode</span><b data-h="mode"></b></div>
      <div class="hud-row"><span>particles</span><b data-h="count"></b></div>
      <div class="hud-row"><span>fps</span><b data-h="fps"></b></div>
      <div class="hud-row"><span>frame</span><b data-h="ms"></b></div>
      <div class="hud-row"><span>draw calls</span><b data-h="calls"></b></div>
      <div class="hud-row"><span>shape</span><b data-h="shape"></b></div>
      <div class="hud-row"><span>secrets</span><b data-h="secrets"></b></div>
      <canvas width="212" height="30"></canvas>
      ${
        hasSim
          ? `<label>attract <input type="range" min="0.5" max="12" step="0.1" data-u="uAttract"></label>
             <label>turbulens <input type="range" min="0" max="2" step="0.05" data-u="uCurlAmp"></label>
             <label>damp <input type="range" min="0.8" max="0.99" step="0.005" data-u="uDamp"></label>`
          : ""
      }`;
    document.body.append(panel);

    panel.querySelectorAll<HTMLInputElement>("input[data-u]").forEach((input) => {
      input.value = String(uniforms[input.dataset.u!].value);
      // slå upp uniformen per event — motorn kan ha byggts om sedan panelen öppnades
      input.addEventListener("input", () => {
        const live = ctx.simParams().uniforms[input.dataset.u!];
        if (live) live.value = Number(input.value);
      });
    });

    const c2d = panel.querySelector("canvas")!.getContext("2d")!;
    const set = (key: string, val: string | number) => {
      const node = panel?.querySelector(`[data-h="${key}"]`);
      if (node) node.textContent = String(val);
    };

    const loop = () => {
      if (!panel) return;
      const s = ctx.engine.stats();
      set("mode", s.mode.toUpperCase());
      set("count", s.particleCount.toLocaleString("sv-SE"));
      set("fps", s.fps);
      set("ms", `${s.frameMs} ms`);
      set("calls", s.drawCalls);
      set("shape", s.shape);
      set("secrets", `${ctx.secrets.count()}/${ctx.secrets.total()}`);

      history.push(s.frameMs);
      if (history.length > 106) history.shift();
      c2d.clearRect(0, 0, 212, 30);
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7c6cff";
      c2d.strokeStyle = accent;
      c2d.beginPath();
      history.forEach((ms, i) => {
        const y = 30 - Math.min(ms / 40, 1) * 28;
        i === 0 ? c2d.moveTo(i * 2, y) : c2d.lineTo(i * 2, y);
      });
      c2d.stroke();
      raf = requestAnimationFrame(loop);
    };
    loop();
  };

  const toggle = () => (panel ? close() : open());

  ctx.registerCommand({
    id: "debug",
    label: () => ctx.t({ sv: "Debug-HUD (D)", en: "Debug HUD (D)" }),
    group: () => ctx.t({ sv: "Åtgärder", en: "Actions" }),
    hint: "D",
    run: toggle,
  });

  return { toggle };
}
