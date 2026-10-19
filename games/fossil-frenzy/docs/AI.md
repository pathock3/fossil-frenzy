# The opponents — how the AI thinks, and how the levels are built

Everything an opponent does comes from **one decision engine** (the `bots` script in `index.html`) plus a **profile**: a short list of skills in the data block (`GAME_DATA.ai`). The perfect player has every skill at its maximum; every easier opponent is the same engine with some skills turned down. A level *is* a profile — nothing is hard-coded per level, and changing a level means changing numbers in the data block.

## What an opponent may know

The same as a person at the table, and no more: the public view of the game, every public flip and every set popped (so it can work out which sets are still out there), and its **own** peeks. It never sees a face-down fossil's value — tested: its decision is unchanged when the hidden values are changed behind its back (`tests/ai.test.js`), and the public view contains none (`tests/view.test.js`).

## The skills (scored 0–10, except memory and mistakes)

| skill | low means… | 10 means… |
|---|---|---|
| **memory** (0.7 … 0.99; 1 = perfect) | each turn that passes, the chance it still recalls a fossil exactly is `memory`; when it acts on a memory it taps the right spot with probability `memory^age`, otherwise a **random other spot** | never forgets |
| **overconfidence** | trusts a fading memory only as much as it deserves — if it half-remembers a pair it explores instead | trusts memory fully: goes for matches it can't reliably make, and sometimes taps the wrong spot (the "fun" mistake) |
| **valueSense** | every set looks the same: it takes a pair of 2s as eagerly as a pair of 9s | knows high sets are worth far more, so it may leave a pair of 2s and spend the turn better |
| **leadSense** | plays for points | plays for the **win**: weighs its lead or deficit against what is left to play for |
| **endSense** | no feel for how long the game has left (assumes plenty of time; banks late or by habit) | knows how close the end is: banks before time runs out, values a turn by how many remain. 5 = it only notices the end in the last half of the game |
| **setsSense** | (below 5) no idea which sets are still out there | tracks every set popped, so it knows what is still on the board |
| **gemSense** | (below 5) found two gems? it always goes for the third — which reveals both gems' positions to everyone | understands that, and only goes for the third when it knows where it is (or very late) |
| **mistakes** (0 … 0.3) | — | the chance, on any move, that it plays a random move instead of its best |
| **bankAt / endgameTiles** | rule-of-thumb habits for the easy levels: bank whenever holding N sets, or when few fossils remain | — |

`random` is a separate profile for a **tutorial opponent**: it just taps at random.

