# Tabletop Library

Patrick Hockberger's tabletop game designs, adapted as browser games you can play on one shared screen (built for an iPad in Safari). The front page is a shelf of game boxes; tap one to play.

- **Library:** `index.html` — open it in a browser, no install, works offline.
- **Games:** `games/<name>/index.html`, each one a single self-contained file that also works on its own.
  - **Fossil Frenzy** (`games/fossil-frenzy/`) — a fast memory game for 2–6: match fossils, deliver them, outwit your rivals. Bots with adjustable memory can fill any seat.
- **Dig Dig Boom** (the flagship) is a separate site; the library links to it once it has an address.

**Deployment:** hosted on Cloudflare (Workers Builds, static assets), connected to this repo.
- **Live:** `https://fossil-frenzy.patrickhockberger.workers.dev/` is the library; Fossil Frenzy is at `…/games/fossil-frenzy/`. It changes only when `main` changes.
- **Dev (preview):** every other branch is built as a preview, so a change can be tried on an iPad before it goes live (the branch `claude/peaceful-bardeen-fvc0jn` → `https://claude-peaceful-bardeen-fvc0jn-fossil-frenzy.patrickhockberger.workers.dev/`).
- Build command `npm run build` (runs the tests, then copies the library page and each game into `_site/`, stamped with commit · date · branch — shown quietly at the bottom of each page), deploy command `npx wrangler deploy`, config in `wrangler.jsonc`. `.github/workflows/ci.yml` only runs the tests.
- On an iPad, Safari → Share → *Add to Home Screen* on the library page gives a full-screen app.

## Fossil Frenzy: two rule sets (one toggle)
`GAME_DATA.movementDeliverySystem` in the data block at the top of `games/fossil-frenzy/index.html` (also switchable on the setup screen):

| | **On** — the original rulebook ([rulebook](games/fossil-frenzy/rulebook.md)) | **Off** — Patrick's redesign ([design summary](games/fossil-frenzy/docs/design-summary.md)) |
|---|---|---|
| Board | 37 spaces: 31 fossils + 6 corner research sites | 31 spaces, all fossils |
| Turn | move 0–3 (push rivals), peek the fossil you stand on, flip another, match — or deliver | peek any fossil, flip another, match — or bank |
| Scoring | delivered fossils at face value (gem 16) | bank ONE set per turn: the number on its fossil (gem 16) + d6 bonus chain |

## Files
- `index.html` — the library page; its data block is the catalogue of games.
- `games/fossil-frenzy/` — the game (`index.html`), `rulebook.md`, `docs/design-summary.md`, `DECISIONS.md` (every ambiguous rule and how it was resolved), `REPORT.md` (1,000-game bot simulations per mode), `tests/`, `tools/simulate.js`.
- `tests/` — library and build tests. `npm test` runs everything (Node ≥ 20; browser tests need Playwright and are skipped without it).
- `tools/build.js`, `wrangler.jsonc`, `.github/workflows/ci.yml` — build and deploy.
- `CLAUDE.md` — project rules for working on the code. `docs/PLAN.md` — the roadmap. `CHANGELOG.md` — what changed.
