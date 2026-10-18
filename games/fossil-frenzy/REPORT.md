# REPORT — Fossil Frenzy (one rule set), 1,000 bot games per row

Reproduce: `npm run simulate -- --games 1000` from the repo root (about 20 s; deterministic — seeds are fixed). Raw numbers: `tools/results.json`; the tables below are `tools/tables.md` verbatim.

Rules simulated: 31 fossils on a hexagon, no pieces; a turn is *peek then flip* or *bank one set* (scored at the number on its fossil, gem 16, plus a d6 chain of +1 per 6); up to 4 players. A bot's **memory** is the chance it remembers each revealed fossil (permanently); unless stated, bots bank as soon as they hold a set. "Level" rows use the campaign levels' own settings from the data block (memory *and* banking habits). ± values are 95% confidence half-widths. See `DECISIONS.md` (Bots and Simulation sections) for the bot and metric definitions. (The earlier comparison of the two retired rule sets is in `docs/archive/REPORT-on-vs-off.md`.)

## Findings

**1. Game length: about 42 turns whatever the player count.** Four bots at 0.90 memory: 41.6 turns (10.4 rounds each), 10th–90th percentile 39–44. Two and three players take 40.8 and 41.5 turns (Table 2): the limit is finding the 15 matches, so rounds per player scale as 1/players. Memory matters for length: everyone at 0.5 takes 46.8 turns, at 1.0, 40.9 (Table 8).

