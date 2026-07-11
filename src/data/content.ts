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
    id: "viska",
    index: "04",
    name: "Viska",
    tagline: {
      sv: "Diktering var som helst i Windows — utan moln",
      en: "Dictation anywhere on Windows — no cloud",
    },
    description: {
      sv: "Tryck F9 och prata — texten skrivs in där markören står, i vilken Windows-app som helst. Kungliga bibliotekets svensktränade KB-Whisper kör på din egen GPU: ljudet lämnar aldrig datorn och transkriberingen tar under en sekund.",
      en: "Press F9 and speak — the text lands wherever the cursor is, in any Windows app. The Royal Library's Swedish-trained KB-Whisper runs on your own GPU: audio never leaves the machine and transcription takes under a second.",
    },
    highlights: {
      sv: [
        "Liveläge på GPU: färdiga fraser skrivs in medan du fortfarande pratar — den pågående förhandsvisas i en pill nertill.",
        "F8 polerar markerad text med en lokal Qwen3-modell — mallbibliotek (Mejl, Commit-text) och egen profil per app.",
        "Integritet i detaljerna: inklistringar hålls utanför Win+V-historiken och molnklippbordet, historiken bor i RAM.",
      ],
      en: [
        "Live mode on GPU: finished phrases are typed while you're still speaking — the current one previews in a pill at the bottom.",
        "F8 polishes selected text with a local Qwen3 model — a template library (Email, Commit message) and per-app profiles.",
        "Privacy in the details: pasted text stays out of the Win+V history and cloud clipboard; history lives in RAM.",
      ],
    },
    tech: ["Python", "faster-whisper", "KB-Whisper", "llama.cpp", "CUDA", "PyInstaller"],
    status: { sv: "Privat beta", en: "Private beta" },
    links: [],
    accent: "#80ed99",
  },
  {
    id: "referat",
    index: "05",
    name: "referat",
    tagline: {
      sv: "Mötesprotokoll som aldrig lämnar datorn",
      en: "Meeting minutes that never leave your machine",
    },
    description: {
      sv: "Slut på att anteckna medan alla andra pratar: referat spelar in mötet, transkriberar och skriver färdigt protokoll — sammanfattning, beslut och åtgärdspunkter. Allt lagras lokalt, API-nycklar krypteras med Windows DPAPI och appen ringer aldrig hem.",
      en: "No more taking notes while everyone else talks: referat records the meeting, transcribes it and writes finished minutes — summary, decisions and action items. Everything is stored locally, API keys are encrypted with Windows DPAPI and the app never phones home.",
    },
    highlights: {
      sv: [
        "Fångar systemljud och mikrofon direkt — fungerar med Teams, Zoom och Meet utan att någon bot går med i samtalet.",
        "Talardiarisering via lokal pyannote-server: vem sa vad — en timmes möte diariseras på under en minut på GPU.",
        "Välj var AI:n kör — KB-Whisper och Ollama helt lokalt, eller valfri OpenAI-kompatibel/Anthropic-endpoint.",
      ],
      en: [
        "Captures system audio and microphone directly — works with Teams, Zoom and Meet without a bot joining the call.",
        "Speaker diarization via a local pyannote server: who said what — an hour-long meeting diarizes in under a minute on GPU.",
        "Choose where the AI runs — KB-Whisper and Ollama fully local, or any OpenAI-compatible/Anthropic endpoint.",
      ],
    },
    tech: ["Electron", "React 19", "TypeScript", "Tailwind 4", "Python", "pyannote.audio"],
    status: { sv: "Öppen källkod", en: "Open source" },
    links: [
      { label: { sv: "Kod på GitHub", en: "Code on GitHub" }, href: "https://github.com/sockulags/referat" },
      { label: { sv: "Ladda ner appen", en: "Download the app" }, href: "https://sockulags.github.io/referat/" },
    ],
    accent: "#ffd166",
  },
  {
    id: "smask",
    index: "06",
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

/** Små sidoprojekt som kretsar kring en planet på rutten — upptäcks, öppnas, räknas som hemlighet. */
export interface Moon {
  id: string;
  /** Sektions-id som månen kretsar kring. */
  host: string;
  secretId: "moon-rep" | "moon-stege";
  name: string;
  tagline: { sv: string; en: string };
  description: { sv: string; en: string };
  liveUrl: string;
  repoUrl: string;
  accent: string;
}

export const moons: Moon[] = [
  {
    id: "stege",
    host: "design-pilot",
    secretId: "moon-stege",
    name: "Stege",
    tagline: { sv: "En schackstege med 498 pinnar", en: "A chess ladder with 498 rungs" },
    description: {
      sv: "Klättra från nybörjarlätt till 2900 ELO — inga ledtrådar, ett felsteg och pusslet nollställs. Time trial öser ur 19 000 Lichess-pussel, allt serverat helt utan backend.",
      en: "Climb from beginner-easy to 2900 ELO — no hints, one misstep and the puzzle resets. Time trial draws from 19,000 Lichess puzzles, all served with zero backend.",
    },
    liveUrl: "https://sockulags.github.io/stege/",
    repoUrl: "https://github.com/sockulags/stege",
    accent: "#bdb2ff",
  },
  {
    id: "rep-counter",
    host: "smask",
    secretId: "moon-rep",
    name: "Rep Counter",
    tagline: { sv: "Varje rep räknas — lokalt", en: "Every rep counts — locally" },
    description: {
      sv: "Blixtsnabb rep-loggning direkt från hemskärmen: snabbknappar, dagsmål och en heatmap som skvallrar om vilodagarna. Ingen server, inget konto — datan bor i din ficka.",
      en: "Lightning-fast rep logging straight from the home screen: quick buttons, daily goals and a heatmap that tattles on your rest days. No server, no account — the data lives in your pocket.",
    },
    liveUrl: "https://sockulags.github.io/rep-counter/",
    repoUrl: "https://github.com/sockulags/rep-counter",
    accent: "#ff9770",
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
  scrollHint: { sv: "Scrolla, spring med WASD — eller warpa med", en: "Scroll, run with WASD — or warp with" },
  playJourney: { sv: "Starta resan", en: "Begin the journey" },
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
  shortcutsAudio: { sv: "Ljud på/av", en: "Sound on/off" },
  shortcutsDebug: { sv: "Debug-HUD (klassisk vy — D styr skeppet i äventyret)", en: "Debug HUD (classic view — D steers the ship in the journey)" },
  shortcutsTerminal: { sv: "Öppna terminalen", en: "Open the terminal" },
  shortcutsWasd: { sv: "Spring genom rymden (äventyrsläge)", en: "Run through space (journey mode)" },
  shortcutsQuestlog: { sv: "Uppdragsloggen", en: "The quest log" },
  shortcutsPrint: { sv: "Skriv ut som riktigt CV", en: "Print as a real CV" },
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
