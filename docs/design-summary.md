# Fossil Frenzy — Complete Rules Summary

A summary of every rule change Patrick made to Fossil Frenzy during the
redesign and playtesting, plus how the physical game was adapted for the
video-game prototype. Written to hand to another builder (Claude Code).

## 1. Where this came from

The original physical game had pieces that moved around the board, landed on
fossil tiles to peek at them, and delivered fossils to drop-off sites at the
six corners of the board.

## 2. Patrick's redesign sketch (his words, 2026-10-14)

- No pieces on the board. No movement. No delivery.
- All border spaces filled with fossils; the six corner drop-off spaces
  removed entirely. (He'll resize the board and specify tokens later —
  not now.)
- The board: 31 spaces, exactly one tile per space. The tile set is the
  original game's set — six 2s, six 3s, four 5s, four 6s, four 7s, two 10s,
  two 11s, three GEMs. (He explicitly rejected an invented 1–15 pairs
  set: "use the same sets as before, simply remove the corners.")
- GEM tiles display the 💎 emoji.
- Each turn is either "peek and flip" (his term — never "peek and pop")
  or "bank".

## 3. Peek and flip (refined through his playtesting)

- **First tap = PEEK (private).** Only the player sees the value. The
  opponent/AI never learns it and must not record it in memory.
- **Second tap = public FLIP.** Everyone sees it; the AI records it.
- Match → both tiles pop to the player's held stash.
- Miss → both tiles stay face-up until the player taps **End turn**, then
  flip back. Nothing ever flips back on an automatic timer.
- The peek does **not** spend the turn: after peeking, the player may still
  choose to bank (the peeked tile flips back down, still secret). Only the
  public second flip commits the turn to peek-and-flip.

## 4. The GEM rule (his refinement)

- If the peek is a GEM and the public flip is a GEM, the player **may** tap
  the peeked GEM to reveal it publicly, then flip a third tile.
- Third tile is a GEM → all three pop as one held set.
- Third tile is not a GEM → all three flip back.
- Declining (tapping End turn instead) = a normal miss: both flip back and
  the peeked GEM stays private — the opponent never learns it.
- Revealing the peeked GEM makes it public: the opponent learns that tile
  from then on. The "may" is a real strategic choice (information vs. the
  triple).
- The AI follows the same rule on its turns.

## 5. Bank

- A turn is peek-and-flip **or** bank — never both (but see §3: the peek
  alone doesn't commit the turn).
- Bank is offered only while holding at least one pair or gem set. With an
  empty stash it is disabled with an explanatory hint.
- Banking: each held pair/set scores 1 point, then roll a d6 — every 6
  scores +1 and rolls again. The whole chain resolves from the single
  bank tap.
- Design note he was shown and kept: frequent small banks may be the
  dominant strategy (expected bonus ≈ +0.2 per bank lottery).

## 6. End of game and tiebreaks

- The game ends the instant no face-down tiles remain. Unbanked pairs in
  the stash are lost.
- Tiebreak order: score → pairs/sets popped → who popped the final pair →
  draw.

## 7. The AI opponent (video-game adaptation)

- **Five difficulty tiers with an unlock ladder:** beating a tier unlocks
  the next; progress persists in localStorage. Pass & Play is exempt from
  the ladder. The picker shows only the numbered tier names; locked tiers
  show as locked with no explanations.
  1. Beginner — 80% tile memory, 3× overconfidence
  2. Novice — 85% memory, 2.5× overconfidence
  3. Normal — 90% memory, 2× overconfidence
  4. Challenging — 96.5% memory, 1.5× overconfidence
  5. Master — 99% memory, 1× overconfidence
- His reasoning for Master at 99%: near-perfect memory doesn't make the AI
  unbeatable — a lucky player can still win.
- **AI memory model:** the AI records only public information — its own
  peeks and flips, and the player's public second-tap flips. It never
  records the player's peeks (a peek doesn't even decay its other
  memories). Memory decays over time per the tier's model.
- **Per-tier bank heuristics:** Beginner banks at 3+ pairs with zero
  endgame awareness; Novice adds a final-turn exception at ≤2 tiles
  remaining; Normal at ≤6; Challenging and Master at ≤4.
- **AI turn presentation:** its first flip is its private peek — the player
  sees only the space it peeked (highlighted, §8), never the number. Its
  second flip is public. Its turn result stays on the board indefinitely
  until the player taps **Start Turn**; its bank turns wait for Start Turn
  the same way.
- **AI GEM-reveal policy** (flagged as a builder judgment call): reveal when
  it knows the third GEM's location; always reveal with ≤6 tiles remaining;
  Master never blind-gambles.

## 8. UI rules he set (video-game adaptation)

- Page fully locked: no scrolling, no pull-to-refresh, no rubber-banding
  (the help modal keeps its own internal scroll). Taps must register
  instantly.
- The flip-up and flip-back animations are identical.
- Concealed (face-down) tiles are deep umber; public (face-up) tiles show a
  bright face. A small legend under the score bar explains concealed vs
  public.
- Flipped spaces are highlighted with a ring in the flipper's color —
  **ring only, around the space**: blue for the player's flips, red for the
  AI's. Never recolor the tile itself; no marker dots anywhere.
- The AI's concealed peek renders as a normal face-down tile carrying the
  red ring: the player sees *where* it peeked, not the number.

## 9. Modes

- **Vs AI** (five tiers + unlock ladder) and **Pass & Play** (two humans on
  one screen, exempt from the ladder). Starting a new game asks for
  confirmation.

## 10. Explicitly future — not now

- Five gradually-larger board sizes (beginner = small), with fossils equal
  to spaces and new fossil values per board. Board size, shape, and tiles
  should stay parameterized for this.
- Renaming / retheming the game: he's open to it but hasn't ordered it.

## 11. Patrick's design philosophy (observed — apply to the build)

- **The Tabletop Test** (his standing rule for all his games): they were
  designed as physical tabletop games, and the prototype must feel like
  stuff on a table, not software menus. Every digital interaction must
  mirror what the player's hands would do with the physical components —
  tap the tile to flip it, tap the die to roll it. Never use action buttons
  that perform game verbs ("Deliver", "Buy", "Fight"), dropdown menus, or
  modal dialogs for game actions. System chrome (menu, help, new game)
  stays minimal. The table is the UI.
- **Minimum taps.** Strip every unnecessary tap. If a tap doesn't represent
  a real decision, remove it. (Example: the bank d6 chain resolves entirely
  from the single bank tap — every 6 just rolls again on its own.)
- **Player-controlled pacing.** Nothing advances on an automatic timer.
  Tiles stay face-up until the player taps End turn; the AI's result waits
  until the player taps Start Turn. The taps that remain are decisions and
  pacing the player owns — never mere acknowledgments.
- **State shown in-place, in the game world.** No stat tables, no
  instructional narration. Information lives on the board itself (the
  colored rings show whose flip is whose; the concealed/public legend sits
  under the score bar).
- **Quiet UI for unimportant things.** Minor features get deliberately
  quiet chrome, not prominent buttons.
- **Flag every judgment call.** Anything you as the builder decide that he
  didn't specify goes into the in-game How to Play / help panel as a
  flagged judgment call, so he can verify or overrule it. His design
  authority stays intact.
- **How he works.** He states the result he wants; you work out the approach
  and keep trying — don't ask him to choose between approaches. He
  playtests on his phone and sends terse, visual corrections; turn them
  around fast.
