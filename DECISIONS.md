# DECISIONS

Unclear rules and judgment calls, in the order they were made. The owner can overrule any of them; most are single values in the data block (`GAME_DATA` in `index.html`) and every one has a test. The in-game *How to play* panel lists the ones that matter at the table.

## Inputs and precedence
1. **Two inputs, two modes.** `rulebook.md` is the original game. `docs/design-summary.md` (handed over mid-task, written by an earlier agent session) describes Patrick's redesign: no pieces, no movement, no delivery; every turn is "peek and flip" or "bank". I mapped them onto the requested toggle: `movementDeliverySystem: true` = rulebook, `false` = redesign. Where the two disagree, the mode being played decides. Where the task statement and the summary disagree (the summary's five-tier AI with overconfidence and memory decay vs. the task's "remembers a revealed fossil with a set probability"), the task statement wins.
2. **Commits go straight to `main`**, as instructed, although the session started on a `claude/…` branch.
3. **JavaScript in one HTML file.** Easiest to share (open the file, AirDrop it, or host it on GitHub Pages) and it runs offline on an iPad. Node is used only for tests and simulations.

## Board and setup
4. **Board = hexagon of 37 hex spaces** (radius 3). The rulebook says 31 tiles, one per space "except the corners", six corners → 37 spaces, which is exactly a radius-3 hexagon. Die faces 1–6 = the corners clockwise from top-left. The redesign removes the corners, leaving 31 spaces (matches the summary's "31 spaces, exactly one tile per space"). Board radius, corners and the tile list are data; the engine refuses a tile count that doesn't match the space count (the summary wants the board parameterised for later sizes).
5. **Setup dice:** players roll in seat order; whoever rolls a number already taken re-rolls until different. Highest roll goes first; "clockwise" = increasing seat number around the table. In the redesign the same roll decides who starts.
6. **Your setup roll is also your first delivery assignment** (the die you rolled is still showing). Data flag `initialAssignment` (`'startCorner'`, anything else = roll again).

## Movement (rulebook mode)
7. Pieces cannot share a space and cannot pass through each other. "Go around" = a path of up to 3 steps that avoids occupied spaces; you cannot stop on an occupied space.
8. **Push:** only the step *into* the victim's space can be a push; it uses one of your 3 steps (so a victim 3 spaces away can be pushed, one 4 away cannot) and ends your move. The pusher chooses the direction. The victim goes onto an adjacent **empty** space — never onto another player (no bumping), never onto the space the pusher is pushing from. It may land on a corner or on a space with a fossil. Pushes can be switched off in the data (`allowPush`).
9. Moving 0 spaces is a real choice (tap your own piece).

## Peek, flip, match
10. **Unmatched flipped fossils flip back face down at the end of the turn** that revealed them. The rulebook calls this a memory game and the summary says so explicitly ("both tiles flip back"). So there are no persistent face-up fossils on the board; "face up" means a matched set in front of a player.
11. **A match is the fossil you peeked at plus the fossil you flipped** (same number; the rulebook's "to another on the board"). Pairs for numbers; a gem set needs all three gems — two gems never match.
12. One peek and at most one match attempt per turn. Peeking needs a fossil underfoot (rulebook) or any fossil (redesign). In the rulebook mode a peek must be followed by a flip, so you cannot end the turn after a bare peek; in the redesign a peek does not spend the turn (you may bank or end instead).
13. The forced flip may be any other face-down fossil, even one a piece is standing on.
14. "You now have the *option* to flip the fossil you stand on" is optional in the engine; the UI takes it for you when it is a pair (it can only help) and when all three gems are showing.
15. **Gems, rulebook order:** flip a gem as your forced flip → you *may* flip one second fossil → then your own. The extra flip is offered whenever the forced flip is a gem (not only if your own is one), so offering it leaks nothing. Redesign order: reveal your peeked gem first, then flip a third fossil; declining keeps your gem private (summary §4).

## Delivery (rulebook mode)
16. Matched sets sit face up in front of you and are worth 0 until delivered. Delivering flips **one** fossil of a set face down at its face value and tosses the rest ("50% cut": one of a pair, one of the three gems = 16).
17. Delivery happens after movement. If you already stand on your site, move 0 and deliver. After a delivery you roll for the next site; if it is the site you are standing on and you still hold a set, you may deliver again. You cannot move afterwards. With no set in hand nothing is rolled.
18. You cannot peek and deliver in the same turn (corners hold no fossil). The turn is move + (peek/flip/match **or** deliver chain).
19. Delivered (face-down) fossils are private; others see only how many. Everything is revealed at the end.

## End and scoring
20. The game ends the instant the last fossil is matched, even if players still hold undelivered sets (worth 0). Tie-breaks: score → most fossils → highest scoring fossil → shared win. Redesign (summary §6): score → sets popped → who popped the final pair → draw.
21. **Redesign bank (owner feedback, 2026-10-18):** a bank turn takes **one** held set of the player's choice and scores **the number on its fossil** (gem set 16); the other sets stay in front of you. Then one d6 chain per bank: each 6 = +1 and rolls again (kept from the design summary — set `bonusDieSides: 0` in the data to remove it). This replaces my earlier "1 point per held set, all at once". Values are data (`setPoints`, `bonus*`).
22. Point values are the tile numbers; delivered fossils count at that number (gems 16).

## Bots
23. **Memory model:** each bot remembers every revealed fossil (any public flip, or its own peek) independently with probability `memory`, permanently. What it sees during its own turn is exact (it must act on it); it recalls that later only with probability `memory`. It never records anyone else's peek. Memory is forgotten for matched fossils.
24. Bots are given `Engine.publicView` only (no hidden tile values); a test asserts the view contains none.
25. **Strategy** (same for all bots, only memory differs): rulebook — walk toward the best goal (deliver a set > go to a located pair > explore an unseen fossil, each discounted 30% per extra turn of walking), deliver whenever at the site with a set, peek only when it can learn something. Redesign — bank the most valuable held set as soon as it holds one (head-to-head, waiting was no better), otherwise peek a located pair or an unseen fossil; so a bot always reveals a space on a turn it does not bank. Gems: try for the third gem always (rulebook), or only when it is located or in the endgame (redesign; otherwise two bots can deadlock when only the gems remain).
26. Bots do not model opponents, do not plan deliveries against the end of the game, and ignore the summary's "overconfidence" and decay. Presets are named after the summary's tiers with its memory levels (80 / 85 / 90 / 96.5 / 99 %).

## UI
27. Following the owner's "tabletop test": tap tiles, pieces, held sets and the delivered pile; no verb buttons, no timers. Quiet **End turn** / **Continue** is the only pacing control. A bot's whole turn is played at once and stays on the board (ring in its colour; its peek is a ringed face-down fossil) until the next tap.
28. Privacy is by honour: your peek shows on the tile (tap it again to hide) and your delivered pile opens on tap. No "pass the device" screens, to keep taps to a minimum.
29. The toggle's default is `GAME_DATA.movementDeliverySystem`; the setup screen can override it per game. Setup (names, bots, memory) is remembered in `localStorage` when available.
30. No save/resume of a game in progress (a reload starts over).
34. **Bot turns show their work (owner feedback):** a bot's peek is a dashed ring on a face-down space (number hidden); its flip is a solid ring on a face-up one. When a bot matches, the matched fossils stay face up on the board until the next tap (your own matches too), instead of vanishing with no trace.
35. **Gem rule in the redesign** (peek a gem, flip a gem, tap your peeked gem to reveal it, then flip a third; a gem makes the set) was already implemented and is now covered by a tap-level browser test. In the rulebook mode the same set is made in the rulebook's order (flip a second fossil first, your own last), which keeps your gem private if the attempt fails.

## Simulation (REPORT.md)
31. Fixed definitions: 4 players, memory 0.90 unless stated; seeds are `seed·100000 + game number` so runs are reproducible; "early leader" = the unique top scorer after 25 / 50 / 75 % of the game's turns (and a tie-aware variant); a shared win counts as a fractional win. OFF scores are pair counts, so spread is compared with the coefficient of variation as well as raw numbers.
32. Caveat: bots are simple heuristics, so absolute numbers (especially how many points they strand undelivered) are bot behaviour, not human behaviour.

## Process
33. Tests use Node's built-in runner (`npm test`); the browser tests use Playwright if installed and skip themselves otherwise.
