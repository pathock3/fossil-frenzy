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
