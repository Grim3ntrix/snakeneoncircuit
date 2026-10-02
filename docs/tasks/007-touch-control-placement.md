# Task 007 — Touch Control Placement

Task 003 made the game playable on a phone. It built the pad, the pause control, and the
sound control, and it measured the row they live in.

It also predicted this task. 003 closed with a section headed **Not verifiable here**, and
the first item in it was:

> How the pad *feels* under a thumb — target size on glass, **accidental presses during
> fast play**, thumb travel.

followed by:

> Emulated touch is not a thumb. This task is not done until a human has played it on a
> real phone.

That playtest has now happened. The prediction held: **Pause is being hit by accident
during play, and an accidental pause mid-run is worse than an accidental turn.** 003 said
so itself when it refused to put the control in the pad's centre — *"an accidental pause
mid-run is destructive in a way an accidental direction is not"* — and then placed it 8px
from the pad's edge, where the same argument applies with less force and no measurement
behind it.

So this is not a new feature and not a matter of taste. It is 003's own open item, closed
by the one method 003 named for closing it.

**Revised.** The fix this first produced — the swap and the wider gap — was reported
insufficient by the same owner, because it reordered the hazard without removing it. The
controls were then moved off the pad's row entirely, which is recorded under *Revised: the
controls leave the pad's row* below. The sections before that one are kept as they were
written, because they are what the second attempt answered and because the reasoning in them
is still the reasoning behind the ordering.

---

## The failure, mechanically

Pause is destructive, and three separate things conspire to make hitting it by accident
both easy and irreversible:

1. **It is adjacent.** In portrait the row is `[pad 148] 8px [Pause 56] 8px [Sound 56]`.
   Pause's left edge is 8px from the pad's right edge, in the same thumb band, at the same
   height. In landscape `.controls` becomes a grid with the pad spanning both columns and
   Pause and Sound side by side **directly beneath it** — the same adjacency, rotated.
2. **It fires on touch-down.** `pause.addEventListener('pointerdown', …)`. There is no
   release to change your mind in, and no chance to slide off.
3. **The nearest control is the destructive one.** A thumb that overshoots the pad's right
   key lands on Pause. It could have landed on Sound, which the player can undo by pressing
   it again; instead it landed on the one control whose whole job is to interrupt.

The third is the one that was never chosen deliberately. Sound and Pause are in the order
they were written, not the order they should be in.

---

## The design

### Pause takes `click`, not `pointerdown`

The pad's argument for `pointerdown` is written down at `input.js` and it is entirely about
latency:

> A click fires on release, which adds the whole duration of the press to the turn's
> latency, and it does not fire at all if the finger moves off the key before lifting —
> during fast play, exactly when the input matters most.

Pause does not inherit that argument, because **nothing is being timed against it.** The
simulation advances a cell every 120ms and a late turn is fatal; a pause that lands 80ms
later is not late, it is a pause. It is in the same category as the overlay music button,
which the same file already binds to `click` for a related reason.

What it gains is the property the pad cannot afford: `click` needs the down and the up on
the same element, so **a thumb that lands on Pause on its way somewhere else and slides off
does nothing at all.** That is precisely the accidental press, and this makes it a no-op
without any layout change — which is why it is the fix, and the geometry below is only
defence in depth.

The file's comment on the music button currently claims `click` is *"the one place in the
game where that is the right choice"*. That sentence becomes false here, so it is amended
rather than left to quietly rot.

### The destructive control goes furthest from the thumb

Pause and Sound swap places, so the row reads `[pad] [Sound] [Pause]` and, in landscape,
puts Sound beneath the pad and Pause to its right.

The rule this establishes is worth naming, because it decides the question whenever the
row gains a control: **the control nearest the thumb is the one that is safe to hit by
accident.** Sound is safe — it is visible, it reports its own state in its label, and the
player undoes it by pressing it again. Pause is not.

### The row spends its slack on separation

The row is 296px at 320×568 and its contents are 276px, so 20px is currently going nowhere:
`justify-content: center` splits it into empty space at the two ends rather than putting it
between the pad and the controls, where it would do some good.

