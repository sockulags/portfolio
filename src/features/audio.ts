/**
 * Helt syntetiserat ljudlandskap — inga ljudfiler, av som standard.
 * AudioContext skapas lazy vid första aktivering (kräver användargest,
 * vilket M-tangenten/palettkommandot garanterar).
 */
import type { FeatureContext, ShapeId, BusEvents } from "../app/contracts";

type BlipKind = BusEvents["audio-blip"]["kind"];

interface PadSpec {
  freqs: number[];
  filterHz: number;
  detune: number;
  type: OscillatorType;
  level: number;
}

// Ett lugnt ackord per form — låga grundtoner, mjukt lågpassfilter.
const PADS: Record<ShapeId, PadSpec> = {
  galaxy: { freqs: [55, 82.4, 110, 164.8], filterHz: 420, detune: 7, type: "sawtooth", level: 1 }, // öppna kvinter
  layers: { freqs: [65.4, 98, 130.8, 164.8], filterHz: 520, detune: 5, type: "sawtooth", level: 0.85 }, // mjuk dur
  knot: { freqs: [73.4, 82.4, 110, 146.8], filterHz: 480, detune: 8, type: "sawtooth", level: 0.85 }, // sus2
  lattice: { freqs: [82.4, 110, 146.8, 196], filterHz: 380, detune: 4, type: "sine", level: 1 }, // kvarter
  wave: { freqs: [49, 98, 110, 146.8], filterHz: 340, detune: 6, type: "sine", level: 1.1 }, // pentatonisk drone
  blob: { freqs: [87.3, 110, 130.8, 164.8], filterHz: 300, detune: 5, type: "sine", level: 1.1 }, // varm maj7, lågt
  ring: { freqs: [220, 329.6, 493.9], filterHz: 1400, detune: 9, type: "sine", level: 0.5 }, // luftig
  scatter: { freqs: [92.5, 138.6, 185], filterHz: 600, detune: 10, type: "sine", level: 0.6 },
};

const STORE_KEY = "pf-audio";
const FADE_S = 2;

