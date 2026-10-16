# REPORT — delivery ON vs. OFF, 1,000 bot games per configuration

Reproduce: `node tools/simulate.js --games 1000` (about 45 s; deterministic — seeds are fixed). Raw numbers: `tools/results.json`; the tables below are `tools/tables.md` verbatim.

**ON** = the original rulebook (pieces, movement, delivery to corner sites, tile-value scoring). **OFF** = Patrick's redesign (no pieces, peek / flip / bank, 1 point per banked set + d6 bonus chain). Every table is 1,000 games per mode per row; ± values are 95% confidence half-widths. Bots differ only in `memory` (the chance each revealed fossil is remembered, permanently); all other behaviour is identical. See DECISIONS.md #23–26 and #31–32 for the bot and metric definitions.

## Findings

**1. Game length — OFF is about 15% shorter.** With four bots at 0.90 memory: 43.3 turns (10.8 rounds each) ON vs 36.7 turns (9.2 rounds) OFF; the 10th–90th percentile range is 38–48 vs 34–40, so OFF is also more predictable. Delivery costs roughly 6–7 extra turns, spent walking to a site and delivering. Game length in *turns* barely moves with player count (ON 42.5–43.5, OFF 35.1–37.3), because the limiting factor is finding the 15 matches, so rounds per player scale as 1/players (Table 2). Memory matters for length too: with everyone at 0.5 a game takes 48.3 (ON) / 41.7 (OFF) turns; at 1.0 it takes 42.8 / 36.1 (Table 7).

