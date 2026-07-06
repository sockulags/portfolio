export type Lang = "sv" | "en";

export interface ProjectLink {
  label: { sv: string; en: string };
  href: string;
}

export interface Project {
  id: string;
  index: string;
  name: string;
  tagline: { sv: string; en: string };
  description: { sv: string; en: string };
  highlights: { sv: string[]; en: string[] };
  tech: string[];
  status: { sv: string; en: string };
  links: ProjectLink[];
  accent: string;
}

export const projects: Project[] = [
  {
    id: "meritvo",
    index: "01",
    name: "Meritvo",
    tagline: {
      sv: "AI-assisterad CV-plattform",
      en: "AI-assisted CV platform",
    },
    description: {
      sv: "En komplett SaaS för att bygga, skräddarsy och exportera CV:n. All erfarenhet lagras en gång i en språkneutral masterdatamodell — sedan skapas obegränsat många CV:n, vart och ett anpassat mot en specifik tjänst.",
      en: "A complete SaaS for building, tailoring and exporting CVs. Every experience is stored once in a language-neutral masterdata model — then any number of CVs can be created, each tailored to a specific role.",
    },
    highlights: {
      sv: [
        "AI föreslår — du godkänner. Alla AI-ändringar går via en granskningskö, ingenting skrivs om i tysthet.",
        "Klistra in en jobbannons och få matchningspoäng, nyckelord, luckor och konkreta rekommendationer.",
        "Export till PDF/HTML/TXT från samma rendermodell — förhandsvisning och export är alltid identiska.",
      ],
      en: [
        "AI proposes — you approve. Every AI edit goes through a review queue; nothing is silently rewritten.",
        "Paste a job ad to get a match score, keywords, gaps and concrete recommendations.",
        "PDF/HTML/TXT export from a shared render model — preview and export are always identical.",
      ],
    },
    tech: ["Next.js 16", "React 19", "PostgreSQL", "Prisma", "Stripe", "OpenAI", "NextAuth"],
    status: { sv: "Privat beta", en: "Private beta" },
    links: [],
    accent: "#7c6cff",
  },
  {
    id: "pilot",
    index: "02",
    name: "Pilot",
    tagline: {
      sv: "Lokal AI-agent som verifierar sitt eget arbete",
      en: "Local-first AI agent that verifies its own work",
    },
    description: {
      sv: "En verktygsanvändande AI-agent som kör helt lokalt på Windows via Ollama. Den klassificerar varje tur, samlar bevis — läser filer, kör skalkommandon, gör webbresearch — och svarar bara utifrån vad den faktiskt har verifierat.",
      en: "A tool-using AI agent that runs fully local on Windows via Ollama. It classifies each turn, gathers evidence — reads files, runs shell commands, does web research — and answers only from what it has actually verified.",
    },
    highlights: {
      sv: [
        "Lokalt först: kör på Ollama-modeller utan moln — OpenAI som valbar backend.",
        "Reproducerbar eval-svit: förmågor mäts, inte påstås.",
        "Skiktad säkerhetsmodell med timeouts, tokens och loopback som standard.",
      ],
      en: [
        "Local-first: runs on Ollama models with no cloud — OpenAI as an optional backend.",
        "Reproducible eval suite: capabilities are measured, not claimed.",
        "Layered safety model with timeouts, tokens and loopback by default.",
      ],
    },
    tech: ["Python", "FastAPI", "Ollama", "MCP", "WebSocket", "React"],
    status: { sv: "Öppen källkod", en: "Open source" },
    links: [{ label: { sv: "Kod på GitHub", en: "Code on GitHub" }, href: "https://github.com/sockulags/pilot" }],
    accent: "#4cc9f0",
  },
  {
    id: "design-pilot",
    index: "03",
    name: "Design-Pilot",
    tagline: {
      sv: "Sajtbyggare med canvas och CLI — du äger koden",
      en: "Site builder with canvas and CLI — you own the code",
    },
    description: {
      sv: "En shadcn-inspirerad sajtbyggare i två delar: ett Figma-likt canvas där riktiga React-komponenter renderas live, och ett CLI som kopierar in produktionsklar komponentkod i ditt projekt. Inga npm-beroenden — koden blir din.",
      en: "A shadcn-inspired site builder in two parts: a Figma-like canvas where real React components render live, and a CLI that copies production-ready component code into your project. No npm dependency — the code is yours.",
    },
    highlights: {
      sv: [
        "Dra-och-släpp riktiga React-komponenter, redigera props per instans, nesta fritt.",
        "Bygg flera sidor och layouter, koppla interna länkar, exportera hela projektet.",
        "AI-assistent via lokal proxy — API-nyckeln lämnar aldrig maskinen.",
      ],
      en: [
        "Drag and drop real React components, edit props per instance, nest freely.",
        "Build multiple pages and layouts, wire internal links, export the whole project.",
        "AI assistant via a local proxy — the API key never leaves the machine.",
      ],
    },
    tech: ["TypeScript", "React", "Vite", "Node CLI", "pnpm workspaces", "Anthropic API"],
    status: { sv: "Under utveckling", en: "In development" },
    links: [],
    accent: "#f72585",
  },
  {
    id: "rep-counter",
    index: "04",
    name: "Rep Counter",
    tagline: {
      sv: "PWA för daglig träningsloggning",
      en: "PWA for daily exercise logging",
    },
    description: {
      sv: "En mobilanpassad PWA för att logga repetitioner — snabbknappar, dagliga mål, aktivitetskarta och periodfilter. All data stannar lokalt på enheten. Installeras på hemskärmen och fungerar offline.",
      en: "A mobile-first PWA for logging reps — quick buttons, daily goals, an activity heatmap and period filters. All data stays local on the device. Installs to the home screen and works offline.",
    },
    highlights: {
      sv: [
        "Blixtsnabb loggning med snabbknappar och karusell för aktiva övningar.",
        "Översikt med heatmap, dagstotaler och redigerbara poster.",
        "Ingen server, inget konto — lokal lagring med full återställning.",
      ],
      en: [
        "Lightning-fast logging with quick buttons and an active-exercise carousel.",
        "Overview with heatmap, daily totals and editable entries.",
        "No server, no account — local storage with full reset support.",
      ],
    },
    tech: ["TypeScript", "PWA", "Service Worker", "GitHub Actions", "GitHub Pages"],
    status: { sv: "Live", en: "Live" },
    links: [
      { label: { sv: "Testa live", en: "Try it live" }, href: "https://sockulags.github.io/rep-counter/" },
      { label: { sv: "Kod på GitHub", en: "Code on GitHub" }, href: "https://github.com/sockulags/rep-counter" },
    ],
    accent: "#80ed99",
  },
  {
    id: "smask",
    index: "05",
    name: "Smask!",
    tagline: {
      sv: "Familjens kokbok — testade och godkända recept",
      en: "The family cookbook — tested and approved recipes",
    },
    description: {
      sv: "Slut på att googla fram tio varianter och glömma vilken man utgick från. Smask sparar recepten familjen faktiskt lagat — med betyg, anteckningar och foton — och gör veckans recept till en färdig handlingslista.",
      en: "No more googling ten variants and forgetting which one you used. Smask stores the recipes the family actually cooked — with ratings, notes and photos — and turns the week's recipes into a ready shopping list.",
    },
    highlights: {
      sv: [
        "AI-inmatning: fota en kokbokssida, klistra in en länk eller prata in receptet.",
        "Handlingslista som slår ihop ingredienser över recept och grupperar per butiksavdelning.",
        "Bildpipeline med tre webp-varianter och portionsskalning direkt i receptvyn.",
      ],
      en: [
        "AI ingestion: photograph a cookbook page, paste a link or dictate the recipe.",
        "Shopping list that merges ingredients across recipes and groups by store section.",
        "Image pipeline with three webp variants and portion scaling right in the recipe view.",
      ],
    },
    tech: ["Next.js 16", "React 19", "Tailwind 4", "Supabase", "Anthropic API", "sharp"],
    status: { sv: "Privat beta", en: "Private beta" },
    links: [],
    accent: "#ff6b35",
  },
];

