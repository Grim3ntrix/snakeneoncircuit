# Task 003 — Touch Controls

Task 001 delivered the playable core. Task 002 replaced its visual floor with the Neon Circuit identity, and in doing so designed the ready, paused, and over overlays.

Both are keyboard-only, and by design. Task 002 recorded the consequence in its own deferred section rather than leaving it to be discovered:

> The overlays instruct the player to press Enter, and on a touch device there is no key to press, so the game cannot be started at all. Whatever task adds touch controls therefore has to replace that copy as part of the work, not just add controls beside it.

This is that task. It makes the game playable on a phone, and it is the last thing standing between the current build and a public URL that works for the majority of the people who would open it.

---

## Prerequisite

Tasks 001 and 002 are complete and their invariants survive this task unchanged. Read both first — in particular 001's layer order and "Extension points for later tasks" table, and 002's overlay and layout decisions, which this task extends rather than revisits.

---

## The problem

Stated plainly, because the phrasing matters for every decision below:

**On a touch device the game is not awkward, it is unplayable.** There is no key to press to leave the ready screen. Every other shortcoming is secondary to that one.

The secondary problems are worth naming too, so they are not rediscovered during implementation:

- A phone player has no way to pause. `P` and `Escape` do not exist there.
- The overlays render `<kbd>` chips for keys that do not exist on the device showing them.
- The game advertises itself as playable one-handed. It currently is not playable at all.

---

## The control surface

**A four-way pad, always visible on touch devices.** No preference, no toggle, no gesture-only mode.

### Why a pad, and not a swipe

A swipe is the obvious first answer and it is the wrong one here, for three reasons that are all gameplay costs rather than taste:

| | Swipe | Pad |
| --- | --- | --- |
| Where the finger is | Dragged **across the board** — the one region the player must watch | Off the board entirely |
| Cost before a turn registers | Must exceed a recognition threshold | None — `pointerdown` is the turn |
| A 45° input | Ambiguous between two directions | Impossible |

The middle row is the one that decides it. The simulation advances a cell every 120 ms. A gesture that must travel far enough to be recognised spends a real fraction of a tick before the intent even exists, and an ambiguous or late turn in this game is fatal rather than merely annoying.

### The space objection, answered with measurements

The obvious argument against a pad is that it steals room from the board. It does not. Measured on the current build:

| Viewport | `.board` container | Board | Unused height |
| --- | --- | --- | --- |
| 320×568 | 296×488 | 288×288 | 200px |
| 480×720 | 456×640 | 456×456 | 184px |
| 412×915 | 388×835 | 384×384 | 451px |

Every phone viewport is **width-limited**, so the board already sits in a column of empty vertical space. A 3×3 cross of 44px controls with 8px gaps is 148px tall and fits inside the smallest of those without the board losing a pixel. The arithmetic is in *Layout* below, and it is an acceptance criterion rather than an assumption.

### Anti-goals

Do not do any of these.

- A virtual joystick, or a "drag anywhere on the board" steering mode. Both reintroduce the occlusion and ambiguity the pad exists to remove.
- Swipe as a second, undocumented input path. See *Scope* — it is deferred, not silently added.
- A settings menu, a control-scheme preference, or anything persisted. Task 002 deferred a settings menu deliberately; a two-option design question is not a reason to overturn that.
- Buttons drawn into the canvas. See *Markup, not canvas*.
- Haptics, sound, or animation on press beyond a state change.

---

## Scope

### In scope

- The pad: markup, styling, and its placement in the layout.
- Pointer input for the four directions, feeding the existing intent queue.
- A pause control reachable without a keyboard.
- The overlay copy, replaced with something a touch device can follow.
- The `<kbd>` treatment on touch devices.
- The landscape arrangement.

### Out of scope

- **Swipe gestures.** Deferred, with a stated condition for revisiting — see *Deliberately deferred*.
- **Gamepad API.** Not a touch device, and nobody has asked.
- **Any change to `simulation.js`.** Input is a presentation concern. This file is byte-identical at the end of this task.
- **Any change to `renderer.js`.** It knows the board is 24 cells square and nothing else. It must not learn that touch exists.
- **Score persistence, statistics, audio, difficulty.** Still deferred, as in 001 and 002.

---

## Where it lives

### Markup, not canvas

The pad is HTML and CSS. It is not drawn by `renderer.js`.

`renderer.js` is documented as knowing the board is 24 cells square "and nothing else about the game", and `draw(state)` is pure with respect to the game. A drawn pad would put interface chrome inside the one module that is supposed to be replaceable wholesale as a visual redesign, and it would duplicate what the platform already gives for free: real focus, real hit-testing, real accessibility semantics, and no rounding errors on a 44px target.

