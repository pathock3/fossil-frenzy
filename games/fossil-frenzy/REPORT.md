# REPORT — Fossil Frenzy (one rule set), 1,000 bot games per row

Reproduce: `npm run simulate -- --games 1000` from the repo root (about 4½ minutes; deterministic — seeds are fixed). Raw numbers: `tools/results.json`; the tables below are `tools/tables.md` verbatim. How the opponents work: `docs/AI.md`.

> **Retuned (playtest 7):** the Focus skill was removed and the campaign levels were retuned (table 10 shows the new values). The other tables below were produced before this and were not re-run; a quick re-check of the five levels head to head (500 games per pair) gives each level over the one below it: 78% / 76% / 71% / 71%.

Rules simulated: 31 fossils on a hexagon (2/3/5/6/7/9/10 and three gems worth 12), no pieces; a turn is *peek then flip* or *bank one set* (scored at the number on its fossil; the tables below were run when a bank also rolled a d6 chain of +1 per 6, since removed — about +0.2 a bank, which shifts every player alike, so the ladder is unchanged in kind but not re-run); up to 4 players. A player is the one decision engine in the `bots` script with a profile of eight skills scored 0–10 (`GAME_DATA.skills`): **Memory**, **Self-awareness**, **Value sense**, **Lead sense**, **Endgame sense**, **Set tracking**, **Gem sense**, **Focus**. "Perfect" = 10 on every skill; "Memory m" in a table means the perfect player with that Memory skill (8 = a memory that survives a turn 90% of the time, 4 = 70%, 0 = 50%). "Level" rows use the campaign levels' own profiles. ± values are 95% confidence half-widths. See `DECISIONS.md` (items 55–63) for what was tried and dropped.

## Findings

**1. Memory decides most games.** Four players with very different Memory (Table 3): Memory 10 wins 98.4%; Memory 6 wins 1.0%, 2 wins 0.2%, 0 wins 0.4%. Among the Memory of the levels (Table 4: 4 / 6.8 / 7.7 / 8.5) win share runs 2.7% → 12.5% → 24.2% → 60.6%. Memory fades with every turn that passes, so the gaps between neighbouring levels are large. It is a steep lever.

**2. Memory also sets how long a game lasts.** Everyone at Memory 10: 40.9 turns; at 8: 52.9; at 4: 90.5; at 0: 136.7 (Table 8) — forgetful players waste turns on slips. Two, three and four players take about the same number of turns (52.4 / 52.2 / 52.9 at Memory 8, Table 2).

