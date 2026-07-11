/**
 * Centrala kontrakt för alla feature-moduler. Moduler får ALDRIG importera
 * main.ts eller varandra — allt de behöver kommer via FeatureContext.
 */

export type ShapeId =
  | "galaxy"
  | "layers"
  | "knot"
  | "lattice"
  | "wave"
  | "blob"
  | "lanes"
  | "ring"
  | "scatter";

export type SkinId = "default" | "matrix" | "wire" | "gold";

export interface EngineStats {
  mode: "gpgpu" | "cpu";
  particleCount: number;
  fps: number;
  frameMs: number;
  drawCalls: number;
  shape: ShapeId;
}

/** Overlay: ett litet separat partikelmoln för spel/varelser, CPU-styrt. */
export interface OverlayApi {
  /** xyz per partikel, världskoordinater (z=0-planet fyller vyn). */
  positions: Float32Array;
  /** rgb per partikel, 0..1. */
  colors: Float32Array;
  count: number;
  setVisible(v: boolean): void;
  /** Ladda upp positions/colors till GPU:n — anropa efter varje ändring. */
  sync(): void;
  dispose(): void;
}

export interface EngineApi {
  setShape(id: ShapeId, instant?: boolean): void;
  currentShape(): ShapeId;
  /** Morfa fältet till ett godtyckligt punktmoln, håll kvar, gå sen tillbaka. */
  morphToPoints(points: Float32Array, holdMs?: number): void;
  /** Morfa fältet till text (renderas med sajtens displayfont). */
  morphToText(text: string, holdMs?: number): void;
  /** Tryckvåg genom fältet från en skärmposition. strength ~0.5..3. */
  shockwave(clientX: number, clientY: number, strength?: number): void;
  /** Som shockwave men i världskoordinater (z=0-planet). */
  shockwaveWorld(x: number, y: number, strength?: number): void;
  /** Virvel som suger in partiklar medan active=true. */
  vortex(clientX: number, clientY: number, active: boolean): void;
  setGravity(on: boolean): void;
  setSkin(skin: SkinId): void;
  /** Väderpåverkan: vind i världsenheter, drift = nedåtdrag 0..1, dim = 0..1. */
  setWeather(w: { windX: number; windY: number; drift: number; dim: number } | null): void;
  setAccent(hex: string): void;
  burst(tier?: 1 | 2 | 3): void;
  /** Svart hål: fältet spiralerar in i en singularitet och återföds i en big bang (~7 s). */
  blackHole(): void;
  /** true ⇒ scrollspy får inte byta form (spel pågår). */
  paused: boolean;
  createOverlay(count: number, opts?: { size?: number }): OverlayApi;
  /** Skärmpixlar → världskoordinater på z=0-planet. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number };
  /** Halva bredden/höjden av synligt område vid z=0. */
  worldBounds(): { halfW: number; halfH: number };
  stats(): EngineStats;
  reducedMotion: boolean;
}

export type BusEvents = {
  section: { id: string };
  secret: { id: string; count: number; total: number };
  "palette-open": Record<string, never>;
  theme: { theme: "dark" | "light" };
  lang: { lang: "sv" | "en" };
  konami: { tier: 1 | 2 | 3 };
  "game-start": { game: string };
  "game-end": { game: string; score: number };
  "skin-unlocked": { skin: SkinId };
  "audio-blip": { kind: "nav" | "open" | "secret" | "morph" | "shoot" | "hit" | "warp" };
  /** Äventyrs-/klassiskt läge har växlats. */
  mode: { mode: "journey" | "classic" };
  /** Alla stopp på resan besökta (via Play-turen eller på egen hand). */
  "journey-complete": Record<string, never>;
  /** Hemligheterna nollställdes (speedrun) — räknare och märken måste ritas om. */
  "secrets-reset": Record<string, never>;
  /** Förhandsvisa ett kosmiskt fenomen (fuskkoder/test) — cosmos-modulen lyssnar. */
  "cosmos-preview": { what: "aurora" | "meteor" | "iss" };
};

export interface Bus {
  on<K extends keyof BusEvents>(event: K, cb: (payload: BusEvents[K]) => void): () => void;
  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void;
}

export type SecretId =
  | "konami"
  | "konami-master"
  | "cheat-code"
  | "runaway"
  | "asteroids-play"
  | "snake-10"
  | "night-owl"
  | "polyglot"
  | "chameleon"
  | "terminal"
  | "hire"
  | "multiverse"
  | "first-warp"
  | "free-flight"
  | "moon-rep"
  | "moon-stege";

export interface SecretsApi {
  /** Registrera fynd. No-op om redan hittad. Visar toast + emitterar 'secret'. */
  found(id: SecretId): void;
  has(id: SecretId): boolean;
  count(): number;
  total(): number;
  /** För uppdragsloggen: alla hemligheter med status, namn och ledtrådar.
   *  hint2 är den tydligare ledtråden — saknas den är uppdraget kryptiskt-only. */
  list(): {
    id: SecretId;
    found: boolean;
    name: { sv: string; en: string };
    hint: { sv: string; en: string };
    hint2?: { sv: string; en: string };
  }[];
  reset(): void;
}

export interface CommandSpec {
  id: string;
  label: () => string;
  group: () => string;
  hint?: string;
  /** Syns bara när villkoret är sant (t.ex. upplåsta skins). */
  visible?: () => boolean;
  run: () => void;
}

export interface FeatureContext {
  engine: EngineApi;
  bus: Bus;
  secrets: SecretsApi;
  lang(): "sv" | "en";
  t(entry: { sv: string; en: string }): string;
  toast(msg: string): void;
  registerCommand(cmd: CommandSpec): void;
  /** Kör ett registrerat palettkommando via id. false om okänt/dolt. */
  runCommand(id: string): boolean;
  goTo(sectionId: string): void;
  actions: {
    toggleTheme(): void;
    toggleLang(): void;
    openPalette(): void;
    copyEmail(): Promise<void>;
  };
  theme(): "dark" | "light";
  EMAIL: string;
  GITHUB_USER: string;
  GITHUB_URL: string;
  SITE_URL: string;
}
