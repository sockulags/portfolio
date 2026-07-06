/**
 * Custom cursor: en liten punkt som följer pekaren exakt och en ring som
 * släpar efter. Växer över interaktiva element. Aktiveras inte på pekskärm.
 */
export function initCursor(): void {
  if (window.matchMedia("(pointer: coarse)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  document.body.append(dot, ring);
  document.body.classList.add("has-custom-cursor");

  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let rx = x;
  let ry = y;

  window.addEventListener(
    "pointermove",
    (e) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.transform = `translate(${x}px, ${y}px)`;
    },
    { passive: true }
  );

  const interactive = "a, button, input, [data-hover]";
  document.addEventListener("pointerover", (e) => {
    if ((e.target as HTMLElement).closest(interactive)) ring.classList.add("is-hover");
  });
  document.addEventListener("pointerout", (e) => {
    if ((e.target as HTMLElement).closest(interactive)) ring.classList.remove("is-hover");
  });
  document.addEventListener("pointerdown", () => ring.classList.add("is-down"));
  document.addEventListener("pointerup", () => ring.classList.remove("is-down"));

  (function loop() {
    rx += (x - rx) * 0.16;
    ry += (y - ry) * 0.16;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(loop);
  })();
}
