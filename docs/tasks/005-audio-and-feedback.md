# Task 005 — Audio and Richer Feedback

**Status:** Ready for implementation
**Depends on:** 001 (playable core), 002 (visual identity), 003 (touch controls), 004 (score persistence) — all complete
**Followed by:** final polish

---

## Prerequisite

`simulation.js` is correct and must stay untouched. This task is the first one that changes
how the game is *presented moment to moment* rather than what it looks like at rest, and it
is the first one that makes a noise.

It is also the first task that breaks an invariant a previous task wrote down deliberately.
That is not an accident and it is not a detail — see *What this overturns*.

---

## Note on numbering

Task 001 listed `004 game feel & audio` and `010 final polish`. Task 004 took the README's
order instead and became persistence, and it recorded why. This is the audio and feedback
task 001 named, now numbered 005 to follow the document that shipped in its place. Nothing
about the work changed with the number.

---

## The problem

**Nothing the player does is acknowledged where they are looking.**

The simulation is honest and the score is correct, but the four moments that matter pass in
silence and without an event:

- **Eating.** The food disappears and a number in the HUD changes. The player's eye is on
  the snake, not on the HUD, so the reward is a thing they have to go and check. At speed
  the node they were routing toward is simply gone.
- **Dying.** The game swaps an overlay in. There is no event *at the point of failure* — no
  tell for where the run ended or what it hit — and the wall and the player's own tail are
  reported identically, as `Game over`.
- **Clearing the board.** The hardest thing the game can be asked to do is announced with
  the same overlay, one line of copy different.
- **Beating the record.** This one has a mark on the overlay and nothing else. The game's
  best moment is celebrated only after the run is over, in text.

Two earlier tasks named this work and deferred it. Task 002: *"Audio of any kind. Screen
shake, particles, flashes, death effects, trails."* Task 002 again, on the death messaging:
*"Distinguishing wall from self is out of scope for this task — it is content, not identity,
and belongs with 004's feedback work."* Both promises come due here.

**The outcome:** eating, dying, clearing the board, and beating the record are each
acknowledged by a synthesised sound and by an effect on the board built from the identity's
own vocabulary. The two deaths stop reading the same.

---

## What this overturns

Task 002 wrote three invariants this task breaks, each with a recorded reason. They are
lifted deliberately, and the reasoning is in
[`docs/decisions/001-render-events.md`](../decisions/001-render-events.md).

| 002 invariant | Here |
| --- | --- |
| `renderer.draw(state)` keeps its signature | **Broken** — becomes `draw(state, effects)` |
| The renderer never learns that anything happened | **Broken** — effects are handed to it |
| Nothing on the canvas animates | **Broken** — that is what this task is |

002's own note on the last one was *"the boundary is worth more than the effect"* — a
deliberate trade that this task reverses on purpose, having weighed the same thing.

**Kept from 002, and load-bearing:**

- **The renderer still never reads `phase`, `score`, or `over`.** It is told *that* something
  happened; it can never ask how the game is going. This is the invariant that mattered.
- **No per-frame allocation.** The effects timeline allocates once, at construction.
- **Silhouettes are not touched.** The head stays a full cell, the body stays inset, the
  food stays a diamond. 002's "uncomfortable number" — head vs body at 1.46:1 — means shape
  is what separates them for a colour-blind player, and no effect here may blur that.
- **The legibility floor holds.** See *The board effects*.

---

## Scope

### In scope

- **Four synthesised sounds** — eat, death, win, new best — from the Web Audio API, with no
  audio files and nothing to download.
- **Two board effects** — the eaten node's flare, and a wavefront along the trace that reads
  as the signal stopping on a death and completing on a win.
- **A mute control** — the `M` key everywhere, a Sound button on touch devices, and the
  choice remembered across reloads.
- **The death reason in the game-over title**, so a wall and the player's own tail stop
  reading the same.
- **A settings key in storage**, holding the sound preference and nothing else.

### Out of scope

- **Any change to `simulation.js`.** Byte-identical at the end of this task. Feedback is a
  presentation concern and the outcome token already carries everything needed.
