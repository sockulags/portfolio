/**
 * Pix — ett husdjur av 64 partiklar. Kläcks när besökaren hittar sin
 * första hemlighet, växer med antalet besök och minns dig via localStorage.
 * Kan släppas fri via kommandopaletten — då kommer den aldrig tillbaka.
 */
import type { FeatureContext, OverlayApi } from "../app/contracts";

const COUNT = 64;

const FREED_KEY = "pf-pix-freed";
const VISITS_KEY = "pf-pix-visits";
const SESSION_KEY = "pf-pix-session";
const HATCHED_KEY = "pf-pix-hatched";

const SPRING_K = 2;
const DAMPING = 0.9; // per frame vid 60 fps
const MAX_SPEED = 2.5; // världsenheter/s
const CURIOSITY_RANGE = 3.5;
const FOLLOW_GAP = 0.8;
const EDGE_MARGIN = 0.12; // andel av viewportens fulla bredd/höjd
const FAREWELL_S = 1.5;

function gauss(): number {
  // Box-Muller
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

function isNight(): boolean {
  const h = Number(
    new Intl.DateTimeFormat("sv-SE", { hour: "numeric", hour12: false, timeZone: "Europe/Stockholm" }).format(new Date())
  );
  return h >= 23 || h < 7;
}

function parseHex(raw: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return [0.486, 0.424, 1]; // #7c6cff
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function initPix(ctx: FeatureContext): void {
  if (localStorage.getItem(FREED_KEY) === "1") return;
  if (ctx.engine.reducedMotion) return;
  if (window.innerWidth < 860) return;

  // räkna besöket max en gång per session
  if (!sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, "1");
    localStorage.setItem(VISITS_KEY, String(Number(localStorage.getItem(VISITS_KEY) ?? "0") + 1));
  }
  const visits = Number(localStorage.getItem(VISITS_KEY) ?? "1");
  const scale = visits < 3 ? 0.7 : visits < 7 ? 1.0 : 1.3;
  const bodyRadius = 0.28 * scale;

  let overlay: OverlayApi | null = null;
  let hatched = false;
  let leaving = false;
  let disposed = false;

  const home = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  const cursor = { x: 0, y: 0, active: false };

  // per-partikel: gaussisk kroppsform + wobbelbanor + ljusvarians + flyktfart
  const offX = new Float32Array(COUNT);
  const offY = new Float32Array(COUNT);
  const phA = new Float32Array(COUNT);
  const phB = new Float32Array(COUNT);
  const spA = new Float32Array(COUNT);
  const spB = new Float32Array(COUNT);
  const amp = new Float32Array(COUNT);
  const tint = new Float32Array(COUNT);
  const scatX = new Float32Array(COUNT);
  const scatY = new Float32Array(COUNT);

  let raf = 0;
  let last = 0;
  let born = 0;
  let blinkNext = 0;
  let blinkUntil = 0;
  let sparkle = 0;
  let sleeping = false;
  let leaveStart = 0;
  let sleepTimer = 0;
  let accent: [number, number, number] = [0.486, 0.424, 1];
  let accentNext = 0;

  function computeHome(): void {
    // ~12 % in från höger/nedre kant
    const b = ctx.engine.worldBounds();
    home.x = b.halfW * (1 - EDGE_MARGIN * 2);
    home.y = -b.halfH * (1 - EDGE_MARGIN * 2);
  }

  function onMove(e: PointerEvent): void {
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    cursor.active = true;
  }

  function onClick(e: MouseEvent): void {
    if (!hatched || leaving || disposed) return;
    const w = ctx.engine.screenToWorld(e.clientX, e.clientY);
    if (Math.hypot(w.x - pos.x, w.y - pos.y) > bodyRadius + 0.15) return;
    // glatt hopp: impuls uppåt + gnistrande ljus
    vel.y += 2.4;
    sparkle = 1;
    ctx.bus.emit("audio-blip", { kind: "secret" });
  }

  function onVisibility(): void {
    if (disposed) return;
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (raf === 0) {
      sleeping = isNight();
      last = performance.now() / 1000;
      raf = requestAnimationFrame(loop);
    }
  }

  function writeColors(o: OverlayApi, bright: number, extra: number): void {
    const col = o.colors;
    for (let i = 0; i < COUNT; i++) {
      const b = bright * tint[i];
      const add = extra * tint[i];
      col[i * 3] = Math.min(1, accent[0] * b + add);
      col[i * 3 + 1] = Math.min(1, accent[1] * b + add);
      col[i * 3 + 2] = Math.min(1, accent[2] * b + add);
    }
  }

  function farewellStep(o: OverlayApi, now: number, dt: number): void {
    const k = Math.min(1, (now - leaveStart) / FAREWELL_S);
    const p = o.positions;
    for (let i = 0; i < COUNT; i++) {
      scatY[i] += 2.5 * dt; // accelererar uppåt
      p[i * 3] += scatX[i] * dt;
      p[i * 3 + 1] += scatY[i] * dt;
    }
    writeColors(o, 1 - k, 0);
    o.sync();
    if (k >= 1) cleanup();
  }

  function loop(): void {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0.001, now - last));
    last = now;
    const o = overlay;
    if (!o) return;

    // följ sajtens accentfärg (byts per sektion), samplas glest
    if (now >= accentNext) {
      accentNext = now + 2;
      accent = parseHex(getComputedStyle(document.documentElement).getPropertyValue("--accent"));
    }

    if (leaving) {
      farewellStep(o, now, dt);
      return;
    }

    // mål: hem — eller en punkt 0.8 enheter från markören om den är nära
    let tx = home.x;
    let ty = home.y;
    if (!sleeping && cursor.active) {
      const c = ctx.engine.screenToWorld(cursor.x, cursor.y);
      const dx = pos.x - c.x;
      const dy = pos.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < CURIOSITY_RANGE && d > 1e-4) {
        tx = c.x + (dx / d) * FOLLOW_GAP;
        ty = c.y + (dy / d) * FOLLOW_GAP;
      }
    }

    // fjäder mot målet, dämpad, hastighetsbegränsad
    vel.x += (tx - pos.x) * SPRING_K * dt;
    vel.y += (ty - pos.y) * SPRING_K * dt;
    const damp = Math.pow(DAMPING, dt * 60);
    vel.x *= damp;
    vel.y *= damp;
    const speed = Math.hypot(vel.x, vel.y);
    if (speed > MAX_SPEED) {
      vel.x = (vel.x / speed) * MAX_SPEED;
      vel.y = (vel.y / speed) * MAX_SPEED;
    }
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;

    if (now >= blinkNext) {
      blinkUntil = now + 0.12;
      blinkNext = now + 4 + Math.random() * 5;
    }
    const blink = now < blinkUntil ? 0.3 : 1;
    sparkle = Math.max(0, sparkle - dt * 1.6);

    const grow = Math.min(1, (now - born) / 0.6);
    const ease = grow * (2 - grow);
    const breath = 1 + (sleeping ? 0.02 : 0.05) * Math.sin(now * (sleeping ? 0.5 : 1.5));
    const wob = sleeping ? 0.25 : 1;

    const p = o.positions;
    for (let i = 0; i < COUNT; i++) {
      const wx = Math.sin(now * spA[i] + phA[i]) * amp[i] * wob;
      const wy = Math.cos(now * spB[i] + phB[i]) * amp[i] * wob;
      p[i * 3] = pos.x + (offX[i] * breath + wx) * ease;
      p[i * 3 + 1] = pos.y + (offY[i] * breath + wy) * ease;
      p[i * 3 + 2] = 0;
    }
    writeColors(o, (sleeping ? 0.4 : 1) * blink * ease, sparkle * 0.7);
    o.sync();
  }

  function spawn(): void {
    for (let i = 0; i < COUNT; i++) {
      offX[i] = gauss() * bodyRadius * 0.5; // ~95 % inom kroppsradien
      offY[i] = gauss() * bodyRadius * 0.5;
      phA[i] = Math.random() * Math.PI * 2;
      phB[i] = Math.random() * Math.PI * 2;
      spA[i] = 0.5 + Math.random() * 0.9;
      spB[i] = 0.5 + Math.random() * 0.9;
      amp[i] = (0.02 + Math.random() * 0.045) * scale;
      tint[i] = 0.72 + Math.random() * 0.28;
    }
    computeHome();
    pos.x = home.x;
    pos.y = home.y;
    sleeping = isNight();

    overlay = ctx.engine.createOverlay(COUNT);
    overlay.setVisible(true);

    const now = performance.now() / 1000;
    born = now;
    last = now;
    blinkNext = now + 4 + Math.random() * 5;

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("click", onClick);
    window.addEventListener("resize", computeHome);
    document.addEventListener("visibilitychange", onVisibility);
    sleepTimer = window.setInterval(() => {
      sleeping = isNight();
    }, 3_600_000);

    if (!document.hidden) raf = requestAnimationFrame(loop);
  }

  function hatch(): void {
    if (hatched || disposed) return;
    hatched = true;
    // toasta bara vid allra första kläckningen, inte varje besök
    if (!localStorage.getItem(HATCHED_KEY)) {
      localStorage.setItem(HATCHED_KEY, "1");
      ctx.toast(ctx.t({ sv: "Något kläcktes … säg hej till Pix.", en: "Something hatched… say hi to Pix." }));
    }
    spawn();
  }

  function farewell(): void {
    if (!hatched || leaving || disposed || !overlay) return;
    leaving = true;
    leaveStart = performance.now() / 1000;
    for (let i = 0; i < COUNT; i++) {
      scatX[i] = (Math.random() - 0.5) * 1.6;
      scatY[i] = 1.5 + Math.random() * 2.5;
    }
    localStorage.setItem(FREED_KEY, "1");
    ctx.toast(ctx.t({ sv: "Pix flög sin väg. Tack för sällskapet.", en: "Pix flew away. Thanks for the company." }));
  }

  function cleanup(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    raf = 0;
    window.clearInterval(sleepTimer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("click", onClick);
    window.removeEventListener("resize", computeHome);
    document.removeEventListener("visibilitychange", onVisibility);
    overlay?.dispose();
    overlay = null;
  }

  if (ctx.secrets.count() >= 1) {
    hatch();
  } else {
    const off = ctx.bus.on("secret", () => {
      off();
      hatch();
    });
  }

  ctx.registerCommand({
    id: "pix-free",
    label: () => ctx.t({ sv: "Släpp Pix fri", en: "Set Pix free" }),
    group: () => "Pix",
    visible: () => hatched && !leaving && !disposed,
    run: farewell,
  });
}