export function initAudio(ctx: FeatureContext): { toggle(): void; enabled(): boolean } {
  let on = false;
  let ac: AudioContext | null = null;
  let master: GainNode | null = null; // på/av-grind, rampas för klickfritt läge
  let padBus: GainNode | null = null;
  let blipBus: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  const pads = new Map<ShapeId, { gain: GainNode; oscs: OscillatorNode[] }>();
  const padReapers = new Map<ShapeId, number>();
  const gentle = ctx.engine.reducedMotion ? 0.7 : 1;

  function ensureAudio(): AudioContext {
    if (ac) return ac;
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
    padBus = ac.createGain();
    padBus.gain.value = 0.05 * gentle;
    padBus.connect(master);
    blipBus = ac.createGain();
    blipBus.gain.value = 0.12 * gentle;
    blipBus.connect(master);
    return ac;
  }

  function ensurePad(shape: ShapeId): GainNode {
    const existing = pads.get(shape);
    if (existing) return existing.gain;
    const a = ensureAudio();
    const spec = PADS[shape];
    const gain = a.createGain();
    gain.gain.value = 0;
    gain.connect(padBus!);
    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = spec.filterHz;
    filter.Q.value = 0.6;
    filter.connect(gain);
    const oscs: OscillatorNode[] = [];
    for (const freq of spec.freqs) {
      for (const sign of [-1, 1]) {
        const osc = a.createOscillator();
        osc.type = spec.type;
        osc.frequency.value = freq;
        osc.detune.value = sign * spec.detune;
        osc.connect(filter);
        osc.start();
        oscs.push(osc);
      }
    }
    pads.set(shape, { gain, oscs });
    return gain;
  }

  /** Korsfada till formens pad; andra rampas ner och SKÖRDAS efter uttoning
   *  — annars ackumuleras tysta men CPU-ätande oscillatorer per besökt form. */
  function fadeTo(shape: ShapeId): void {
    if (!ac) return;
    ensurePad(shape);
    const now = ac.currentTime;
    for (const [id, pad] of pads) {
      const target = id === shape ? PADS[id].level : 0;
      pad.gain.gain.cancelScheduledValues(now);
      pad.gain.gain.setValueAtTime(pad.gain.gain.value, now);
      pad.gain.gain.linearRampToValueAtTime(target, now + FADE_S);
      if (id === shape) {
        window.clearTimeout(padReapers.get(id));
        padReapers.delete(id);
      } else if (!padReapers.has(id)) {
        padReapers.set(
          id,
          window.setTimeout(() => {
            padReapers.delete(id);
            const p = pads.get(id);
            if (!p || id === current) return;
            p.oscs.forEach((o) => {
              o.stop();
              o.disconnect();
            });
            p.gain.disconnect();
            pads.delete(id);
          }, (FADE_S + 0.5) * 1000)
        );
      }
    }
    current = shape;
  }

  let current: ShapeId | null = null;

  function shapeOf(sectionId: string): ShapeId {
    const raw = document.getElementById(sectionId)?.dataset.shape;
    return raw && raw in PADS ? (raw as ShapeId) : ctx.engine.currentShape();
  }

  function noiseBuffer(a: AudioContext): AudioBuffer {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function canBlip(): boolean {
    return on && !!ac && ac.state === "running";
  }

  /** Enkel ton med kuvert: 5ms attack, exponentiell decay — aldrig klickig. */
  function tone(freq: number, type: OscillatorType, dur: number, peak: number, delay = 0): void {
    if (!canBlip()) return;
    const a = ac!;
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.005 + dur);
    osc.connect(g).connect(blipBus!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  }

  function noise(dur: number, peak: number, filterType: BiquadFilterType, fromHz: number, toHz?: number): void {
    if (!canBlip()) return;
    const a = ac!;
    const t0 = a.currentTime;
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a);
    src.loop = true;
    const f = a.createBiquadFilter();
    f.type = filterType;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(fromHz, t0);
    if (toHz !== undefined) f.frequency.linearRampToValueAtTime(toHz, t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.005 + dur);
    src.connect(f).connect(g).connect(blipBus!);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  function blip(kind: BlipKind): void {
    switch (kind) {
      case "nav":
        tone(660, "sine", 0.06, 0.5);
        break;
      case "open":
        tone(523.25, "sine", 0.09, 0.4);
        tone(659.25, "sine", 0.11, 0.4, 0.07);
        break;
      case "secret":
        [880, 1108.7, 1318.5].forEach((f, i) => tone(f, "triangle", 0.14, 0.32, i * 0.08));
        break;
      case "morph":
        noise(0.3, 0.22, "bandpass", 300, 1600);
        break;
      case "shoot":
        tone(120, "square", 0.05, 0.4);
        break;
      case "hit":
        noise(0.08, 0.45, "lowpass", 800);
        break;
    }
  }

  function toggle(): void {
    on = !on;
    localStorage.setItem(STORE_KEY, on ? "1" : "0");
    if (on) {
      clearTimeout(suspendTimer);
      const a = ensureAudio();
      void a.resume();
      const now = a.currentTime;
      master!.gain.cancelScheduledValues(now);
      master!.gain.setValueAtTime(master!.gain.value, now);
      master!.gain.linearRampToValueAtTime(1, now + 0.6);
      fadeTo(ctx.engine.currentShape());
      ctx.toast(ctx.t({ sv: "Ljud på", en: "Sound on" }));
    } else {
      const a = ac;
      if (a && master) {
        const now = a.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + 0.3);
        suspendTimer = setTimeout(() => {
          if (!on) void a.suspend();
        }, 400);
      }
      ctx.toast(ctx.t({ sv: "Ljud av", en: "Sound off" }));
    }
  }

  ctx.bus.on("section", ({ id }) => {
    if (on) fadeTo(shapeOf(id));
  });
  ctx.bus.on("audio-blip", ({ kind }) => blip(kind));
  ctx.bus.on("palette-open", () => blip("open"));
  ctx.bus.on("theme", () => tone(1000, "sine", 0.03, 0.12)); // tyst tick

  // Pausa i bakgrundsflik, återuppta om ljudet är på.
  document.addEventListener("visibilitychange", () => {
    if (!ac) return;
    if (document.hidden) void ac.suspend();
    else if (on) void ac.resume();
  });

  // M-tangenten binds i main.ts (via runCommand) — där finns skrivskyddet
  // som hindrar att ord som "matrix" togglar ljudet.

  ctx.registerCommand({
    id: "audio-toggle",
    label: () => ctx.t(on ? { sv: "Ljud: på", en: "Sound: on" } : { sv: "Ljud: av", en: "Sound: off" }),
    group: () => ctx.t({ sv: "Åtgärder", en: "Actions" }),
    hint: "M",
    run: toggle,
  });

  // Autoplay-policy: starta aldrig själv — påminn bara om att ljud var på.
  if (localStorage.getItem(STORE_KEY) === "1") {
    setTimeout(() => ctx.toast(ctx.t({ sv: "Tryck M för ljud", en: "Press M for sound" })), 1000);
  }

  return { toggle, enabled: () => on };
}