### Memory in numbers
A fact stays exact with probability `memory^age` (age = turns, anybody's, since it was last seen):

| memory | 1 turn ago | 2 | 4 | 8 | 16 |
|---|---|---|---|---|---|
| 0.70 | 70% | 49% | 24% | 6% | 5% (floor) |
| 0.80 | 80% | 64% | 41% | 17% | 5% |
| 0.90 | 90% | 81% | 66% | 43% | 19% |
| 0.95 | 95% | 90% | 81% | 66% | 44% |
| 0.99 | 99% | 98% | 96% | 92% | 85% |

When it slips it is *confidently wrong*: it believes it knows where the pair is, taps somewhere else, and reveals something it didn't mean to. What it saw this very turn is always exact; a 5% floor stops a very forgetful opponent being stuck for ever.

## How the perfect AI decides what to do with its turn

At the start of a turn it has up to four candidates and scores each by the position it leads to:

- **Bank** its best held set.
- **Take a set it can make** (two fossils of the same number it has located).
- **Explore**: peek a fossil it hasn't seen and flip another unseen one (two new facts at once, a chance they match, a chance the new one matches something known).
- **Go for the third gem** when it already knows two (see below).

A position is scored as *equity* — banked points, plus what held sets and known pairs are worth **given how many turns it expects to have left**, plus what spare turns are worth, minus the same for the opponent — turned into a chance of winning. On top of that:

- **The defaults.** Early in the game banking what you hold and taking a set you can make are simply the default moves: a nudge that fades as the game goes on, so later the score and the time left decide. The nudge is smaller for low sets, so a 2 or 3 may not be worth the turn. (Simulation: the nudge costs nothing in strength, so it is on.)
- **Certainty.** A set only counts as certain if it can be sure of where the fossils are. With a fading memory it weighs the chance of recalling both fossils: if the chance is small and it is realistic about its memory (low overconfidence) it explores instead; an overconfident bot goes for it, and a slip taps a random spot.
- **The third gem.** If it has found two gems the naive move is to go for the third. The perfect AI notices this reveals both gems' positions, and does it only when it knows where the third is (or very late, when the odds are good). `gemSense` 0–4 bots always go for it.
- **Mistakes.** With probability `mistakes` it ignores all this and plays a random move.

The expected number of turns left is fitted to simulated games (about 2.2–2.5 turns per set still to be made); how it weighs everything is in `GAME_DATA.ai.tuning`.

## What the simulations taught us (see `REPORT.md`)

1. **Memory is the biggest lever, and a steep one.** Perfect memory beats 0.8 about 97% of the time. Memory 0.8 versus 0.8-and-overconfident makes little difference to win rate (overconfidence changes *how* it loses: it tries matches and misses).
2. **Gems matter.** Always going for the third gem loses to the careful version 67% of the time — the user's intuition that a smart AI shouldn't give two gems away is right.
3. **A mistake rate is a gentle dial.** 10% random moves ≈ a 57% win rate for the perfect player, 25% ≈ 76%. Memory is far steeper (0.8 ≈ 97%). So memory sets the level's *character* and the mistake rate fine-tunes it.
4. **Knowing how long the game has left is worth about 56%** against banking by habit.
5. **Valuing sets by number, watching the lead, and tracking which sets are left made no measurable difference** against a perfect-memory opponent. They change what it takes and leaves, not whether it wins — worth keeping because they make it *look* smarter or dumber, but they won't move the difficulty much.
6. **Three ideas that sounded right lost:** flipping only already-public fossils (to give nothing away) was worse than flipping a new one; an explicit push for the leader to finish and the trailer to stall was worse (knob `endBias` stays 0); and searching ahead (imagining the rest of the game for each option) was no better over 300 games — a first run of 100 said 63%, a lucky run of seeds.

## The levels

| level | memory | overconf. | value | lead | end | sets | gem | mistakes | habits |
|---|---|---|---|---|---|---|---|---|---|
| Beginner | 0.70 | 10 | 0 | 0 | 0 | 0 | 0 | 20% | banks at 2 sets |
| Novice | 0.78 | 8 | 3 | 0 | 0 | 0 | 0 | 12% | banks at 3 sets, or when ≤ 4 fossils are left |
| Normal | 0.84 | 5 | 7 | 3 | 4 | 10 | 5 | 8% | — |
| Challenging | 0.89 | 3 | 10 | 6 | 7 | 10 | 10 | 5% | — |
| Master | 0.94 | 1 | 10 | 10 | 10 | 10 | 10 | 2% | — |

Each level beats the one below it (66–75% head-to-head), and Beginner is deliberately easy: a player with memory 0.7 beats it 63% of the time, while only a player who never forgets beats Master more often than not. **The ladder is calibrated bot against bot; how it feels to a person is for playtesting.** To change a level, edit its line in `campaign.levels` — turn `memory` first, then `mistakes` for fine-tuning, then the skills.

## Making each skill feel alive

A skill only matters to the player if they can *see* it. Ideas, roughly cheapest first — none are built yet:

- **Overconfidence and mistakes** are already the most visible: the opponent goes for a match and taps the wrong spot. A tiny tell makes it a story — a short shake or a "hm?" on a miss, a pleased bounce on a hit.
- **endSense** shows as banking: a low-endSense opponent banks in a rush or leaves sets stranded at the end (the player sees the "Matched, not banked" row); a high one banks just in time. The bank banner can say "Banking before the game ends" for a high-endSense opponent.
- **gemSense** shows when a low-gemSense opponent reveals two gems and the player grabs the third — a visible gift.
- **valueSense** shows as which sets it takes first and what it leaves on the board.
- **leadSense** shows late: a trailing high-leadSense opponent keeps fossils on the board; a leading one hurries.
- A **portrait or name for each opponent** with one line of character does more than any hidden strategy: players mostly watch their own game.

## Play styles and a bigger campaign

If the campaign grows (say 25 levels with different boards and sets), the engine already copes: it reads the board and the fossil set from the game, not from fixed numbers. Differences between opponents will mostly be noticed through memory, mistakes and the few visible quirks above, not through subtle strategy. So rather than many "styles", a few **visible quirks** as profiles are cheap and charming — *the Hoarder* banks late, *the Banker* banks at once, *the Gem Hunter* always goes for the third gem (gemSense 0), *the Gambler* chases big sets. Same engine, different numbers.

## Things worth considering next

- **A tutorial.** The `random` profile exists. A tutorial wants a scripted first game teaching peek / flip / bank, with a gentle opponent that sometimes shows what a good move is.
- **Human-like slips.** A slip currently taps a uniformly random other spot; people more often pick a *neighbouring* fossil, or swap two they half-remember. A near-miss bias would feel more human.
- **Reading the player.** A dashed peek ring tells everyone where a player looked. A smart AI could remember which fossils *you* have peeked at and avoid feeding you pairs.
- **3–4 players.** Only 2-player games use the opponent (Campaign); with more players a smart AI would also target the leader.
- **Adaptive difficulty** (nudge `memory` between games) — optional, off by default so the ladder stays honest.
- **Calibrate against people.** Anonymous per-device counts (games played / won per level) would show where the real difficulty curve bends.
- **A developer "why did it do that?" view** — the planner already produces its candidates and scores (`bot.weigh`).