- **Difficulty progression, or anything that varies `TICK_MS`.** Still deferred, as in every
  task before this one.
- **Music, ambience, or a soundtrack.** Four event voices. There is no bed and no loop.
- **Screen shake, particles, flashes, motion blur, trails, or chromatic aberration.** 002's
  anti-goals stand. The two effects below are the whole of it.
- **Haptics.** `navigator.vibrate` is unavailable on iOS, so it cannot be relied on and
  would be an inconsistent tell. 003 deferred it and this task does not pick it up.
- **A settings menu, or a volume slider.** One toggle, and it is a control rather than a
  screen. 002 deferred a settings menu and one boolean is not a reason to overturn it.
- **Wall-versus-self *sounds*.** The deaths differ in the title and in the shape of the
  effect, not by ear. Two death sounds is a second distinction the player has to learn for
  no gain.
- **A sound on turning, pausing, or starting.** See *The sound*.

---

## Where it lives

### The timeline is its own module

`src/effects.js` owns what just happened and how far through being shown it is.

| Export | Responsibility |
| --- | --- |
| `EFFECT` | The frozen set of kinds: `EAT`, `DEATH`, `WIN` |
| `createEffects({ reducedMotion })` | Returns `{ spawn, advance, clear, slots }` |

```js
const effects = createEffects({ reducedMotion: prefersReducedMotion });
effects.spawn(EFFECT.EAT, state.cells[0]);  // main.js, at the OUTCOME seam
effects.advance(dt);                        // main.js, once per frame
renderer.draw(state, effects);              // the renderer reads `slots`
```

The cell handed to a flare is `state.cells[0]` — the head's new position, which *is* the cell
the node was on, because `step()` has already moved the head onto it. Nothing has to remember
where the food used to be.

- **Fixed capacity, allocated at construction.** An eat effect lasts
  `EFFECT_MS.eat`; the simulation ticks every `TICK_MS`. At most
  `⌈EFFECT_MS.eat / TICK_MS⌉` eat flares can be in flight at once, and the table has slots
  for one more than that. The outcome — a death or a win — gets a single slot of its own,
  because the game ends on it and cannot produce a second.
- **`slots` is read, never retained and never mutated**, by anything but this module.
- **Nothing is allocated after construction**, so 002's per-frame allocation ban survives
  intact — the ban is about the draw path, and the draw path still allocates nothing.
- **No DOM, no canvas, no Web Audio.** It is arithmetic over numbers, so it runs headlessly
  under Node like `simulation.js`, and it is verified there before anything is wired to it.

### The simulation never learns this exists

`main.js` already branches on the token `step()` returns —
`ATE`, `DIED_WALL`, `DIED_SELF`, `WON` — to update the score and to end the run. This task
adds a `spawn` beside that existing branch. This is the seam task 001 specified: *"`step()`
returns what happened; whoever calls it decides what to do with that fact."*

No call is added to `simulation.js`, `state.js`, `rng.js`, or `storage.js`'s record path.

### The renderer is handed events, not state

`draw(state, effects)`. The renderer gains one parameter and one new kind of input. It does
not gain the ability to ask what happened, and it still cannot see the phase, the score, or
the death reason.

---

## The board effects

Three effects, and each is the identity's own metaphor resolving. None is decoration applied
over it. Two mechanics between them, because a death and a win are one wavefront read two
ways — and the third is the food's own halo, which the board already knows how to draw.

### Eating — the node's halo leaves

The food is the only lit element on the board and its glow is a second filled diamond at
`FOOD_HALO_ALPHA`. On an eat, that halo **expands and fades** at the cell the node was
consumed on: the node's own language leaving it.

- Drawn in the **food layer, before the snake**, so the arriving head covers the centre and
  the flare spreads out past it. It can never occlude the trace, because the trace is
  painted after it.
- Its final radius is bounded to roughly one cell, so it reads as an event at a point rather
  than as a field spreading over the board.
- It is the only effect that can be in flight more than one at a time.

