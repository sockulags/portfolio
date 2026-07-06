import type { Bus, SecretId, SecretsApi } from "./contracts";
import { local } from "./storage";

const STORAGE_KEY = "pf-secrets";
const STARTED_KEY = "pf-secrets-started";

interface SecretDef {
  id: SecretId;
  hint: { sv: string; en: string };
  name: { sv: string; en: string };
}

/** Kryptiska ledtrådar — får aldrig avslöja rakt av. */
const CATALOG: SecretDef[] = [
  {
    id: "konami",
    name: { sv: "Gamla skolan", en: "Old school" },
    hint: { sv: "Trettio liv, om du minns ordningen.", en: "Thirty lives, if you remember the order." },
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
  },
  {
    id: "runaway",
    name: { sv: "Rymlingen", en: "The runaway" },
    hint: { sv: "En av en kvarts miljon vill något annat.", en: "One in a quarter million wants something else." },
  },
  {
    id: "asteroids-play",
    name: { sv: "Pilot på riktigt", en: "An actual pilot" },
    hint: { sv: "Paletten kan mer än att navigera. Prova att leka.", en: "The palette does more than navigate. Try playing." },
  },
  {
    id: "snake-10",
    name: { sv: "Ormtjusaren", en: "Snake charmer" },
    hint: { sv: "Gittret är ett bräde. Tio bitar räcker.", en: "The lattice is a board. Ten bites will do." },
  },
  {
    id: "night-owl",
    name: { sv: "Nattugglan", en: "Night owl" },
    hint: { sv: "Kom tillbaka när alla andra sover.", en: "Come back when everyone else is asleep." },
  },
  {
    id: "polyglot",
    name: { sv: "Polyglotten", en: "The polyglot" },
    hint: { sv: "Läs samma sak med andra ögon.", en: "Read the same thing with different eyes." },
  },
  {
    id: "chameleon",
    name: { sv: "Kameleonten", en: "The chameleon" },
    hint: { sv: "Ljus, mörker, ljus, mörker… envishet belönas.", en: "Light, dark, light, dark… persistence pays." },
  },
  {
    id: "terminal",
    name: { sv: "Hemma", en: "Home" },
    hint: { sv: "Där utvecklare känner sig hemma. Större-än.", en: "Where developers feel at home. Greater-than." },
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
    list: () => CATALOG.map((s) => ({ id: s.id, found: found.has(s.id), hint: s.hint })),
    reset() {
      found.clear();
      persist();
      local.setItem(STARTED_KEY, String(Date.now()));
    },
  };
}

/** Aktiv tid sedan hemlighetsjakten började — för diplomet. */
export function questStartedAt(): number {
  return Number(local.getItem(STARTED_KEY) ?? Date.now());
}