That slack moves between the pad and the controls, as a margin on the pad's trailing edge:
**8px becomes 24px, measured.** The row's own box does not move — still 296×148, still the
number 003's board arithmetic and the landscape cap are built on — and the board is untouched:
cell size is 12/14/16/19/12 across the reference viewports, identical before and after.

**What it costs, because the first draft of this section claimed it was free.** The footprint
is unchanged, but the row's *contents* now need 292 of the 296px rather than 276, so the
tolerance at the very narrow end falls from 20px to 4px: a viewport narrower than roughly
316px overflows where it previously fitted to about 300px. `CLAUDE.md` scopes responsiveness
to "~320px", so this sits inside the stated range and the trade is deliberate — but it is a
trade. `--space-3` would give a 20px separation and leave 8px spare, if the narrow end ever
needs that room back.

---

## Revised: the controls leave the pad's row

The swap above was played, and the owner reported that it was not the fix:

> I want refinemenr about the task 7 because you only have swap the sound and pause on
> mobile. What I really mean is what if we should not put in on the same line as the pad?
> so that the player can't accedentally click it

That is a correct reading of what the swap did. **It reordered the hazard; it did not remove
it.** Sound at 24px is still on the pad's row, still in the same thumb band, still one
overshoot away — and putting the *destructive* control 88px out only helps a thumb that was
aiming at the pad's right key in the first place. A thumb that drifts diagonally, or that
simply sits too far right, still lands on the row. The ordering rule stated above is not
wrong; it was doing less work than this section claimed for it.

So the controls come off the row. In portrait they stack one above the other beside the pad,
Sound on top.

**The board cost, and why it is a stack rather than a second row.** Three placements were
measured before any of them was written:

| Placement | Cost |
| --- | --- |
| Stacked **above** the pad, in portrait | Cell **12 → 11** at 320×568 and **19 → 17** at 480×720 |
| In the **HUD row**, which is what "inline at the top" first suggested | Fits on height, but at 320px the HUD is 288px wide and the wordmark plus score already use about 207 of it — two 44px controls need roughly 104 more |
| **Beside** the pad, stacked | **Free at every viewport, in both orientations** |

The third wins on arithmetic rather than on taste, and it is the same arithmetic that governs
everything else in this file. The stack is 44 + 16 + 44 = **104px tall against the pad's
148**, so the row is still exactly as tall as the pad and the board row above it does not move
at all. It is also *narrower* than what it replaced — **236px of row against 292** — which is
what makes the wider gap affordable at the same time.

**The separation is now 32px** from the pad's drawn edge, which is **28px measured from the
pad's hit rect**, since `.pad__key::before` grows every key by 4px a side. It was 20px before.
Both controls are now the same distance from the pad rather than 20px and 84px.

**And the overshoot lands on nothing.** The stack is vertically centred on the pad, so its own
16px gap falls exactly on the right key's centre line: a thumb that overshoots straight right
crosses 32px of dead space and arrives in a second one. That was not designed — it falls out
of centring 104 on 148 — and it is asserted in the verification rather than asserted here.

**Which also means the ordering stopped deciding anything.** Centred on the pad, the two
controls are both exactly 28px from it and each overlaps the right key's band by the same 14px.
The rule from *The destructive control goes furthest from the thumb* is therefore inert in
portrait as well as in landscape, and the honest note is that it is *kept* rather than
reversed — reversing it would now be a change with no measurement behind it. It is recorded
here rather than deleted, because a reader who finds the rule stated above should find this
too.

**The two controls are 16px apart, not 8.** The pad's own `--space-2` gap is right *inside*
the pad, where every key is the same kind of action and a thumb landing between two of them
still means "a direction". Sound and Pause are not that: one is a setting and one interrupts
the run. So their gap is doubled, and the spacing now says which of the three is the odd one
out — 16 within the pair, 32 to the pad. The stack has the room for it for free, being 104
against 148.

Landscape is deliberately untouched. Its controls column is exactly `--pad-footprint` wide, so
there is no *beside* for a control to sit in, and widening that column is the one thing 003's
board cap subtracts — it would shrink the board, which is the trade this whole section exists
to refuse.

### Sound takes `click` too

