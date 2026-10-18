# Changelog

## Unreleased
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
