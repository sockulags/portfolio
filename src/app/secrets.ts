import type { Bus, SecretId, SecretsApi } from "./contracts";
import { local } from "./storage";

const STORAGE_KEY = "pf-secrets";
const STARTED_KEY = "pf-secrets-started";

interface SecretDef {
  id: SecretId;
  hint: { sv: string; en: string };
  /** Tydligare ledtråd — låses upp på begäran i uppdragsloggen.
   *  Utelämnad = kryptiskt-only, för uppdragen som SKA vara kluriga. */
  hint2?: { sv: string; en: string };
  name: { sv: string; en: string };
}

/** Kryptiska ledtrådar — får aldrig avslöja rakt av. */
const CATALOG: SecretDef[] = [
  {
    id: "first-warp",
    name: { sv: "Warppiloten", en: "Warp pilot" },
    hint: { sv: "Siffror är snabbare än scroll.", en: "Numbers are faster than scrolling." },
    hint2: {
      sv: "Tryck 1–6 i äventyrsläget så flyger skeppet dit själv.",
      en: "Press 1–6 in journey mode and the ship flies there on its own.",
    },
  },
  {
    id: "free-flight",
    name: { sv: "Fri flykt", en: "Free flight" },
    hint: { sv: "Riktiga piloter rör inte scrollhjulet.", en: "Real pilots never touch the scroll wheel." },
    hint2: {
      sv: "Håll in W och spring genom rymden. Shift ger extra fart.",
      en: "Hold W and run through space. Shift adds a boost.",
    },
  },
  {
    id: "moon-rep",
    name: { sv: "Följeslagaren", en: "The companion" },
    hint: { sv: "Något litet kretsar kring familjens middag.", en: "Something small orbits the family dinner." },
    hint2: {
      sv: "En liten måne svävar vid Smask-planeten — klicka på den.",
      en: "A tiny moon hovers by the Smask planet — click it.",
    },
  },
  {
    id: "moon-stege",
    name: { sv: "Klättraren", en: "The climber" },
    hint: { sv: "En stege med 498 pinnar står lutad mot byggplatsen.", en: "A ladder of 498 rungs leans against the build site." },
    hint2: {
      sv: "Design-Pilot har också en måne. Besök den.",
      en: "Design-Pilot has a moon too. Pay it a visit.",
    },
  },
  {
    id: "konami",
    name: { sv: "Gamla skolan", en: "Old school" },
    hint: { sv: "Trettio liv, om du minns ordningen.", en: "Thirty lives, if you remember the order." },
    hint2: { sv: "↑ ↑ ↓ ↓ ← → ← → B A — på tangentbordet.", en: "↑ ↑ ↓ ↓ ← → ← → B A — on the keyboard." },
  },
  {
    id: "konami-master",
    name: { sv: "Tradition", en: "Tradition" },
    hint: { sv: "Det som fungerade en gång fungerar tre.", en: "What worked once works three times." },
  },
  {
    id: "cheat-code",
    name: { sv: "Fuskaren", en: "The cheat" },
    hint: { sv: "Skriv det du vill att världen ska göra.", en: "Type what you want the world to do." },
    hint2: {
      sv: "Skriv ordet „gravity” var som helst på sidan — utan textfält.",
      en: "Type the word “gravity” anywhere on the page — no text box needed.",
    },
  },
  {
    id: "runaway",
    name: { sv: "Rymlingen", en: "The runaway" },
    hint: { sv: "En av en kvarts miljon vill något annat.", en: "One in a quarter million wants something else." },
    hint2: {
      sv: "Då och då vandrar en ensam ljusprick över skärmen. Fånga den med ett klick.",
      en: "Every so often a lone speck of light wanders across the screen. Catch it with a click.",
    },
  },
  {
    id: "asteroids-play",
    name: { sv: "Pilot på riktigt", en: "An actual pilot" },
    hint: { sv: "Paletten kan mer än att navigera. Prova att leka.", en: "The palette does more than navigate. Try playing." },
    hint2: { sv: "Öppna paletten (Ctrl+K) och sök på Asteroids.", en: "Open the palette (Ctrl+K) and search for Asteroids." },
  },
  {
    id: "snake-10",
    name: { sv: "Ormtjusaren", en: "Snake charmer" },
    hint: { sv: "Gittret är ett bräde. Tio bitar räcker.", en: "The lattice is a board. Ten bites will do." },
    hint2: { sv: "Paletten gömmer ett Snake — ät tio bitar.", en: "The palette hides a Snake game — eat ten pieces." },
  },
  {
    id: "night-owl",
    name: { sv: "Nattugglan", en: "Night owl" },
    hint: { sv: "Kom tillbaka när alla andra sover.", en: "Come back when everyone else is asleep." },
    hint2: { sv: "Besök sajten mellan midnatt och fem, svensk tid.", en: "Visit between midnight and five, Swedish time." },
  },
  {
    id: "polyglot",
    name: { sv: "Polyglotten", en: "The polyglot" },
    hint: { sv: "Läs samma sak med andra ögon.", en: "Read the same thing with different eyes." },
    hint2: { sv: "Byt språk — L på tangentbordet eller knappen uppe till höger.", en: "Switch language — L on the keyboard or the button top right." },
  },
  {
    id: "chameleon",
    name: { sv: "Kameleonten", en: "The chameleon" },
    hint: { sv: "Ljus, mörker, ljus, mörker… envishet belönas.", en: "Light, dark, light, dark… persistence pays." },
    hint2: { sv: "Växla tema tio gånger i rad. Ja, tio.", en: "Toggle the theme ten times in a row. Yes, ten." },
  },
  {
    id: "terminal",
    name: { sv: "Hemma", en: "Home" },
    hint: { sv: "Där utvecklare känner sig hemma. Större-än.", en: "Where developers feel at home. Greater-than." },
    hint2: { sv: "Tryck > för att öppna terminalen.", en: "Press > to open the terminal." },
  },
  {
    id: "hire",
    name: { sv: "Rekryteraren", en: "The recruiter" },
    hint: { sv: "Superanvändaren vet vad hen vill. Fråga terminalen.", en: "The superuser knows what they want. Ask the terminal." },
  },
  {
    id: "multiverse",
    name: { sv: "Multiversum", en: "Multiverse" },
    hint: { sv: "Ett universum räcker inte. Öppna ett till.", en: "One universe is not enough. Open another." },
  },
];