**Its curve is set by measurement, not by taste.** The first implementation faded on `(1-t)²`
and grew linearly, and when the drawn frame was sampled it turned out not to exist: with the
head on the cell, the flare tinted exactly one pixel — the head's own anti-aliased edge — and
was gone by 40% of its life. The squared fade was spending the flare's brightness while it was
still hidden under the head that had just arrived on it, and the head is opaque and painted
after it, so there was never a haze over that cell for the curve to suppress.

The flare now fades **linearly** and grows on **`√t`**: the expansion is front-loaded, so it
clears the head while it still has brightness to spend, and what remains of its life is the
tail of the fade rather than the whole of the visible part. This is the one place in the task
where reading the code was not enough and the pixels had to be read.

### Dying — the signal stops

The trace is drawn today with a ramp that attenuates from full brightness at the neck to
`TRACE_TAIL_ALPHA` at the tail. On a death, **that ramp collapses**: a wavefront travels
from the head toward the tail and the whole trace settles at the tail's floor.

**It bottoms out at `TRACE_TAIL_ALPHA` and goes no further, and that is a requirement rather
than a taste.** That constant exists because composited over the substrate `--snake-body`
reaches 3:1 at alpha 0.45 and falls below it after; under 3:1 the trace stops being a
legible graphical object under WCAG 1.4.11. On game over the player has just died and needs
to see where. An effect that took the board dark would undo the fix task 002 made for
exactly that reason. The burnout settles *at* the legibility floor, which is to say it is
dramatic to the precise limit the design already permits, and not one step past it.

The head keeps its full cell and the body keeps its inset, so the silhouette distinction
002 called load-bearing survives the alpha change untouched.

### Clearing the board — the signal completes

The same wavefront, inverted: the trace **surges to full brightness** from head to tail and
settles back to its normal ramp. One mechanic with a sign, rather than a second one.

It is the right shape for the event. A cleared board has no food on it and the snake fills
the field, so the board is already visually complete; what is left to say is that the signal
made it all the way round.

### Reduced motion

`prefers-reduced-motion` is honoured, and its blanket CSS guard cannot reach a canvas. So
the effects timeline takes the preference at construction and, when it is set, resolves an
effect straight to its end state and draws no travel.

**The information still lands.** A death still settles the trace at the floor; a win still
brightens it. What is removed is the movement, which is the thing the preference asks about.
The eat flare does not draw at all, because it carries no information a player needs — the
food is gone and the score has changed either way.

---

## The sound

### Four voices, synthesised

`src/audio.js` owns one `AudioContext`, a master gain, and four voices built from
oscillators and gain envelopes. **No audio files.** Every dependency is a cost this project
declines to pay, and an asset pipeline would be a build step by another name.

| Moment | Sound |
| --- | --- |
| Eat | A short rising blip. |
| Death | A low falling tone. |
| Win | A short resolving figure. |
| New best | A distinct two-note rise, and it plays *after* the outcome when a run both ends and sets a record. |

- **One voice table**, in `audio.js`. Pitches and envelope times are the sound design, not
  tunables scattered across the project, and they live in one place the way the palette
  lives in one place.
- **The shared constants** — master gain, and the durations effects run for — go in
  `config.js` beside every other tunable, per the single-source-of-truth rule.
- **A limited palette applies to sound too.** A small fixed set of pitches, reused. Not a
  different tone per event invented from scratch.

### Four moments, and no more

Dead air is a real cost, and so is noise. The rule that decides the list: **a sound belongs
to a moment that changes what happens next.**

- **Eat** changes the score, the length, and where the food is. It earns one.
- **Death** and **win** end the run. They earn one each.
- **New best** is the only thing the game is allowed to celebrate, and 004 already gave it a
  mark on the screen. It earns one.
- **Turning** does not. A turn sound would fire up to 8⅓ times a second during fast play —
  which is not a signal, it is a drone, and it would be the loudest thing in the game.
- **Pausing and starting** do not, because the overlay appearing or leaving *is* the
  acknowledgement, immediately and unmistakably. A sound there is saying it twice.

---

## The gesture gate

**Browsers will not let a page make noise before the player has done something.** Chrome
logs a warning and Safari refuses outright. Zero console warnings is a hard requirement in
this project, so the rule is absolute:

