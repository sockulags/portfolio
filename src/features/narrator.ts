import type { Bus, ShapeId } from "../app/contracts";

const DESCRIPTIONS: Record<string, { sv: string; en: string }> = {
  galaxy: {
    sv: "Bakgrunden visar en spiralgalax av hundratusentals partiklar som långsamt roterar.",
    en: "The background shows a spiral galaxy of hundreds of thousands of slowly rotating particles.",
  },
  layers: {
    sv: "Partiklarna har format staplade dokumentsidor med textrader — en bild av CV-plattformen Meritvo.",
    en: "The particles now form stacked document pages with text lines — an image of the CV platform Meritvo.",
  },
  knot: {
    sv: "Partiklarna har flätat sig till en torusknut — agentloopen i projektet Pilot.",
    en: "The particles have braided into a torus knot — the agent loop of the Pilot project.",
  },
  lattice: {
    sv: "Partiklarna bildar ett tredimensionellt kubgitter — komponentregistret i Design-Pilot.",
    en: "The particles form a three-dimensional cube lattice — the component registry of Design-Pilot.",
  },
  wave: {
    sv: "Partiklarna svänger i pulserande vågrader — repetitioner och puls, som i Rep Counter.",
    en: "The particles swing in pulsing wave rows — repetitions and pulse, like Rep Counter.",
  },
  blob: {
    sv: "Partiklarna har samlats i en organisk, nästan ätbar form — familjekokboken Smask.",
    en: "The particles have gathered into an organic, almost edible shape — the family cookbook Smask.",
  },
  ring: {
    sv: "Partiklarna formar en öppen portalring runt kontaktuppgifterna.",
    en: "The particles form an open portal ring around the contact details.",
  },
};

/**
 * Skärmläsarberättaren: beskriver partikelscenen poetiskt via aria-live
 * när sektionen byts. Syns aldrig visuellt.
 */
export function initNarrator(bus: Bus, lang: () => "sv" | "en", shapeFor: (sectionId: string) => ShapeId): void {
  const region = document.createElement("div");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("role", "status");
  region.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);";
  document.body.append(region);

  let last = "";
  bus.on("section", ({ id }) => {
    const shape = shapeFor(id);
    const desc = DESCRIPTIONS[shape];
    if (!desc || shape === last) return;
    last = shape;
    // liten fördröjning så rubriken hinner läsas först
    setTimeout(() => {
      region.textContent = desc[lang()];
    }, 1200);
  });
}
