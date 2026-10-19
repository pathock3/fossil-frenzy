# The opponents — how the AI thinks, and how the levels are built

Everything an opponent does comes from **one decision engine** (the `bots` script in `index.html`) plus a **profile**: a score from 0 to 10 for each of eight named **skills** (`GAME_DATA.skills` lists them with a name and a description). The perfect player scores 10 on every skill; every easier opponent is the same engine with some skills turned down. A campaign level *is* a profile — changing a level means changing numbers in the data block, nothing else.

## What an opponent may know

The same as a person at the table, and no more: the public view of the game, every public flip and every set popped (so it can work out which sets are still out there), and its **own** peeks. It never sees a face-down fossil's value — tested: its decision is unchanged when the hidden values are changed behind its back (`tests/ai.test.js`), and the public view contains none (`tests/view.test.js`).

## The eight skills (each 0–10)

| skill | low means… | 10 means… |
|---|---|---|
| **Memory** | each turn that passes it forgets more; acting on an old memory it often taps the wrong spot — half the time the fossil *next to* the right one | never forgets |
| **Self-awareness** | overconfident: trusts a fading memory fully, goes for matches it can't reliably make, and sometimes gets them wrong | knows how reliable its memory is: if it half-remembers a pair it explores instead |
| **Value sense** | every set looks the same — it takes a pair of 2s as eagerly as a pair of 9s | knows high sets are worth far more, so it may leave a pair of 2s and spend the turn better |
| **Lead sense** | plays for points | plays for the **win**: weighs its lead or deficit against what is left to play for |
| **Endgame sense** | (0–0.5) banks as soon as it holds 2 sets; (up to 2.5) banks at 3 sets or when ≤ 4 fossils are left; above that it works it out, noticing the end only when it is within that fraction of 18 of its own turns | knows how close the end is: banks before time runs out, values a turn by how many remain |
| **Set tracking** | (below 5) no idea which sets are still on the board | tracks every set popped, so it knows exactly what is still out there |
| **Gem sense** | (below 5) found two gems? it always goes for the third — which shows everyone both gems' positions | understands that, and goes for the third only when it knows where it is (or very late) |
| **Focus** | slips: plays a random move now and then instead of its best | never slips |

What the numbers mean (set in `GAME_DATA.ai.tuning`):

| Memory skill | a memory survives a turn | 4 turns later | 8 turns later | | Focus | random moves |
|---|---|---|---|---|---|---|
| 0 | 50% | 6% | 5% (floor) | | 0 | 50% |
| 4 | 70% | 24% | 6% | | 5 | 25% |
| 6 | 80% | 41% | 17% | | 6 | 20% |
| 8 | 90% | 66% | 43% | | 8 | 10% |
| 9 | 95% | 81% | 66% | | 9.5 | 2.5% |
| 10 | 100% | 100% | 100% | | 10 | 0% |

When memory slips the bot is *confidently wrong*: it believes it knows where the pair is, taps somewhere else, and reveals something it didn't mean to. What it saw this very turn is always exact; a 5% floor stops a very forgetful opponent from being stuck for ever.

`random` is a separate profile for a **tutorial opponent**: it taps at random.

## How the perfect AI decides what to do with its turn

At the start of a turn it has up to four candidates and scores each by the position it leads to:

- **Bank** its best held set.
- **Take a set it can make** (two fossils of the same number it has located).
- **Explore**: peek a fossil it hasn't seen and flip another unseen one (two new facts at once, a chance they match, a chance the new one matches something known).
- **Go for the third gem** when it already knows two.

A position is scored as *equity* — banked points, plus what held sets and known pairs are worth **given how many turns it expects to have left**, plus what spare turns are worth, minus the same for the opponent — turned into a chance of winning. On top of that:

- **The defaults.** Early in the game banking what you hold and taking a set you can make are simply the default moves — a nudge that fades as the game goes on, so later the score and the time left decide. It is smaller for low sets, so a 2 or 3 may not be worth the turn. (In simulation the nudge costs nothing in strength.)
- **Certainty.** A set only counts as certain if it can be sure where the fossils are. It weighs its chance of recalling them; if that is small and it is self-aware it explores instead; an overconfident bot goes for it, and a slip taps a nearby or random spot.
- **The third gem.** The naive move, on finding two gems, is to go for the third. The perfect AI sees that this reveals both positions, and does it only when it knows where the third is (or very late, when the odds are good).
- **Focus.** With probability (focus slip rate) it ignores all this and plays a random move.

The expected number of turns left is fitted to simulated games (about 2.2–2.5 turns per set still to be made).