The same reasoning already applies to the overlays, which are DOM and have been since 001.

### One intent pipeline

**The pad must feed the same intent queue as the keyboard. Not a parallel path.**

`input.js` already exposes exactly the seam this needs. `attachInput` receives a handler object — `getState`, `start`, `togglePause`, `turn` — and its whole job is to translate a physical key into one of four intents and hand it on. The pad's handler belongs in that same function and must call **those same handlers**. The pad needs to know nothing about the phase machine, the queue, or legality.

Two things must not be duplicated:

- **The phase dispatch.** `input.js` chooses between `start(direction)` and `turn(direction)` from the current phase, and does nothing at all while paused. If the pad re-implements that branch, the two paths will diverge on the cases nobody exercises — a direction pressed while paused, or on the over screen. Extract the dispatch so both sources call one function.
- **The queue's rules.** They live in `simulation.js` — `queueDirection`, `isRedundantOrReversal`, `referenceDirection`, and the `MAX_QUEUED_INPUTS` cap of two — so that a fast <kbd>↑</kbd> then <kbd>←</kbd> inside one tick is buffered and both turns land on consecutive ticks. A second path that reimplemented them would quietly lose those guarantees on touch only. That is the worst kind of bug: one that never reproduces on the machine it was written on.

Reuse the queue. Do not reimplement its rules at the pad.

### Pointer events, not click

Listen for `pointerdown`.

`click` fires on release, which adds the whole duration of the press to the turn's latency, and it will not fire at all if the finger moves off the button before lifting — during fast play, exactly when the input matters most.

The pad needs `touch-action: none` so the browser does not claim the gesture for scrolling or double-tap-zoom, and so a press cannot be reinterpreted as a scroll partway through. This applies to the controls, not to the page: the page itself must still scroll normally everywhere the game is not.

Multi-touch is allowed by construction — a `pointerdown` from a second finger is another intent, and the queue's own cap is what limits how far ahead a player can queue. Do not add a separate "one finger at a time" rule.

---

## Layout

### Fitting without shrinking the board

The board's cell size comes from `min(board.clientWidth / COLS, board.clientHeight / ROWS)`, floored, in `renderer.js`. Anything that reduces `.board`'s height can therefore shrink the cell size — and a cell size that drops from 12 to 11 is a board that visibly changed size, plus a `--board-px` change that moves the HUD rule and the overlay scrim with it.

**The pad is a sibling of `.board` in `.shell`, never a child of it.** Placing it inside would put it inside the element the `ResizeObserver` measures and the renderer sizes against.

The arithmetic that must hold, portrait:

```
pad height        = 3 × 44px + 2 × 8px  = 148px
plus the shell gap                      =  16px
total taken from the board row          = 164px

320×568:  488 − 164 = 324  >  288  → cell stays 12
480×720:  640 − 164 = 476  >  456  → cell stays 19
412×915:  835 − 164 = 671  >  384  → cell stays 16
```

All three hold with room to spare. Verify rather than trust: the cell size at each of these viewports is an acceptance criterion, measured before and after.

If a future change makes one of these tight, the response is to reduce the gap or the pad's footprint — not to accept a smaller board.

### Landscape

A short landscape viewport is the one case where the arithmetic fails, and it fails badly. At 844×390 there is roughly 286px of vertical room for the board row; taking 164px of it leaves the cell size clamped at `MIN_CELL_PX`. The board would become a postage stamp.

So the pad's position is a media-query decision rather than a fixed one:

- **Portrait:** below the board.
- **Landscape, at any height:** beside the board, so the board keeps the full height and gives up width instead — which it has to spare.

The board's cell size must be no worse in short landscape than it is today. Today it is already constrained; the requirement is that this task does not make it worse.

### What "beside" turned out to require

Three things, none of them obvious, each measured after the first attempt was wrong:

- **Beside applies to all landscape, not only short landscape.** Height is the binding constraint in landscape generally, so beside is never the worse answer — and a pad that moves position at some height threshold is a pad that surprises the player who rotated into it.
- **The board is sized from its row, not from its contents** — `height: 100%` with `aspect-ratio: 1`. Left to its contents the column pins itself to the canvas's intrinsic width and can never grow to fill a taller viewport; the first attempt left 137px of nothing between the board and the pad at 844×390, wider than the pad itself. This also means the pad's column can be `auto` without being circular, which it otherwise would be, since the renderer sizes the canvas from the board it sits inside.
- **The board needs a width cap as well as a height one.** A row taller than the space left beside the pad makes a board wider than its column, and a centred grid track that overflows overflows *both* ways — pushing half the board off the left edge, where no amount of scrolling reaches it. Caught at 400×380, where the tracks came to 452px inside a 405px content box. `max-height` on the board, subtracting the shell's gutter and the pad's footprint, is what bounds it.

