# New Booster cards: the design spaces v2.7 opened up

`NEW-BOOSTERS.csv` holds 32 proposed cards (ids PW-60…, ON-60…, IM-60…). They are **not on the sheet yet**: say the word and I add them. The game already plays all of them (`tests/newcards.test.js`).

## The design spaces
1. **Changing the die after it is rolled.** "+N to your result" lets one Power card pull the next one in (a chain: 4 → 6 → 9 reaches the Pet). Cards: Ladder Lizard, Spring Hare, Jetpack Gull, Tailwind Swift, Mirror Mantis, Daredevil Gerbil (pay 1 Health for +3).
2. **Rules of Extra Rolls** (cap 4, "replace your result" is now a rule cards can bend). Loaded Dice (keep the higher die), Free Spin (the first one costs nothing), Hoarder's Chest (+1 per Extra Roll held), Overflow Valve (pays when an Extra Roll does not fit), Reroll Rebate (pays when you spend one).
3. **The number on the die itself.** Snake Eyes (roll a 1), Lucky Seven, Boxcars (roll a 10) react to the die, Extra Rolls included. Consolation Prize / Hot Streak react to the result you face a Monster with (low / 10+).
4. **Shaping the damage.** Bump Stop (at most 5), Tough Hide (2 or less is nothing), Lucky Number (every 3rd Monster is harmless), Smoke Bomb (next Monster halved), Decoy (next Monster harmless).
5. **Defeating, not just surviving.** Brave Terrier (≤3 damage) and Bulldog Bouncer (≤6) defeat small Monsters: with Bounty Poster, Monster Jerky and Victory Bell they pay.
6. **One-shot ("break") cards.** Phoenix Feather: the first time a Monster would BOOM you, your Health becomes 4 and the card breaks (like Panic Button).
7. **Moving Monsters.** Trapdoor (the next Monster in the Mine goes to the bottom), Dull Claws (every Monster set steps back one on its damage ladder).
8. **Health thresholds.** Full Tank (+2 to rolls at 8+ Health) mirrors Redline (low Health). Panic Possum (≤3 Health: 2 Extra Rolls), Crimson Vial (3 Health for 3 Extra Rolls).
9. **Existing, now cheaper to fill:** Crowd Pleaser (3+ cards trigger), Rejuvenating Spring, Sampler.

## Not built yet (needs a new tap on the table, and a decision for the AI)
- "Once per Monster, you may lose 2 Health to get +3 to your result" (pay Health to bend the die after the roll).
- "Swap your result for 11 minus it" (flip the die), "roll two dice and keep the higher on your first roll".
- A tap-to-use card that changes which Monster you face (swap the Monster with the next card).

## Rebalance of existing cards (from 800 AI packs; the least-picked cards got a little better)
Pick rate was 20–70%; the bottom ones were All In (20%), Thorned Gadget (28%), Floor Jack (28%), Applause Meter (28%), Giant Slayer (30%), Reset Button (30%), Risky Shortcut (30%), Crumple Zone (33%). Changes (fixture and live sheet):
- All In: Health to 2, not 1. Thorned Gadget: costs 1 Health, not 2. Floor Jack: below 5 becomes 5.
- Applause Meter: 3+ cards, not 4+. Giant Slayer: 6+ damage, not 7+. Reset Button: Health to 8. Risky Shortcut: lose 1, not 2. Crumple Zone: 4+ damage, not 5+.
Cave Scout and Wrecking Ball were also low but are situational, so I left them; the 12 Grit cards and their proposed rewrites are in `QUESTIONS.md`.
