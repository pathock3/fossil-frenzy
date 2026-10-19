# The opponents — how the AI thinks, and how the levels are built

Everything an opponent does comes from **one decision engine** (the `bots` script in `index.html`) plus a **profile**: a short list of abilities in the data block (`GAME_DATA.ai`). The perfect player has every ability at its maximum; every easier opponent is the same engine with some abilities turned down. Nothing is hard-coded per level — a level *is* a profile.

## What an opponent may know

The same as a person at the table, and no more:

- the public view of the game (scores, held sets, which fossils are still on the board, whose turn it is, what has been flipped);
- every public flip and every set that has been popped (so it can work out which sets are still out there);
- its **own** peeks.

It never sees a face-down fossil's value. This is tested: the decision is unchanged when the hidden values are changed behind its back (`tests/ai.test.js`), and the public view contains no hidden values (`tests/view.test.js`).

## The abilities

| ability | 0 means… | 1 means… |
|---|---|---|
| **memory** | (0.8 = easiest, 0.99 = hardest) each turn that passes, the chance it still recalls a fact exactly is `memory`; when it acts on a memory it taps the right spot with probability `memory^age`, otherwise a **random other spot** | never forgets |
| **valueSense** | every set looks equally valuable — it takes a pair of 2s as eagerly as a pair of 9s | understands high sets are worth far more than low ones, so it may leave a pair of 2s alone and spend the turn better |
| **leadSense** | plays for points | plays for the **win**: it weighs how far ahead or behind it is against how much is left to play for |
| **endSense** | no feel for how long the game has left (assumes plenty of time, so it banks late or by habit) | knows how close the end is: banks before time runs out, values a turn according to how many remain |
| **setsSense** | has no idea which sets are left | tracks every set popped, so it knows exactly what is still on the board (e.g. whether the big ones are gone) |
| **bankAt / endgameTiles** | (habits for the easy levels) bank whenever it holds N sets, or whenever few fossils remain — instead of working it out | — |

`random` is a separate profile for a **tutorial opponent**: it taps at random.

### Memory in numbers

A fact (a fossil's number and place) stays exactly right with probability `memory^age`, where age is the number of turns (anybody's) since the bot last saw it:

| memory | 1 turn ago | 2 | 4 | 8 | 16 |
|---|---|---|---|---|---|
| 0.80 | 80% | 64% | 41% | 17% | 3% |
| 0.85 | 85% | 72% | 52% | 27% | 7% |
| 0.90 | 90% | 81% | 66% | 43% | 19% |
| 0.95 | 95% | 90% | 81% | 66% | 44% |
| 0.99 | 99% | 98% | 96% | 92% | 85% |

When it slips it is *confidently wrong*: it believes it knows where the pair is, taps a different spot, and reveals something else instead — which is what a person who half-remembers does. A fact it saw this very turn is always exact. (A 5% floor stops a very forgetful opponent from being stuck for ever.)

## How the perfect AI decides what to do with its turn

At the start of a turn it has up to four candidates, and scores each by how good the position is afterwards:

- **Bank** its best held set.
- **Take a set it knows how to make** (two fossils of the same number it has located).
- **Explore**: peek a fossil it has not seen and flip another unseen one (two new facts at once; a chance the two match; a chance the new fossil matches something it already knows).
- **Gamble** on the third gem when it knows two.

The score of a position is its *equity* — banked points, plus what its held sets and known pairs are worth **given how many turns it expects to have left**, plus what the leftover turns are worth, minus the opponent's equivalent — turned into a **chance of winning** (a lead is worth more when little is left to play for). From that fall out the behaviours you described:

- It doesn't bank a 2 early — a held set is only at risk when time runs short, so exploring is worth more; as the end nears, the held sets become urgent and it banks them (highest first).
- A public pair of 9s is taken at once; a pair of 2s is left while there is anything better to do — unless nothing better remains.
- It leaves a public set for the other player only when the other player wouldn't want it (the more a set is worth, the more likely they take it).
- It counts the sets still on the board to work out how long the game has left, and how likely any unseen fossil is to be a particular number.

