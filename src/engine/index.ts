import type { EngineApi } from "../app/contracts";
import { GpgpuEngine } from "./gpgpu";
import { CpuEngine } from "./cpu";

/** Den konkreta motortypen som main.ts använder (app-interna metoder utöver kontraktet). */
export type AppEngine = EngineApi & {
  setTheme(mode: "dark" | "light"): void;
  setReducedMotion(on: boolean): void;
  setOffsetX(x: number): void;
  setScroll(y: number): void;
  simParams(): { uniforms: Record<string, { value: unknown }> };
};

export function createEngine(canvas: HTMLCanvasElement): AppEngine {
  try {
    // upprepad kontextförlust i denna flik ⇒ ge upp GPGPU och kör den lätta CPU-motorn
    if (sessionStorage.getItem("pf-gl-fallback") === "cpu") {
      throw new Error("GPGPU nedgraderad efter upprepad kontextförlust");
    }
    // proba på en temporär canvas så huvudcanvasens kontext inte låses med fel attribut
    const probe = document.createElement("canvas").getContext("webgl2");
    if (!probe || !probe.getExtension("EXT_color_buffer_float")) {
      throw new Error("WebGL2 float render targets unavailable");
    }
    return new GpgpuEngine(canvas);
  } catch (err) {
    console.info("[engine] GPGPU otillgängligt, faller tillbaka till CPU-läge:", err);
    // GpgpuEngine kan ha hunnit låsa kontexten — ge CPU-motorn en fräsch canvas
    const fresh = canvas.cloneNode() as HTMLCanvasElement;
    canvas.replaceWith(fresh);
    return new CpuEngine(fresh);
  }
}
