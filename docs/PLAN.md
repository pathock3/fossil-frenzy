# PLAN — the collection, how it's built, how games are adapted

The working plan for turning Patrick's tabletop designs into a collection of browser games. Future sessions: read this with `CLAUDE.md` before starting work. Status marks: ✅ done · 🔜 next · ⬜ later.

## 1. The collection (inspired by UFO 50)

- **One site, one repo.** The front page is a *cabinet*: a grid of game cards. Each game lives in its own folder (`/fossil-frenzy/`, …) and plays as its own single self-contained HTML file. ⬜
- **Dig Dig Boom is separate** — the flagship gets its own repo, Cloudflare project and release cadence, free of the single-file rule. The cabinet links out to it. ⬜
- **What to borrow from UFO 50:** one shared visual and control language with a distinct identity per game; per-game saves; two goals per game — one for beating it, one for mastering it (the design summary's AI tier ladder fits the second); a cabinet that remembers what you've played. ⬜
- **Unlisted games:** a flag keeps a prototype off the cabinet while its link still works for testers (not secret — just not listed). ⬜
- Open decisions (owner): the collection's name; which game comes second.

## 2. How it's coded

### Per-game skeleton ✅ (Fossil Frenzy is the template)
Rulebook → one **data block** with every rule and number (variants are toggles) → pure **engine** → **bots** that see only public information → touch **UI** → a **test for every rule** → **bot simulations** that answer design questions (`REPORT.md`) → **`DECISIONS.md`** for every judgment call. Adding a game is a repeatable job: rulebook in; game, tests and simulation report out.

### Shared code — after the third game ⬜
Extract only what has clearly repeated: dice/randomness, board geometry, the seat setup screen, bot memory, help panel with judgment calls, save/resume, test and simulation harness, and a tabletop kit (tiles, flip rings, dice, trays, pieces). Shared code lives once in the repo; the build copies it into each game, so every published game is still one file you can AirDrop.

### Version history and environments
| | | |
|---|---|---|
| History | git; every change is a commit | ✅ |
| Live site | `main` → `fossil-frenzy.patrickhockberger.workers.dev` (friends) | ✅ |
| Dev site | every other branch → its own Cloudflare preview link (owner's iPad) | ✅ |
| Release gate | Claude merges to `main` only when the owner says so | ✅ |
| Tests gate deploys | `npm run build` runs `npm test` first; a failing test fails the Cloudflare build and the old version stays live | ✅ |
| Which build am I on? | the build stamps commit · date · branch; shown on the setup screen and in How to play | ✅ |
| Rollback | Cloudflare keeps previous versions (Deployments → rollout history); or `git revert` | ✅ |
| Release notes | `CHANGELOG.md`; tags like `fossil-frenzy-v0.1.0` | ✅ |

### Not interrupting players mid-game 🔜
A deploy never changes a page already open. The danger is a reload — or iPad Safari silently reloading a backgrounded tab — which today loses the game. Plan: save the game after every action; resume on load; stamp saves with a version so an update either migrates an old save or offers to finish the game in progress. Later: an installable offline version that holds an update until the current game ends.

## 3. Design philosophy — tabletop first

These games were designed for the table, so the clearest way to teach them is to show a table.

### The Tabletop Test (owner's rules — non-negotiable)
- The table is the UI: tap the tile to flip it, tap the die to roll it. No verb buttons, menus or modal dialogs for game actions.
- Minimum taps: if a tap isn't a real decision, remove it.
- The player owns pacing: nothing advances on a timer.
- State is shown in place, on the board — no stat tables, no instructional narration.
- System chrome (help, new game) is small and quiet.
- Every judgment call is flagged in the in-game help and in `DECISIONS.md`.

### Adapting a tabletop game for a screen — practices
1. **Components look and move like components.** Flips flip, pieces slide, dice tumble — players' physical intuitions carry over.
2. **Automate bookkeeping, never decisions.** Scoring, shuffling and legal-move checks are the machine's job; choices stay with the player.
3. **Don't automate what the game is about.** In a memory game a log of revealed tiles would break it. Each game lists what must stay manual.
4. **Show what the table shows; hide what it hides.** Hidden information on a shared screen is the hardest problem — honour-system peeks today; a pass-the-device screen where a game needs it.
5. **Quiet legal-move highlights** replace rules lookups without narrating.
6. **Take-backs before anything is revealed** — the digital version of lifting your hand off a piece.
7. **Teach by playing:** a short guided first turn, not walls of text.
8. **Colour-blind safe:** player colour always paired with a number or shape.
9. **Use the digital advantage:** rule toggles and bot simulations test variants that are slow to test at a table.

## 4. Fossil Frenzy against this plan
Gaps to close before it becomes the template for every game:
- 🔜 Save and resume (section 2).
- 🔜 The hint line above the board is instructional narration.
- 🔜 The end screen is a stats table.
- 🔜 Flip rings are colour-only (no number or shape).

## 5. Order of work
1. ✅ Cloudflare live + preview links; tests gate deploys; build stamp; changelog.
2. 🔜 Save and resume in Fossil Frenzy.
3. 🔜 Close the three Tabletop-Test gaps above.
4. ⬜ Move Fossil Frenzy into the collection layout and build the cabinet.
5. ⬜ Game two; after game three, extract shared code.
