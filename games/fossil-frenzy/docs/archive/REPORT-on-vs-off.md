> **Archived.** This compared the two rule sets that Fossil Frenzy used to have — the original rulebook (movement and delivery) and the redesign (peek, flip, bank). The owner then chose a single rule set (the redesign), so the original rule set's code was removed (it lives in git history, last present at commit `369ea0b`). Kept as a record of how the two compared: on every measure they played very similarly.

# REPORT — delivery ON vs. OFF, 1,000 bot games per configuration

Reproduce: `npm run simulate -- --games 1000` (from the repo root; runs `games/fossil-frenzy/tools/simulate.js`) (about 45 s; deterministic — seeds are fixed). Raw numbers: `tools/results.json`; the tables below are `tools/tables.md` verbatim.

**ON** = the original rulebook (pieces, movement, delivery to corner sites, one set delivered at a time, scored at the number on its fossil). **OFF** = Patrick's redesign (no pieces; each turn is peek-and-flip *or* bank; banking takes **one** held set and scores **the number on its fossil**, gem 16, then a d6 chain adding +1 per 6). Every table is 1,000 games per mode per row; ± values are 95% confidence half-widths. Bots differ only in `memory` (the chance each revealed fossil is remembered, permanently). See DECISIONS.md #21–26 and #31–32 for the bot and metric definitions.

> **Revision note.** An earlier version of this report scored OFF as "1 point per held set, all banked at once". Owner feedback corrected that rule (numbers are the points; one set per bank), and the bots now bank as soon as they hold a set. The earlier conclusions that OFF was much shorter, tie-heavy, and gave memory more weight were artifacts of the old scoring and no longer hold.

## Findings

**1. Game length — about the same; OFF slightly shorter and more predictable.** Four bots at 0.90 memory: 43.3 turns (10.8 rounds each) ON vs 41.6 turns (10.4 rounds) OFF; the 10th–90th percentile range is 38–48 vs 39–44. Banking one set at a time costs OFF roughly one turn per match, which cancels most of what removing movement saves. Length in *turns* barely moves with player count (ON 42.5–43.5, OFF 40.8–41.9) because the limiting factor is finding the 15 matches, so rounds per player scale as 1/players (Table 2). Memory matters for length: everyone at 0.5 takes 48.3 (ON) / 46.8 (OFF) turns; at 1.0, 42.8 / 40.9 (Table 7).