**3. Scores are well spread, and ties are rare.** Four players at Memory 8: mean 17.3 per player, winner 26.3; the winner leads second place by 6.8 points (26% of the winner's score). 6.0% of games tie on score and 1.1% stay tied through every tie-break. Unbanked sets cost 2.5 points a game.

**4. The early leader is hard to catch.** At half-time the leader goes on to win 53.9% of four-player games (fair share 25%) and 66.8% after three quarters; with two players a half-time lead wins 71.3% (fair 50%) (Tables 1–2).

**5. There is no seat-order edge.** Four players: 26.5 / 24.2 / 24.6 / 24.8% by turn order; two players: 50.4% / 49.6%.

**6. The campaign ladder is smooth (Table 6).** Each level beats the one below it by about the same margin — Novice beats Beginner 66.6%, Normal beats Novice 70.8%, Challenging beats Normal 70.4%, Master beats Challenging 69.9% — and Master beats Beginner 96.8%. Even Beginner beats the random tutorial opponent 88.6% of the time (Table 11). Against the perfect player with an imperfect memory (Table 7): Memory 6 (80% a turn) beats Beginner 81%, Novice 62%, Normal 46%, Challenging 26%, Master 11.5%; Memory 8 beats Master 38%; only a player who never forgets beats Master more often than not (86%). A person is not a bot, so **how hard the levels feel is for playtesting to settle**; Beginner was made easy on purpose.

**7. What each skill is worth (Table 9).** Against the perfect player: Memory 6 loses about 98% of games (being unaware of it, Self-awareness 0, changes little: 98.0%); **no Gem sense (always going for the third gem) loses 67%**; Focus 8 (a random move one time in ten) loses 57% and Focus 5 (one in four) 76%; having no Endgame sense (banking as soon as it holds two sets) loses only 52%. Value sense, Lead sense and Set tracking made **no measurable difference** against a perfect-memory opponent (50.7% / 48.1% / 51.1%, within ±3%): they change *how* it plays (what it takes and leaves) more than whether it wins. **Focus is a much gentler dial than Memory** (10% slips ≈ 57%, against Memory 6 ≈ 98%), which makes it good for fine-tuning a level.

## Caveats
- Opponents are heuristics, calibrated bot against bot (and in particular on how fast memory fades). A human forgets differently — more by neighbouring spots and by interference than by a clean per-turn decay (a slip here is a neighbouring fossil half the time).
- The "human proxy" in Table 7 is the perfect player with a given Memory. Treat it as an ordering of difficulty, not a promise of a win rate.
- ± values are normal-approximation intervals; the head-to-head cells are 1,000 games each, so differences under about 4 points are noise.

## Table 1 — 4 players, everyone at Memory 8, 1000 games

| metric | value |
|---|---|
| turns per game (mean / median) | 52.9 / 52 |
| turns per game (10th–90th pct) | 45–62 |
| rounds per player | 13.2 |
| mean final score per player / mean winning score | 17.3 / 26.3 |
| score SD within a game / range (max − min) | 6.7 / 17.2 |
| coefficient of variation within a game | 0.39 |
| mean winning margin (1st − 2nd), and as % of winner's score | 6.8, 25.9% |
| games with a tie on score / a shared win after every tie-break | 6.0% / 1.1% |
| points lost at the end in unbanked sets (mean) | 2.5 |
| leader at 25% of the game: someone has scored / a sole leader exists | 97.9% / 90.3% |
| leader at 25%: win rate counting tied leaders (credit shared) | 40.2% ±3.1% |
| leader at 50% of the game: someone has scored / a sole leader exists | 100.0% / 89.5% |
| leader at 50%: win rate counting tied leaders (credit shared) | 53.9% ±3.1% |
| leader at 75% of the game: someone has scored / a sole leader exists | 100.0% / 94.1% |
| leader at 75%: win rate counting tied leaders (credit shared) | 66.8% ±2.9% |
| win share by turn order (1st / 2nd / 3rd / 4th) | 26.5% / 24.2% / 24.6% / 24.8% |

Fair win share with 4 players is 25.0%; the 95% half-width of a win share over 1000 games is about ±2.7%.

## Table 2 — game length and early leader by player count (everyone at Memory 8)

| players | turns | rounds/player | leader at 50% goes on to win (fair share) | win share by turn order |
|---|---|---|---|---|
| 2 | 52.4 | 26.2 | 71.3% (50.0%) | 50.4% / 49.6% |
| 3 | 52.2 | 17.4 | 59.7% (33.3%) | 34.2% / 32.4% / 33.5% |
| 4 | 52.9 | 13.2 | 53.9% (25.0%) | 26.5% / 24.2% / 24.6% / 24.8% |

## Table 3 — memory: four players of very different Memory skill (0 / 2 / 6 / 10), random seats

| Memory skill | win share | mean score | mean rank |
|---|---|---|---|
| 0 | 0.4% ±0.4% | 7.1 | 3.20 |
| 2 | 0.2% ±0.3% | 8.2 | 3.04 |
| 6 | 1.0% ±0.6% | 11.9 | 2.60 |
| 10 | 98.4% ±0.8% | 36.1 | 1.02 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.71.

## Table 4 — memory: the Memory of Beginner / Normal / Challenging / Master, random seats

| Memory skill | win share | mean score | mean rank |
|---|---|---|---|
| 4 | 2.7% ±1.0% | 8.9 | 3.43 |
| 6.8 | 12.5% ±2.0% | 14.9 | 2.67 |
| 7.7 | 24.2% ±2.7% | 19.0 | 2.20 |
| 8.5 | 60.6% ±3.0% | 25.8 | 1.54 |

Spearman correlation between a seat's memory and its final score (per game, averaged): 0.62.

## Table 5 — one player of Memory m against three players at Memory 4 (fair share 25%)

| focal Memory skill | win share | mean score |
|---|---|---|
| 0 | 9.9% ±1.9% | 12.5 |
| 2 | 14.4% ±2.2% | 14.1 |
| 4 | 25.7% ±2.7% | 17.5 |
| 8 | 77.4% ±2.6% | 30.8 |
| 10 | 97.4% ±1.0% | 35.5 |

## Table 6 — the campaign ladder: each level against each other level (2 players, row beats column this often; a draw counts half)

| | Beginner | Novice | Normal | Challenging | Master |
|---|---|---|---|---|---|
| **Beginner** | — | 32.4% | 16.3% | 6.0% | 3.2% |
| **Novice** | 66.6% | — | 30.6% | 15.7% | 5.7% |
| **Normal** | 82.8% | 70.8% | — | 29.7% | 13.6% |
| **Challenging** | 92.9% | 85.0% | 70.4% | — | 26.6% |
| **Master** | 96.8% | 93.5% | 86.2% | 69.9% | — |

## Table 7 — how hard is each level? Win rate of the perfect strategy at a given Memory skill against each level

| level | perfect play, Memory 0 | perfect play, Memory 4 | perfect play, Memory 6 | perfect play, Memory 8 | perfect play, Memory 10 |
|---|---|---|---|---|---|
| Beginner | 28.2% | 59.7% | 81.2% | 96.0% | 99.6% |
| Novice | 16.7% | 43.3% | 62.0% | 91.0% | 99.1% |
| Normal | 7.7% | 23.2% | 45.7% | 78.6% | 97.0% |
| Challenging | 2.8% | 12.5% | 25.7% | 61.2% | 92.7% |
| Master | 1.2% | 5.0% | 11.5% | 37.7% | 86.0% |

Outright wins only, since the campaign counts only an outright win as a defeat (a draw leaves the level locked).

## Table 9 — what each ability is worth: the perfect player against itself with one ability taken away (2 players; the perfect player wins this often, a draw counts half)

| the other player lacks… | perfect player wins |
|---|---|
| Memory 6 (a memory survives a turn 80% of the time) instead of 10 | 98.3% ±0.8% |
| Memory 6, and unaware of it — overconfident (Self-awareness 0) | 98.0% ±0.9% |
| no Value sense (0) | 50.7% ±3.1% |
| no Lead sense (0) | 48.1% ±3.1% |
| no Endgame sense (0: it banks as soon as it holds 2 sets) | 52.2% ±3.1% |
| no Set tracking (0) | 51.1% ±3.1% |
| no Gem sense (0: always goes for the third gem) | 66.7% ±2.9% |
| all of the Beginner's weak settings (Memory 4, every sense 0, plus a random move one turn in five — the since-removed Focus 6) | 99.6% ±0.4% |

## Table 10 — the five campaign opponents' skills (0 = none, 10 = perfect)

| level | Memory | Self-awareness | Value sense | Lead sense | Endgame sense | Set tracking | Gem sense |
|---|---|---|---|---|---|---|---|
| Beginner | 4.8 | 0 | 0 | 0 | 0 | 0 | 0 |
| Novice | 7.4 | 3 | 3 | 3 | 3 | 3 | 3 |
| Normal | 8.6 | 5 | 5 | 5 | 5 | 5 | 5 |
| Challenging | 9.2 | 7 | 8 | 8 | 8 | 8 | 8 |
| Master | 9.8 | 9 | 10 | 10 | 10 | 10 | 10 |

Memory 8 = a memory that survives a turn 90% of the time; 4 = 70%; 0 = 50%. See `docs/AI.md`.

## Table 11 — the tutorial opponent (plays at random): how often each campaign level beats it (2 players)

| level | wins |
|---|---|
| Beginner | 88.6% |
| Novice | 95.4% |
| Normal | 99.0% |
| Challenging | 99.9% |
| Master | 100.0% |

## Table 8 — everyone has the same Memory skill (4 players)

| Memory skill | turns | leader at 50% goes on to win |
|---|---|---|
| 0 | 136.7 | 56.6% |
| 4 | 90.5 | 53.6% |
| 8 | 52.9 | 53.9% |
| 10 | 40.9 | 44.4% |

