# PLAN — the collection, how it's built, how games are adapted

The working plan for turning Patrick's tabletop designs into a collection of browser games. Future sessions: read this with `CLAUDE.md` before starting work. Status marks: ✅ done · 🔜 next · ⬜ later.

## 1. The collection (inspired by UFO 50)

- **One site, one repo, called the Tabletop Library.** The front page (`index.html`) is a shelf of game boxes — tap a box to open the game. Each game lives in `games/<id>/` and plays as its own single self-contained HTML file; the catalogue is a data block in the library page, and a test fails if the folders and the catalogue disagree. ✅
- **Dig Dig Boom is separate** — the flagship gets its own repo, Cloudflare project and release cadence, free of the single-file rule. The library has a placeholder entry (off the shelf) ready to link out to it by `url`. 🔜 needs its web address
- **What to borrow from UFO 50:** one shared visual and control language with a distinct identity per game; per-game saves; two goals per game — one for beating it, one for mastering it (the design summary's AI tier ladder fits the second); a library that remembers what you've played (a quiet "Played" tag is in; saves come with save/resume). ◐
- **Unlisted games:** `listed: false` keeps a prototype off the shelf while its link still works for testers (not secret — just not listed). ✅
- Decided: the collection is the **Tabletop Library** (working name — easy to change in one place). Open: which game comes second; Dig Dig Boom's web address.

## 2. How it's coded

### Per-game skeleton ✅ (Fossil Frenzy is the template)
Rulebook → one **data block** with every rule and number (variants are toggles) → pure **engine** → **bots** that see only public information → touch **UI** → a **test for every rule** → **bot simulations** that answer design questions (`REPORT.md`) → **`DECISIONS.md`** for every judgment call. Adding a game is a repeatable job: rulebook in; game, tests and simulation report out.

### Shared code — after the third game ⬜
Extract only what has clearly repeated: dice/randomness, board geometry, the seat setup screen, bot memory, help panel with judgment calls, save/resume, test and simulation harness, and a tabletop kit (tiles, flip rings, dice, trays, pieces). Shared code lives once in the repo; the build copies it into each game, so every published game is still one file you can AirDrop.

### Version history and environments
| | | |
|---|---|---|
| History | git; every change is a commit | ✅ |
| Live site | `main` → `tabletop-library.patrick-blim-hockberger.workers.dev` = the library; games under `/games/<id>/` (friends) | ✅ |
| Dev site | every other branch → its own Cloudflare preview link (owner's iPad) | ✅ |
| Release gate | Claude merges to `main` only when the owner says so | ✅ |
| Tests gate deploys | `npm run build` runs `npm test` first; a failing test fails the Cloudflare build and the old version stays live | ✅ |
| Which build am I on? | the build stamps commit · date · branch; shown on the setup screen and in How to play | ✅ |
| Rollback | Cloudflare keeps previous versions (Deployments → rollout history); or `git revert` | ✅ |
| Release notes | `CHANGELOG.md`, each release with its commit (cloud sessions can't push git tags; the owner can add GitHub Releases if wanted) | ✅ |

### Not interrupting players mid-game ◐ (save/resume ✅ in Fossil Frenzy)
A deploy never changes a page already open. The danger is a reload — or iPad Safari silently reloading a backgrounded tab. Fossil Frenzy now saves after every action and resumes on load; a save made under different rules is cleared with a quiet note (migrating old saves is possible later if a rules change should not end games in progress). Later: an installable offline version that holds an update until the current game ends.

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
Gaps closed (this is now the template for the next game):
- ✅ Save and resume: saved after every action, resumes after a reload, refuses saves from changed rules or older versions.
- ✅ Prompts above the board were instructional narration: now shown only until a device has finished one game; Auto / On / Off in the help panel.
- ✅ The end screen was a stats table: now each player's banked fossils laid out with their score, the winner marked.
- ✅ Ring colour is not an accessibility gap (only the current player's flips are shown). A peek is a dashed ring, a flip a solid one.
- ✅ **Playtest round 2** (owner): no who-goes-first screen (random order + a turn card); big scores; the opponent's turn animated move by move (peek, then flip); a third tap after two gems is consent; banking ends the turn; a ☰ menu with rules, retry and back-to-start (see DECISIONS 33–38).
- ✅ **One rule set** (owner decision, 2026-10-18): the original movement/delivery mode and the toggle were removed; Pass & Play (2–4) and a five-level Campaign were added.

Still to consider (not started): take-backs before anything is revealed; a short guided first turn; (the turn card now doubles as a pass-the-device moment in Pass & Play); more Campaign content beyond the five levels (the owner will flesh it out); a gentler first rung of the ladder (see `games/fossil-frenzy/REPORT.md`).

## 5. Order of work
1. ✅ Cloudflare live + preview links; tests gate deploys; build stamp; changelog.
2. ✅ Save and resume in Fossil Frenzy.
3. ✅ Close the Tabletop-Test gaps above.
4. ✅ Fossil Frenzy moved into `games/fossil-frenzy/`; the Tabletop Library front page is built.
4b. ✅ Fossil Frenzy reduced to one rule set; Pass & Play and the Campaign ladder added.
5. ⬜ Game two; after game three, extract shared code.

## 6. Where the name lives
The app is the **Tabletop Library**; each game keeps its own name inside it (Fossil Frenzy is a game, not the app). Renaming the app touches:

| Where | What it controls | Who changes it |
|---|---|---|
| Library page `index.html` (`LIBRARY.name`, `<title>`, Home Screen title) | what people see | repo — done: "Tabletop Library" |
| `package.json` `name` / `description` | tooling only | repo — done |
| `wrangler.jsonc` `name` = `tabletop-library` | **the web address** (`<name>.<account>.workers.dev`, and every preview address) | repo — done; **must match the Cloudflare Worker's name** |
| The game's browser-storage keys (`tabletop-library-fossil-frenzy-*`) | saves, campaign progress, settings | repo — done (earlier `fossil-frenzy-*` data is discarded) |
| `README.md`, this file: the live and dev links | documentation | repo — done |
| Cloudflare Worker / project name | the web address friends use | **owner**, in the Cloudflare dashboard (a Worker cannot be renamed — create a new one named `tabletop-library`) |
| GitHub repository name (`fossil-frenzy`) | the code's address — only we see it | **skipped on purpose**; can be renamed any time in GitHub → Settings → General (GitHub redirects the old name) |
| iPad Home Screen icons and bookmarks | the old address | **owner**, per device |
| The game's own title (`games/<id>/index.html`) | stays the game's name | — |

