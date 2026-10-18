# Changelog

## Unreleased
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
