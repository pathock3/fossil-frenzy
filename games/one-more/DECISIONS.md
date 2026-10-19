# DECISIONS — One More…

Unclear rules and judgment calls. The owner can overrule any of them; most are single values in the data block (`GAME_DATA` in `index.html`) and every one has a test. The in-game *How to play* panel lists the ones that matter at the table (its "fine print").

## Where the rules come from
1. **`rulebook.md` is the source** (Patrick's rulebook, last updated Sep. 2024). `SPEC.md` is the design of the digital version. Where the owner corrects either, the correction wins.
2. **38 gem cards and 6 boom cards.** One gem card = one gem. A card is just a number in the data block's deck (`deck.gems`, `deck.booms`); how a gem is *drawn* (one of four colours) is decoration only and never affects play.

## The rules, as built
3. **A turn:** draw cards (as many as you like). A boom ends the turn at once and loses this turn's gems; the turn's cards and the boom go to the boom pile, boom face up, so everyone can see how many booms are out (a counter and six pips show it). A gem is a choice: save, or draw again. Saving puts the gems in your safe pile for good and ends the turn.
4. **Two players:** the first to save 20 gems wins (`rules.race`). If both reach 19 (every gem is saved) it is a tie. Gems at risk on the table do not count. **Three to six players:** the game ends the moment all 38 gems are saved; most gems wins.
5. **The end is checked after every save.** In a two-player game the second reason (all gems saved, neither on 20) can only be 19–19, so it is a tie.
6. **Refresh after the 6th boom.** When the last boom is drawn it stays on the table until a tap, like every boom; the refresh happens as the turn passes: every card nobody has saved (boom pile, lost gems, what is left of the draw pile) is shuffled into a new draw pile.
7. **Refresh when only booms remain (judgment).** The rulebook lets a player refresh when they notice every card left in the draw pile is a boom. Digital: it happens automatically at the moment it becomes true — declining is never better. The gems at risk stay on the table and are not shuffled in. It only happens if the shuffle brings at least one gem back (otherwise every unsaved gem is already on the table; the player can only save, or draw a certain boom). It is also checked as a turn passes.
8. **A refresh never shuffles the cards on the table** in the current turn, and never a saved gem.
9. **Ties in 3–6 players** are a shared win; every tied seat is marked as a winner. Two players tied at 19–19 is a tie.
10. **Rematch order** (as the rulebook says): fewest gems goes first, then second fewest, and so on; seats with equal scores keep their previous relative order. Two players: the loser first; after a tie, the player who went second (the rulebook says "the loser goes first"; with a tie there is none). The first game's order is random: the seats from the setup screen are shuffled into a random turn order. Each person keeps their colour.
11. **No limit on cards drawn** in a turn. You cannot save with nothing drawn.

## Not built
12. **The drinking variant** (when you go boom, drink!) is not in the digital game.
13. **The Booby Prizes expansion** (16 prize cards) is not built: the rulebook does not list what the cards do. The data block has a reserved `expansions.boobyPrizes` entry (not available) and the deck is data, so a prize deck can be added later. Nothing in the engine is expansion-aware yet.

## The computers
14. **Information discipline:** a computer is given `Engine.publicView` only: the draw pile's *count*, how many booms are out (so also how many gems and booms are left in the pile, which follows from public facts), its own gems at risk, and everyone's saved gems. Never the order of the draw pile. A test shuffles the hidden order and checks the decision does not change.
15. **The decision:** dig again while G/(G+B) > g′/(g′+1), with G gems and B booms left in the draw pile, g gems at risk, and g′ = g ÷ risk. That is "keep digging while the expected gain is positive" with the style's boldness (`styles[].risk`) applied.
16. **Three named styles** — Careful (risk 0.75), Steady (1), Daring (1.3). SPEC.md lists the scale as ≈0.75×, 1×, 1.3× "on g" in the order Careful, Steady, Daring; taken literally on g that would make Careful bolder, so the number is applied as *boldness* (g′ = g ÷ risk): Careful saves earlier, Daring digs longer. On a fresh pile Careful saves at 5 gems, Steady at 7, Daring at 9. In simulation (`tools/simulate.js`) the styles are close in strength — greed pays slightly in a long game, caution is safer in a race — so any of them is a fair opponent.
17. **Two-player race adjustment** (SPEC: "more risk when the opponent is near 20, less when they are far ahead of the target"): the computer's risk is multiplied by `bots.race.nearRisk` (1.35) when the other side is within 4 of the target, and by `farRisk` (0.85) when the other side is 12 or more away from it. Both are data. A computer always saves if that reaches the target, or ends a 3–6 player game with it in front.
18. **A computer's turn is shown one draw at a time**; then it waits for a tap before the next player (as in Fossil Frenzy). A tap anywhere during it skips to the end of its turn (and does not also pass the turn). With the device's reduced-motion setting on, its whole turn is shown at once. All-computer tables are allowed (you can watch, tapping to go on).

## UI
19. **The table is the UI:** tap the draw pile to dig; tap your gems on the table (or your safe pile) to save; tap anywhere to go on after a boom or a computer's turn. No Draw/Save buttons. A tap saves only when it lands on the gems (or within a finger's width of them): a stray tap on the empty felt does nothing, because banking a turn by accident is the worst mistake this game has. Tapping your own safe pile saves from anywhere on it.
20. **A boom stays until a tap**, with the lost gems greyed beside it. Taps in the first 0.45 s (`pace.boomGuardMs`) are ignored, so a quick digger tapping the pile does not skip the boom by accident.
21. **Nothing advances on a timer** except animations and a computer's moves (and the game-over screen, which appears about a second after the last save so the gems can land; a tap shows it at once).
22. **Scores count up** as saved gems land in the pile. The score is the biggest number at every seat; in a two-player game a small "/20" shows the target.
23. **Setup:** 2–6 seats, each Human or Computer (a Computer picks one of the three styles). The setup, sound and prompts are remembered on the device (`tabletop-library-one-more-…`). Default: You + a Steady computer. Names default to "You", "Player N" or the style's name (numbered if repeated); a name typed in stays.
24. **Prompts above the table** ("Tap the pile to dig." …) show until this device has finished one game, then go quiet (Settings → Prompts: Auto / On / Off).
25. **Save and resume:** the game saves to the browser after every action (even with a boom showing or a computer waiting to be tapped) and resumes on load; the random numbers' position is saved, so a resumed game plays on exactly as it would have. A save from other rules or a damaged one is cleared with a quiet note.
26. **Menu (☰):** How to play, Sound on/off, Settings, Restart, Main menu; Restart and Main menu ask first while a game is in progress. Restart deals a new game at once with the same people (in a fresh random turn order); Main menu goes back to the home screen.
27. **Sound** is synthesised (Web Audio, recipes in the data block): a card tick, a glint that climbs a pentatonic scale with each gem of a run, a clink for each gem landing in your pile (rising too) and a chime, a boom with a low rumble, a shuffle, and a fanfare for the win. On/off in the menu and Settings, remembered. The iPad's silent switch still mutes it.
28. **Motion** honours the device's reduced-motion setting: no shake, flash or flying — cards still end up where they belong.
29. **The library link** (‹ Tabletop Library) appears on the home screen when the game is served over http(s).
30. **Thumb zone (owner request):** the draw pile — the most-tapped control — is in the bottom-right corner (landscape: right column, bottom; portrait and phone: bottom row, right), with a ~10px extra tap margin; the boom pile, which is only looked at, is opposite (top-left / bottom-left). The saved-gems taps stay on the gems. Settings → Draw pile can mirror the layout for left-handed play (remembered). The seats stay along the top, the menu button top-left.