export function createSecrets(bus: Bus, lang: () => "sv" | "en", showToast: (msg: string) => void): SecretsApi {
  let found = new Set<SecretId>();
  try {
    const raw = local.getItem(STORAGE_KEY);
    if (raw) found = new Set(JSON.parse(raw) as SecretId[]);
  } catch {
    // korrupt lagring — börja om
  }
  if (!local.getItem(STARTED_KEY)) {
    local.setItem(STARTED_KEY, String(Date.now()));
  }

  const persist = () => local.setItem(STORAGE_KEY, JSON.stringify([...found]));

  return {
    found(id) {
      if (found.has(id)) return;
      const def = CATALOG.find((s) => s.id === id);
      if (!def) return;
      found.add(id);
      persist();
      const l = lang();
      const label = l === "sv" ? "Hemlighet" : "Secret";
      showToast(`✦ ${label} ${found.size}/${CATALOG.length}: ${def.name[l]}`);
      bus.emit("secret", { id, count: found.size, total: CATALOG.length });
      bus.emit("audio-blip", { kind: "secret" });
    },
    has: (id) => found.has(id),
    count: () => found.size,
    total: () => CATALOG.length,
    list: () => CATALOG.map((s) => ({ id: s.id, found: found.has(s.id), name: s.name, hint: s.hint, hint2: s.hint2 })),
    reset() {
      found.clear();
      persist();
      local.setItem(STARTED_KEY, String(Date.now()));
      bus.emit("secrets-reset", {});
    },
  };
}

/** Aktiv tid sedan hemlighetsjakten började — för diplomet. */
export function questStartedAt(): number {
  return Number(local.getItem(STARTED_KEY) ?? Date.now());
}