export const ui = {
  role: {
    sv: "Fullstackutvecklare",
    en: "Full-stack developer",
  },
  heroLine: {
    sv: "Jag bygger AI-drivna produkter — från lokala agenter till färdiga SaaS-plattformar.",
    en: "I build AI-driven products — from local agents to complete SaaS platforms.",
  },
  greetingMorning: { sv: "God morgon", en: "Good morning" },
  greetingDay: { sv: "Hej", en: "Hello" },
  greetingEvening: { sv: "God kväll", en: "Good evening" },
  scrollHint: { sv: "Scrolla — eller tryck", en: "Scroll — or press" },
  selectedWork: { sv: "Utvalda projekt", en: "Selected work" },
  contactTitle: { sv: "Hör av dig", en: "Get in touch" },
  contactBody: {
    sv: "Öppen för spännande uppdrag och samarbeten. Snabbaste vägen är mejl — eller kika på koden direkt.",
    en: "Open to interesting work and collaborations. Email is the fastest route — or go straight to the code.",
  },
  copyEmail: { sv: "Kopiera e-post", en: "Copy email" },
  copied: { sv: "Kopierad!", en: "Copied!" },
  builtWith: {
    sv: "Byggd med three.js + Vite. Inga cookies, ingen spårning.",
    en: "Built with three.js + Vite. No cookies, no tracking.",
  },
  localTime: { sv: "Lokal tid", en: "Local time" },
  paletteHint: { sv: "för kommandopalett", en: "for command palette" },
  palettePlaceholder: { sv: "Skriv ett kommando eller sök…", en: "Type a command or search…" },
  paletteEmpty: { sv: "Inga träffar", en: "No matches" },
  navigate: { sv: "Navigera", en: "Navigate" },
  actions: { sv: "Åtgärder", en: "Actions" },
  goTo: { sv: "Gå till", en: "Go to" },
  home: { sv: "Hem", en: "Home" },
  contact: { sv: "Kontakt", en: "Contact" },
  switchLang: { sv: "Switch to English", en: "Byt till svenska" },
  toggleTheme: { sv: "Växla ljust/mörkt läge", en: "Toggle light/dark mode" },
  openGithub: { sv: "Öppna GitHub-profil", en: "Open GitHub profile" },
  shortcuts: { sv: "Kortkommandon", en: "Keyboard shortcuts" },
  shortcutsPalette: { sv: "Kommandopalett", en: "Command palette" },
  shortcutsSections: { sv: "Hoppa till sektion", en: "Jump to section" },
  shortcutsTheme: { sv: "Växla tema", en: "Toggle theme" },
  shortcutsLang: { sv: "Växla språk", en: "Toggle language" },
  shortcutsHelp: { sv: "Visa denna hjälp", en: "Show this help" },
  shortcutsClose: { sv: "Stäng överlägg", en: "Close overlay" },
  status: { sv: "Status", en: "Status" },
  privateRepo: { sv: "Privat repo", en: "Private repo" },
} as const;

export const marqueeWords = [
  "TypeScript",
  "React",
  "Next.js",
  "three.js",
  "Python",
  "FastAPI",
  "Supabase",
  "PostgreSQL",
  "Prisma",
  "Tailwind",
  "Ollama",
  "Anthropic API",
  "OpenAI",
  "PWA",
  "CI/CD",
];
