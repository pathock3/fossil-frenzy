# REPORT — Fossil Frenzy (one rule set), 1,000 bot games per row

Reproduce: `npm run simulate -- --games 1000` from the repo root (about 20 s; deterministic — seeds are fixed). Raw numbers: `tools/results.json`; the tables below are `tools/tables.md` verbatim.

Rules simulated: 31 fossils on a hexagon, no pieces; a turn is *peek then flip* or *bank one set* (scored at the number on its fossil, gem 12, plus a d6 chain; fossils 2/3/5/6/7/9/10 and gems 12 — the top two values were 10/11 and gems 16 before the playtest change of 2026-10-18 of +1 per 6); up to 4 players. A bot's **memory** is the chance it remembers each revealed fossil (permanently); unless stated, bots bank as soon as they hold a set. "Level" rows use the campaign levels' own settings from the data block (memory *and* banking habits). ± values are 95% confidence half-widths. See `DECISIONS.md` (Bots and Simulation sections) for the bot and metric definitions. (The earlier comparison of the two retired rule sets is in `docs/archive/REPORT-on-vs-off.md`.)

## Findings

**1. Game length: about 42 turns whatever the player count.** Four bots at 0.90 memory: 41.6 turns (10.4 rounds each), 10th–90th percentile 39–44. Two and three players take 40.8 and 41.5 turns (Table 2): the limit is finding the 15 matches, so rounds per player scale as 1/players. Memory matters for length: everyone at 0.5 takes 46.8 turns, at 1.0, 40.9 (Table 8).

