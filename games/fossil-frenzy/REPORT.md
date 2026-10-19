# REPORT — Fossil Frenzy (one rule set), 1,000 bot games per row

Reproduce: `npm run simulate -- --games 1000` from the repo root (about 2½ minutes; deterministic — seeds are fixed). Raw numbers: `tools/results.json`; the tables below are `tools/tables.md` verbatim. How the opponents work: `docs/AI.md`.

Rules simulated: 31 fossils on a hexagon (2/3/5/6/7/9/10 and three gems worth 12), no pieces; a turn is *peek then flip* or *bank one set* (scored at the number on its fossil plus a d6 chain of +1 per 6); up to 4 players. A player is the one decision engine in the `bots` script with a **profile** of abilities (`GAME_DATA.ai`): **memory** (each turn that passes, the chance a memory is still exact; acting on it succeeds with probability memory^age, otherwise a random other spot), **valueSense**, **leadSense**, **endSense**, **setsSense**, and banking habits. "Perfect" = every ability at 1; "memory m" in a table means the perfect strategy with that memory. "Level" rows use the campaign levels' own profiles from the data block. ± values are 95% confidence half-widths. See `DECISIONS.md` (items 55–59) for what was tried and dropped.

## Findings

**1. Memory decides most games.** Four players with very different memory (Table 3): the perfect memory wins 97.2%; 0.80 wins 2.1%, 0.55 0.4%, 0.30 0.3%. Even among the memories of the campaign levels (Table 4: 0.80 / 0.90 / 0.95 / 0.99) win share runs 2.3% → 9.0% → 25.1% → 63.6%. One perfect-memory player against three at 0.70 wins 97.7% (Table 5). Memory fades with every turn that passes, so even 0.95 forgets half of what it saw 14 turns ago — the gaps between neighbouring memories are large. If a level feels too hard, `memory` is the first lever.

**2. Memory also sets how long a game lasts.** Everyone at 1.0: 40.8 turns; at 0.9: 51.6; at 0.7: 88.8; at 0.5: 124.0 (Table 8) — forgetful players waste turns on slips. Two, three and four players take about the same number of turns (49.3 / 51.0 / 51.6 at 0.90, Table 2).