**2. Scores are well spread, and ties are rare.** Mean score 18.4 per player, winner 26.8; within-game SD 6.2 (coefficient of variation 0.34); the winner leads second place by 6.6 points (25% of the winner's score). 6.3% of games tie on score and 1.3% stay tied through every tie-break. Bots lose only 2.6 points per game to unbanked sets, because banking is available on any turn.

**3. The early leader wins about twice as often as chance.** After half the game's turns the leader (a tied lead shares credit) goes on to win 42.7% of four-player games (fair share 25%); after three quarters, 59.2%; after a quarter, 32.8%. By player count (Table 2) a half-time lead wins 64.2% with 2 players (fair 50%), 49.5% with 3 (fair 33.3%). A lead is hard to overturn because most matches are made in the middle of the game and the leader has already banked theirs.

**4. Memory skill matters a lot — until the players are all good.** Four players of very different memory (Table 3): the best (1.00) wins 50.2% — twice the 25% fair share — and the worst (0.30) wins 4.3%; the Spearman correlation between a seat's memory and its final score is 0.55. One perfect-memory player against three 0.70 players wins 42.4% (Table 5). Among players at the memory levels of Beginner to Master (Table 4) the effect is much milder: win share runs from 17.3% to 32.8% and the correlation drops to 0.14 — near-perfect memory does not make the top level unbeatable.

**5. Turn order: a small first-seat edge.** Four players: 26.7 / 24.8 / 23.1 / 25.5% by turn order (fair 25%, ±2.7%). Two players: 54.1% for whoever starts (±3.1%) — slightly more than fair, and relevant to the campaign, where the die decides who starts.

**6. The campaign ladder rises, unevenly.** Each level beats every easier one more often than not (Table 6), but the first three are close: Beginner, Novice and Normal are within a few points of each other head-to-head (Normal beats Beginner 56.5%, Novice beats Beginner 54.2%, and Beginner–Novice is a coin flip within the noise). The real steps come at the top: Master beats Beginner 62.1% and Challenging 51.3%. Against a human-proxy (Table 7): a perfect-memory player beats Beginner outright 62.5% of the time and Master 47.9%; a player who forgets half of what they see beats Beginner 26.4% and Master 16.7% of the time. So **every level is beatable by a strong player, and the early levels are not much easier than the late ones for a weaker player**. If a gentler start is wanted, the data block's `memory` values for Beginner and Novice are the lever (for example 0.5 and 0.65 instead of 0.80 and 0.85).

## Caveats
- Bots are simple heuristics (DECISIONS, Bots section): they do not plan against the end of the game and do not model opponents. Absolute numbers are bot behaviour, not human behaviour. A human forgets positions as well as values and gets tired; this model treats all of that as one coin.
- The "human proxy" in Table 7 is a bot of the given memory banking promptly. A real person will play differently, so treat Table 7 as an ordering of difficulty, not a promise of a win rate.
- Campaign levels also differ in banking habits (from the design summary): they bank once holding three sets, and plan for the end of the game at different points (never for Beginner, with 2 / 6 / 4 / 4 fossils left for Novice to Master). The difference between levels in Table 6 is memory *and* those habits together.
- ± values are normal-approximation intervals; the head-to-head cells are 1,000 games each, so differences under about 4 points are noise.

## Table 1 — 4 players, everyone at memory 0.90, 1000 games

| metric | value |
|---|---|
| turns per game (mean / median) | 41.6 / 42 |
| turns per game (10th–90th pct) | 39–44 |
| rounds per player | 10.4 |
| mean final score per player / mean winning score | 18.4 / 26.8 |
| score SD within a game / range (max − min) | 6.2 / 16.0 |
| coefficient of variation within a game | 0.34 |
| mean winning margin (1st − 2nd), and as % of winner's score | 6.6, 24.6% |
| games with a tie on score / a shared win after every tie-break | 6.3% / 1.3% |
| points lost at the end in unbanked sets (mean) | 2.6 |
| leader at 25% of the game: someone has scored / a sole leader exists | 97.8% / 92.5% |
| leader at 25%: win rate counting tied leaders (credit shared) | 32.8% ±2.9% |
| leader at 50% of the game: someone has scored / a sole leader exists | 100.0% / 91.1% |
| leader at 50%: win rate counting tied leaders (credit shared) | 42.7% ±3.1% |
| leader at 75% of the game: someone has scored / a sole leader exists | 100.0% / 94.3% |
| leader at 75%: win rate counting tied leaders (credit shared) | 59.2% ±3.0% |
| win share by turn order (1st / 2nd / 3rd / 4th) | 26.7% / 24.8% / 23.1% / 25.5% |

Fair win share with 4 players is 25.0%; the 95% half-width of a win share over 1000 games is about ±2.7%.

## Table 2 — game length and early leader by player count (everyone at memory 0.90)

| players | turns | rounds/player | leader at 50% goes on to win (fair share) | win share by turn order |
|---|---|---|---|---|
| 2 | 40.8 | 20.4 | 64.2% (50.0%) | 54.1% / 45.9% |
| 3 | 41.5 | 13.8 | 49.5% (33.3%) | 35.1% / 31.1% / 33.8% |
| 4 | 41.6 | 10.4 | 42.7% (25.0%) | 26.7% / 24.8% / 23.1% / 25.5% |

## Table 3 — memory skill: four players of very different memory (0.30 / 0.55 / 0.80 / 1.00), random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.3 | 4.3% ±1.3% | 11.0 | 3.33 |
| 0.55 | 12.6% ±2.1% | 16.1 | 2.69 |
| 0.8 | 33.0% ±2.9% | 21.3 | 2.04 |
| 1 | 50.2% ±3.1% | 24.2 | 1.74 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.55.

## Table 4 — memory skill: the memory of Beginner / Normal / Challenging / Master, random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.8 | 17.3% ±2.3% | 16.7 | 2.69 |
| 0.9 | 24.6% ±2.7% | 18.2 | 2.46 |
| 0.965 | 25.4% ±2.7% | 18.7 | 2.40 |
| 0.99 | 32.8% ±2.9% | 19.8 | 2.26 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.14.

## Table 5 — one player of memory m against three players at 0.70 (fair share 25%)

| focal memory | win share | mean score |
|---|---|---|
| 0.3 | 5.3% ±1.4% | 11.2 |
| 0.5 | 14.2% ±2.2% | 15.3 |
| 0.7 | 26.0% ±2.7% | 18.3 |
| 0.9 | 37.0% ±3.0% | 20.7 |
| 1 | 42.4% ±3.1% | 22.0 |

## Table 6 — the campaign ladder: each level against each other level (2 players, row beats column this often; a draw counts half)

| | Beginner | Novice | Normal | Challenging | Master |
|---|---|---|---|---|---|
| **Beginner** | — | 50.3% | 44.6% | 37.5% | 36.4% |
| **Novice** | 54.2% | — | 49.2% | 44.2% | 42.7% |
| **Normal** | 56.5% | 51.8% | — | 40.2% | 38.7% |
| **Challenging** | 60.2% | 55.6% | 56.8% | — | 47.6% |
| **Master** | 62.1% | 57.1% | 58.3% | 51.3% | — |

## Table 7 — how hard is each level? Win rate of a player of a given memory (banking promptly) against each level

| level | player memory 0.5 | player memory 0.7 | player memory 0.9 | player memory 1 |
|---|---|---|---|---|
| Beginner | 26.4% | 41.9% | 56.7% | 62.5% |
| Novice | 23.3% | 40.1% | 55.9% | 60.9% |
| Normal | 23.5% | 35.7% | 50.7% | 56.4% |
| Challenging | 16.8% | 32.0% | 45.8% | 49.9% |
| Master | 16.7% | 31.0% | 43.7% | 47.9% |

Outright wins only, since the campaign counts only an outright win as a defeat (a draw leaves the level locked).

## Table 8 — everyone has the same memory (4 players)

| memory | turns | leader at 50% goes on to win |
|---|---|---|
| 1 | 40.9 | 45.2% |
| 0.5 | 46.8 | 44.3% |
| 0.7 | 43.7 | 45.4% |
| 0.9 | 41.6 | 42.7% |