**The `AudioContext` is constructed lazily, inside a real user gesture — never at module
load.**

`start()` is the right place and the only place. It runs synchronously inside the `keydown`
or `pointerdown` that began the game, so it *is* a gesture, it happens before any sound the
game can make, and it is the moment the player has committed to playing. There is exactly
one such call in the project.

A consequence worth stating: on the ready screen the game is silent, and it is silent because
nothing has happened yet rather than because sound is being suppressed.

### While the tab is hidden

The context is suspended when the tab is hidden and resumed when it is visible, mirroring
the existing auto-pause. Nothing loops, so this is not about stopping a noise — it is about
not holding a running audio thread for a tab nobody is looking at.

---

## What is stored

### The sound preference

```json
{ "muted": false }
```

Under `snakeneoncircuit.settings.v1`, declared in `config.js` beside every other constant.

| Field | Meaning |
| --- | --- |
| `muted` | Whether the player has turned the sound off |

**Why a separate key and not a third field in `stats.v1`.** Task 004 made that key mean two
validated counts with all-or-nothing rejection, and it made rejection all-or-nothing for a
reason. A preference stored inside the record would mean a corrupt score also silently lost
your sound setting — two unrelated things failing together because they were kept in one
object. A different key also means a future schema for either one is a different key, which
is the versioning rule 004 set.

**Validation is total, and rejection is all-or-nothing**, exactly as `loadStats()`:

- The key absent, the value not valid JSON, or not a JSON object.
- `muted` missing, or not a boolean.

Anything but exactly `{ muted: <boolean> }` reads as the default, and **the default is sound
on**. The player has already had to press a key or tap the pad to get here, so the first
sound the game can make already follows a deliberate action, and a player who wants silence
has a key and a button.

### Nothing else

No volume, no last-used setting, no "has the player muted before". One boolean.

---

## Where it is shown

### The game-over title carries the reason

| Reason | Title |
| --- | --- |
| `REASON.WALL` | `Hit a wall` |
| `REASON.SELF` | `Bit itself` |
| `REASON.WIN` | `Board cleared` |

`state.over.reason` has distinguished all three since task 001, and `main.js` has surfaced
only `WIN` — task 002 recorded that gap and deferred it to this work.

**The title, not the detail line.** The detail line already carries the score, the new-best
mark, and the comparison, and it already reaches two line boxes at 320px in the win case. It
is the tightest copy in the interface. The title is a single short phrase with room, and
replacing it makes no line wider than it is today.

The title is uppercased and letter-spaced by CSS, so its width on screen is not its
character count. **Each of the three is measured to one line box at 320×568**, which is the
narrowest the layout produces; if one does not fit, the copy shortens and the layout does
not move. The existing detail line is unchanged.

### The mute control

- **`M` on every device.** It toggles immediately, including mid-run.
- **A Sound button beside Pause**, shown by `@media (pointer: coarse)` like every other
  control. It costs the board nothing, for the reason 003 established when it moved the
  pause control out of the HUD row.
- **The button's own label reports its state.** It reads `Sound` while the sound is on and
  `Muted` while it is off, so muting is never silent in either sense of the word.

**The label and not `aria-pressed`.** The two were considered together and the pair is
worse than either alone: with the visible text changing, `aria-pressed="false"` alongside a
button named "Muted" announces as *"Muted, toggle button, not pressed"*, which reads as the
opposite of what it means. A stable name with a pressed state would have been the other
option, and it needs a second visual signal for the sighted player — the control already
rests at `--ink-dim`, so there is nothing left to dim it to, and the alternative was
inventing a strikethrough that nothing else in the interface uses. So the name carries the
state, exactly as the visible text does, and the accessible name is the visible label —
which is also what WCAG 2.5.3 asks for.

On a fine pointer `.controls` is not rendered at all, so `M` is the desktop control and the
README's control table — where `P` and `Escape` are already documented — is where it is
written down. The ready overlay carries the hint as well, in the keyboard-only pair that CSS
hides wherever there is a button instead: *"Press M to mute"* while the sound is on, *"Press
M for sound"* while it is off, swapped by the same code that writes the button's label. Two
lines rather than one, because the hint has to name the state the key would change and the
default is not the only state a returning player arrives in. Measured to one line box at
320px, which is the gate the panel's narrowest case sets.

