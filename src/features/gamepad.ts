/**
 * Gamepad — sajten märker när en handkontroll ansluts. Utanför spel bläddrar
 * styrkorset/spaken mellan sektioner, A startar Asteroids och B skickar Escape.
 * I spel översätts kontrollen till syntetiska tangenttryck på window (spelen
 * lyssnar redan där). Vibration via dual-rumble — allt failar tyst.
 */
import type { FeatureContext } from "../app/contracts";

const SECTIONS = ["hem", "meritvo", "pilot", "design-pilot", "viska", "referat", "smask", "kontakt"];
const NAV_DEBOUNCE_MS = 400;
const NAV_FLICK = 0.6; // spakutslag som räknas som sektionsbläddring
const HOLD_ZONE = 0.4; // spakutslag som räknas som styrning i spel

// standardmappning: 0=A, 1=B, 7=RT, 12–15=styrkors upp/ner/vänster/höger
const BTN_A = 0;
const BTN_B = 1;
const BTN_RT = 7;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const TRACKED = [BTN_A, BTN_B, BTN_RT, DPAD_UP, DPAD_DOWN, DPAD_LEFT, DPAD_RIGHT];

// styrkors → WASD-bokstäver (Snake tolkar dem själv, w = uppåt osv.)
const DPAD_LETTERS: [number, string][] = [
  [DPAD_UP, "w"],
  [DPAD_DOWN, "s"],
  [DPAD_LEFT, "a"],
  [DPAD_RIGHT, "d"],
];

interface RumbleParams {
  duration: number;
  startDelay?: number;
  strongMagnitude: number;
  weakMagnitude: number;
}

