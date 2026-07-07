# Portfolio

Personlig portfoliosida för [Lucas Skog](https://github.com/sockulags) — en minimalistisk one-pager
som gick *beyond reasonable*. Byggd med Vite, TypeScript och three.js. Inga ramverk, inga cookies,
ingen spårning.

**Live:** [sockulags.github.io/portfolio](https://sockulags.github.io/portfolio/)

## Motorn

- **GPGPU-partikelsimulering** — 262 144 partiklar (65 536 på mobil) simuleras helt på GPU:n
  (`GPUComputationRenderer`, FBO ping-pong) med curl noise-turbulens och fjäderkraft mot
  morfbara måltexturer. CPU-fallback för enheter utan float-render-targets, FPS-probe som
  sänker upplösningen på svag hårdvara.
- **Sju former** — galax, dokumentlager, torusknut, kubgitter, våg, blob och ring — en per
  scrollsektion, plus godtyckliga punktmoln och **text**: partiklarna stavar "LUCAS SKOG" vid
  load och projektnamnet första gången varje sektion besöks.
- **Fysisk cursor** — klick skickar en chockvåg genom fältet, håll-och-dra skapar en virvel.
- **Levande värld** — fältet påverkas av det verkliga vädret i Stockholm (open-meteo: vind,
  nederbörd, molnighet) och footern visar aktuellt väder + Kp-index för norrsken.
- **Sajten tittar upp också** — när ISS faktiskt passerar över Stockholm glider en liten
  partikel-ISS över fältet (wheretheiss.at), under riktiga meteorregn (Perseiderna,
  Geminiderna …) faller stjärnfall, och vid Kp ≥ 5 nattetid böljar norrskensdraperier
  över himlavalvet.
- **Gamepad-stöd** — koppla in en handkontroll: navigera med styrkorset, spela Asteroids
  med spakarna och känn varje träff genom rumble.

## Överdrivet funktionell

- **Kommandopalett** (`Ctrl+K`) med fuzzy-sök och dynamiskt kommandoregister
- **Riktig terminal** (`>`) — `ls`, `cat cv.md`, `neofetch` med live motorstats, tab-completion,
  historik, pipes (`ls | grep ai`) och `sudo hire-me`
- **Ctrl+P blir ett riktigt CV** — print-stylesheet reflowar sajten till ett ATS-vänligt
  ensidigt CV med QR-kod
- **Klistra in en jobbannons** — lokal matchningsanalys (~60 teknologier, sv/en-synonymer),
  rapport med träffar/luckor och partiklarna morfar till ett radardiagram. Noll nätverk.
- **Live GitHub-puls** — "senast aktiv för 2 h sedan" i heron, ETag-cachat
- **Tvåspråkig** (SV/EN), ljust/mörkt tema med View Transitions-våg från knappen
- **DevTools-mottagning** — stylad konsolbanner + `window.lucas` (getters: `lucas.hire`,
  `lucas.gravity`, `lucas.cv` …)
- **Debug-HUD** (`D`) — FPS-graf, partikelantal, draw calls och live-sliders för sim-parametrar
- **Maskinläsbart lager** — `llms.txt`, `cv.txt`, `resume.json` (JSON Resume), `humans.txt`,
  `security.txt`, sitemap
- **404-sida** där 2 500 canvas-partiklar formar "404" och sökvägen fuzzy-matchas mot sektioner
- **Tillgängligt** — partikelscenerna beskrivs poetiskt för skärmläsare (aria-live), full
  tangentbordsstyrning, `prefers-reduced-motion` respekteras överallt

## Hemligheterna

Tolv hemligheter, en runtavla (`Runtavlan` i paletten), och ett genererat diplom + speedrun-läge
för den som hittar allt. Utan att avslöja för mycket:

- En gammal fuskkod från 1986 fungerar — tre gånger
- Skriv det du vill att världen ska göra (`gravity`, `wire`, och något Morpheus skulle viska …) — upplåsta skins sparas
- Ett fullt spelbart **Asteroids** gömmer sig i partikelfältet, och gittret är i hemlighet ett
  **Snake**-bräde (WASD)
- En av 262 144 partiklar rymmer ibland — fånga den
- Öppna sajten i två fönster samtidigt och se vad som händer (`BroadcastChannel`)
- Något kläcks när du hittat din första hemlighet — det bor i hörnet, följer muspekaren och
  sover nattetid (Stockholmstid)
- Sajten vet när du är uppe sent
- Det finns ett ord som får hela galaxen att kollapsa i en singularitet — och återfödas

## Utveckling

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typkoll + produktionsbygge till dist/
```

## Deploy

Byggs och publiceras till GitHub Pages via `.github/workflows/deploy.yml` vid push till `main`.