`pointerdown` on Sound was the third of the three points in "The failure, mechanically" and
the only one still standing after the move: it fired on touch-down, so a thumb that brushed
it on the way past toggled the mute. Binding it to `pointerdown` while placing it 32px away
is spending geometry to buy something one line of binding gives back.

Nothing is timed against a mute either, so it takes Pause's gesture for Pause's reason. The
rule is now **every control that is not the pad answers to `click`, and the pad alone answers
to `pointerdown`** — one rule, no exception. The comment on that handler already claimed the
same gesture as Pause; the code did not, which is how it survived.

### What is ruled out, and why

**Moving Pause to the HUD row.** 003 measured this and rejected it, and the measurement
stands: the HUD row is 40px tall, a 44px control grows it by 17px, and that 17px comes
straight out of the board row — at 844×390 the cell goes **12 → 11**. Quoted from 003:
*"a control is not exempt from a rule the pad has to obey."* This task does not reopen it.

**Debouncing the pause press** — ignoring a pause within N milliseconds of a direction
press. It treats the symptom without moving anything, it is invisible to the player, and it
would swallow a deliberate fast pause, which is the one moment a player wants one.

---

## Files

| File | Change |
| --- | --- |
| `index.html` | Pause and Sound swap places in the row; then both are wrapped in `.controls__neighbours` and moved beside the pad |
| `src/input.js` | Pause binds `click`; Sound follows it; the music button's "one place" comment is amended |
| `css/main.css` | `--space-6` on the scale; the coarse-pointer arrangement; the pad's `margin-inline-end` replaced by the row's own gap |
| `README.md` | The music control's paragraph, whose arithmetic this changes |

Expected **not** to change: `src/simulation.js`, `src/renderer.js`, `src/state.js`,
`src/rng.js`, `src/effects.js`, `src/audio.js`, `src/main.js`, `src/storage.js`,
`src/config.js`. This is a placement and gesture change; the game does not learn about it.

---

## Verification

1. **The gesture is a click, for both controls.** A `pointerdown` on either one followed by a
   `pointerup` elsewhere does nothing — asserted for Pause *and* for Sound. It is the whole
   mechanism, it fails silently, and 007's own harness checked Pause alone while Sound was
   still binding `pointerdown` underneath it.
2. **A press and release on either still works.** Pause pauses and resumes; Sound toggles
   between `Sound` and `Muted`. The fix must not cost a control its function.
3. **The row's footprint is unchanged.** 296×148 at 320×568, pad 148×148, controls 56×44, no
   horizontal scroll, at every reference viewport — 320×568, 375×667, 412×915, 480×720,
   844×390, 1440×900.
4. **The board is untouched.** Cell size identical to `main` at all six viewports, and the
   board row's own height identical with it. This is the property the placement exists to
   protect, and the reason the stack sits beside the pad rather than above it.
5. **Separation is measured from the pad's hit rect**, not its drawn edge, and in both
   orientations. The hit rect is what a thumb actually touches; the drawn edge overstates the
   dead space by 4px on every side.
6. **The overshoot probe.** A press 16px right of the pad, on the right key's centre line, is
   asserted to land on no control and to change neither the phase nor the sound label.
7. **The stack is centred on the pad**, asserted to 0px rather than eyeballed, because the
   dead lane in 6 depends on where the stack's own gap falls.
8. **Landscape still stacks correctly**, with Sound and Pause on the row beneath the pad, the
   column still exactly `--pad-footprint` wide, and the two now `--space-4` apart.
9. **Console clean** across a session that starts, pauses, resumes, mutes, and dies — every
   entry at every level, not errors alone.
10. **Keyboard is unaffected.** `P`, `Escape`, and `M` behave exactly as before; the pad keys
    and the overlays are untouched.

## Result

Measured in Chrome over CDP with touch emulation, dispatching real mouse events at distinct
press and release coordinates.

**After the swap** — the first attempt, kept because it is what the second one answered:

| Viewport | Row | Pad | Controls | → Sound | → Pause | Cell |
| --- | --- | --- | --- | --- | --- | --- |
| 320×568 | 296×148 | 148 | 56×44 | 24.0px | 88.0px | 12 |
| 375×667 | 351×148 | 148 | 56×44 | 24.0px | 88.0px | 14 |
| 412×915 | 388×148 | 148 | 56×44 | 24.0px | 88.0px | 16 |
| 480×720 | 456×148 | 148 | 56×44 | 24.0px | 88.0px | 19 |
| 844×390 | 148×291.8 | 148 | 70×44 | 54.0px | 54.0px | 12 |

