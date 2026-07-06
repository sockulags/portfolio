# Portfolio

Personlig portfoliosida för [Lucas Skog](https://github.com/sockulags) — en minimalistisk one-pager
med ett interaktivt three.js-partikelfält som morfar mellan former för varje projektsektion.

**Live:** [sockulags.github.io/portfolio](https://sockulags.github.io/portfolio/)

## Funktioner

- **Partikelfält i three.js** — 15 000 partiklar (7 000 på mobil) som morfar mellan sju former:
  galax, dokumentlager, torusknut, kubgitter, våg, blob och ring — en per sektion, med
  scrollstyrd rotation och musparallax
- **Kommandopalett** — `Ctrl+K` med fuzzy-sök: navigera, växla språk/tema, kopiera e-post
- **Tvåspråkig** — svenska/engelska, sparas i `localStorage`
- **Ljust/mörkt tema** — partikelrenderingen byter blandningsläge per tema
- **Kortkommandon** — `1`–`5` hoppar till projekt, `T` tema, `L` språk, `?` hjälp
- **Custom cursor**, scrollprogress, sektionspricknav med tooltips, marquee
- **Tillgängligt** — respekterar `prefers-reduced-motion`, fungerar utan pekdon, semantisk HTML
- Ett litet easter egg för den som minns gamla tiders fuskkoder

## Teknik

Vite · TypeScript · three.js — inga ramverk, inga cookies, ingen spårning.

## Utveckling

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typkoll + produktionsbygge till dist/
```

## Deploy

Byggs och publiceras till GitHub Pages via `.github/workflows/deploy.yml` vid push till `main`.
