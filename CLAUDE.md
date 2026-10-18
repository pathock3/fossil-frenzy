# Tabletop Library — project rules

A collection of Patrick Blim-Hockberger's tabletop game designs, adapted as browser games. The front page (`index.html`) is the library; each game lives in `games/<id>/`. Roadmap and design philosophy: **`docs/PLAN.md`** — read it before starting new work.

## Hard rules
1. **Every game is one self-contained `index.html`** (`games/<id>/index.html`), playable by touch on an iPad in Safari. It must work opened directly, with no runtime dependencies and no network. Plain JavaScript. The build only copies files and stamps the version.
2. **All rules, point values and board setup live in one data block** per game (`<script id="data">`) — separate from its logic (`engine`, `bots`, `ui` scripts). Logic must not hard-code a rule number that belongs in the data block. The library's catalogue (`LIBRARY` in the root `index.html`) is the same idea for the collection.
3. **Automated tests for every rule**, in each game's `tests/` (library and build tests are in the root `tests/`). Run `npm test` after every change and fix failures before committing.
4. **`main` is the live site** (friends play it). Work on a branch (`claude/peaceful-bardeen-fvc0jn` or a feature branch), push it, and the owner tests that branch's preview link on an iPad. Merge to `main` only when the owner says so.
5. **Deployment is automatic**: Cloudflare runs `npm run build` = `npm test` then `tools/build.js` (copies the library page and every `games/*/index.html` into `_site/`, stamping commit · date · branch into each `<meta name="build">`), then deploys with `wrangler.jsonc`. A failing test fails the build, so the old version stays live. `main` is production; every other branch gets a preview link. `.github/workflows/ci.yml` also runs the tests on every push. Don't break the single-file-per-game build.
6. **Commit after each working change** with a short message. Note user-visible changes in `CHANGELOG.md`.

## Layout
- `index.html` — the Tabletop Library front page; its data block lists the games. To add a game: create `games/<id>/` with `index.html` (build-stamp meta included), then add a catalogue entry. A test fails if they disagree.
- `games/<id>/` — one game: `index.html`, its rulebook/source rules, `DECISIONS.md` (every ambiguous call), `tests/`, optional `tools/` (bot simulations) and `REPORT.md`.
- `games/<id>/tests/` — `npm test` runs them all (Node ≥ 20). A game's `tests/load.js` extracts its data/engine/bots scripts from its `index.html` and runs them in Node. Browser tests use Playwright and skip themselves if it is unavailable.
- Dig Dig Boom (the flagship) is a **separate site/repo**; the library links to it by `url`.
- `tools/build.js`, `wrangler.jsonc`, `.github/workflows/ci.yml` — build and deploy.

## Fossil Frenzy (`games/fossil-frenzy/`)
- **One rule set**: peek (first tap, private) then flip (second tap, public), or bank one set; 31 fossils on a corner-less hexagon; no pieces, no movement; Pass & Play (2–4 people) or Campaign (five levels, beat each to unlock the next; levels are shown by name only, never percentages). Do not reintroduce the removed rulebook mechanics (movement, delivery, a rule-set toggle) without the owner asking.
- `docs/design-summary.md` — the redesign this game implements, plus Patrick's UI philosophy. `rulebook.md` — the original physical game (history only). The owner's later feedback overrides both; it is logged in `DECISIONS.md`.
- `DECISIONS.md` — when a rule is unclear: choose the most sensible reading, log it there, keep going.
- Scripts in `index.html`: `data` (all rules, the campaign levels), `engine` (pure rules, no DOM), `bots`, `campaign` (pure unlock logic), `ui`.

## UI philosophy (from the owner — "the Tabletop Test")
- The table is the UI: tap tiles, pieces and piles like physical components. No verb buttons ("Deliver"), no dropdowns, no modals for game actions. System chrome (help, new game) stays small and quiet.
- Minimum taps; nothing advances on a timer; the player owns pacing (End turn / Start turn).
- Concealed tiles deep umber, public tiles bright; flips get a ring (ring only) in the flipper's colour.
- Page is locked in games: no scrolling or rubber-banding (the help panel scrolls internally). Taps register instantly. (The library's shelf may scroll.)
- Any judgment call is listed in the game's in-game How to Play panel and in its `DECISIONS.md`.
- Information discipline: bots receive a public view of the game (`Engine.publicView`) — never hidden tile values.
