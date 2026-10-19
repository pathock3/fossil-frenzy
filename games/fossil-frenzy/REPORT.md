# REPORT — Fossil Frenzy (one rule set), 1,000 bot games per row

Reproduce: `npm run simulate -- --games 1000` from the repo root (about 4 minutes; deterministic — seeds are fixed). Raw numbers: `tools/results.json`; the tables below are `tools/tables.md` verbatim. How the opponents work: `docs/AI.md`.

Rules simulated: 31 fossils on a hexagon (2/3/5/6/7/9/10 and three gems worth 12), no pieces; a turn is *peek then flip* or *bank one set* (scored at the number on its fossil plus a d6 chain of +1 per 6); up to 4 players. A player is the one decision engine in the `bots` script with a **profile** (`GAME_DATA.ai`): **memory** (each turn that passes, the chance a memory is still exact; acting on it succeeds with probability memory^age, otherwise a random other spot), **overconfidence**, **valueSense**, **leadSense**, **endSense**, **setsSense**, **gemSense** (skills scored 0–10), a **mistakes** rate (the chance of a random move), and banking habits. "Perfect" = memory 1, no mistakes, every skill 10; "memory m" in a table means the perfect player with that memory. "Level" rows use the campaign levels' own profiles. ± values are 95% confidence half-widths. See `DECISIONS.md` (items 55–60) for what was tried and dropped.

## Findings

**1. Memory decides most games.** Four players with very different memory (Table 3): the perfect memory wins 97.5%; 0.80 wins 1.8%, 0.55 0.4%, 0.30 0.4%. Among the memories of the five levels (Table 4: 0.70 / 0.84 / 0.89 / 0.94) win share runs 2.5% → 9.2% → 24.2% → 64.1%. Memory fades with every turn that passes, so the gaps between neighbouring memories are large. If a level feels too hard or easy, `memory` is the first lever — a steep one.

**2. Memory also sets how long a game lasts.** Everyone at 1.0: 40.9 turns; at 0.9: 52.1; at 0.7: 88.9; at 0.5: 130.7 (Table 8) — forgetful players waste turns on slips. Two, three and four players take about the same number of turns (51.8 / 52.1 / 52.1 at 0.90, Table 2).

