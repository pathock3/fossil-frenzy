# One More… — Build Spec

Source: `rulebook.md` (Patrick's rulebook). No separate spec was given; this file records Claude's design so the owner can correct it. Where the rulebook is silent, choose the most sensible reading and log it in DECISIONS.md AND in the in-game How to play fine print. The owner's corrections are final — apply them literally.

## What it is
A 2–6 player push-your-luck game on one device (Pass & Play), plus computer opponents so one person can play alone. 38 gem cards + 6 boom cards in a draw pile. On your turn you draw until you save or go boom.

## Rules to implement exactly (from the rulebook)
- Setup: all 44 cards shuffled face down into the draw pile; random turn order.
- Your turn: draw cards. A **boom** ends your turn at once and you lose every gem drawn this turn; all cards drawn this turn go to the boom pile (boom face up, visible to everyone, so players can see how many booms are out). A **gem** gives a choice: **save** (the turn's gems go to your safe pile, can never be lost, turn ends) or **draw again**.
- When the 6th (final) boom is drawn, refresh the draw pile: shuffle all cards NOT saved by players into a new draw pile; play continues with the next player.
- If all cards left in the draw pile are booms, the player may refresh the draw pile and continue their turn. (Digital: this happens automatically at the moment it becomes true — see judgment calls.)
- 3–6 players: the game ends when all gems have been collected and the only cards remaining are the 6 booms. Most gems wins. Play again: fewest gems goes first, then second fewest, and so on.
- 2 players: first to collect 20 gems wins; if both reach 19 they tie (that is every gem collected, 19–19). Play again: the loser goes first.
- One gem card = one gem. (38 gems; 20+19 would exceed 38, which is why 2 players play to 20.)
- Not in the digital game: the drinking variant. The Booby Prizes expansion cannot be built (the rulebook does not say what the 16 cards do) — leave it out, note it in DECISIONS.md, and structure the data block so a prize deck could be added later.

## UI philosophy (same as the whole library — see CLAUDE.md and games/fossil-frenzy)
- The table is the UI: tap the **draw pile** to draw; tap your **gems on the table** (the row you have drawn this turn) or your safe pile to save them. No "Draw"/"Save" verb buttons, no modals for game actions. Obvious outcomes resolve themselves. System chrome (menu, help) stays small and quiet.
- Nothing advances on a timer except animations: the player owns pacing. After a boom, the boom stays on the table until a tap passes the turn.
- Page locked: no scrolling, no rubber-banding, no pull-to-refresh; taps register instantly. Playable by touch on an iPad in Safari, also fine on phones and desktop.
- Quiet UI for unimportant features, big for important ones. Atmosphere over panels: stunning visuals/audio welcome, clutter is not.
- Show clearly (publicly): whose turn it is; each player's safe gem count (big); the gems drawn this turn; the draw pile (cards left); the boom pile (how many booms are out of 6). These are public information in the physical game too.
- Gems: bright cut gems in a few colours (colour is decoration only; every gem is worth 1). Boom card: a lit bomb. Distinct look from Fossil Frenzy: a dark mine/cave, deep indigo and violet, glowing teal/magenta/amber gems, a spark-orange boom.
- Sound (Web Audio, synthesised, no files; copy the `sound` script pattern from games/fossil-frenzy and adapt): card draw/flip tick, a rising glint for each gem in a run (pitch climbs with the run), a satisfying cascade on saving, a big soft boom + low rumble on boom, fanfare at the win. Off switch in the menu/settings; remembered.
- Menu: a small ☰ in a corner: How to play, Sound, Main menu/Restart (ask before leaving a game in progress).
- Prompts: a one-line hint above the table ("Tap the pile to dig. Tap your gems to save them.") shown until the device has finished one game, then quiet — as in Fossil Frenzy.

## Players & opponents
- Setup screen (after the home screen's Play): 2–6 seats. Each seat has a name and a type: Human or Computer (a quiet toggle on the seat). Default: 2 seats, You (human) + a computer. Remember the setup on the device.
- Computers: decide from public information only (draw pile count, booms out, their at-risk gems, scores). Policy: keep digging while the expected gain is positive: with G gems and B booms left in the draw pile and g gems at risk this turn, draw again if G/(G+B) > g/(g+1) (adjusted by a risk setting). Three computer styles with names (e.g. Careful, Steady, Daring) that scale that threshold (≈0.75×, 1×, 1.3× on g) and, in a 2-player race, take more risk when the opponent is near 20 and less when they are far ahead of the target. A computer's turn is shown one draw at a time (animated), then waits for a tap before the next player.
- Pass & Play (all humans) needs no privacy screen (all information is public); a turn card is not needed — the active player is highlighted, and a boom shows until tapped.

## Records & extras
- Remember on the device: last setup, sound on/off, hints; count of games finished. No profiles/records required.
- Game over screen: final gem counts big, winner(s) marked in their colour (ties shown as a tie), "Play again" (fewest first, per the rulebook) and "Main menu".

## Judgment calls to log (rulebook silent)
1. Auto-refresh: when the draw pile holds only booms, it refreshes automatically at once (the rulebook makes it optional, but declining is never better than saving). The gems at risk this turn stay on the table and are not shuffled in.
2. The refresh shuffles every card not saved by a player (the boom pile, all discarded gems) but not the cards on the table in the active player's current turn.
3. Ties in 3–6 players: shared win, all tied players marked.
4. Rematch order: fewest gems first (ties keep their previous relative order); 2 players: the loser first (a tie: the player who went second).
5. Final-boom turn: when the 6th boom ends a turn, the refresh happens as part of passing the turn.
6. The 3–6 player end: checked after every save (all 38 gems saved ⇒ the game is over). If the 6th boom refresh would leave nothing but booms and gems are all saved, the game is over.
7. A player who has saved nothing and draws all booms etc. is just a normal case; there is no limit on cards drawn in a turn.
