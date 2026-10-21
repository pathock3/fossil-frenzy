# Rules questions — running list

Status: **open** = waiting for the owner. **ruled** = answered (the answer is in the data block of `index.html`).

## Written in the sheet itself (Notes column, "Question:")
Read live from the sheet by the lab page ("Questions already written in your sheet"). At the time of writing:
- Prickly Porcupine (PW-04): Masochist traded for arrows (now Rerolls). Is Grit the right reward here? — open
- Falcon Finisher (PW-21): should Grit and bonuses add to this second roll? — open
- Floor Jack (ON-14): should the floor be 4, 5 or 6? — open
- Shoo Spray (IM-27): is a blind move fun, or does it feel like nothing happened? — open (a design question, not a rules one)
- Wormhole (IM-33): is chaining into another Immediate card the fun part of Portal, or was it the free choice? — open (design)

## Mine, from reading the Rules tab for the engine
1. **Order of triggered cards** ("Trigger order" is still an open decision in your sheet): when a roll triggers several Power cards, does the order they resolve in ever matter? Until you rule, the engine resolves them left to right by printed number, highest first, and logs the order. — open
2. **Block vs. damage order:** "Resolve all triggered cards, then take damage." Block is a Power-card effect that lowers the damage. Is Block applied to the Monster's damage before halving effects (Venom Spider) or after? Default: halve first, then Block. — open
3. **"Defeat the Monster" and Grit:** the Pet triggers on a final result of 10 or more. Is the result after Grit and Rerolls and bonuses the one compared? (The Rules tab says "Cards use the final result after Grit, Rerolls and bonuses", so yes — listed only so you can confirm.) — assumed yes
4. **Grit before the roll:** "+1 per Grit on that roll, for you only." Does Grit spent before a roll carry onto a reroll of that same Monster? (The v2.6 rulebook says yes.) Default: yes. — open
5. **After-roll Grit:** "3 Grit for +1." Can you buy several +1s in one go (6 Grit for +2)? Default: yes, any number you can afford. — open
6. **Banking threshold in the solo Dig:** "You may bank any time after you reach your Pledge." In a solo Dig with no other players, what is the Pledge? Default (now in the solo Dig): no Pledge — you may bank between any two cards, never in front of a Monster. — open
7. **Monster damage numbering:** "Each copy dug this Dig deals the next number" — across both Monster sets together, or per set? Default: per set (A: 1, 3, 5, 7; B: 2, 4, 6), with the "beyond the Mine" Monsters continuing 8, 9, … — open
8. **Immediate card while a Monster is unresolved:** can a Monster be dug while another is in progress? Default: no — a Monster is fully resolved (roll, triggers, damage) before the next card is dug. — open

## Added while building the solo Dig (each is one line in `DDB.rules`, so easy to change)
9. **Order of result changes:** Tune-Up and friends add; Wrecking Ball doubles; Backfire turns 1 into 10; Floor Jack lifts below 4 to 4. Default: add, then double, then "becomes", then "less than" (`rulings.transformOrder`). Second Spark (3 or less rerolls free) looks at the result *before* the double/becomes/floor changes, once per Monster. — open
10. **Panic Button:** the free reroll happens after the line has triggered and before damage; does the rerolled result trigger the line *again* (so heals and Grit stack)? Default: yes (`rulings.panicRetriggers`). — open
11. **Die size:** ruled by the owner — a d10 (`rules.die`). — **ruled**
12. **Starting spaces:** ruled by the owner — Health 0–10 starting at 10; Grit 0–6 starting at 0; Rerolls 0–3 starting at 0 each round (`rules.start`, `rules.caps`). — **ruled**
13. **"Whenever you gain …" at a full track:** does gaining Health at 12 still count? Default: no — the track has to actually move (`rulings.gainAtCapFires`). — open
14. **Immediate cards in the Starter Kit:** the Rules tab says you "start the next Dig with" the chosen cards. Immediates would do nothing in play, so they are shuffled into the Mine (`rulings.kitImmediates`). — open
15. **Losing Health to a card** (Prickly Porcupine, Risky Shortcut) can take you to 0 and BOOM you. Default: yes. Lucky Cricket only protects against a Monster's damage. — open
16. **Sneak Attack** defeats the dug Monster without a roll — it counts as survived (and defeated, so Monster Jerky and Bounty Poster apply). — assumed
17. **Cloning Machine** goes under a Power card of your choice, the Pet included. If you move that card later, the clone goes with it. — assumed
18. **A Monster beyond the Mine** has no card, only a number: it appears when you dig from an empty Mine. — assumed
19. **Damage you take** is reduced by Block *and* by Bumper; "first Monster deals no damage" (Cowcatcher) applies to the first Monster dug this Dig, including one you only revealed with Cave Scout until you actually face it. — assumed
20. **Magpie/Echo** copy the top Immediate card of the discard pile, not the cards that copied it (two Echoes in a row copy nothing). — assumed

## Added while building the run (Booster Pack, Prep, Leaderboard) for one player
21. **Reward ladder:** the Rules tab says it "needs a new version". Placeholder in `DDB.run.ladder`: 0 gems = Bronze (draw 3, keep 1), 10 = Bronze+ (4, 1), 20 = Silver (4, 2), 30 = Gold (5, 3) — following your hint (20 gems = 2 keeps, 30 = 3). A BOOM opens a Bronze Pack. — open
22. **Before round 1:** you have no cards to make a Starter Kit from, so a run opens with a Bronze Pack (`run.firstPack`) and a kit of 1. Is that how it starts? — open
23. **Solo Crown Jewel:** the Crown tracker starts at 3 and the Crown is unclaimed. Banking with more Monsters survived than the tracker takes the Crown and sets the tracker to your score (so later rounds must beat your own best). Matching the tracker does not take it. — open
24. **Final round, solo:** "no banking… keep going until you're in the lead or go BOOM." Implemented as: no banking until you have survived more than the tracker; then the Bank chest becomes "Take the Crown" and ends the run in a win. BOOM leaves the Crown on the table. — open
25. **Pledge, solo:** with no opponents there is no "dibs", so a pledge only forces you to reach that number before banking (and BOOM drops it). Is a solo Pledge worth having at all? — open
26. **BOOM and the Leaderboard:** a BOOM locks in nothing — Monsters survived in a Dig only count on the Leaderboard when you bank. — assumed (from "BOOM: remove your Pledge marker. Your best-Dig marker stays.")
27. **Escape Bonus die:** the same d10, rolled once per round after you bank. — assumed
28. **Which cards go to the Mine:** every Booster card you own that is not in your Starter Kit is shuffled into the next Mine, so the Mine grows by one card per card kept. Cards are never lost unless you use the optional Advanced trash. — assumed (from "shuffle everything else into your Mine")
29. **Five rounds:** the Round tracker lists 1, 2, 2, 3 for four rounds; for five I use 1, 2, 2, 3, 3 (`rules.kitSizes` repeats the last number). — open
30. **Where do cards go at Reset** that were in play (Power/Ongoing cards that were on the table)? They are shuffled back into the Mine like everything else, so a Starter Kit card also returns to the Mine and may be dug later unless you choose it for the kit again. — assumed