**2. Scores are well spread, and ties are rare.** Mean score 17.3 per player, winner 24.2; within-game SD 5.3 (coefficient of variation 0.31); the winner leads second place by 5.2 points (22% of the winner's score). 6.9% of games tie on score and 1.4% stay tied through every tie-break. *Effect of the value change (10/11 → 9/10, gems 16 → 12):* scores came down and bunched up — the gap between best and worst fell from 16.0 to 13.5 points and the winning margin from 6.6 to 5.2 — so one big set swings a game less than before. Bots lose only 2.6 points per game to unbanked sets, because banking is available on any turn.

**3. The early leader wins about twice as often as chance.** After half the game's turns the leader (a tied lead shares credit) goes on to win 46.1% of four-player games (fair share 25%); after three quarters, 60.9%; after a quarter, 35.5%. By player count (Table 2) a half-time lead wins 68.5% with 2 players (fair 50%), 53.8% with 3 (fair 33.3%). *The smaller top values did not weaken the early leader's edge* (it was 42.7% / 59.2% / 32.8% before — a small rise, near the noise): that edge comes from tempo (matches made and banked early) more than from the size of the big fossils. A lead is hard to overturn because most matches are made in the middle of the game and the leader has already banked theirs.

**4. Memory skill matters a lot — until the players are all good.** Four players of very different memory (Table 3): the best (1.00) wins 52.0% — twice the 25% fair share — and the worst (0.30) wins 4.0%; the Spearman correlation between a seat's memory and its final score is 0.57. One perfect-memory player against three 0.70 players wins 43.4% (Table 5). Among players at the memory levels of Beginner to Master (Table 4) the effect is much milder: win share runs from 17.4% to 32.8% and the correlation drops to 0.14 — near-perfect memory does not make the top level unbeatable.

**5. Turn order: a small first-seat edge.** Four players: 28.5 / 24.8 / 22.8 / 23.9% by turn order (fair 25%, ±2.7%). Two players: 54.5% for whoever starts (±3.1%) — slightly more than fair, and relevant to the campaign, where the die decides who starts.

**6. The campaign ladder rises, unevenly.** Each level beats every easier one more often than not (Table 6), but the first three are close: Beginner, Novice and Normal are within a few points of each other head-to-head (Normal beats Beginner 57.7%, Novice beats Beginner 54.3%, and Novice–Normal is close to even). The real steps come at the top: Master beats Beginner 65.2% and Challenging 51.8%. Against a human-proxy (Table 7): a perfect-memory player beats Beginner outright 65.6% of the time and Master 48.9%; a player who forgets half of what they see beats Beginner 25.7% and Master 15.1% of the time. So **every level is beatable by a strong player, and the early levels are not much easier than the late ones for a weaker player**. If a gentler start is wanted, the data block's `memory` values for Beginner and Novice are the lever (for example 0.5 and 0.65 instead of 0.80 and 0.85).

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
| mean final score per player / mean winning score | 17.3 / 24.2 |
| score SD within a game / range (max − min) | 5.3 / 13.5 |
| coefficient of variation within a game | 0.31 |
| mean winning margin (1st − 2nd), and as % of winner's score | 5.2, 21.6% |
| games with a tie on score / a shared win after every tie-break | 6.9% / 1.4% |
| points lost at the end in unbanked sets (mean) | 2.6 |
| leader at 25% of the game: someone has scored / a sole leader exists | 97.8% / 92.5% |
| leader at 25%: win rate counting tied leaders (credit shared) | 35.5% ±3.0% |
| leader at 50% of the game: someone has scored / a sole leader exists | 100.0% / 90.7% |
| leader at 50%: win rate counting tied leaders (credit shared) | 46.1% ±3.1% |
| leader at 75% of the game: someone has scored / a sole leader exists | 100.0% / 93.0% |
| leader at 75%: win rate counting tied leaders (credit shared) | 60.9% ±3.0% |
| win share by turn order (1st / 2nd / 3rd / 4th) | 28.5% / 24.8% / 22.8% / 23.9% |

Fair win share with 4 players is 25.0%; the 95% half-width of a win share over 1000 games is about ±2.7%.

## Table 2 — game length and early leader by player count (everyone at memory 0.90)

| players | turns | rounds/player | leader at 50% goes on to win (fair share) | win share by turn order |
|---|---|---|---|---|
| 2 | 40.8 | 20.4 | 68.5% (50.0%) | 54.5% / 45.5% |
| 3 | 41.5 | 13.8 | 53.8% (33.3%) | 36.1% / 31.1% / 32.8% |
| 4 | 41.6 | 10.4 | 46.1% (25.0%) | 28.5% / 24.8% / 22.8% / 23.9% |

## Table 3 — memory skill: four players of very different memory (0.30 / 0.55 / 0.80 / 1.00), random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.3 | 4.0% ±1.2% | 10.6 | 3.36 |
| 0.55 | 12.2% ±2.0% | 15.3 | 2.71 |
| 0.8 | 31.8% ±2.9% | 20.0 | 2.04 |
| 1 | 52.0% ±3.1% | 22.7 | 1.69 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.57.

## Table 4 — memory skill: the memory of Beginner / Normal / Challenging / Master, random seats

| memory | win share | mean score | mean rank |
|---|---|---|---|
| 0.8 | 17.4% ±2.4% | 15.8 | 2.67 |
| 0.9 | 25.4% ±2.7% | 17.1 | 2.43 |
| 0.965 | 24.4% ±2.7% | 17.6 | 2.41 |
| 0.99 | 32.8% ±2.9% | 18.5 | 2.24 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.14.

## Table 5 — one player of memory m against three players at 0.70 (fair share 25%)

| focal memory | win share | mean score |
|---|---|---|
| 0.3 | 4.8% ±1.3% | 10.7 |
| 0.5 | 15.1% ±2.2% | 14.5 |
| 0.7 | 25.7% ±2.7% | 17.3 |
| 0.9 | 38.1% ±3.0% | 19.4 |
| 1 | 43.4% ±3.1% | 20.5 |

## Table 6 — the campaign ladder: each level against each other level (2 players, row beats column this often; a draw counts half)

| | Beginner | Novice | Normal | Challenging | Master |
|---|---|---|---|---|---|
| **Beginner** | — | 47.5% | 42.8% | 36.2% | 34.4% |
| **Novice** | 54.3% | — | 48.7% | 41.8% | 40.5% |
| **Normal** | 57.7% | 52.4% | — | 40.3% | 38.3% |
| **Challenging** | 62.9% | 58.6% | 57.7% | — | 48.6% |
| **Master** | 65.2% | 60.2% | 59.1% | 51.8% | — |

## Table 7 — how hard is each level? Win rate of a player of a given memory (banking promptly) against each level

| level | player memory 0.5 | player memory 0.7 | player memory 0.9 | player memory 1 |
|---|---|---|---|---|
| Beginner | 25.7% | 42.1% | 59.9% | 65.6% |
| Novice | 22.9% | 40.8% | 56.1% | 61.9% |
| Normal | 21.6% | 35.0% | 50.2% | 57.0% |
| Challenging | 16.0% | 29.6% | 44.5% | 50.2% |
| Master | 15.1% | 29.0% | 42.8% | 48.9% |

Outright wins only, since the campaign counts only an outright win as a defeat (a draw leaves the level locked).

## Table 8 — everyone has the same memory (4 players)

| memory | turns | leader at 50% goes on to win |
|---|---|---|
| 1 | 40.9 | 48.6% |
| 0.5 | 46.8 | 46.6% |
| 0.7 | 43.7 | 49.5% |
| 0.9 | 41.6 | 46.1% |
