import type { FeatureContext, SkinId } from "../app/contracts";
import { local, readJsonArray } from "../app/storage";

const UNLOCKED_KEY = "pf-skins-unlocked";
const ACTIVE_KEY = "pf-skin";

interface CheatDef {
  code: string;
  skin?: SkinId;
  run?: (ctx: FeatureContext) => void;
  toast: { sv: string; en: string };
}

const CHEATS: CheatDef[] = [
  {
    code: "gravity",
    toast: { sv: "⬇ Gravitationen släpps på …", en: "⬇ Gravity engaged …" },
    run: (ctx) => {
      ctx.engine.setGravity(true);
      setTimeout(() => ctx.engine.setGravity(false), 5000);
    },
  },
  // koden är "neo" (inte "matrix") — m/t är kortkommandon och får inte läcka
  { code: "neo", skin: "matrix", toast: { sv: "▮ Wake up, Neo.", en: "▮ Wake up, Neo." } },
  { code: "wire", skin: "wire", toast: { sv: "△ Blueprint-läge.", en: "△ Blueprint mode." } },
  {
    code: "normal",
    toast: { sv: "Återställt.", en: "Back to normal." },
    run: (ctx) => applySkin(ctx, "default"),
  },
];

const SKIN_LABEL: Record<SkinId, { sv: string; en: string }> = {
  default: { sv: "Tema: Standard", en: "Skin: Default" },
  matrix: { sv: "Tema: Matrix", en: "Skin: Matrix" },
  wire: { sv: "Tema: Blueprint", en: "Skin: Blueprint" },
  gold: { sv: "Tema: Guld", en: "Skin: Gold" },
};

const SKIN_ACCENTS: Partial<Record<SkinId, string>> = {
  matrix: "#00ff66",
  gold: "#ffc14d",
};

/** Aktivt skins accentfärg, om skinet tvingar en — annars null. */
export function skinAccentOverride(): string | null {
  const active = (local.getItem(ACTIVE_KEY) ?? "default") as SkinId;
  return SKIN_ACCENTS[active] ?? null;
}

function unlocked(): Set<SkinId> {
  return new Set(readJsonArray<SkinId>(local, UNLOCKED_KEY));
}

let onSkinChange: (() => void) | null = null;

function applySkin(ctx: FeatureContext, skin: SkinId): void {
  ctx.engine.setSkin(skin);
  document.documentElement.dataset.skin = skin;
  local.setItem(ACTIVE_KEY, skin);
  onSkinChange?.();
}

/** Lås upp ett skin (från fuskkod eller konami) och aktivera det. */
export function unlockSkin(ctx: FeatureContext, skin: SkinId): void {
  const set = unlocked();
  if (!set.has(skin)) {
    set.add(skin);
    local.setItem(UNLOCKED_KEY, JSON.stringify([...set]));
    ctx.bus.emit("skin-unlocked", { skin });
  }
  applySkin(ctx, skin);
}

export function initCheats(ctx: FeatureContext, onChange?: () => void): void {
  onSkinChange = onChange ?? null;
  // återställ aktivt skin från förra besöket
  const saved = local.getItem(ACTIVE_KEY) as SkinId | null;
  if (saved && saved !== "default" && unlocked().has(saved)) applySkin(ctx, saved);

  // palettkommandon för upplåsta skins
  (["default", "matrix", "wire", "gold"] as SkinId[]).forEach((skin) => {
    ctx.registerCommand({
      id: `skin-${skin}`,
      label: () => ctx.t(SKIN_LABEL[skin]),
      group: () => ctx.t({ sv: "Upplåst", en: "Unlocked" }),
      visible: () => (skin === "default" ? unlocked().size > 0 : unlocked().has(skin)),
      run: () => applySkin(ctx, skin),
    });
  });

  // ringbuffert för inskrivna bokstäver
  let buffer = "";
  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-12);
    for (const cheat of CHEATS) {
      if (buffer.endsWith(cheat.code)) {
        buffer = "";
        if (cheat.skin) unlockSkin(ctx, cheat.skin);
        cheat.run?.(ctx);
        ctx.toast(ctx.t(cheat.toast));
        if (cheat.code !== "normal") ctx.secrets.found("cheat-code");
      }
    }
  });
}