**3. Scores are well spread, and ties are rare.** Four players at 0.90: mean 16.5 per player, winner 24.3; within-game SD 6.1; the winner leads second place by 5.3 points (22% of the winner's score). 7.5% of games tie on score and 0.6% stay tied through every tie-break. Unbanked sets cost 3.6 points a game.

**4. The early leader wins about twice as often as chance.** After half the game's turns the leader goes on to win 43.4% of four-player games (fair share 25%), 58.9% after three quarters, 33.0% after a quarter; with two players a half-time lead wins 58.8% (fair 50%) (Tables 1–2).

**5. There is no seat-order edge.** Four players: 24.8 / 24.7 / 26.9 / 23.6% by turn order (fair 25%, ±2.7%); two players: 50.0% / 50.0%.

**6. The campaign ladder rises steadily (Table 6).** Each level beats the one below it: Novice beats Beginner 61.8%, Normal beats Novice 61.8%, Challenging beats Normal 77.6%, Master beats Challenging 74.2%; Master beats Beginner 98.5%. All five beat the random tutorial opponent at least 96.8% of the time (Table 11). Against players of the *perfect strategy with imperfect memory* (Table 7): memory 0.9 beats Beginner 75%, Normal 51%, Master 10%; only a player who never forgets beats Master more often than not (57%). A person is not a bot, so **how hard the levels feel is for playtesting to settle** — the data block's `memory` values are the lever.

**7. What the abilities are worth (Table 9).** Against the perfect player: memory 0.8 loses 98% of games; having no sense of how long the game has left (and banking by habit) loses about 60% — so **memory first, then knowing when the game is ending**. Valuing sets by their number, watching the lead, and tracking which sets are left made **no measurable difference** against a perfect-memory opponent (52% / 48% / 46%, all within the noise of ±3%): they change *how* it plays (which sets it leaves, what it takes) more than whether it wins. Ideas that sounded right but lost in simulation are listed in `docs/AI.md` (flipping only already-public fossils, an explicit "leader rushes the end" push, searching ahead).

## Caveats
- Opponents are heuristics, calibrated bot against bot (and in particular on how fast memory fades). A human forgets differently — more by neighbouring spots and by interference than by a clean per-turn decay.
- The "human proxy" in Table 7 is the perfect strategy with a given memory. Treat it as an ordering of difficulty, not a promise of a win rate.
- ± values are normal-approximation intervals; the head-to-head cells are 1,000 games each, so differences under about 4 points are noise.

## Table 1 — 4 players, everyone at memory 0.90, 1000 games

| metric | value |
|---|---|
| turns per game (mean / median) | 51.6 / 50 |
| turns per game (10th–90th pct) | 44–60 |
| rounds per player | 12.9 |
| mean final score per player / mean winning score | 16.5 / 24.3 |
| score SD within a game / range (max − min) | 6.1 / 15.5 |
| coefficient of variation within a game | 0.37 |
| mean winning margin (1st − 2nd), and as % of winner's score | 5.3, 21.7% |
| games with a tie on score / a shared win after every tie-break | 7.5% / 0.6% |
| points lost at the end in unbanked sets (mean) | 3.6 |
| leader at 25% of the game: someone has scored / a sole leader exists | 62.5% / 60.2% |
| leader at 25%: win rate counting tied leaders (credit shared) | 33.0% ±3.7% |
| leader at 50% of the game: someone has scored / a sole leader exists | 92.4% / 85.9% |
| leader at 50%: win rate counting tied leaders (credit shared) | 43.4% ±3.2% |
| leader at 75% of the game: someone has scored / a sole leader exists | 99.8% / 92.5% |
| leader at 75%: win rate counting tied leaders (credit shared) | 58.9% ±3.1% |
| win share by turn order (1st / 2nd / 3rd / 4th) | 24.8% / 24.7% / 26.9% / 23.6% |

Fair win share with 4 players is 25.0%; the 95% half-width of a win share over 1000 games is about ±2.7%.

## Table 2 — game length and early leader by player count (everyone at memory 0.90)

| players | turns | rounds/player | leader at 50% goes on to win (fair share) | win share by turn order |
|---|---|---|---|---|
| 2 | 49.3 | 24.6 | 58.8% (50.0%) | 50.0% / 50.0% |
| 3 | 51.0 | 17.0 | 47.5% (33.3%) | 33.8% / 32.1% / 34.2% |
| 4 | 51.6 | 12.9 | 43.4% (25.0%) | 24.8% / 24.7% / 26.9% / 23.6% |

## Table 3 — memory skill: four players of very different memory (0.30 / 0.55 / 0.80 / 1.00), random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.3 | 0.3% ±0.3% | 6.4 | 3.19 |
| 0.55 | 0.4% ±0.4% | 7.1 | 3.11 |
| 0.8 | 2.1% ±0.9% | 11.9 | 2.52 |
| 1 | 97.2% ±1.0% | 32.2 | 1.03 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.73.

## Table 4 — memory skill: the memory of Beginner / Normal / Challenging / Master, random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.8 | 2.3% ±0.9% | 8.2 | 3.48 |
| 0.9 | 9.0% ±1.8% | 14.0 | 2.76 |
| 0.95 | 25.1% ±2.7% | 19.1 | 2.12 |
| 0.99 | 63.6% ±3.0% | 24.2 | 1.49 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.67.

## Table 5 — one player of memory m against three players at 0.70 (fair share 25%)

| focal memory | win share | mean score |
|---|---|---|
| 0.3 | 8.3% ±1.7% | 11.2 |
| 0.5 | 13.4% ±2.1% | 12.6 |
| 0.7 | 27.1% ±2.8% | 16.2 |
| 0.9 | 70.3% ±2.8% | 24.1 |
| 1 | 97.7% ±0.9% | 30.9 |

## Table 6 — the campaign ladder: each level against each other level (2 players, row beats column this often; a draw counts half)

| | Beginner | Novice | Normal | Challenging | Master |
|---|---|---|---|---|---|
| **Beginner** | — | 36.9% | 25.4% | 6.3% | 1.9% |
| **Novice** | 61.8% | — | 36.7% | 11.0% | 3.0% |
| **Normal** | 72.0% | 61.8% | — | 23.7% | 10.1% |
| **Challenging** | 93.6% | 88.3% | 77.6% | — | 24.9% |
| **Master** | 98.5% | 96.3% | 90.4% | 74.2% | — |

## Table 7 — how hard is each level? Win rate of the perfect strategy at a given memory against each level

| level | player memory 0.5 | player memory 0.7 | player memory 0.9 | player memory 1 |
|---|---|---|---|---|
| Beginner | 7.1% | 21.3% | 75.4% | 98.1% |
| Novice | 3.9% | 13.4% | 63.8% | 97.5% |
| Normal | 3.8% | 10.5% | 50.5% | 92.5% |
| Challenging | 0.9% | 2.3% | 25.6% | 78.8% |
| Master | 0.1% | 0.9% | 10.1% | 57.4% |

Outright wins only, since the campaign counts only an outright win as a defeat (a draw leaves the level locked).

## Table 9 — what each ability is worth: the perfect player against itself with one ability taken away (2 players; the perfect player wins this often, a draw counts half)

| the other player lacks… | perfect player wins |
|---|---|
| memory 0.8 (instead of perfect) | 98.3% ±0.8% |
| no feel for set values (valueSense 0) | 52.0% ±3.1% |
| no eye on the win (leadSense 0) | 48.2% ±3.1% |
| no sense of the game ending (endSense 0, banks at 3 sets) | 59.7% ±3.0% |
| does not track which sets are left (setsSense 0) | 46.2% ±3.1% |
| all of those (memory 0.8, every sense 0, banks at 3 sets) | 98.1% ±0.8% |

## Table 10 — the five campaign opponents' settings

| level | memory | valueSense | leadSense | endSense | setsSense | bank habit |
|---|---|---|---|---|---|---|
| Beginner | 0.8 | 0 | 0 | 0 | 0 | at 3 sets |
| Novice | 0.85 | 0.4 | 0 | 0 | 0 | at 3 sets, and when ≤ 4 fossils left |
| Normal | 0.9 | 0.8 | 0.3 | 0.5 | 1 | none |
| Challenging | 0.95 | 1 | 0.7 | 0.8 | 1 | none |
| Master | 0.99 | 1 | 1 | 1 | 1 | none |

Senses run from 0 (none) to 1 (perfect); memory is the chance a remembered fact is still recalled exactly, per turn that passes (see `docs/AI.md`).

## Table 11 — the tutorial opponent (plays at random): how often each campaign level beats it (2 players)

| level | wins |
|---|---|
| Beginner | 96.8% |
| Novice | 98.4% |
| Normal | 99.0% |
| Challenging | 99.5% |
| Master | 99.9% |

## Table 8 — everyone has the same memory (4 players)

| memory | turns | leader at 50% goes on to win |
|---|---|---|
| 1 | 40.8 | 45.4% |
| 0.5 | 124.0 | 50.5% |
| 0.7 | 88.8 | 44.4% |
| 0.9 | 51.6 | 43.4% |

