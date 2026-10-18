# Changelog

## Unreleased
- **Playtest round 2 (Fossil Frenzy):** no more "Who goes first?" screen — the order is random and a card names whose turn it is before they tap (every turn in Pass & Play). **Scores are big** across the top, the current player lit up. **Opponents' turns are animated** one move at a time: a peek (the fossil lifts and tilts, the number stays hidden), then the flip; tap to skip ahead. **Two gems:** tapping a third fossil is enough — no need to tap your own gem first. **Banking ends your turn** immediately. A **☰ menu** replaces the ? and ↺ buttons: How to play, Retry (asks first, then restarts at once with the same players/level) and Back to the start.
- **The app is the Tabletop Library** (renamed; Fossil Frenzy remains the name of the game inside it): package, Cloudflare config (`tabletop-library`), links in the docs and the game's browser-storage keys now use the new name. **Saved games and campaign progress made under the old name are discarded.** The live address is now `https://tabletop-library.patrickhockberger.workers.dev/` (a new Cloudflare project named `tabletop-library`); the GitHub repository keeps its old name on purpose. `docs/PLAN.md` lists every place the name lives.
- **Fossil Frenzy is now one rule set** (owner decision). The original rulebook mode — movement, pieces, corner delivery sites — and the "movement & delivery" toggle are gone. A turn is: first tap a private peek, second tap a public flip; or bank one set.
- **Pass & Play for 2–4 people** (humans only) **or Campaign**: five opponents — Beginner, Novice, Normal, Challenging, Master — shown by name only (no percentages). Only Beginner is open at first; the others are greyed out with a lock. Win outright to unlock the next; progress is remembered on the device. `?unlock` on the address opens every level for testing.
- The game's address and saved games: a game saved by an earlier version is cleared with a quiet note (the rules changed); campaign progress starts fresh.
- **Library:** the designer is credited once, at the top — "Games designed by Patrick Blim-Hockberger" — not under each game.
- REPORT.md rewritten for the single rule set and now includes how hard each campaign level is; the old two-rule-set comparison is archived in `games/fossil-frenzy/docs/archive/`.
- **Quieter prompts:** the line of instructions above the board shows until a device has finished one game, then goes quiet; Auto / On / Off in the help panel.
- **End screen:** each player's fossils laid out face up with their score and the winner marked, instead of a stats table. Undelivered/unbanked sets show dimmed and struck through.
- **Save and resume (Fossil Frenzy):** a game in progress is saved after every action and resumes after a reload — mid-turn, mid-peek, or with a bot's turn on the board. A save made under different rules (after an update that changes the rules) is cleared with a quiet note instead of resuming wrongly. A finished game or "new game" clears the save.
- **Tabletop Library:** a front page with a shelf of game boxes; Fossil Frenzy moved to `games/fossil-frenzy/` and links back to the library. **Fossil Frenzy's address changes** to `…/games/fossil-frenzy/`; the site's root is now the library. Dig Dig Boom has a placeholder entry, off the shelf until it has an address.
- **Redesign mode (owner feedback):** a bank takes ONE set of your choice and scores the number on its fossil (gem 16), then the d6 bonus chain. Previously every held set scored 1 point at once.
- **Bot turns show their work:** a dashed ring marks the space a bot peeked at (number hidden), a solid ring the space it flipped, and a match stays face up until the next tap.
- Bots bank as soon as they hold a set; REPORT.md re-run (the two rule sets now play very similarly on every measure).
- Build stamp: each deployed copy shows its commit, date and branch (setup screen and How to play).
- Deploys are gated by the tests: `npm run build` runs `npm test` first.
- `docs/PLAN.md`: the plan for the collection, code practices and tabletop design rules.

## Fossil Frenzy v0.1.0 — 2026-10-18 (commit `4d78deb`)
First playable release.
- Hot-seat play for 2–6 players on one screen, touch-first for iPad.
- Two rule sets from one toggle: the original rulebook (movement and delivery) and Patrick's redesign (peek, flip, bank).
- Bots with adjustable memory (Beginner–Master presets).
- 104 automated tests, 1,000-game bot simulations (`REPORT.md`), every judgment call in `DECISIONS.md`.
- Hosted on Cloudflare: `main` is live, every branch gets a preview link.
