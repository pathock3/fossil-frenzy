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