---

## When audio is unavailable

`AudioContext` may be absent, may throw on construction, or may refuse to start. As with
storage in 004, **the game is identical, minus the sound.**

- No error, no toast, no degraded layout, no disabled-looking control, and nothing in the
  console.
- Every call into `audio.js` is safe when the context does not exist, so `main.js` never has
  to ask whether audio is available before playing something.

This is the project's standing posture: a capability the browser may not have is a branch,
not an error. 003 treated `pointer: coarse` this way and 004 treated `localStorage` this way.

---

## Accessibility

- **Sound is additive.** Every sound corresponds to a change that is already carried
  visually and, for the deaths and the win, in text. A deaf player loses emphasis, never
  information. This is the criterion that decides which moments get a sound at all.
- **The death reason is text**, not a sound and not a colour. It is in the overlay's existing
  `aria-live="polite"`, so it is announced.
- **The mute control is a real `<button type="button">`** whose accessible name is its
  visible label, reporting the state it is in, and it is at least 44×44 CSS px.
- **`M` does not collide** with any documented key: `KEY_MAP`, `PAUSE_KEYS`, and `START_KEYS`
  do not contain it.
- **`prefers-reduced-motion` is honoured on the canvas**, where the CSS guard cannot reach.
  See *The board effects*.
- **No effect reduces contrast below the floors 002 established.** The trace's worst state is
  `TRACE_TAIL_ALPHA`, the head and food silhouettes are unchanged, and this is measured
  rather than assumed.
- **Every control carries every state the project requires.** Adding a second control to the
  row surfaced that Pause had no `disabled` state, so it is inert on the ready and over
  screens while looking exactly as live as it does mid-run. It now disables. The dimming
  takes its label to 3.2:1, against 7.1:1 at rest; WCAG 1.4.3 exempts an inactive component,
  and the platform delivers no pointer events to one, so it cannot be pressed, hovered, or
  focused while it is off. The Sound control is never disabled, **including when the browser
  has no Web Audio** — a silence the player cannot control must not be reported by a control
  that looks broken.
- **Focus and tab order are unchanged in kind.** The Sound button joins Pause as a second
  focusable control, carrying the same visible focus ring; the pad's keys stay out of the
  tab order exactly as 003 left them, because the arrow keys already reach the same four
  intents. Neither control exists on a fine pointer, where `.controls` is never rendered.

---

## Invariants this task must not break

- **`simulation.js` is byte-identical.** No rule, no timing, no state shape changes.
- **The renderer never reads `phase`, `score`, or `over`**, and never imports `state.js`,
  `simulation.js`, or `storage.js`.
- **No per-frame allocation.** The effects slots are allocated at construction and reused;
  the draw path allocates nothing.
- **The game is still deterministic.** Sound and effects are outputs of a run and never
  inputs to one. The same seed and the same inputs produce the same run, muted or not.
- **`input.js` remains the only module that listens for input.** The `M` key and the Sound
  button are handled there and routed through the same handler object as every other control.
- **The trace never drops below `TRACE_TAIL_ALPHA`**, and the head and food silhouettes are
  unchanged.
- **No board regression** at any reference viewport, with or without the Sound button.
- **The board's cell size does not change**, which the decision to put the Sound button in
  `.controls` should make automatic, and which is measured anyway.
- **With sound muted, or audio unavailable, every screen is unchanged** from what it is with
  sound on.
- **No new dependency, no build step, no `package.json`.** Web Audio is browser-native.
- **Console is clean**, including on the first gesture and on the audio-unavailable path.

---

## Files