**2. Score spread — relatively wider ON, and OFF scores are too coarse to separate players.** ON: scores average 17.0 with a within-game SD of 5.9 (coefficient of variation 0.35), a 15-point range, and a winning margin of 6.2 points (25% of the winner's score). OFF: scores average 3.5 with SD 0.9 (CV 0.26) and a margin of 1.0 point (20%). Raw numbers aren't comparable (different scales), but the CV and margin-% say ON separates players more. The practical consequence is on the OFF side: **35.2% of OFF games tie on score** and 5.6% stay tied through every tie-break (a shared win), against 4.9% and 0.1% ON — in the redesign the tie-break chain (most sets popped, then who popped the final pair) decides about a third of games. ON has its own wrinkle: bots strand about 20 undelivered points per game (about a fifth of everything matched) because the game ends the instant the last pair is matched; OFF strands 2.5 sets.

**3. The early leader wins about twice as often as chance in both modes, and the modes are statistically level at the midpoint.** Counting a tied lead as shared credit (the fair measure — see the note), the player leading after half the game's turns goes on to win 44.9% ON vs 48.9% OFF (fair share with four players is 25%; each ±3.1%, so the gap is not significant). At 75% of the game the lead is stickier ON (56.4% vs 47.8%) — scoring is lumpy in OFF so late leads are often just ties. At 25% almost nothing is informative in OFF (only 2% of games have a sole leader, because nobody has banked yet) while ON has a leader in 78% of games who wins 34% of the time. By player count (Table 3) the lead's value falls as seats are added, as expected, but stays above the fair share everywhere. *Note:* the "sole leader" rows look more dramatic for OFF (59.4% at 50%), but that conditions on the 52% of games where somebody is strictly ahead, which selects games that were already one-sided; the tie-aware rows are the honest comparison.

**4. Memory skill decides a lot in both modes, and delivery dilutes it by roughly a quarter.** Four bots with very different memory (Table 4): the best (1.00) wins 50.0% ON vs 59.5% OFF — twice and 2.4 times the 25% fair share — and the worst (0.30) wins under 5% in both. The Spearman correlation between a seat's memory and its final score is 0.55 ON vs 0.65 OFF. In head-to-head terms (Table 6) one perfect-memory bot against three 0.70 bots wins 41.5% ON vs 49.4% OFF. Put as an edge over fair share, the OFF top player's edge is about 1.4× the ON edge (+34.5 vs +25.0 points). Walking, pushing and delivery-die luck add noise that memory cannot remove. At the memory levels in the design summary (0.80–0.99; Table 5) the effect is much milder: the spread between Beginner and Master is only 19.6% → 29.7% ON and 19.4% → 30.9% OFF, and the memory–score correlation falls to 0.12–0.16, consistent with the summary's point that 99% memory is beatable. There, tier differences are about 10 points of win share — noticeable over many games, invisible in one.

**5. Side effects worth knowing.** Turn order matters more in OFF: the first player wins 30.0% and the fourth 20.2% (fair 25%, ±2.7%) vs 26.7% / 22.7% ON, because the short, coarse-scoring OFF game often ends before the last seat gets its turn and ties break toward whoever acted last-but-one. If OFF is the preferred rule set this is worth addressing (e.g. let the round finish before the game ends, or an alternate tie-break).

## Caveats
- Bots are simple heuristics (DECISIONS #25–26): they do not plan deliveries against the end of the game, do not model opponents, and the OFF bank rule (bank at ≥ 2 sets or ≤ 6 fossils left) was not tuned — the design summary suspects frequent small banks dominate, which would raise OFF scores and might change the tie rates. Absolute numbers are bot behaviour, not human behaviour; the comparison ON vs OFF is the useful part.
- Memory is a per-fossil coin flip, not decay over time; humans also forget *positions*, which this model treats as part of the same coin.
- OFF scores are counts of sets, so spread is compared by CV and margin-% as well as raw values.
- ±values are normal-approximation intervals for proportions; the "sole leader" rows have fewer qualifying games, so wider intervals.
- ON and OFF boards differ (37 vs 31 spaces); each game uses its own seed, so the modes do not share a deal.

## Table 1 — 4 players, equal memory 0.90, 1000 games per mode

| metric | delivery ON | delivery OFF |
|---|---|---|
| turns per game (mean / median) | 43.3 / 43 | 36.7 / 37 |
| turns per game (10th–90th pct) | 38–48 | 34–40 |
| rounds per player | 10.8 | 9.2 |
| mean final score per player | 17.0 | 3.5 |
| mean winning score | 25.0 | 4.7 |
| score SD within a game | 5.9 | 0.9 |
| score range (max − min) | 15.2 | 2.3 |
| coefficient of variation within a game | 0.35 | 0.26 |
| mean winning margin (1st − 2nd) | 6.2 | 1.0 |
| winning margin as % of winner's score | 24.9% | 20.3% |
| games with a tie on score | 4.9% | 35.2% |
| games with a shared win (all tie-breaks tied) | 0.1% | 5.6% |
| unbanked/undelivered points lost at the end (mean) | 20.0 | 2.5 |
| leader at 25% of the game: someone has scored / a sole leader exists | 77.9% / 76.6% | 2.0% / 2.0% |
| leader at 25%: sole leader goes on to win | 34.6% ±3.4% | 80.0% ±17.5% |
| leader at 25%: win rate counting tied leaders (credit shared) | 34.3% ±3.3% | 80.0% ±17.5% |
| leader at 50% of the game: someone has scored / a sole leader exists | 100.0% / 93.3% | 98.3% / 52.4% |
| leader at 50%: sole leader goes on to win | 45.7% ±3.2% | 59.4% ±4.2% |
| leader at 50%: win rate counting tied leaders (credit shared) | 44.9% ±3.1% | 48.9% ±3.1% |
| leader at 75% of the game: someone has scored / a sole leader exists | 100.0% / 94.6% | 100.0% / 49.3% |
| leader at 75%: sole leader goes on to win | 57.6% ±3.1% | 65.8% ±4.2% |
| leader at 75%: win rate counting tied leaders (credit shared) | 56.4% ±3.1% | 47.8% ±3.1% |
| win share by turn order (1st / 2nd / 3rd / 4th) | 26.7% / 25.9% / 24.8% / 22.7% | 30.0% / 22.4% / 27.4% / 20.2% |

Fair win share with 4 players is 25.0%; 95% half-width of a win share over 1000 games is about ±2.7%.

## Table 2 — game length by player count (equal memory 0.90)

| players | ON turns | ON rounds/player | OFF turns | OFF rounds/player |
|---|---|---|---|---|
| 2 | 43.2 | 21.6 | 35.1 | 17.5 |
| 3 | 43.5 | 14.5 | 35.7 | 11.9 |
| 4 | 43.3 | 10.8 | 36.7 | 9.2 |
| 5 | 43.1 | 8.6 | 37.1 | 7.4 |
| 6 | 42.5 | 7.1 | 37.3 | 6.2 |

## Table 3 — does the early leader win? by player count (leader at 50% of the game, tied leaders share credit)

| players | ON | OFF | fair share |
|---|---|---|---|
| 2 | 64.5% | 64.9% | 50.0% |
| 3 | 53.4% | 50.6% | 33.3% |
| 4 | 44.9% | 48.9% | 25.0% |
| 5 | 40.1% | 45.1% | 20.0% |
| 6 | 35.3% | 48.1% | 16.7% |

## Table 4 — mixed memory (0.30 / 0.55 / 0.80 / 1.00), 4 players, random seats

| memory | ON win share | ON mean score | ON mean rank | OFF win share | OFF mean score | OFF mean rank |
|---|---|---|---|---|---|---|
| 0.3 | 4.7% ±1.3% | 10.0 | 3.38 | 3.9% ±1.2% | 2.1 | 3.23 |
| 0.55 | 16.4% ±2.3% | 15.5 | 2.63 | 9.8% ±1.8% | 3.2 | 2.49 |
| 0.8 | 28.9% ±2.8% | 19.4 | 2.13 | 26.8% ±2.7% | 4.0 | 1.88 |
| 1 | 50.0% ±3.1% | 22.7 | 1.71 | 59.5% ±3.0% | 4.7 | 1.39 |

Spearman correlation between a seat's memory and its final score (per game, averaged): ON 0.55, OFF 0.65.

## Table 5 — mixed memory at the design-doc tier levels (0.80 / 0.90 / 0.965 / 0.99), 4 players, random seats

| memory | ON win share | ON mean score | ON mean rank | OFF win share | OFF mean score | OFF mean rank |
|---|---|---|---|---|---|---|
| 0.8 | 19.6% ±2.5% | 15.7 | 2.64 | 19.4% ±2.5% | 3.3 | 2.38 |
| 0.9 | 23.6% ±2.6% | 16.9 | 2.47 | 24.7% ±2.7% | 3.5 | 2.13 |
| 0.965 | 27.1% ±2.8% | 17.6 | 2.37 | 25.0% ±2.7% | 3.6 | 2.02 |
| 0.99 | 29.7% ±2.8% | 18.2 | 2.28 | 30.9% ±2.9% | 3.7 | 1.96 |

Spearman correlation between a seat's memory and its final score (per game, averaged): ON 0.12, OFF 0.16.

## Table 6 — one bot of memory m against three bots at 0.70 (fair share 25%)

| focal memory | ON win share | ON mean score | OFF win share | OFF mean score |
|---|---|---|---|---|
| 0.3 | 6.6% ±1.5% | 10.9 | 5.3% ±1.4% | 2.3 |
| 0.5 | 15.0% ±2.2% | 14.1 | 11.3% ±2.0% | 2.9 |
| 0.7 | 27.7% ±2.8% | 17.1 | 27.2% ±2.8% | 3.6 |
| 0.9 | 35.3% ±3.0% | 19.2 | 38.4% ±3.0% | 4.0 |
| 1 | 41.5% ±3.1% | 20.4 | 49.4% ±3.1% | 4.2 |

## Table 7 — everyone has the same memory (4 players)

| memory | ON turns | OFF turns | ON early leader (50%) wins | OFF early leader (50%) wins |
|---|---|---|---|---|
| 1 | 42.8 | 36.1 | 41.0% | 49.2% |
| 0.5 | 48.3 | 41.7 | 45.3% | 52.1% |
| 0.7 | 45.2 | 38.6 | 42.1% | 49.5% |
| 0.9 | 43.3 | 36.7 | 44.9% | 48.9% |