**2. Score spread — essentially identical.** ON: mean score 17.0, within-game SD 5.9 (coefficient of variation 0.35), winning margin 6.2 points (25% of the winner's score). OFF: 18.4, SD 6.2 (CV 0.34), margin 6.6 (25%). Score ties are rare in both (4.9% ON, 6.3% OFF) and shared wins after all tie-breaks are 0.1% vs 1.3%. The real difference is stranded points: ON bots end the game holding about 20 undelivered points (23% of what they matched) because the game ends the instant the last pair is matched and delivery needs a walk to the right corner; OFF bots strand about 2.6, because banking is available any turn.

**3. The early leader wins about twice as often as chance in both modes, and the modes are statistically level.** Counting a tied lead as shared credit (the fair measure), the player leading after half the game's turns goes on to win 44.9% ON vs 42.7% OFF (fair share with four players is 25%; each ±3.1). At 75% of the game it is 56.4% vs 59.2%, and at 25% it is 34.3% vs 32.8%. By player count (Table 3) the lead's value falls steadily with more seats in both modes (2 players ≈ 64%, 6 players ≈ 35–36%) but stays above the fair share everywhere. In plain terms: a lead is hard to overturn, because most of the matches are made in the middle of the game and the leader has already banked or delivered theirs.

**4. Memory skill decides the winner about equally in both modes.** Four bots with very different memory (Table 4): the best (1.00) wins 50.0% ON vs 50.2% OFF — twice the 25% fair share — and the worst (0.30) wins under 5% in both. The Spearman correlation between a seat's memory and its final score is 0.55 in both. One perfect-memory bot against three 0.70 bots wins 41.5% ON vs 42.4% OFF (Table 6). At the memory levels in the design summary (0.80–0.99; Table 5) the effect is much milder: Beginner-to-Master moves the win share only from 19.6% to 29.7% ON and 17.3% to 32.8% OFF, with a memory–score correlation of 0.12–0.14 — consistent with the summary's point that 99% memory is beatable by a lucky player. Walking, pushing and delivery dice do **not** measurably dilute memory skill in the rulebook mode.

**5. Turn order.** First seat wins 26.7% in both modes; the last seat 22.7% ON and 25.5% OFF (fair 25%, ±2.7%). A mild first-mover edge, no clear difference between modes.

**What this means for the design question.** On these measures the two rule sets are nearly interchangeable: similar length, similar spread, similar snowballing, similar weight on memory. The choice is therefore about *feel*, not balance — ON adds walking, shoving and the delivery die to a memory game (and strands points); OFF is the pure memory game with a bank decision each turn.

## Caveats
- Bots are simple heuristics (DECISIONS #25–26): they do not plan deliveries against the end of the game and do not model opponents. The OFF banking policy was checked head-to-head (600 games per policy; waiting to bank until 2–4 sets or the endgame was no better than banking at once, within noise), so bots bank as soon as they hold a set. Absolute numbers are bot behaviour, not human behaviour; the ON vs OFF comparison is the useful part.
- Memory is a per-fossil coin flip, not decay over time; humans also forget *positions*, which this model treats as part of the same coin.
- ±values are normal-approximation intervals for proportions; the "sole leader" rows have fewer qualifying games, so wider intervals.
- ON and OFF boards differ (37 vs 31 spaces); each game uses its own seed, so the modes do not share a deal.

## Table 1 — 4 players, equal memory 0.90, 1000 games per mode

| metric | delivery ON | delivery OFF |
|---|---|---|
| turns per game (mean / median) | 43.3 / 43 | 41.6 / 42 |
| turns per game (10th–90th pct) | 38–48 | 39–44 |
| rounds per player | 10.8 | 10.4 |
| mean final score per player | 17.0 | 18.4 |
| mean winning score | 25.0 | 26.8 |
| score SD within a game | 5.9 | 6.2 |
| score range (max − min) | 15.2 | 16.0 |
| coefficient of variation within a game | 0.35 | 0.34 |
| mean winning margin (1st − 2nd) | 6.2 | 6.6 |
| winning margin as % of winner's score | 24.9% | 24.6% |
| games with a tie on score | 4.9% | 6.3% |
| games with a shared win (all tie-breaks tied) | 0.1% | 1.3% |
| unbanked/undelivered points lost at the end (mean) | 20.0 | 2.6 |
| leader at 25% of the game: someone has scored / a sole leader exists | 77.9% / 76.6% | 97.8% / 92.5% |
| leader at 25%: sole leader goes on to win | 34.6% ±3.4% | 33.6% ±3.0% |
| leader at 25%: win rate counting tied leaders (credit shared) | 34.3% ±3.3% | 32.8% ±2.9% |
| leader at 50% of the game: someone has scored / a sole leader exists | 100.0% / 93.3% | 100.0% / 91.1% |
| leader at 50%: sole leader goes on to win | 45.7% ±3.2% | 43.9% ±3.2% |
| leader at 50%: win rate counting tied leaders (credit shared) | 44.9% ±3.1% | 42.7% ±3.1% |
| leader at 75% of the game: someone has scored / a sole leader exists | 100.0% / 94.6% | 100.0% / 94.3% |
| leader at 75%: sole leader goes on to win | 57.6% ±3.1% | 60.5% ±3.1% |
| leader at 75%: win rate counting tied leaders (credit shared) | 56.4% ±3.1% | 59.2% ±3.0% |
| win share by turn order (1st / 2nd / 3rd / 4th) | 26.7% / 25.9% / 24.8% / 22.7% | 26.7% / 24.8% / 23.1% / 25.5% |

Fair win share with 4 players is 25.0%; 95% half-width of a win share over 1000 games is about ±2.7%.

## Table 2 — game length by player count (equal memory 0.90)

| players | ON turns | ON rounds/player | OFF turns | OFF rounds/player |
|---|---|---|---|---|
| 2 | 43.2 | 21.6 | 40.8 | 20.4 |
| 3 | 43.5 | 14.5 | 41.5 | 13.8 |
| 4 | 43.3 | 10.8 | 41.6 | 10.4 |
| 5 | 43.1 | 8.6 | 41.8 | 8.4 |
| 6 | 42.5 | 7.1 | 41.9 | 7.0 |

## Table 3 — does the early leader win? by player count (leader at 50% of the game, tied leaders share credit)

| players | ON | OFF | fair share |
|---|---|---|---|
| 2 | 64.5% | 64.2% | 50.0% |
| 3 | 53.4% | 49.5% | 33.3% |
| 4 | 44.9% | 42.7% | 25.0% |
| 5 | 40.1% | 40.3% | 20.0% |
| 6 | 35.3% | 35.9% | 16.7% |

## Table 4 — mixed memory (0.30 / 0.55 / 0.80 / 1.00), 4 players, random seats

| memory | ON win share | ON mean score | ON mean rank | OFF win share | OFF mean score | OFF mean rank |
|---|---|---|---|---|---|---|
| 0.3 | 4.7% ±1.3% | 10.0 | 3.38 | 4.3% ±1.3% | 11.0 | 3.33 |
| 0.55 | 16.4% ±2.3% | 15.5 | 2.63 | 12.6% ±2.1% | 16.1 | 2.69 |
| 0.8 | 28.9% ±2.8% | 19.4 | 2.13 | 33.0% ±2.9% | 21.3 | 2.04 |
| 1 | 50.0% ±3.1% | 22.7 | 1.71 | 50.2% ±3.1% | 24.2 | 1.74 |

Spearman correlation between a seat's memory and its final score (per game, averaged): ON 0.55, OFF 0.55.

## Table 5 — mixed memory at the design-doc tier levels (0.80 / 0.90 / 0.965 / 0.99), 4 players, random seats

| memory | ON win share | ON mean score | ON mean rank | OFF win share | OFF mean score | OFF mean rank |
|---|---|---|---|---|---|---|
| 0.8 | 19.6% ±2.5% | 15.7 | 2.64 | 17.3% ±2.3% | 16.7 | 2.69 |
| 0.9 | 23.6% ±2.6% | 16.9 | 2.47 | 24.6% ±2.7% | 18.2 | 2.46 |
| 0.965 | 27.1% ±2.8% | 17.6 | 2.37 | 25.4% ±2.7% | 18.7 | 2.40 |
| 0.99 | 29.7% ±2.8% | 18.2 | 2.28 | 32.8% ±2.9% | 19.8 | 2.26 |

Spearman correlation between a seat's memory and its final score (per game, averaged): ON 0.12, OFF 0.14.

## Table 6 — one bot of memory m against three bots at 0.70 (fair share 25%)

| focal memory | ON win share | ON mean score | OFF win share | OFF mean score |
|---|---|---|---|---|
| 0.3 | 6.6% ±1.5% | 10.9 | 5.3% ±1.4% | 11.2 |
| 0.5 | 15.0% ±2.2% | 14.1 | 14.2% ±2.2% | 15.3 |
| 0.7 | 27.7% ±2.8% | 17.1 | 26.0% ±2.7% | 18.3 |
| 0.9 | 35.3% ±3.0% | 19.2 | 37.0% ±3.0% | 20.7 |
| 1 | 41.5% ±3.1% | 20.4 | 42.4% ±3.1% | 22.0 |

## Table 7 — everyone has the same memory (4 players)

| memory | ON turns | OFF turns | ON early leader (50%) wins | OFF early leader (50%) wins |
|---|---|---|---|---|
| 1 | 42.8 | 40.9 | 41.0% | 45.2% |
| 0.5 | 48.3 | 46.8 | 45.3% | 44.3% |
| 0.7 | 45.2 | 43.7 | 42.1% | 45.4% |
| 0.9 | 43.3 | 41.6 | 44.9% | 42.7% |