One consequence worth recording: **the HUD spans both columns in landscape rather than matching the board.** Matched to the board it is as narrow as the board, and beside the pad the board is narrower than it was — at 568×320 that is 216px for a wordmark and a score that need 231, and the title wrapped mid-name. A header over a two-column body reads as a header; a header the width of the left column reads as a mistake.

---

## Pause

The pad gives directions. It does not give a way to stop, and a phone player currently has none.

**One pause control, 44×44.** Not the centre cell of the pad: the centre of a cross is where a thumb lands when a player is moving fast, and an accidental pause mid-run is destructive in a way an accidental direction is not.

It is visible only on touch devices, like the pad, and it stays quiet — Task 002's HUD is the "silkscreen label area" of the board, subordinate to the play field, and a control in that register must not shout.

### Why it sits beside the pad, and not in the HUD row

This was specified for the HUD row, and measured against it before being moved. It cannot go there without shrinking the board:

| Viewport | Board-row slack today | After a 44px control in the HUD row |
| --- | --- | --- |
| 480×720 | 184px | 3px — the cell holds, with nothing to spare |
| 844×390 | — | cell 12 → **11** |

The HUD row is 40px tall, so a 44px control grows it by 17px, and that 17px comes straight out of the board row, which is what the cell size is floored from. §Layout already answers this — *"the response is to reduce the gap or the pad's footprint — not to accept a smaller board"* — and a control is not exempt from a rule the pad has to obey.

So pause lives in `.controls`, the cluster that already holds the pad: beside it in portrait, below it in landscape. It costs the board nothing, because the cluster is already 148px tall and the button is 44. The cluster is centred on the board as a whole, so the pad sits 44px left of the board's axis rather than dead centre under it — measured, and left that way deliberately: at 320px there is only 70px of width to the right of the pad for a 64px button, so pinning pause to the edge to centre the pad would leave the two controls 6px apart. A centred cluster at a comfortable spacing reads better than a centred pad with a button jammed against it.

Everything else is as specified: 44×44, a real `<button type="button">` with an accessible name, `pointerdown` rather than `click`, and gated by `@media (pointer: coarse)` like every other part of this feature.

---

## The overlay copy

Task 002 wrote this requirement into its deferred section so it would not be lost. Both halves are required:

- **The instruction must become one a touch device can follow.** "Press Enter to start" is not. The pad is now on screen and is the obvious thing to touch, so the copy should name it.
- **The `<kbd>` chips must not render on touch.** A keycap is an instruction to press a key that does not exist. Hiding them is not cosmetic; leaving them is a broken instruction.

Which copy shows is a `@media (pointer: coarse)` decision in CSS, not a JavaScript branch. There is nothing to detect at runtime that the media query does not already answer.

Note that pressing a direction to start also steers, on both keyboard and pad — the README documents this for keys and the pad inherits it. Do not special-case the ready screen at the pad; a direction press is a direction press.

---

## Accessibility

- **Every control is at least 44×44 CSS px.** No exceptions, including the pause control.
- **Every control is a real `<button type="button">`** with an accessible name, not a `<div>` with a click handler. This is what gives touch exploration something to find and announce.
- **Pad buttons carry `tabindex="-1"`.** They are for touch; the keyboard already has direct arrow-key control of the same intents, so WCAG 2.1.1 is satisfied without them in the tab order. Removing them also avoids a real collision: a focused pad button plus <kbd>Enter</kbd> to start a game would otherwise fire a direction at the same moment.
- **Keyboard operation and `:focus-visible` are unchanged.** The pad is additive. Every keyboard path that works today works identically afterwards.
- **`prefers-reduced-motion` is honoured.** The global guard in `main.css` already covers anything added; do not add motion that escapes it.
- **The pad must not trap or steal focus**, and must not interfere with the overlays' existing behaviour.

---

## Invariants this task must not break

- `simulation.js` is byte-identical. No game rule changes.
- `renderer.js` does not reference touch, pointer events, the pad, or the phase. `draw(state)` still takes `state` alone.
- The intent queue's semantics — the two-turn cap, reversal rejection, duplicate rejection — are reused, not reimplemented.
- No `localStorage`, no preference store, no settings menu.
- No new dependency, no build step, no `package.json`. The pad is markup and CSS.
- Overlay behaviour on keyboard devices is unchanged.
- The board's cell size does not regress at any reference viewport.

---

## Files

Expected to change:

