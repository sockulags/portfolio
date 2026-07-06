import type { FeatureContext, ShapeId } from "../app/contracts";

const CYCLE: ShapeId[] = ["galaxy", "knot", "lattice", "wave", "blob", "ring", "layers"];

/** Skärmsläckarläge: efter 3 min stillhet tonar UI:t bort och formerna cyklar. */
export function initIdle(ctx: FeatureContext, restore: () => void): void {
  if (ctx.engine.reducedMotion) return;

  let idleTimer: ReturnType<typeof setTimeout>;
  let cycleInterval: ReturnType<typeof setInterval> | undefined;
  let active = false;
  let cycleIdx = 0;

  const enter = () => {
    if (document.body.classList.contains("game-active") || document.hidden) {
      arm();
      return;
    }
    active = true;
    document.body.classList.add("idle-mode");
    cycleInterval = setInterval(() => {
      cycleIdx = (cycleIdx + 1) % CYCLE.length;
      ctx.engine.setShape(CYCLE[cycleIdx]);
    }, 7000);
  };

  const exit = () => {
    if (!active) return;
    active = false;
    document.body.classList.remove("idle-mode");
    clearInterval(cycleInterval);
    restore();
  };

  const arm = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(enter, 180_000);
  };

  ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => {
    window.addEventListener(
      ev,
      () => {
        exit();
        arm();
      },
      { passive: true }
    );
  });
  arm();
}