## What the simulations taught us (see `REPORT.md`)

These are the findings that changed the design — several were **not** what we expected:

1. **Memory is the biggest lever by far.** Against an otherwise identical opponent, memory 1.0 beats 0.9 about 93% of the time and 0.8 about 98%. The difference between the levels is mostly a difference in how well they remember.
2. **Knowing how long the game has left is the second.** The same player without it (banking by habit) loses about 57–60% of the time.
3. **Hiding information doesn't pay.** We expected the perfect player to flip only fossils everyone had already seen (to give nothing away). Flipping a new fossil instead — learning two things a turn — did better, so that idea was dropped.
4. **"The leader should rush to end the game" didn't help** (and the opposite didn't either): adding an explicit push for the leader to finish and for the trailer to stall *lowered* its win rate. The equity model already gets what is useful out of the lead; the knob (`endBias`) stays at 0.
5. **Valuing sets properly, watching the lead, and tracking which sets are left are worth little against a perfect-memory opponent** — a few percent at most, within the noise of the simulations. They shape *how it plays* (what it leaves, what it takes) more than whether it wins. They matter more when memory is imperfect.
6. **Thinking ahead didn't help either.** As a check on whether this planner is close to the limit, we built a player that, before each choice, deals the unseen fossils out at random many times, plays the rest of the game out for each option with two rule-of-thumb players, and picks the option that wins most often. Over 300 games it won **51%** against the rule-of-thumb perfect player — no better than chance. (A first run of 100 games said 63%; it was a lucky run of seeds. Longer runs removed it.) So the planner's choices between banking, taking a set and exploring are already about as good as this kind of search can make them. The search was removed from the game.

## The levels

| level | memory | valueSense | leadSense | endSense | setsSense | habits |
|---|---|---|---|---|---|---|
| Beginner | 0.80 | 0 | 0 | 0 | 0 | banks at 3 sets |
| Novice | 0.85 | 0.4 | 0 | 0 | 0 | banks at 3 sets, or when ≤ 4 fossils are left |
| Normal | 0.90 | 0.8 | 0.3 | 0.5 | 1 | — |
| Challenging | 0.95 | 1 | 0.7 | 0.8 | 1 | — |
| Master | 0.99 | 1 | 1 | 1 | 1 | — |

Each level beats the one below it (head-to-head tables in `REPORT.md`). To change how hard a level is, edit its line in `campaign.levels` in the data block — no code. The usual levers, in order of effect: `memory`, then `endSense`, then the others. The ladder was set from simulations of bots against bots; **how hard each level feels to a person is for playtesting to settle**, and `memory` is the knob to turn.

## Things worth considering next

- **Tutorial.** The `random` profile exists. A tutorial wants more than a random opponent: a scripted first game that teaches peek / flip / bank, with a gentle bot that sometimes *shows* what a good move is.
- **Human-like mistakes beyond memory.** A slip currently taps a uniformly random other spot; people more often pick a *neighbouring* fossil, or swap two they half-remember. A small "near miss" bias would feel more human.
- **Reading the opponent.** A dashed peek ring tells everyone where a player looked. The perfect AI could remember which fossils *you* have peeked at (you know them; it doesn't) and avoid giving you pairs, or wait for you to use them.
- **3–4 players.** Only 2-player games use the opponent (Campaign). With more players a smart AI would also play politics: target the leader, avoid feeding the player who moves next.
- **Personalities.** Same strength, different style — a hoarder who banks late, a banker who banks at once, a gambler who chases gems. Cheap to add as profiles.
- **Adaptive difficulty.** Nudge `memory` up or down between games according to how the player is doing (optional, and off by default so the ladder stays honest).
- **Calibrate against people.** The ladder is calibrated bot-against-bot. Anonymous per-device counts (games played / won per level) would show where the real difficulty curve bends.
- **A "why did it do that?" view** (developer only) showing the candidates and their scores — the planner already produces them (`bot.weigh`).
