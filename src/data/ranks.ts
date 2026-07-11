/**
 * Diplomen i lager: en resa-rank som är lätt att få, och fyra hemlighetsranker
 * med stigande krav. Ren data + ren logik — features (diploma, runeboard)
 * importerar härifrån i stället för från varandra.
 */

export interface Rank {
  id: string;
  /** 1..5 — styr hur påkostat diplomet ritas. */
  tier: 1 | 2 | 3 | 4 | 5;
  name: { sv: string; en: string };
  /** Krav i antal hemligheter; null = resan (pf-journey-done). "all" = alla. */
  need: number | "journey" | "all";
  requirement: { sv: string; en: string };
  color: string;
}

export const RANKS: Rank[] = [
  {
    id: "resenar",
    tier: 1,
    name: { sv: "Rymdresenär", en: "Space Traveler" },
    need: "journey",
    requirement: { sv: "Fullborda resan genom alla åtta stopp", en: "Complete the journey through all eight stops" },
    color: "#7c6cff",
  },
  {
    id: "kadett",
    tier: 2,
    name: { sv: "Kadett", en: "Cadet" },
    need: 3,
    requirement: { sv: "Hitta 3 hemligheter", en: "Find 3 secrets" },
    color: "#d0925b",
  },
  {
    id: "pilot",
    tier: 3,
    name: { sv: "Pilot", en: "Pilot" },
    need: 6,
    requirement: { sv: "Hitta 6 hemligheter", en: "Find 6 secrets" },
    color: "#cfd8e8",
  },
  {
    id: "kapten",
    tier: 4,
    name: { sv: "Kapten", en: "Captain" },
    need: 9,
    requirement: { sv: "Hitta 9 hemligheter", en: "Find 9 secrets" },
    color: "#ffc14d",
  },
  {
    id: "kommendor",
    tier: 5,
    name: { sv: "Kommendör", en: "Commander" },
    need: "all",
    requirement: { sv: "Hitta alla hemligheter", en: "Find every secret" },
    color: "#9ff0ff",
  },
];

export interface RankProgress {
  secretCount: number;
  secretTotal: number;
  journeyDone: boolean;
}

export function rankEarned(rank: Rank, p: RankProgress): boolean {
  if (rank.need === "journey") return p.journeyDone;
  const need = rank.need === "all" ? p.secretTotal : rank.need;
  return p.secretCount >= need;
}

/** Nästa oförtjänta rank — för progressraden i uppdragsloggen. */
export function nextRank(p: RankProgress): Rank | null {
  return RANKS.find((r) => !rankEarned(r, p)) ?? null;
}