```
index.html        Pad markup, pause control, overlay copy
css/main.css      Pad and pause styling, coarse-pointer and landscape media queries
src/input.js      pointerdown handling, routed into the existing intent queue
```

Expected **not** to change: `src/simulation.js`, `src/renderer.js`, `src/state.js`, `src/rng.js`, `src/config.js`, `src/main.js`.

If implementation appears to require touching any of those, that is a signal the design has drifted, not a signal to widen the task. Stop and reconsider.

---

## Verification

As in 001 and 002: reuse the existing harness rather than eyeballing, and read resulting screenshots directly.

Steps that are automatable and must be automated:

1. **Cell size before and after**, at every reference viewport, to prove the board did not shrink.
2. **No horizontal scroll, no layout shift** at 320px up.
3. **Control geometry** — every control's rect is at least 44×44.
4. **Intent parity** — a scripted sequence of pad presses produces the identical final simulation state as the equivalent key sequence. This is the single most valuable check in the task: it is the assertion that the two input paths really are one.
5. **Queue guarantees under touch** — a fast two-press sequence inside one tick is buffered and both apply; a reversal is rejected; the cap holds.
6. **Console clean** — no errors, no exceptions, no browser-level errors.

### Not verifiable here

Report these as unverified rather than claiming them:

- How the pad *feels* under a thumb — target size on glass, accidental presses during fast play, thumb travel.
- Whether 148px of pad is comfortable or cramped on a real device.
- Real multi-touch behaviour with two thumbs.
- Rotation on a physical device.

Emulated touch is not a thumb. This task is not done until a human has played it on a real phone.

---

## Acceptance criteria

### Playability

- [ ] The game can be started on a touch device with no keyboard attached
- [ ] All four directions steer the snake
- [ ] The game can be paused and resumed without a keyboard
- [ ] Pressing a direction on the ready screen starts the game and steers, exactly as a key does
- [ ] The overlays give an instruction a touch device can follow
- [ ] `<kbd>` chips do not render on touch devices

### Input integrity

- [ ] A pad press and the equivalent key press produce the identical simulation state
- [ ] Two pad presses inside one tick are both buffered and applied on consecutive ticks
- [ ] A reversal onto the neck is rejected rather than fatal
- [ ] The two-turn cap holds for pad input
- [ ] A press registers on `pointerdown`, not on release

### Layout

- [ ] Cell size is unchanged at 320×568, 375×667, 412×915, 480×720, and 844×390
- [ ] The board is not made smaller in short landscape than it is today
- [ ] No horizontal scroll at any width from 320px up
- [ ] No layout shift when overlays appear or disappear
- [ ] The pad does not overlap the board or the HUD

### Accessibility

- [ ] Every control is at least 44×44 CSS px
- [ ] Every control is a real button with an accessible name
- [ ] Keyboard operation is unchanged and `:focus-visible` still works
- [ ] `prefers-reduced-motion` neutralises anything added
- [ ] The pad never steals or traps focus

### Integrity

- [ ] `simulation.js` is byte-identical
- [ ] `renderer.js` does not reference touch, pointer, or the pad
- [ ] No `localStorage`, no settings menu, no preference
- [ ] No new file, dependency, or build step
- [ ] Console is clean during normal use

---

## Deliberately deferred

Do not build, stub, or scaffold any of these.

- **Swipe gestures.** Revisit only with evidence that the pad is insufficient in practice — not because a swipe was also easy to add. If added, a swipe is a second *source* into the same intent queue, never a second path with its own rules.
- **A settings menu, or any control-scheme preference.** If the pad ever needs to adapt, it adapts by device capability — `@media (pointer: coarse)`, orientation, viewport — not by asking the player to find an option. An affordance behind a setting is one the people who need it are least likely to find.
- **Haptics.** `navigator.vibrate` is unavailable on iOS, so it cannot be relied on and would be an inconsistent tell.
- Audio, score persistence, statistics, difficulty progression — unchanged from 001 and 002.
- The Gamepad API.
- Any change to `simulation.js`.

---

## Definition of Done

1. It works, including its edge cases.
2. The refinement pass (`polish-pass` skill, or `/polish`) has been run. This task adds interface chrome, which is exactly the kind of change that accumulates without one.
3. Verified in a browser at narrow and wide viewports, portrait and short landscape, at DPR 1, 2, and 3, with reduced motion.
4. Verified on a real touch device, by hand.
5. No console errors, dead code, or placeholders remain.
6. Every invariant above holds, and `simulation.js` and `renderer.js` are untouched.
7. You can answer yes to: *would a phone player describe this as finished, or as a desktop game with buttons bolted on?*

If the honest answer to 7 is the second one, the task is not done regardless of how many criteria are ticked.

Do not commit unless asked.
