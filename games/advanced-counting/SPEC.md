# Advanced Counting — Build Spec

Patrick's decided spec, beyond what the rulebook says. Build exactly this. (Pasted from his Meta Muse notes, 2026-10-19. The owner's later corrections override it.)

## 1. Game structure

- Solo climb only. 13 levels, A through M.
- Level A: 2×2 grid, cards 1–4. Level B: 2×3 grid, cards 1–6. Level C onward: 3×3 (1–9) up through 8×8.
- **Retry rule (critical):** a wrong tap re-deals the identical layout — cards flip face-up again in the same positions. The player studies and retries until the sequence is completed. Only a completed level deals a new layout. Retry time and mistakes count toward Personal Records.

## 2. Profiles & records

- Per-profile Personal Records, stored on device: highest level reached; best time and fewest mistakes per level.
- The profile selector sits just above the Start button; its dropdown opens upward.
- "Rename profile…" sits quietly at the bottom of the profile dropdown. Blank names are rejected; renaming never alters records.
- Default profile is named "Player 1".
- High scores open via a single "High scores ▸" button.

## 3. Main menu

- Tagline: "How high can you count?"
- Buttons, top to bottom: **High scores**, then **How to play**. Both 58px, full-width.
- Tapping a level row inside High scores starts a practice round at that level. Start begins the full climb at Level A.
- Start button: 124px tall (112px on small phones), 72% width, centered, pinned to the bottom.
- Credit line: "Patrick Blim-Hockberger, 2019"
- The Menu button opens a dropdown: Rules, Main Menu.

## 4. In-game UI

- The primary button is labeled "Flip".
- No next-number indicator of any kind — the player always knows which number comes next.
- Rules is accessed only through the Menu dropdown.
- Practice mode: free card flips; the Flip button becomes Start.

## 5. Results screen

- Three columns, label above value: LEVEL / MISTAKES / TIME.
- A subtly glowing NEW RECORD! badge under any stat that just set a record.
- The screen waits for an OK tap before continuing — he takes breaks between rounds, and the next round's timer starts only on that tap.

## 6. Design philosophy

- **Tabletop feel.** Physical cards on a table; taps flip cards; the table is the UI — not buttons performing game verbs, not dropdowns or modals for game actions.
- **Minimum taps.** Obvious outcomes resolve themselves. State is shown in place, on the board.
- **No instructional narration.** Never explain what is already clear.
- **Quiet UI for unimportant features;** important things are big.
- **Mobile:** fully locked page — no scrolling, no pull-to-refresh, no rubber-banding. Taps register instantly.
- **Stunning is welcome** (audio, visuals) — **clutter is not.** Atmosphere over panels and features.

## 7. Working with Patrick

- He states the result; you determine the approach. Don't ask him to pick between approaches.
- Share each new build for his review.
- His corrections are final — apply them literally, as worded.
- Flag your judgment calls (an in-game help panel works) wherever the rulebook is silent.

---

# Claude's reading of the spec (judgment calls — log each in DECISIONS.md and in the game's How to play)

1. **Levels:** A 2×2 (1–4), B 2×3 (1–6), C 3×3 (1–9), D 3×4 (12), E 4×4 (16), F 4×5 (20), G 5×5 (25), H 5×6 (30), I 6×6 (36), J 6×7 (42), K 7×7 (49), L 7×8 (56), M 8×8 (64) — "an additional row or column, making a square whenever possible". Cards are numbered 1..n and are re-shuffled into a fresh layout for each new level.
2. **The round:** the cards are dealt face up (study). The primary button "Flip" turns them all face down (a staggered flip). The player then taps cards in order 1, 2, 3…. A correct tap leaves the card face up. A wrong tap counts one mistake and re-deals the identical layout face up (every card flips up, in the same places), so the player studies again; Flip starts the next try from 1 again. Finishing the sequence completes the level.
3. **Time:** runs from the moment the level is dealt (when the player tapped OK / Start) to the last correct tap, so it includes study time and every retry. No live clock is shown during a round (quiet UI); the time appears on the results screen. The timer never runs while the results screen is up.
4. **Climb:** Start → level A; each completed level → results → OK → the next level is dealt (timer starts on that OK tap). After level M, OK returns to the main menu. Menu → Main Menu abandons the round without a confirmation (records are saved as each level completes).
5. **Practice** (tap a level row in High scores): the level is dealt face up; cards can be flipped up and down freely by tapping them; the primary button reads Start and begins a try (timer starts then). Wrong taps re-deal as above. Practice rounds never change the records (they are practice) and the results screen shows no NEW RECORD badges; OK returns to High scores.
6. **Records:** "highest level reached" = the highest level the profile has completed in the climb (the rulebook's score). Per level: best (lowest) time and fewest mistakes from climb rounds. NEW RECORD! badges: LEVEL when the level just completed is above the profile's previous highest; MISTAKES / TIME when this round beat an existing record for that level (a first completion of a level only sets the baseline, so no badge).
7. **Profiles:** the selector shows the current profile name; its dropdown (opening upward) lists the profiles, then "+ New profile", and quietly at the very bottom "Rename profile…" (inline edit; blank rejected). The selected profile is remembered. A new profile is named "Player N" (next free number).
8. **High scores:** a screen listing the 13 levels for the current profile: letter, grid size, best time, fewest mistakes; the highest level reached is marked. Levels not yet completed show "—". Every row is tappable (practice).
9. **Main menu** as specced; plus a small quiet sound on/off icon in a corner (the spec is silent on sound; sound is welcome, so there must be an off switch). Sound is synthesised (Web Audio, no files): a card-flip click, a rising chime on each correct card (pitch climbs with the number), a soft low note on a mistake, a short fanfare on a completed level, a sparkle on a NEW RECORD.
10. **How to play** (main menu button) and **Rules** (in-game ☰ Menu dropdown) show the same short, visual panel: peek at the cards, flip, tap 1→N in order, wrong tap re-deals, climb A→M; the judgment calls listed under a folded "fine print".
11. In-game, a tiny quiet label names the level (e.g. "C") and "Practice" when practising; the ☰ Menu button sits quietly in a corner. No next-number hint, no mistake counter, no live timer.
