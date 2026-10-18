# Fossil Frenzy

A fast, family memory game for 2–6 players, played hot-seat on one screen (built for an iPad in Safari). Match fossils from memory, deliver them to your research site, and out-score your friends. Bots with adjustable memory can fill any seat.

**Play:** open `index.html` in a browser — it is one self-contained file, no install, works offline.

**Deployment:** hosted on Cloudflare (Workers Builds, static assets), connected to this repo. `main` is the live game — one stable link that updates on every merge. Other branches build previews so a change can be tried on an iPad before it goes live. Build command `npm run build` (runs the tests, then copies `index.html` to `_site/` stamped with its version), deploy command `npx wrangler deploy`, config in `wrangler.jsonc`. The version shows quietly on the setup screen, so you can tell a preview from the live game. `.github/workflows/ci.yml` only runs the tests. On an iPad, Safari → Share → *Add to Home Screen* gives a full-screen app.

## Two rule sets (one toggle)
`GAME_DATA.movementDeliverySystem` in the data block at the top of `index.html` (also switchable on the setup screen):

| | **On** — the original rulebook ([rulebook.md](rulebook.md)) | **Off** — Patrick's redesign ([docs/design-summary.md](docs/design-summary.md)) |
|---|---|---|
| Board | 37 spaces: 31 fossils + 6 corner research sites | 31 spaces, all fossils |
| Turn | move 0–3 (push rivals), peek the fossil you stand on, flip another, match — or deliver | peek any fossil, flip another, match — or bank |
| Scoring | delivered fossils at face value (gem 16) | bank ONE set per turn: the number on its fossil (gem 16) + d6 bonus chain |

## Files
- `index.html` — the whole game: data block, rules engine, bots, touch UI.
- `rulebook.md`, `docs/design-summary.md` — the source rules.
- `DECISIONS.md` — every ambiguous rule and how it was resolved.
- `REPORT.md` — 1,000-game bot simulations per mode (`tools/simulate.js`).
- `tests/` — `npm test` (Node ≥ 20; browser tests need Playwright and are skipped without it).
- `CLAUDE.md` — project rules for working on the code.
- `docs/PLAN.md` — the roadmap: the collection, coding practices, tabletop design rules.
- `CHANGELOG.md` — what changed in each release.
