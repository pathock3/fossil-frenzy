# The AI opponent — how it plays, and how we measured it

Goal of this phase: **play as close to perfectly as we can**. Only then decide how (and how much) to play worse on purpose.

## What it is

`AI` (script `ai` in `index.html`). It plays only from what a player can see: its own Mine's *cards* (not their order beyond what it has seen) and the Leaderboard. It never reads the opponent's Dig. (A test shuffles the hidden part of its Mine and checks it decides the same.)

* **Thinking ahead.** Each decision is tried on copies of the Dig (`Dig.clone`) with the unseen cards shuffled, played out with a quick policy, and the option with the best average value wins:
  * *Dig on or bank?* — "bank now" against "play on until N Monsters have been survived, then bank" for several N.
  * *Fights* — it triggers everything, highest first (the usual play), and only does something else (reroll, skip a card, another order) when that is clearly better.
  * *Cloning Machine* — which Power card to put it under.
* **What a finished Dig is worth** (`DDB.ai.phi`): the chance of winning the Crown from "rounds left, my best, their best, who holds the better spot when level" — measured in self-play (`tools/gather.js`). In the last round it is simply "did I get ahead, and stay alive".
* **Prep.** A deck is worth the average value of the Digs it makes. The AI keeps the cards, and builds the Starter Kit (cards and order), that make its next Dig most valuable — aimed at the opponent's current best, so it is trying to get **ahead** of it (not just to survive more). Empty Kit places are gems (face-up Geodes), so a card must beat a gem to earn its place.
* **The last round**: the leader waits, everyone else digs (the existing rule). We tested "the leader keeps digging too": it loses badly (27% against waiting) — waiting keeps your last Dig in hand for when you are passed.
* `AI.basic` is the old simple AI (kept for comparison, and as a starting point for playing worse on purpose).

## What we measured (simulated matches, 4 rounds, seats swapped; ±4–5 points at 400–800 matches)

| A | B | A wins |
|---|---|---|
| old AI | old AI | 51% |
| thinking AI, old Prep | old AI | 52% (the Dig play alone changes little) |
| **old Dig play + new Prep** | old AI | **79%** |
| thinking AI (both) | old AI | **75%** |
| new Dig-or-bank choice, old fight rules | new Prep, old Dig play | 55% |
| new fight choices with no margin | same | 45% — the extra rerolls are noise; hence the margin |
| new Prep with 3× more simulations | new Prep | **56%** — more thinking is stronger |
| leader keeps digging in the last round | waits | 27% |

Findings:

1. **The deck is the lever.** Choosing pack cards and the Kit by *simulated value toward getting ahead* is worth about +28 points over choosing the first cards. Per-card averages are not enough: a card is worth what it adds to the Digs you will actually play.
2. **Standing is worth a lot.** From the measured table: with weak decks, being ahead by one at the start of the last round wins ~75–80%. With strong decks (everyone reaches 5–7 Monsters) the leader still wins ~63%, and who holds the better spot in a tie matters little.
3. **In-Dig play has little headroom** once the deck is good: the decisions are few, and a plain "trigger everything, highest first" is already near the best fight play. The best gain is knowing when to bank/dig on.
4. **More simulations help** (Prep: 60 → 200 playouts is worth ~+5). That is the natural knob for playing worse on purpose.

## How to re-measure (Node ≥ 20, no browser)

```
node games/dig-dig-boom/tools/run.js base base 2000                # old AI vs itself
node games/dig-dig-boom/tools/run.js rollout base 600              # the thinking AI vs the old one
node games/dig-dig-boom/tools/run.js 'rollout:{"prepSims":200}' rollout 400
node games/dig-dig-boom/tools/gather.js rollout rollout 2000 phi.json 3,4,5   # re-measure the win-chance table (slow)
node games/dig-dig-boom/tools/ahead.js rollout base 800            # who wins from which position before the last round
```
A brain spec is `base`, `rollout`, `smartprep` (old Dig play, new Prep), `rolldig`, `rollact`, `finaldig`, with optional JSON overrides of `DDB.ai.think` (and `phi`: a file written by `gather.js`). When the rules, the card pool or the number of rounds change, re-run `gather.js` and paste the new table into `DDB.ai.phi`.

## Knobs for playing worse on purpose (next phase — not built)

`DDB.ai.think` already holds the numbers that make it weaker or stronger without changing code: `prepSims`/`screenSims` (how well it builds a deck), `rolls`/`idleRolls` (how well it judges bank-or-dig), `bankAt`, `fightMargin`, `lambda`. Beyond these: pick the second-best option now and then, forget the cards it has seen, ignore the opponent's best, play the old AI's rules of thumb (`AI.basic`).

## Things the simulations turned up (for the owner)

* **Echo + Rewind Tape can loop for ever.** Rewind Tape puts the top Immediate of the discard pile on top of the Mine; Echo copies it. With both in the Mine, digging them can alternate without end. In a normal round the AI banks after 40 cards (`giveUpDigs`); in the **last round nobody can bank**, so the round never ends. The AI's deck simulations treat a loop as a lost Dig (cut off after 70 cards), so it should avoid keeping the pair — not yet checked on its own — but a rule is needed (see QUESTIONS.md).
* Ties on the Leaderboard are decided by who reached the number first, which in a simulation is decided by card count. In real play it is decided by who is faster — a fast human always beats the AI's 1.1 s-per-card clock in a tie.
