# Dig Dig BOOM! (v2.7) — browser prototype

One file: `index.html`. Open it directly or from the build. Hidden from the library shelf until the owner says so (`listed: false` in the root `index.html`); reach it at `games/dig-dig-boom/`.

## Where the rules live
- **The Google Sheet** (cards: tab "v2.7 Draft", rules: tab "v2.7 Rules") is the source of every card. The page fetches it each time it opens; this browser keeps the last copy for offline play (`localStorage`, never in the repo). Test fixtures are in `tests/` (`cards-full.csv`, `fixture.csv`).
- **`<script id="data">`** (`DDB`): sheet address and column names, card types and colours, and every rule number (`DDB.rules`: the d10, Health 0–10, Grit, Rerolls, caps, start values, rulings that are open questions; `DDB.run`: rounds, reward ladder, Crown start; `DDB.phrases`: the phrase book).
- **Card behaviour is read from the card text.** `DDB.phrases` lists sentence patterns; the `dig` script maps each to an effect. Change a card in the sheet and the game follows. A text the phrase book does not understand is shown as "not built yet" in the kit chooser, and `tests/dig.test.js` fails if any card of the fixture is not understood. To teach the game a new kind of sentence: add a pattern to `DDB.phrases` and handle its `op` in `Dig`.

## Scripts (in order)
`data` → `engine` (sheet reading, text fitting) → `dig` (one Dig: roll, Grit, Rerolls, triggers, damage, every effect, save/load) → `board` (Leaderboard, Crown Jewel, Pledge, dibs; any number of players) → `run` (rounds, Prep, Booster Packs, Starter Kit, Escape Bonus, save/load) → `ui` (the Top Tab card design, Cards page) → `solo` (the game screen) → `printv` (print-and-play sheets).

The engines have no DOM. State is plain data (the rng carries `.state()`/`.restore()`), so a game saves after every tap and a reload puts you back exactly where you were.

## Open rules questions
`QUESTIONS.md` — each answer is one value in `DDB.rules` (see `rulings`). `STATUS.md` has the step list.

## Tests
`node --test games/dig-dig-boom/tests/*.test.js` (browser tests need Playwright + Chromium and skip themselves otherwise).
