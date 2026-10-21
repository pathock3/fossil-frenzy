# Rules questions — running list

Only questions still waiting for the owner are listed (**open**), plus calls I made that you can overrule (**assumed** / **my call**). Anything you have ruled on is removed.

## Written in the sheet itself (Notes column, "Question:")
Each is a note you wrote on a card. Card text is quoted exactly.
- **Prickly Porcupine** (Power, number 1): "Lose 1 {heart}, then +2 {grit}". Your note: Masochist traded for arrows (now Rerolls) — is Grit the right reward here? — open
- **Falcon Finisher** (Power, number 8): "Roll again. If it's 10 or more, defeat this Monster". Your note: should Grit and bonuses add to this second roll? Right now the second roll counts only the cards' roll bonuses (like Tune-Up), not Grit you spent. — open
- **Floor Jack** (Ongoing): "If your result is less than 4, it becomes 4". Your note: should the floor be 4, 5 or 6? — open
- **Shoo Spray** (Immediate): "+2 {grit}. Move the top card of your Mine to the bottom without looking". Your note: is a blind move fun, or does it feel like nothing happened? — open (a design question, not a rules one)
- **Wormhole** (Immediate): "Reveal cards from your Mine until you find an Immediate card. Do it, then shuffle the rest back". Your note: is chaining into another Immediate card the fun part of Portal, or was it the free choice? — open (design)

## About a Dig (each is one line in `DDB.rules`, so easy to change)
9. **Order of result changes:** Tune-Up and friends add; Wrecking Ball doubles; Backfire turns 1 into 10; Floor Jack lifts below 4 to 4. Default: add, then double, then "becomes", then "less than" (`rulings.transformOrder`). Second Spark (3 or less rerolls free) looks at the result *before* the double/becomes/floor changes, once per Monster. — open
10. **Panic Button:** the free reroll happens after the line has triggered and before damage; does the rerolled result trigger the line *again* (so heals and Grit stack)? Default: yes (`rulings.panicRetriggers`). — open
13. **"Whenever you gain …" at a full track:** does gaining Health at 10 (a full track) still count? Default: no — the track has to actually move (`rulings.gainAtCapFires`). — open
15. **Losing Health to a card** (Prickly Porcupine, Risky Shortcut) can take you to 0 and BOOM you. Default: yes. Lucky Cricket only protects against a Monster's damage. — open
16. **Sneak Attack** defeats the dug Monster without a roll — it counts as survived (and defeated, so Monster Jerky and Bounty Poster apply). — assumed
17. **Cloning Machine** goes under a Power card of your choice, the Pet included. If you move that card later, the clone goes with it. — assumed
18. **A Monster beyond the Mine** has no card, only a number: it appears when you dig from an empty Mine. — assumed
19. **Damage you take** is reduced by Block *and* by Bumper; "first Monster deals no damage" (Cowcatcher) applies to the first Monster dug this Dig, including one you only revealed with Cave Scout until you actually face it. — assumed
20. **Magpie/Echo** copy the top Immediate card of the discard pile, not the cards that copied it (two Echoes in a row copy nothing). — assumed

## Added while building the run (Booster Pack, Prep, Leaderboard) for one player
22. **Before round 1:** you have no cards to make a Starter Kit from, so a run opens with a Bronze Pack (`run.firstPack`) and a kit of 1. Is that how it starts? — open

## Added with your rulings (player-chosen triggers, Starter Kit on top of the Mine, AI, no pledging)
36. **Ongoing cards stay automatic.** You choose which eligible *Power* cards to trigger and in what order, but an Ongoing card's "Whenever…" effect still fires by itself when its event happens. Do you also want to choose whether (and when) each Ongoing card triggers? — open
37. **Conga Crab and Unlucky Duck** ("for each other card that triggers", "if no other card triggers") count the other cards you chose once you have chosen them: they resolve when you take the damage. — my call
38. **No Grit or Rerolls once you start triggering.** The sequence is roll, adjust with Grit/Rerolls, trigger, then damage. — my call
39. **Generator ("at the start of each Dig")** fires when it is dug as part of your Starter Kit (before the first Monster), since the kit is how a Dig starts. — my call
40. **"Trigger all"** is a small chip on the Power line that triggers everything eligible, highest number first. Tapping the Monster takes the damage at once, and any glowing card you did not tap is not used (your ruling). Keep the chip, or remove it? — my call
41. **Panic Button** sends you back to choose your triggers again after its free reroll (gains from cards you already triggered stay). Still open under #10 whether the reroll should let you trigger again at all. — my call
42. **Starter Kit order.** Your kit goes on top of the Mine face up in the order you tap them (1st is dug first); any other card you own is shuffled into the Mine. — ruled by the owner, order mine
43. **Final round, who is "last standing".** Banking in the final round is the usual Bank pile, allowed only once you are in the lead (past the Crown tracker, or level with it on a better spot). The round goes on until every player has banked or gone BOOM; I did not end it the moment only one player is left, so a lone survivor still has to get into the lead to bank (a player already holding the Crown has to reach their own number again). Is that right, or should the last player not to have gone BOOM win at once? — assumed
44. **How the AI decides** (numbers in `DDB.ai`): it never spends Grit before a roll (it knows nothing yet). After the roll it spends Grit (3 for +1) to reach the Pet if it can, else the nearest card above its result; it rerolls when the Pet is out of reach or no card on its line has triggered; then it triggers everything and takes the damage. It banks when its Health is 3 or less, or when banking would put it in the lead and its Health is under 6 ("not confident"); with Health 6 or more it keeps digging. It keeps the first cards a pack offers and picks its Starter Kit at random. — my call
45. **AI clock:** it digs one card every 1.1 seconds on its own while you play (a Monster, with its rolls, counts as one card). When your Dig is over and it is not, a Fast forward button on the BOOM/Banked panel makes it 0.06 seconds a card. Prep waits for it. — my call
46. **Prep at the same time:** the AI opens its Booster Pack the moment you open yours (yours is drawn first), then keeps cards and chooses its kit without seeing yours. Its Escape Bonus is the same single roll as yours. — my call
