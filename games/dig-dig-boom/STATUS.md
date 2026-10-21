# Dig Dig BOOM! v2.7 prototype — status

The owner's brief (summarised): prototype the v2.7 rules from the live Google Sheet, in four steps, pausing after each so they can test.
Cards: https://docs.google.com/spreadsheets/d/1cKcNNs38CydvvhW7rUJIc4DWHgEvT-deluLdhrIpk04 — tab "v2.7 Draft" (gid 2) = cards, tab "v2.7 Rules" (gid 3) = rules. The page fetches both every time it opens (never a copy in the repo). The older rulebook (v2.6, Drive doc "Dig Dig BOOM! Rulebook") and the components PDF are context only: where they conflict with the v2.7 Rules tab, the Rules tab wins.

| Step | What | State |
|---|---|---|
| 1 | Card design | **Done** — Top Tab, Geode stat 3, Monster stat 1, compact art; the whole deck is on the "Cards" page |
| 2 | Print view: letter sheets of poker cards + Power line, Drill, Leaderboard | **Built** — "Print sheets" (Letter/A4, cut marks, or bleed pages for a print shop; Power line, Drill, Leaderboard, table mat, card backs) |
| 3 | Playable solo Dig on iPad (Monster roll exactly per the Rules tab, log of every card's effect) | **Built — ready to test** (the page opens on it). Every card text in the sheet is understood; 60+ rule tests |
| 4 | Full round loop: Prep, Leaderboard + Crown Jewel, hot-seat players, final round | **Single-player version built** ("Play a run"): Escape Bonus, gems, Booster Pack, Starter Kit, reset, Leaderboard (live marker, no pledging in the app), Crown Jewel, final round, an AI opponent on its own clock. Hot-seat multiplayer not started. The game saves after every tap and resumes after a reload |

Working rule from the owner: if a rule is ambiguous, ask — don't guess. Unanswered questions are in `QUESTIONS.md`; the engine keeps each ambiguous point behind a named ruling in the data block so it is one line to change once answered.

Where things stand: everything the owner asked for so far is built and pushed, and the full test suite passes. Waiting on the owner: testing on an iPad, the open questions in `QUESTIONS.md` and the go-ahead for hot-seat multiplayer (the Leaderboard engine, `Board`, already supports any number of players). Nothing else is queued, so no further overnight check-ins are scheduled.