**3. Scores are well spread, and ties are rare.** Four players at 0.90: mean 17.3 per player, winner 26.2; the winner leads second place by 6.8 points (26% of the winner's score). 6.0% of games tie on score and 0.9% stay tied through every tie-break. Unbanked sets cost 2.5 points a game.

**4. The early leader is hard to catch.** At half-time the leader goes on to win 50.3% of four-player games (fair share 25%), 66.4% after three quarters; with two players a half-time lead wins 74.1% (fair 50%) (Tables 1–2).

**5. There is no seat-order edge.** Four players: 24.2 / 25.7 / 25.0 / 25.1% by turn order; two players: 50.7% / 49.3%.

**6. The campaign ladder rises steadily (Table 6).** Each level beats the one below it — Novice beats Beginner 66.0%, Normal beats Novice 71.5%, Challenging beats Normal 73.7%, Master beats Challenging 74.9% — and Master beats Beginner 98.3%. Even Beginner beats the random tutorial opponent 87.1% of the time (Table 11). Against the perfect strategy with imperfect memory (Table 7): memory 0.7 beats Beginner 62.8%, Novice 45%, Normal 25%, Master 2.7%; memory 0.9 beats Beginner 95%, Normal 79%, Master 29%; only a player who never forgets beats Master more often than not (82%). **How hard the levels feel to a person is for playtesting to settle**; the first level was made easy on purpose.

**7. What each ability is worth (Table 9).** Against the perfect player: memory 0.8 loses about 97% of games (being overconfident about it changes little: 97.6%); **always going for the third gem loses 67%** — giving away two gems' positions is a real mistake; having no sense of how long the game has left loses 56%; a 10% mistake rate loses 57% and a 25% rate loses 76%. Valuing sets by their number, watching the lead and tracking which sets are left made **no measurable difference** against a perfect-memory opponent (50.7% / 48.1% / 51.1%, within the ±3% noise): they change *how* it plays more than whether it wins. The **mistake rate is a much gentler dial than memory** (10% ≈ 57%, 25% ≈ 76%, against memory 0.8 ≈ 97%), which makes it good for fine-tuning a level.

## Caveats
- Opponents are heuristics, calibrated bot against bot (and in particular on how fast memory fades). A human forgets differently — more by neighbouring spots and by interference than by a clean per-turn decay.
- The "human proxy" in Table 7 is the perfect player with a given memory. Treat it as an ordering of difficulty, not a promise of a win rate.
- ± values are normal-approximation intervals; the head-to-head cells are 1,000 games each, so differences under about 4 points are noise.

## Table 1 — 4 players, everyone at memory 0.90, 1000 games

| metric | value |
|---|---|
| turns per game (mean / median) | 52.1 / 51 |
| turns per game (10th–90th pct) | 45–61 |
| rounds per player | 13.0 |
| mean final score per player / mean winning score | 17.3 / 26.2 |
| score SD within a game / range (max − min) | 6.7 / 17.2 |
| coefficient of variation within a game | 0.39 |
| mean winning margin (1st − 2nd), and as % of winner's score | 6.8, 25.8% |
| games with a tie on score / a shared win after every tie-break | 6.0% / 0.9% |
| points lost at the end in unbanked sets (mean) | 2.5 |
| leader at 25% of the game: someone has scored / a sole leader exists | 97.8% / 91.1% |
| leader at 25%: win rate counting tied leaders (credit shared) | 40.6% ±3.1% |
| leader at 50% of the game: someone has scored / a sole leader exists | 100.0% / 91.7% |
| leader at 50%: win rate counting tied leaders (credit shared) | 50.3% ±3.1% |
| leader at 75% of the game: someone has scored / a sole leader exists | 100.0% / 92.8% |
| leader at 75%: win rate counting tied leaders (credit shared) | 66.4% ±2.9% |
| win share by turn order (1st / 2nd / 3rd / 4th) | 24.2% / 25.7% / 25.0% / 25.1% |

Fair win share with 4 players is 25.0%; the 95% half-width of a win share over 1000 games is about ±2.7%.

## Table 2 — game length and early leader by player count (everyone at memory 0.90)

| players | turns | rounds/player | leader at 50% goes on to win (fair share) | win share by turn order |
|---|---|---|---|---|
| 2 | 51.8 | 25.9 | 74.1% (50.0%) | 50.7% / 49.3% |
| 3 | 52.1 | 17.4 | 60.3% (33.3%) | 34.5% / 28.5% / 36.9% |
| 4 | 52.1 | 13.0 | 50.3% (25.0%) | 24.2% / 25.7% / 25.0% / 25.1% |

## Table 3 — memory skill: four players of very different memory (0.30 / 0.55 / 0.80 / 1.00), random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.3 | 0.4% ±0.4% | 6.8 | 3.23 |
| 0.55 | 0.4% ±0.4% | 7.9 | 3.06 |
| 0.8 | 1.8% ±0.8% | 12.3 | 2.56 |
| 1 | 97.5% ±1.0% | 36.7 | 1.02 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.73.

## Table 4 — memory skill: the memory of Beginner / Normal / Challenging / Master, random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.7 | 2.5% ±1.0% | 8.0 | 3.48 |
| 0.84 | 9.2% ±1.8% | 14.4 | 2.73 |
| 0.89 | 24.2% ±2.7% | 19.1 | 2.15 |
| 0.94 | 64.1% ±3.0% | 26.8 | 1.48 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.66.

## Table 5 — one player of memory m against three players at 0.70 (fair share 25%)

| focal memory | win share | mean score |
|---|---|---|
| 0.3 | 5.5% ±1.4% | 10.7 |
| 0.5 | 10.0% ±1.9% | 12.7 |
| 0.7 | 27.3% ±2.8% | 17.9 |
| 0.9 | 75.4% ±2.7% | 30.2 |
| 1 | 97.4% ±1.0% | 35.1 |

## Table 6 — the campaign ladder: each level against each other level (2 players, row beats column this often; a draw counts half)

| | Beginner | Novice | Normal | Challenging | Master |
|---|---|---|---|---|---|
| **Beginner** | — | 32.6% | 14.3% | 5.5% | 1.2% |
| **Novice** | 66.0% | — | 31.0% | 12.6% | 4.6% |
| **Normal** | 82.8% | 71.5% | — | 28.7% | 11.7% |
| **Challenging** | 93.9% | 86.8% | 73.7% | — | 26.3% |
| **Master** | 98.3% | 96.3% | 89.7% | 74.9% | — |

## Table 7 — how hard is each level? Win rate of the perfect strategy at a given memory against each level

| level | player memory 0.5 | player memory 0.7 | player memory 0.9 | player memory 1 |
|---|---|---|---|---|
| Beginner | 29.0% | 62.8% | 95.1% | 99.4% |
| Novice | 17.5% | 45.0% | 88.6% | 98.1% |
| Normal | 7.7% | 24.9% | 79.2% | 97.1% |
| Challenging | 2.9% | 11.3% | 56.0% | 91.3% |
| Master | 0.5% | 2.7% | 29.0% | 82.0% |

Outright wins only, since the campaign counts only an outright win as a defeat (a draw leaves the level locked).

## Table 9 — what each ability is worth: the perfect player against itself with one ability taken away (2 players; the perfect player wins this often, a draw counts half)

| the other player lacks… | perfect player wins |
|---|---|
| memory 0.8 (instead of perfect) | 97.2% ±1.0% |
| memory 0.8, and overconfident about it (overconfidence 10) | 97.6% ±0.9% |
| no feel for set values (valueSense 0) | 50.7% ±3.1% |
| no eye on the win (leadSense 0) | 48.1% ±3.1% |
| no sense of the game ending (endSense 0, banks at 3 sets) | 55.6% ±3.1% |
| does not track which sets are left (setsSense 0) | 51.1% ±3.1% |
| always goes for the third gem (gemSense 0) | 66.7% ±2.9% |
| plays a random move 10% of the time (mistakes 0.1) | 57.2% ±3.1% |
| plays a random move 25% of the time (mistakes 0.25) | 76.2% ±2.6% |
| all of the weak settings (memory 0.8, overconfident, every skill 0, mistakes 0.2, banks at 3 sets) | 98.2% ±0.8% |

## Table 10 — the five campaign opponents' settings

| level | memory | overconfidence | valueSense | leadSense | endSense | setsSense | gemSense | mistakes | bank habit |
|---|---|---|---|---|---|---|---|---|---|
| Beginner | 0.7 | 10 | 0 | 0 | 0 | 0 | 0 | 20.0% | at 2 sets |
| Novice | 0.78 | 8 | 3 | 0 | 0 | 0 | 0 | 12.0% | at 3 sets, and when ≤ 4 fossils left |
| Normal | 0.84 | 5 | 7 | 3 | 4 | 10 | 5 | 8.0% | none |
| Challenging | 0.89 | 3 | 10 | 6 | 7 | 10 | 10 | 5.0% | none |
| Master | 0.94 | 1 | 10 | 10 | 10 | 10 | 10 | 2.0% | none |

Skills run from 0 (none) to 10 (perfect); memory is the chance a remembered fact is still recalled exactly, per turn that passes; mistakes is the chance of a random move (see `docs/AI.md`).

## Table 11 — the tutorial opponent (plays at random): how often each campaign level beats it (2 players)

| level | wins |
|---|---|
| Beginner | 87.1% |
| Novice | 94.5% |
| Normal | 98.6% |
| Challenging | 99.0% |
| Master | 99.8% |

## Table 8 — everyone has the same memory (4 players)

| memory | turns | leader at 50% goes on to win |
|---|---|---|
| 1 | 40.9 | 44.4% |
| 0.5 | 130.7 | 54.2% |
| 0.7 | 88.9 | 54.2% |
| 0.9 | 52.1 | 50.3% |

