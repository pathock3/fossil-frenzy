# Dig Dig BOOM! v2.7 prototype — status

The owner's brief (summarised): prototype the v2.7 rules from the live Google Sheet, in four steps, pausing after each so they can test.
Cards: https://docs.google.com/spreadsheets/d/1cKcNNs38CydvvhW7rUJIc4DWHgEvT-deluLdhrIpk04 — tab "v2.7 Draft" (gid 2) = cards, tab "v2.7 Rules" (gid 3) = rules. The page fetches both every time it opens (never a copy in the repo). The older rulebook (v2.6, Drive doc "Dig Dig BOOM! Rulebook") and the components PDF are context only: where they conflict with the v2.7 Rules tab, the Rules tab wins.

| Step | What | State |
|---|---|---|
| 1 | Card design: several directions on 6 sample cards, owner picks | **Built — waiting for the owner's pick** (`index.html`, five directions A–E) |
| 2 | Print view: letter sheets of poker cards + Power line, Drill, Leaderboard | Not started (needs the Step 1 pick) |
| 3 | Playable solo Dig on iPad (Monster roll exactly per the Rules tab, log of every card's effect) | Rules engine in progress overnight (pure logic + tests); UI after the card pick |
| 4 | Full round loop: Prep, Leaderboard + Crown Jewel, hot-seat players, final round | Not started |

Working rule from the owner: if a rule is ambiguous, ask — don't guess. Unanswered questions are in `QUESTIONS.md`; the engine keeps each ambiguous point behind a named ruling in the data block so it is one line to change once answered.

Overnight plan (owner away): finish what does not depend on the card-style pick — the pure rules engine for Steps 3–4 (Monster roll, Grit/Reroll, triggers, damage, BOOM, banking, Pledge/Leaderboard, Prep) with tests; do not build the card art across the deck until a direction is chosen.
