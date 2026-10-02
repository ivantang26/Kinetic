# PULSE 27

Website for a fictional three-day music and design festival where type is the main visual. Built from PRD 7 (Kinetic / Big typography).

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # astro build + Workbox service worker -> dist/
npm run preview   # serve dist/ (needed to test offline mode)
```

Try `/queue/?demo=10` for a 10-second on-sale countdown.

## Stack

- **Astro** static site with **Preact islands** for the schedule and ticket status.
- **GSAP + SplitText + ScrollTrigger** for the headliner letter reveal. CSS keyframes run the weight loops.
- **Workbox** (`scripts/build-sw.mjs`) precaches every page, script and font after `astro build`.
- **Fonts**: Roboto Flex is instanced down to only the `wght` 100–900 and `wdth` 50–150 axes and subset to Latin (**34 KB** WOFF2; budget was 120 KB). Inter 400 and JetBrains Mono 500 are self-hosted. All three are preloaded.

## How the kinetic type system works

| Piece | File | What it does |
| --- | --- | --- |
| Motion gate | `src/lib/motion.ts` | Calm mode (session) + `prefers-reduced-motion`. |
| Kinetic manager | `src/lib/kinetic.ts` | Only one kinetic element is active at a time (the most visible one nearest the centre). Marquees are exempt. Nothing animates below 32px. |
| Fit-text | `src/lib/fit.ts` | Sizes `[data-fit]` text to fill its box at its *widest* axis state, so hover and stretch never overflow. Measures detached clones in one batched layout pass, and refits on resize and font load. |
| Cursor type | `src/lib/reactive.ts` | Letters within 120px of the cursor gain weight. On touch, a slow wave instead. The width axis counter-moves so the word keeps its box. |
| Hero pulse | `src/components/Hero.astro` | 2s loop (one bar at 120 BPM). The width axis is solved per state, so "PULSE" stays edge to edge at every weight. |
| Day themes | `src/lib/theme.ts`, `global.css` | Colour tokens are registered `@property`s, so one attribute on `<html>` recolours the site over 400ms. |
| Sweep | `src/lib/sweep.ts` | The next page's title sweeps across in mega type (250ms out + 250ms in). |

Rest state for Calm mode and reduced motion is weight 700, width 100, no loops. The marquee becomes a static poster.

## PRD coverage

| ID | Where |
| --- | --- |
| FR-1 Variable font animation | `--wght` / `--wdth` registered properties; text sits in fixed boxes (`contain: inline-size`) |
| FR-2 Scroll letter split | `Headliners.astro`: `aria-label` on the heading, letters `aria-hidden` |
| FR-3 Marquee | `Marquee.astro`: 3 rows (2 on mobile). Pauses on hover, focus, the button and off-screen. The visual is `aria-hidden`, backed by a static list. |
| FR-4 Cursor-reactive type | `reactive.ts`, used by `MegaTitle.astro` (page titles, day bands) |
| FR-5 Day theme switching | Line-up filters, schedule day tabs, persisted for the session |
| FR-6 My PULSE | `islands/Schedule.tsx`: stars in localStorage, clash warnings, `.ics` export (`lib/ics.ts`) |
| FR-7 Offline schedule | Workbox precache. Offline navigations fall back to the schedule. |
| FR-8 Ticket status | `islands/TicketTiers.tsx`: polls every 60s while visible. Set `PUBLIC_TICKETING_API` to the partner endpoint; defaults to the static `/api/tickets.json`. |
| FR-9 Queue page | `public/queue/index.html`: 7 KB, no framework, stable random entry wave, server-clock sync. CDN headers in `public/_headers`. |
| FR-10 Calm mode | Nav toggle, stored in `sessionStorage` |

## Verified

- Every artist name, headline and the hero fits its container with no page overflow at 320, 375, 768, 1024, 1440 and 2560px. That covers all 9 pages; 438 fitted elements checked.
- Screen readers get whole words for split and marquee text.
- The schedule loads, hydrates and shows My PULSE with the server stopped (after one visit).
- Clash warnings appear for overlapping starred sets.
- Calm mode stops all kinetic type.
- Home page: **160 KB** gzipped (budget 500 KB).

**Not verified:** the 50,000-user load test. `loadtest/queue.k6.js` is ready, but at that scale it needs a distributed runner (for example `k6 cloud`).

## Notes and open questions

- **Dates:** the PRD says 12–14 June 2027, but that is Saturday to Monday, and the programme is Friday to Sunday. Every date on the site derives from `FESTIVAL.start` in `src/data/festival.ts`. Set it to `2027-06-11` to fix. The on-sale time is duplicated in `public/queue/index.html` because that page is deliberately standalone.
- **Typeface licence (PRD open question 1):** Roboto Flex is SIL Open Font License, so it is free for web use at any traffic level.
- **Talks identity (open question 2):** here the talks share the day colours.
- Regenerating fonts or press logos needs Python with `fonttools` and `brotli`. Run `python scripts/subset-fonts.py` and `python scripts/build-press-assets.py`.
