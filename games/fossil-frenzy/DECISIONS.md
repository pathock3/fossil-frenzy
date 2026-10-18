# DECISIONS — Fossil Frenzy

Unclear rules and judgment calls, grouped by topic. The owner can overrule any of them; most are single values in the data block (`GAME_DATA` in `index.html`) and every one has a test. The in-game *How to play* panel lists the ones that matter at the table.

## Where the rules come from
1. **One rule set.** `docs/design-summary.md` (Patrick's redesign: no pieces, no movement, no delivery; a turn is peek-and-flip or bank) plus the owner's later feedback *is* the game. `rulebook.md` is the original physical game, kept as history; its movement and delivery rules are **no longer implemented** (they were removed on 2026-10-18 at the owner's request: "don't have two different rule sets"). The removed code and its tests are in git history, last present at commit `369ea0b`.
2. **Where sources disagree, the owner's latest word wins:** the 2026-10-18 feedback replaced the summary's "1 point per set" with "the number on the fossil is the points; bank ONE set"; and asked for Pass & Play (up to 4) and a five-level Campaign. The summary's tiered-AI memory *decay* and "overconfidence" are not implemented (memory is the task's "remembers with a set probability").
3. **The designer is credited once**, at the top of the Tabletop Library, as Patrick Blim-Hockberger (changed surname), not per game. The designer line in `rulebook.md` (otherwise a verbatim copy of the original PDF) was updated to the new surname at the owner's request.

## Board and setup
4. **A hexagon of 31 spaces** (radius 3 = 37 spaces, minus the six corners), one fossil on each. The count follows from the tile set (31) and the summary ("31 spaces, exactly one tile per space"). Board radius, removed spaces and the fossil list are data; the engine refuses a fossil count that does not match the space count.
5. **Who starts:** everyone rolls a die; a duplicate roll is re-rolled by whoever rolled it second; highest goes first; play continues clockwise (seat order). The roll is shown on a "Who goes first?" screen, one tap.

## Peek, flip, match
6. **First tap = a private peek at any fossil; second tap = a public flip of another.** The peek shows on your screen (honour system on a shared device: tap the peeked fossil again to hide it). A peek does not use up the turn: you may bank instead, or just end the turn (the peek stays private).
7. **Unmatched fossils flip back at the end of the turn** that revealed them ("memory game"; the summary agrees). No fossils stay face up on the board.
8. **A match is the fossil you peeked at plus the one you flipped** (same number). Pairs for numbers; a set of three for the gems — two gems never match. One peek and one match attempt per turn.
9. **Gems:** peek a gem and flip a gem → you *may* tap your peeked gem to reveal it, then flip a third fossil; a gem makes the set, otherwise everything flips back. Declining (End turn) keeps your gem private. (The rulebook's other order — flip the extra fossil first — was part of the removed rule set.)
10. **The UI takes the obvious option for you:** when your peek and the flipped fossil are a pair they are taken at once; revealing your own gem is a deliberate tap because it shows information.
11. **A match stays face up on the board until the turn ends** (yours or an opponent's), instead of vanishing, so players can see what happened; the matched fossils join the player's held sets.

## Banking and scoring
12. **Bank = take ONE held set of your choice and score the number on its fossil** (a gem set scores 16), then one d6 chain: each 6 adds +1 and rolls again (kept from the design summary; `bonusDieSides: 0` removes it). Banking takes the whole turn. The other sets stay in front of you; sets never banked score nothing. Values are data.
13. **The game ends the instant the last fossil is matched.** Tie-breaks (from the summary): highest score, then most sets popped, then whoever popped the final pair, then a shared win.

## Campaign
14. **Five levels — Beginner, Novice, Normal, Challenging, Master — shown by name only (no percentages).** All five are visible; only Beginner is open at first; the other four are greyed out with a lock. You play one opponent per level.
15. **You defeat a level by winning outright.** A shared win (every tie-break level) is a draw and does not unlock anything; a loss does not either. Beating a level opens exactly the next one. Beaten levels can be replayed. Beating Master completes the campaign.
16. **Levels differ in memory and in banking habits**, both from the design summary: memory 0.80 / 0.85 / 0.90 / 0.965 / 0.99; every level banks once it holds three sets; and plans for the end of the game by banking when 0 / 2 / 6 / 4 / 4 fossils remain (0 = never). The summary's "overconfidence" is not modelled. Everything is data (`campaign.levels`).
17. **Progress is stored in the browser** (`localStorage`) per device. `?unlock` on the page's address opens every level for that visit, for testing; it saves nothing.
18. **Pass & Play is humans only (2–4)**, exempt from the campaign. The campaign is you against one opponent (so a campaign game has 2 players).
19. The campaign ladder is **monotone but uneven**: the first three levels are close in strength (see REPORT.md). The owner chose these levels; the `memory` values are the lever for a gentler start.

## Bots
20. **Memory:** each bot remembers every revealed fossil (any public flip, or its own peek) independently with probability `memory`, permanently. What it sees during its own turn is exact (it must act on it); it recalls that later only with probability `memory`. It never records anyone else's peek. Matched fossils are forgotten.
21. **Information discipline:** bots are given `Engine.publicView` only (no hidden fossil values); a test asserts the view contains none.
22. **Strategy** (the same for every level; only memory and banking habits differ): bank the most valuable held set once `bankAt` sets are held or `endgameTiles` or fewer fossils remain; otherwise peek a fossil whose partners it has located, else an unseen one, and flip the located partner or an unseen one. **Gems:** it tries for the third gem when it has located one, or when ≤ 6 fossils remain, or always when only the gems remain (otherwise two cautious bots can stall forever when only the gems are left).
23. Bots do not model opponents or plan banking against the end of the game beyond `endgameTiles`.

## UI (the owner's "Tabletop Test")
24. **Tap the table:** fossils and held sets are the controls; no verb buttons for game actions. The small **End turn** / **Continue** button is the only pacing control, and nothing advances on a timer. An opponent's whole turn is played at once and stays on the board until the next tap.
25. **An opponent's turn shows its work:** its peek is a **dashed ring** on a face-down fossil (number hidden), its flip a **solid ring** on a face-up one; a bot that does not bank always reveals a space. Ring colour is not an accessibility gap, since only the current player's flips are ever shown.
26. **Prompts above the board** show until a device has finished one game, then go quiet (Auto / On / Off in the help panel) — a compromise between "no instructional narration" and friends who have never seen the game.
27. **End screen:** each player's banked fossils laid out with their score (a "+n" for bonus points), unbanked sets dimmed and struck through, the winner marked — not a stats table. The tiebreak reason stays as one line because the board cannot show it.
28. **Save and resume:** the game saves to the browser after every action (any phase, mid-peek, with an opponent's turn showing) and resumes automatically on load; the random numbers' position is saved, so a resumed game plays out exactly as it would have. A save made under different rules, from an older version, or damaged is cleared with a quiet note rather than resumed wrongly. A finished game or starting over clears it. Per device and browser.
29. A **library link** (‹ Tabletop Library) appears on the home screen when the game is served over http(s); opened as a standalone file there is nothing to link to.

## Simulation (REPORT.md)
30. Fixed definitions: seeds are `seed·100000 + game number`; "early leader" = the top scorer after 25 / 50 / 75 % of the game's turns, a tied lead sharing its credit; a shared win counts as a fractional win; head-to-head cells alternate who sits first. The "human proxy" is a bot of a given memory banking promptly — an ordering of difficulty, not a promise of a win rate.
31. Banking habit was checked head-to-head (600 games per policy): waiting to bank was no better than banking at once within noise, so bots that stand in for people bank promptly.

## Removed with the original rule set (for the record)
Movement (0–3 spaces on a hex board, going around or pushing other pieces), the six corner research sites, die-rolled delivery assignments with repeat deposits, "50% cut" delivery of one fossil per set, and the rulebook's gem order. The decisions behind them are in the git history before 2026-10-18.

## Process
32. Tests use Node's built-in runner (`npm test`); the browser tests use Playwright if installed and skip themselves otherwise. A build runs the tests first, so a failing test keeps the old version live.