**After the move** — the arrangement that ships:

| Viewport | Row | Pad | Stack | Pad → nearest, hit rect | Board row | Cell |
| --- | --- | --- | --- | --- | --- | --- |
| 320×568 | 296×148 | 148×148 | 56×104 | **28.0px** | 324 | 12 |
| 375×667 | 351×148 | 148×148 | 56×104 | 28.0px | 423 | 14 |
| 412×915 | 388×148 | 148×148 | 56×104 | 28.0px | 671 | 16 |
| 480×720 | 456×148 | 148×148 | 56×104 | 28.0px | 476 | 19 |
| 844×390 | 148×291.8 | 148×148 | 148×44 | 49.9px | 292 | 12 |
| 1440×900 | hidden | — | — | — | 796 | 28 |

No horizontal scroll at any viewport, and the board row's height and the cell size are exactly
what `main` produces at all six. The console is empty across the whole run.

The gestures, at 320×568:

- Started from the pad. **Down on Pause, up on the pad: `playing -> playing`.** **Down on
  Sound, up on the pad: label unchanged.** Both are no-ops.
- **Down and up on Pause: `playing -> paused`, and again `paused -> playing`.**
- **Down and up on Sound: `Muted -> Sound`**, and again back.
- **A press in the dead lane**, 16px right of the pad on the right key's centre line:
  `playing -> playing`, label `Muted -> Muted`. It reaches nothing at all.
- The stack measures 56×104 at (222, 430) and the pad 148×148 at (42, 408)–(190, 556), so the
  stack is centred on the pad to **0px**, with 32px between their drawn edges.

Keyboard, on a fine pointer, is unchanged: `Enter` starts; `P` and `Escape` pause and resume;
`M` toggles between `Sound` and `Muted`; `N` between `Music` and `Music off`; all four arrows
dispatch without exception; and two auto-repeat `M` presses produce one toggle, not two.

### What the landscape row still does not do

**The criterion this task set itself — "Pause is not the control nearest the pad, in either
orientation" — remains false in landscape, and it is restated here rather than quietly
ticked.** There the pad spans the column and both controls sit on one row beneath it, so the
two are *equidistant*: Sound under its left half, Pause under its right. Moving them off the
row does not change that, because the column is exactly `--pad-footprint` wide and there is no
beside for them to move into.

Landscape therefore still rests on the `click` binding and on separation rather than on
geometry. What changed is how much separation: **54px, measured from the pad's drawn edge**,
against the 32px portrait now has — so the orientation the complaint came from is the one that
was fixed, and landscape is more than three times further apart than the 8px that caused it.
Widening the column to buy more would come straight out of the board, which is the trade this
task refuses in both orientations.

The two are `--space-4` apart here as well, carried over from portrait: side by side rather
than stacked, but the same reasoning applies to the same pair of buttons.

### Not verifiable here

Repeating 003, because the same limit applies and it is the whole reason this task exists:

- **Whether a thumb still hits Pause by accident.** The harness can measure separation and
  can assert that a slide-off is a no-op. It cannot measure aim. This task is not finished
  until the same person who reported it plays it again on the same phone.
- Whether the wider gap reads as deliberate spacing or as a hole.

---

## Acceptance criteria

- [x] A press that lands on a control and leaves before lifting does nothing — Pause **and**
      Sound, which the first pass left binding `pointerdown`
- [x] A press and release on Pause pauses and resumes as before, and on Sound toggles the mute
- [x] In portrait, neither control is on the pad's row, and both are 32px from its edge
- [x] A press 16px right of the pad, on the right key's centre line, reaches no control
- [x] The stack is centred on the pad to 0px, which is what puts the lane above where it is
- [x] The row is unchanged in footprint at every reference viewport
- [x] The board's cell size and its row height are unchanged from `main` at every viewport
- [x] Landscape is unchanged apart from the gap between the two controls
- [x] No console output at any level across a full session
- [x] Keyboard pause, mute, and every pad key behave identically to `main`
