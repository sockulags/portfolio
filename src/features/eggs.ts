import type { FeatureContext } from "../app/contracts";
import { unlockSkin } from "./cheats";

/** Konami med progression: burst → chockvåg → GG + guldtema. */
export function handleKonami(ctx: FeatureContext): void {
  const tier = Math.min(Number(localStorage.getItem("pf-konami") ?? "0") + 1, 3) as 1 | 2 | 3;
  localStorage.setItem("pf-konami", String(tier));
  ctx.bus.emit("konami", { tier });
  ctx.engine.burst(tier);
  if (tier === 1) {
    ctx.secrets.found("konami");
    ctx.toast(ctx.t({ sv: "✨ Du hittade den.", en: "✨ You found it." }));
  } else if (tier === 2) {
    ctx.toast(ctx.t({ sv: "✨✨ Igen? Imponerande.", en: "✨✨ Again? Impressive." }));
  } else {
    ctx.engine.morphToText("GG", 2600);
    unlockSkin(ctx, "gold");
    ctx.secrets.found("konami-master");
    ctx.toast(ctx.t({ sv: "👑 GG. Guldtemat är ditt.", en: "👑 GG. The gold skin is yours." }));
  }
}

/** Den förrymda partikeln: en av 260 000 smiter — fånga den. */
export function initRunaway(ctx: FeatureContext): void {
  if (ctx.engine.reducedMotion || ctx.secrets.has("runaway")) return;

  let dot: HTMLElement | null = null;
  let raf = 0;

  const schedule = () => {
    const delay = 150_000 + Math.random() * 150_000;
    setTimeout(spawn, delay);
  };

  const spawn = () => {
    if (document.hidden) {
      schedule();
      return;
    }
    dot = document.createElement("button");
    dot.className = "escaped-dot";
    dot.setAttribute("aria-label", ctx.t({ sv: "En förrymd partikel", en: "An escaped particle" }));
    document.body.append(dot);

    const fromLeft = Math.random() > 0.5;
    const x0 = fromLeft ? -20 : window.innerWidth + 20;
    const x1 = fromLeft ? window.innerWidth + 20 : -20;
    const y0 = 100 + Math.random() * (window.innerHeight - 300);
    const y1 = 100 + Math.random() * (window.innerHeight - 300);
    const cy = Math.min(y0, y1) - 120 - Math.random() * 160;
    // lugn vandring — man ska hinna upptäcka, förstå och jaga den
    const dur = 55_000;
    let u = 0;
    let last = performance.now();
    let pointerX = -1e4;
    let pointerY = -1e4;
    const onMove = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const step = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      if (u >= 1 || !dot) {
        window.removeEventListener("pointermove", onMove);
        cleanup();
        schedule();
        return;
      }
      const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * ((x0 + x1) / 2) + u * u * x1;
      const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
      // tvekar nyfiket när pekaren närmar sig — retas, men låter sig fångas
      const near = Math.hypot(x - pointerX, y - pointerY) < 140;
      u += (dt / dur) * (near ? 0.3 : 1);
      dot.style.transform = `translate(${x}px, ${y}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // click (inte pointerdown) så Enter/Space funkar för tangentbordsjägare
    dot.addEventListener("click", (e) => {
      const rect = dot!.getBoundingClientRect();
      const x = e.clientX || rect.left + rect.width / 2;
      const y = e.clientY || rect.top + rect.height / 2;
      ctx.engine.shockwave(x, y, 1.6);
      ctx.secrets.found("runaway");
      cleanup();
    });
  };

  const cleanup = () => {
    cancelAnimationFrame(raf);
    dot?.remove();
    dot = null;
  };

  schedule();
}

/** Kalender- och nattöverraskningar (Stockholmstid). */
export function initCalendar(ctx: FeatureContext): void {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "numeric",
    hour12: false,
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = get("hour");
  const month = get("month");
  const day = get("day");

  // nattugglan: 00–05
  if (hour >= 0 && hour < 5) {
    document.documentElement.dataset.night = "1";
    setTimeout(() => {
      ctx.toast(ctx.t({ sv: "Du är uppe sent. Jag med.", en: "You're up late. So am I." }));
      ctx.secrets.found("night-owl");
    }, 6000);
  }

  // sajtens födelsedag: 6 juli (lanserades 2026-07-06)
  if (month === 7 && day === 6 && new Date().getFullYear() > 2026) {
    setTimeout(() => {
      ctx.toast(ctx.t({ sv: "🎂 Sajten fyller år idag.", en: "🎂 It's this site's birthday." }));
      ctx.engine.burst(2);
    }, 4000);
  }

  // december: stilla snödrift — men bara om det riktiga vädret inte hunnit ta över
  if (month === 12) {
    setTimeout(() => {
      if (document.documentElement.dataset.weatherLive !== "1") {
        ctx.engine.setWeather({ windX: 0.06, windY: 0, drift: 0.25, dim: 0 });
      }
    }, 6000);
  }
}