## What the simulations taught us (see `REPORT.md`)

1. **Memory is the biggest lever, and a steep one.** Perfect memory beats Memory 6 (survives a turn 80%) about 98% of the time. Self-awareness barely changes the win rate (it changes *how* the bot loses: it tries matches and misses).
2. **Gem sense matters.** Always going for the third gem loses to the careful version about 2 games in 3.
3. **Focus is a gentle dial.** A random move 10% of the time ≈ a 57% win rate for the perfect player, 25% ≈ 76%; memory is far steeper. So Memory sets a level's *character* and Focus fine-tunes it.
4. **Endgame sense is worth a little**: banking as soon as it holds two sets (no sense at all) loses only 52% to the perfect player. It matters more when combined with a fading memory, and it is the most visible skill.
5. **Value sense, Lead sense and Set tracking made no measurable difference** against a perfect-memory opponent. They change what it takes and leaves, not whether it wins — worth keeping because they make it *look* smarter or dumber.
6. **Three ideas that sounded right lost:** flipping only already-public fossils (to give nothing away) was worse than flipping a new one; an explicit push for the leader to finish and the trailer to stall was worse (`endBias` stays 0); and searching ahead (imagining the rest of the game for each option) was no better over 300 games — a first run of 100 said 63%, a lucky run of seeds.

## The levels — chosen for a smooth climb

| level | Memory | Self-aware. | Value | Lead | Endgame | Sets | Gem | Focus |
|---|---|---|---|---|---|---|---|---|
| Beginner | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 6 |
| Novice | 5.6 | 3 | 3 | 3 | 3 | 3 | 3 | 7.2 |
| Normal | 6.8 | 5 | 6 | 6 | 6 | 6 | 6 | 8.1 |
| Challenging | 7.7 | 7 | 8 | 8 | 8 | 8 | 8 | 8.9 |
| Master | 8.5 | 9 | 10 | 10 | 10 | 10 | 10 | 9.5 |

How they were picked: the two ends first — **Beginner deliberately easy** (a new player should feel good: it forgets a lot, is overconfident, slips one move in five, always goes for the third gem and banks as soon as it holds two sets) and **Master hard but beatable** (strong play but a memory that still fades, and a slip one move in forty). Everything in between rises together along that line; the positions along it (0, 0.33, 0.58, 0.77, 1) were found by simulation so that **each level beats the one below it by about the same margin** (67%, 71%, 70%, 70% head-to-head, REPORT.md Table 6). A player with perfect play but a memory that survives a turn 80% of the time beats Beginner 81% of the time, Normal 46%, Master 11.5%.

**This is calibrated bot against bot. How it feels to a person is for playtesting** — turn Memory first, then Focus for fine-tuning, then the senses.

## Making the AI feel alive

Built so far:
- **A visible tell.** When an opponent slips — taps the wrong spot, or plays a random move — it mutters something ("Hm…", "Oops!", "Wait — no.") on its score box until you act.
- **Near misses.** A memory slip is a neighbouring fossil half the time, as a person half-remembering would tap.

Ideas, roughly cheapest first:
- A short shake or "hm?" at the moment of a miss, and a pleased bounce on a match.
- **Endgame sense** shows as banking: a low-sense opponent banks in a rush or leaves sets stranded (the player sees "Matched, not banked"); a high one banks just in time. The bank banner could say "Banking before the game ends".
- **Gem sense** shows when a low-sense opponent reveals two gems and the player grabs the third.
- A **portrait or name for each opponent** with one line of character, plus the skill list from `GAME_DATA.skills` as a small card (names and bars only — no percentages).

## Play styles (saved for later)

If the campaign grows (say 25 levels with different boards and sets) the engine already copes: it reads the board and the fossil set from the game. A few visible quirks as profiles would be cheap and charming — a Hoarder who banks late, a Banker who banks at once, a Gem Hunter who always goes for the third gem. Not built.

## Things worth considering next

- **A tutorial.** The `random` profile exists; a tutorial wants a scripted first game and a gentle opponent that sometimes shows what a good move is.
- **Reading the player.** A dashed peek ring tells everyone where a player looked. A smart AI could remember which fossils *you* have peeked at.
- **3–4 players.** Only 2-player games use the opponent (Campaign).
- **Adaptive difficulty** (nudge Memory between games) — optional, off by default so the ladder stays honest.
- **Calibrate against people** with anonymous per-device counts (games played / won per level).
- **A developer "why did it do that?" view** — the planner already produces its candidates and scores (`bot.weigh`).