export function initGamepad(ctx: FeatureContext): void {
  let raf = 0;
  let padKey = ""; // index:id — nollställer kantdetekteringen vid kontrollbyte
  let prevButtons: boolean[] = [];
  let prevNavUp = false;
  let prevNavDown = false;
  let lastNav = 0;
  const held = new Set<string>(); // syntetiska tangenter som hålls nere just nu

  const sendKey = (type: "keydown" | "keyup", key: string): void => {
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  };

  // släpp allt vi håller — annars fastnar t.ex. Asteroids tangent-set
  const releaseHeld = (): void => {
    for (const key of held) sendKey("keyup", key);
    held.clear();
  };

  const activePad = (): Gamepad | null => {
    if (typeof navigator.getGamepads !== "function") return null;
    let first: Gamepad | null = null;
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      if (pad.mapping === "standard") return pad;
      first ??= pad;
    }
    return first;
  };

  const pressed = (pad: Gamepad, i: number): boolean => pad.buttons[i]?.pressed === true;

  const axis = (pad: Gamepad, i: number): number => {
    const v = pad.axes[i];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };

  // ---------- sektionsnavigering ----------

  const currentIndex = (): number => {
    const mid = window.innerHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < SECTIONS.length; i++) {
      const node = document.getElementById(SECTIONS[i]);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  const navigate = (dir: 1 | -1, now: number): void => {
    if (now - lastNav < NAV_DEBOUNCE_MS) return;
    lastNav = now;
    const idx = currentIndex();
    const next = Math.min(SECTIONS.length - 1, Math.max(0, idx + dir));
    if (next !== idx) ctx.goTo(SECTIONS[next]);
  };

  // ---------- per frame ----------

  const step = (pad: Gamepad, now: number): void => {
    const key = `${pad.index}:${pad.id}`;
    if (key !== padKey) {
      padKey = key;
      prevButtons = [];
      prevNavUp = false;
      prevNavDown = false;
    }

    const edge = (i: number): boolean => pressed(pad, i) && !prevButtons[i];
    const inGame = document.body.classList.contains("game-active");
    const ax0 = axis(pad, 0);
    const ax1 = axis(pad, 1);

    // B avbryter alltid — samma Escape som tangentbordet
    if (edge(BTN_B)) sendKey("keydown", "Escape");

    if (inGame) {
      // hålltangenter: keydown vid nedtryck, keyup vid släpp (diff mot held)
      const want = new Set<string>();
      if (pressed(pad, DPAD_LEFT) || ax0 < -HOLD_ZONE) want.add("ArrowLeft");
      if (pressed(pad, DPAD_RIGHT) || ax0 > HOLD_ZONE) want.add("ArrowRight");
      if (pressed(pad, DPAD_UP) || ax1 < -HOLD_ZONE || pressed(pad, BTN_RT)) want.add("ArrowUp");
      if (pressed(pad, BTN_A)) want.add(" ");
      for (const [btn, letter] of DPAD_LETTERS) if (pressed(pad, btn)) want.add(letter);
      for (const k of want) {
        if (!held.has(k)) {
          held.add(k);
          sendKey("keydown", k);
        }
      }
      for (const k of held) {
        if (!want.has(k)) {
          held.delete(k);
          sendKey("keyup", k);
        }
      }
      // håll flick-läget färskt så spelslut inte ger en falsk kant
      prevNavDown = pressed(pad, DPAD_DOWN) || ax1 > NAV_FLICK;
      prevNavUp = pressed(pad, DPAD_UP) || ax1 < -NAV_FLICK;
    } else {
      releaseHeld(); // spelet tog slut medan knappar hölls nere
      const navDown = pressed(pad, DPAD_DOWN) || ax1 > NAV_FLICK;
      const navUp = pressed(pad, DPAD_UP) || ax1 < -NAV_FLICK;
      if (navDown && !prevNavDown) navigate(1, now);
      else if (navUp && !prevNavUp) navigate(-1, now);
      prevNavDown = navDown;
      prevNavUp = navUp;
      if (edge(BTN_A)) ctx.runCommand("game-asteroids");
    }

    const next: boolean[] = [];
    for (const i of TRACKED) next[i] = pressed(pad, i);
    prevButtons = next;
  };

  // ---------- pollloop ----------

  const frame = (): void => {
    raf = 0;
    const pad = activePad();
    if (!pad) {
      // ingen kontroll kvar — loopen stannar helt
      releaseHeld();
      padKey = "";
      return;
    }
    step(pad, performance.now());
    if (!document.hidden) raf = requestAnimationFrame(frame);
  };

  const ensurePoll = (): void => {
    if (raf || document.hidden) return;
    raf = requestAnimationFrame(frame);
  };

  const stopPoll = (): void => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    releaseHeld();
  };

  window.addEventListener("gamepadconnected", () => {
    ctx.toast(
      ctx.t({
        sv: "🎮 Kontroll ansluten — A: Asteroids · B: avbryt · styrkors: navigera",
        en: "🎮 Controller connected — A: Asteroids · B: cancel · d-pad: navigate",
      })
    );
    ensurePoll();
  });

  window.addEventListener("gamepaddisconnected", () => {
    if (!activePad()) {
      stopPoll();
      padKey = "";
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPoll();
    else if (activePad()) ensurePoll();
  });

  // ---------- vibration ----------

  // reducedMotion stänger inte av inmatningen (det är input, inte animation)
  // men vibrationen hoppar vi över. Firefox saknar vibrationActuator — tyst.
  const rumble = (params: RumbleParams): Promise<unknown> | undefined => {
    if (ctx.engine.reducedMotion) return undefined;
    const pad = activePad();
    try {
      return pad?.vibrationActuator?.playEffect("dual-rumble", params).catch(() => undefined);
    } catch {
      return undefined;
    }
  };

  ctx.bus.on("audio-blip", ({ kind }) => {
    if (kind === "shoot") void rumble({ duration: 40, strongMagnitude: 0, weakMagnitude: 0.25 });
    else if (kind === "hit") void rumble({ duration: 110, strongMagnitude: 0.65, weakMagnitude: 0 });
  });

  ctx.bus.on("secret", () => {
    // dubbelpuls — andra effekten kedjas när den första spelat klart
    void rumble({ duration: 60, strongMagnitude: 0.4, weakMagnitude: 0.4 })?.then(() =>
      rumble({ duration: 60, startDelay: 40, strongMagnitude: 0.4, weakMagnitude: 0.4 })
    );
  });

  ctx.bus.on("game-end", () => {
    // ~300 ms avtonande i två kedjade steg
    void rumble({ duration: 150, strongMagnitude: 0.55, weakMagnitude: 0.35 })?.then(() =>
      rumble({ duration: 150, strongMagnitude: 0.18, weakMagnitude: 0.12 })
    );
  });
}
