# Changelog

## Unreleased
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