| File | Change |
| --- | --- |
| `src/effects.js` | **New.** The event timeline: spawn, age, retire. No DOM, no canvas. |
| `src/audio.js` | **New.** The four voices and the gesture-gated context. |
| `src/config.js` | Effect durations and slots, audio constants, the mute key, `SETTINGS_KEY` |
| `src/renderer.js` | `draw(state, effects)`; the flare layer; the wavefront term in the trace ramp |
| `src/input.js` | The `M` key and the Sound button, through a new `toggleMute` handler |
| `src/storage.js` | `loadMuted` / `saveMuted` under the settings key |
| `src/main.js` | Spawn at the outcome seam, advance per frame, mute state, the reason-driven title |
| `index.html` | The Sound button |
| `css/main.css` | The shared control class, and the Sound button's state |
| `docs/decisions/001-render-events.md` | **New.** Why 002's renderer boundary is lifted |
| `docs/tasks/005-audio-and-feedback.md` | This document |
| `README.md` | The audio paragraph, the control table, the roadmap, the structure, the renderer note |

**Must not change:** `src/simulation.js`, `src/state.js`, `src/rng.js`.

If implementation appears to require touching any of those, that is a signal the design has
drifted, not a signal to widen the task. Stop and reconsider.

---

## Verification

### Automated, off-repo (temp directory, deleted afterwards)

`src/effects.js` and the new `src/storage.js` exports are DOM-free, so a Node harness asserts
them directly, as task 001 did for the rules:

1. **Ageing and retirement** — an effect spawns inactive, becomes active, advances, and is
   retired when its duration elapses.
2. **Capacity** — a burst of eats fills the eat slots and never overflows the array; the
   oldest is reused rather than the newest being dropped.
3. **Slots are reused, not allocated** — the same objects come back across a spawn/retire
   cycle.
4. **Reduced motion** — with the flag set, a spawn resolves immediately and a death settles
   the trace in one step.
5. **The settings key** — round-trip; and for each of invalid JSON, a JSON array, `null`, a
   string, a number, a missing `muted`, and a non-boolean `muted`, the default is returned
   and nothing throws.

### Automated, in a real browser

Driven over the DevTools Protocol, reusing the harness style from 003 and 004:

1. **The gesture gate.** After the first start gesture the context exists and is `running`,
   and **the console carries no autoplay warning** — the specific failure this design exists
   to avoid. Asserted, not assumed.
2. **The voices produce sound.** Each voice is rendered through an `OfflineAudioContext` and
   asserted non-silent over its expected duration, with a peak inside a sane range. I cannot
   hear them, so amplitude is measured rather than the sound being claimed.
3. **Mute.** `M` and the Sound button both toggle it; the button's label and the keyboard
   hint both follow; the state survives a reload; while muted the context is suspended and
   no voice is scheduled.
4. **Board effects.** The renderer is driven with **chosen** frames rather than watched —
   a hand-built state, a hand-built timeline aged to an exact `t` — so every assertion is
   about a frame that was picked rather than one that happened to be on screen when a poll
   fired. The trace's brightness is sampled per cell across the effect's life, so "a front
   travels" is a measurement and not an impression. Specifically: the resting ramp is
   monotonic and lands on `TRACE_TAIL_ALPHA`; the death front leaves cells ahead of it
   exactly where they were, so it is a front and not a global fade; the win band is always
   at or above the ramp and restores it exactly; and the flare is sampled radially under an
   arriving head at a fifth of a cell, which is what caught the curve this task had to fix.
5. **The floor holds.** The settled trace's tail pixel is **byte-identical** to the resting
   tail pixel — the burnout lands on `TRACE_TAIL_ALPHA` exactly, not near it — and measures
   ≥ 3:1 against a sampled arena pixel. The head is still distinguishable by silhouette.
6. **Reduced motion.** With `prefers-reduced-motion: reduce` emulated, no flare draws and the
   trace settles immediately — the information lands, the travel does not.
7. **Death titles.** Each of the three is a single line box, and the detail line is byte-identical
   to what 004 shipped, at 320×568, 375×667, 412×915, 480×720, 844×390, and 1440×900.
8. **No board regression.** Cell size unchanged at every reference viewport; no horizontal
   scroll; no layout shift when the Sound button is present, and none when Pause disables on
   the ready screen and re-enables on the first tick.
9. **Console clean** across a full session: start, eat, pause, resume, die on a wall, die on
   yourself, clear the board, mute, unmute, reload.
