# Fossil Frenzy — project rules

## Hard rules
1. **Single HTML file** (`index.html`), playable by touch on an iPad in Safari. No build step, no runtime dependencies, no network needed. Plain JavaScript.
2. **All rules, point values, and board setup live in one data block** (`<script id="data">`, the `GAME_DATA` object) — separate from the logic (`engine`, `bots`, `ui` scripts). Logic must not hard-code a rule number that belongs in the data block.
3. **Automated tests for every rule**, in `tests/`. Run `npm test` after every change and fix failures before committing.
4. **Deployment is automatic**: pushing `main` runs `.github/workflows/ci.yml` (tests, then GitHub Pages deploy of `index.html`). Don't break the single-file deploy.
5. **Commit after each working change** with a short message. Work is committed straight to `main` (owner's instruction).

## Source of truth
- `rulebook.md` — the original game (movement/delivery system **ON**).
- `docs/design-summary.md` — Patrick's redesign (movement/delivery system **OFF**: peek-and-flip or bank) and his UI philosophy.
- `GAME_DATA.movementDeliverySystem` is the master toggle: `true` = rulebook, `false` = redesign.
- `DECISIONS.md` — every ambiguous call. When a rule is unclear: choose the most sensible reading, log it there, keep going.

## Layout
- `index.html` — scripts in order: `data`, `engine` (pure rules, no DOM), `bots`, `ui`.
- `tests/` — `node --test tests/` (Node ≥ 20). `tests/load.js` extracts the data/engine/bots scripts from `index.html` and runs them in a `vm` context. `tests/ui.test.js` is a Playwright smoke test (skipped if Playwright/Chromium is unavailable).
- `tools/simulate.js` — bot simulations; `REPORT.md` is its output.

## UI philosophy (from the owner — "the Tabletop Test")
- The table is the UI: tap tiles, pieces and piles like physical components. No verb buttons ("Deliver"), no dropdowns, no modals for game actions. System chrome (help, new game) stays small and quiet.
- Minimum taps; nothing advances on a timer; the player owns pacing (End turn / Start turn).
- Concealed tiles deep umber, public tiles bright; flips get a ring (ring only) in the flipper's colour.
- Page is locked: no scrolling or rubber-banding (the help panel scrolls internally). Taps register instantly.
- Any judgment call is listed in the in-game How to Play panel and in `DECISIONS.md`.
- Information discipline: bots receive a public view of the game (`Engine.publicView`) — never hidden tile values.
