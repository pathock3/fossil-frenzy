# Rules questions — running list

Only questions still waiting for the owner are listed (**open**), plus calls I made that you can overrule (**assumed** / **my call**). Anything you have ruled on is removed.

## Written in the sheet itself (Notes column, "Question:")
Read live from the sheet by the lab page ("Questions already written in your sheet"). At the time of writing:
- Prickly Porcupine (PW-04): Masochist traded for arrows (now Rerolls). Is Grit the right reward here? — open
- Falcon Finisher (PW-21): should Grit and bonuses add to this second roll? — open
- Floor Jack (ON-14): should the floor be 4, 5 or 6? — open
- Shoo Spray (IM-27): is a blind move fun, or does it feel like nothing happened? — open (a design question, not a rules one)
- Wormhole (IM-33): is chaining into another Immediate card the fun part of Portal, or was it the free choice? — open (design)

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
23. **Solo Crown Jewel:** the Crown tracker starts at 3 and the Crown is unclaimed. Banking with more Monsters survived than the tracker takes the Crown and sets the tracker to your score (so later rounds must beat your own best). Matching the tracker does not take it. — open
24. **Final round, solo:** "no banking… keep going until you're in the lead or go BOOM." Implemented as: no banking until you have survived more than the tracker; then the Bank pile becomes "Take the Crown" and ends the run in a win. BOOM leaves the Crown on the table. — open
26. **BOOM and the Leaderboard:** a BOOM locks in nothing — Monsters survived in a Dig only count on the Leaderboard when you bank. — assumed (from "BOOM: remove your Pledge marker. Your best-Dig marker stays.")
27. **Escape Bonus die:** the same d10, rolled once per round after you bank. — assumed
28. **Which cards go to the Mine:** every Booster card you own that is not in your Starter Kit is shuffled into the next Mine, so the Mine grows by one card per card kept. Cards are never lost unless you use the optional Advanced trash. — assumed (from "shuffle everything else into your Mine")
30. **Where do cards go at Reset** that were in play (Power/Ongoing cards that were on the table)? They are shuffled back into the Mine like everything else, so a Starter Kit card also returns to the Mine and may be dug later unless you choose it for the kit again. — assumed

## Added while building the AI opponent (you against the most basic AI)
32. **AI pacing:** the AI digs one card each time you tap your Mine (and plays out any Monster it finds), so you watch it climb the Leaderboard as you go; when your Dig is over it finishes its own at once. — my call
33. **AI play (deliberately basic):** it never spends Grit before a roll; after a roll it buys +1s with Grit only to reach the Pet, and rerolls a result of 3 or less; it triggers every eligible Power card, highest number first, then takes the damage; it banks as soon as that would put it in the lead (or when its Health is 3 or less); in the final round it takes the Crown as soon as it can; it pledges 1 more once it has reached the Crown and has 5+ Health; it keeps the first cards a pack offers and picks its Starter Kit at random. It only uses what a player can see (its own Dig and the Leaderboard). Numbers are in `DDB.ai`. — my call
34. **Shared table:** one Booster Deck and one Trash for both players; one Escape Bonus roll per round that everyone who banked adds (rolled for the AI automatically if you went BOOM); the AI does its Prep before you. — assumed (from "one player rolls the die for the whole table")
35. **Winning against the AI:** whoever holds the Crown Jewel when the final round ends. In the final round the first one to get in the lead can take it. — assumed

## Added with your latest rulings (player-chosen triggers, Starter Kit on top of the Mine)
36. **Ongoing cards stay automatic.** You choose which eligible *Power* cards to trigger and in what order, but an Ongoing card's "Whenever…" effect still fires by itself when its event happens. Do you also want to choose whether (and when) each Ongoing card triggers? — open
37. **Conga Crab and Unlucky Duck** ("for each other card that triggers", "if no other card triggers") count the other cards you chose once you have chosen them: they resolve when you take the damage. — my call
38. **No Grit or Rerolls once you start triggering.** The sequence is roll, adjust with Grit/Rerolls, trigger, then damage. — my call
39. **Generator ("at the start of each Dig")** fires when it is dug as part of your Starter Kit (before the first Monster), since the kit is how a Dig starts. — my call
40. **"Trigger all"** is a small chip on the Power line that triggers everything eligible, highest number first. Tapping the Monster takes the damage at once, and any glowing card you did not tap is not used (your ruling). Keep the chip, or remove it? — my call
41. **Panic Button** sends you back to choose your triggers again after its free reroll (gains from cards you already triggered stay). Still open under #10 whether the reroll should let you trigger again at all. — my call
42. **Starter Kit order.** Your kit goes on top of the Mine face up in the order you tap them (1st is dug first); any other card you own is shuffled into the Mine. — ruled by the owner, order mine