10. **Frame cost is flat.** The draw path allocates nothing, and a long session does not
    degrade.

### Not verifiable here

Reported as unverified rather than claimed:

- **Whether the sounds are pleasant.** Amplitude is measurable; taste is not. This is the
  one thing in the task that needs a human ear.
- **Whether the death effect reads well at speed** on a real display.
- **How the sound sits on a phone speaker**, or alongside whatever else is playing.
- **Real reduced-motion behaviour** on a device where the player has actually set it.

---

## Acceptance criteria

### Feedback

- [ ] Eating is acknowledged on the board at the cell it happened on
- [ ] Dying is acknowledged on the board, and the effect settles at the legibility floor
- [ ] Clearing the board is acknowledged distinctly from dying
- [ ] Each of the four moments has its own sound
- [ ] Turning, pausing, and starting remain silent

### Legibility

- [ ] The trace never renders below `TRACE_TAIL_ALPHA`
- [ ] The head and body silhouettes are unchanged by any effect
- [ ] The food keeps its diamond and its halo
- [ ] No effect occludes the snake, the food, or the grid
- [ ] The board reads clearly in greyscale with every effect settled

### Sound

- [ ] No audio file is added and nothing is downloaded
- [ ] The `AudioContext` is constructed only inside a user gesture
- [ ] No autoplay warning or error reaches the console
- [ ] `M` toggles the sound from any screen
- [ ] The Sound button toggles the sound on a touch device
- [ ] The choice survives a reload
- [ ] With audio unavailable every screen and the whole game are unchanged

### Copy

- [ ] A wall and the player's own tail produce different titles
- [ ] Each title is one line box at 320×568
- [ ] The detail line is unchanged from task 004
- [ ] `M` is documented in the README's control table

### Integrity

- [ ] `simulation.js` is byte-identical
- [ ] The renderer never reads `phase`, `score`, or `over`
- [ ] `input.js` is still the only module that listens for input
- [ ] No per-frame allocation was introduced
- [ ] The run is unaffected by sound or by effects — same seed, same inputs, same run
- [ ] `prefers-reduced-motion` removes the travel and keeps the information
- [ ] No cell-size regression at any reference viewport
- [ ] No dependency, build step, or `package.json` was added
- [ ] Zero console errors or warnings

---

## Deliberately deferred

Do not build, stub, or scaffold any of these.

- **Music, ambience, or a looping bed.**
- **A volume control, or any audio setting beyond muted.** One boolean.
- **A sound for turning, pausing, or starting.**
- **Wall-versus-self sounds** — the distinction is carried by the title and the effect's
  shape, not by ear.
- **A settings menu or a preferences screen.** 002 deferred one; a single toggle is a
  control and belongs with the other controls.
- **Haptics.** 003 deferred them and nothing has changed.
- **Difficulty progression or a variable tick rate.** Unchanged from every task before this.
- **Screen shake, particles, flashes, motion blur, trails, scanlines, CRT distortion.** 002's
  anti-goals stand and are not weakened by this task having animated the canvas.
- **Any change to `simulation.js`, `state.js`, or `rng.js`.**

---

## Definition of Done

1. It works, including its edge cases — a first visit, audio unavailable, muted across a
   reload, a cleared board, and a death on the first tick.
2. The refinement pass (`polish-pass` skill, or `/polish`) has been run. This task **adds**
   motion and sound to a game that had neither, which is exactly the shape of change that
   accumulates without one; it is expected to subtract as much as it adds.
3. Verified in a browser at narrow and wide viewports, at DPR 1, 2, and 3, with reduced
   motion, and in greyscale with every effect settled.
4. Verified on a real touch device for the Sound button.
5. No console errors, dead code, or placeholders remain.
6. Every invariant above holds, and `simulation.js`, `state.js`, and `rng.js` are untouched.
7. You can answer yes to: *would a stranger describe the sound and the death effect as this
   game's own, or as effects bolted onto a Snake clone?*

If the honest answer to 7 is the second one, the task is not done regardless of how many
criteria are ticked.

Do not commit unless asked.
