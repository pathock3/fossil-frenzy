# DECISIONS

Unclear rules and judgment calls, in the order they were made. The owner can overrule any of them; most are single values in the data block (`GAME_DATA` in `index.html`).

## Inputs and precedence
1. **Two inputs, two modes.** `rulebook.md` is the original game; `docs/design-summary.md` (a summary from a previous agent session) describes Patrick's redesign: no pieces, no movement, no delivery; each turn is "peek and flip" or "bank". I map them onto the requested toggle: `movementDeliverySystem: true` = rulebook, `false` = redesign. Where the two disagree, the mode being played decides. Where the task statement and the summary disagree (e.g. the summary's tiered AI with memory decay vs. the task's "remembers with a set probability"), the task statement wins.
2. **Commits go straight to `main`** as instructed, even though the session was started on a `claude/…` branch.
3. **Language: JavaScript in one HTML file.** Easiest to share (open the file, or host it on GitHub Pages) and it runs offline on an iPad.
