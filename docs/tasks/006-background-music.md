# Task 006 — Background music

**Status:** Ready for implementation
**Depends on:** 005 (audio and richer feedback) — in progress on the same branch
**Supersedes:** the *"Music, ambience, or a looping bed"* entry in 005's **Deliberately deferred**
list, and the *"One boolean"* rule in 005's **What is stored**

---

## Why this exists

005 shipped four voices and left the game otherwise silent between them. Playing it, the
owner's report was that the sound was *"acceptable"* but the game *"feels boring"* without a
bed. That is a fair reading of the gap: the four voices are all **events**, and between
events there is nothing. A run is twenty seconds of a quiet board punctuated by four blips.

005 deferred music deliberately, and the deferral was reasonable at the time — a bed is the
single largest piece of audio work in the project and it had no evidence it was wanted. The
evidence now exists. This task reverses the deferral and records why, which is the same
thing 005 did when it reversed 002.

---

## What "music" means here, and what it must not be

**It must not be a loop.** A four- or eight-bar loop under a game whose runs last twenty
seconds is heard three times before it is irritating, and this is a game about a board that
is *never* the same twice. A looping bed would be the one static thing in a dynamic system.

**It must not be an asset.** 005's rule stands: an asset pipeline is a build step wearing a
different hat. Every note is synthesised from the same `AudioContext` the voices use.

**It must not carry information.** 005's accessibility criterion is that sound is additive —
a deaf player loses emphasis, never information. Music that encoded the score would break
that. Everything the bed does is also visible on the board.

**It must get out of the way of the voices.** The eat blip fires up to 8⅓ times a second and
is the acknowledgement the player reads the game by. The bed ducks under it.

---

## The design

### A generative bed, not a composition

Three layers run over one shared clock. Each has its own pattern length, and the lengths are
chosen so the three only realign after a very long time:

| Layer | Enters | Pattern | Notes |
| --- | --- | --- | --- |
| **Pulse** | immediately | 4 steps | The root, low and long. The floor of the bed. |
| **Figure** | immediately | 16 steps | The arpeggio, one note per step. The bed's body. |
| **Upper** | length ≥ 12 | 11 steps | A counter-figure an octave up, one note every other step. |

16 and 11 are coprime, so the two figures only return to the same relationship after
**176 steps** — about 35 seconds at the slowest tempo and 26 at the fastest. A run is
shorter than that in almost every case, so within a run the bed does not repeat. Across
runs it does, which is what makes it music rather than noise.

**The upper layer entering at length 12 is the whole reason the bed is not boring.** It
means the music has a *shape*: the first ten seconds are sparse and slow, and by the time
the snake is long the bed is dense and driving. The player hears their own progress. This is
the same trick as the trace attenuating toward the tail — the game telling you where you are
without a number.

### It grows with the snake

One tempo, interpolated from the snake's length:

```
stepMs = slow + (fast - slow) * clamp01((length - START_LENGTH) / (fullLength - START_LENGTH))
```

- At `START_LENGTH` the bed steps every **300 ms**.
- At `MUSIC.fullLength` (40) it steps every **150 ms**, and it stops accelerating there.

Length rather than score, because length is what the player can see on the board. It is read
in `main.js` and passed in; the bed never reads game state.

### It ducks under the voices

`play()` dips the music bus for `MUSIC.duckS` and lets it back up. The blip is 90 ms; the dip
is 180 ms. This is the one piece of mixing in the project, and it exists for a legibility
reason rather than a taste one: at 8⅓ eats a second the blips and the bed occupy the same
band, and without the dip the eat stops being the loudest thing in the game at exactly the
moment it matters most.

### A pause is not an end

The bed belongs to the **run**, not to the game's activity. Pausing suspends a run without
ending it, so the bed keeps playing under the paused overlay — and, more to the point, keeps
its place: the figure does not restart at step zero on resume. Stopping on every pause and
starting again on every resume would chop the music into pieces and make the pause the
loudest thing in it.

Only **ready** and **over** have no run, and those are the two the bed is silent on. A hidden
tab is a third question again, and it is asked where it always was — by `setHidden`, which
suspends the context for the reason 005 gave.

### Scheduling: a lookahead on the existing frame

The bed is scheduled **ahead of the clock**, from `main.js`'s existing frame loop —
`audio.tick(length)` beside `effects.advance(dt)`. No second timer, no `setInterval`, no
second loop to keep in step with the first.

Web Audio scheduling has to be done ahead of time or notes land late and audibly uneven, so
`tick` schedules every step that falls inside `MUSIC.lookaheadS` of the context clock. It
allocates nothing when there is nothing to schedule, and it allocates only per *note*, never
per frame — the ban 002 wrote is about the draw path and about frame cost, and neither is
touched by a handful of oscillator nodes a second.

**The one hazard, and it is the same one `main.js` already guards.** A tab that was
suspended, or a stalled frame, leaves the next step scheduled in the past. Without a clamp
the loop would discharge every missed step at once — a burst of notes, the audio equivalent
of the snake leaping into a wall. So a next step that has fallen behind the clock is moved
up to it rather than caught up. Same rule as the `MAX_FRAME_MS` clamp, same reason.

---

## The control

**`M` keeps its meaning.** It is the master mute, and a player who presses it expects
silence — so it silences the bed too. That is not negotiable, and it is why music does not
simply get its own unrelated key.

**`N` toggles the music alone.** Adjacent to `M` on the keyboard, which is where the two
audio toggles belong, and free: `KEY_MAP`, `PAUSE_KEYS`, `START_KEYS`, and `MUTE_KEYS`
between them do not contain it.

**A Music button on each overlay** — ready, paused, and over — carrying `data-music` rather
than an id, so one `querySelectorAll` wires all three and a fourth screen would need no code
change. This is the same shape as the pad's four keys, which are wired by one delegated
listener for the same reason.

**Why the overlays and not the touch row.** Measured in 005: at 320px the touch row is 296px,
the pad takes 148, and Pause and Sound take about 118 between them. A third control needs
roughly 67px more than exists. Its other homes are worse — the HUD row costs the board its
cell size at 844×390, which 003 already measured and rejected. So the music control goes
where a player already stops: the screens that appear before a run, during a pause, and
after a death.

**The button reports its own state in its own label**, exactly as the Sound button does, and
for the same reason 005 gave: the one control that produces silence cannot be the one thing
that does not confirm it did something.

### A bug these buttons would have exposed

The music buttons are the **first focusable controls the game has ever had on a fine
pointer**. Until now every button lived in `.controls`, which is `display: none` wherever the
primary pointer is fine — so on a desktop there was nothing in the document a keyboard could
focus, and two latent faults in `input.js` had nowhere to show themselves:

- `PREVENT_DEFAULT_KEYS` contains Space, and `preventDefault` on a key press cancels the
  default action — which, on a focused button, *is* the activation. Space would have silently
  stopped working on the new control.
- `START_KEYS` contains Enter and Space, so a press on a focused button would have started a
  game **and** toggled the setting: one press, two intents, and the run the player did not ask
  for.

Both are fixed in `input.js` by one predicate — whether the press landed on a `<button>` —
which stands aside for Space's default and for the start branch, and stands aside for neither
of them where a direction key is concerned. The arrow keys are the game's whatever is focused.
This is not scope: without it the feature would have shipped with a control that is
unreachable by the key that reaches buttons, and a button that starts a game when you press it.

---

## What is stored

```json
{ "muted": false, "music": true }
```

`settings.v1` is **redefined rather than bumped to v2**, which needs justifying against 005's
own versioning rule — *"a future schema is a different key"*. The rule exists so a record
written under one shape can never be read back as another. That guarantee is delivered here
by validation instead: `loadSettings` accepts exactly this shape and returns the defaults for
anything else, all-or-nothing, so a v1 record holding only `muted` reads as the defaults
rather than as a settings object missing a field.

The bump would only be needed if `v1` had ever been written by a browser that is not this
working tree. It has not: `main` has no audio at all, and this branch is uncommitted. So the
key has never existed in the wild and redefining it costs nothing.

| Field | Meaning | Default |
| --- | --- | --- |
| `muted` | Master mute — silences the voices and the bed | `false` |
| `music` | Whether the bed plays at all | `true` |

The defaults are deliberately different in spirit: **sound on, and music on.** A player who
wants silence has `M`, and a player who wants only the voices has `N`.

---

## Invariants this task must not break

- **`simulation.js`, `state.js`, and `rng.js` are byte-identical.** Music is presentation.
- **The bed never reads game state.** It is handed a length, the way the renderer is handed
  events. It cannot ask anything.
- **The run is still deterministic.** The bed draws no randomness at all — its patterns are
  fixed tables — so there is not even a seed to keep out of the simulation.
- **No per-frame allocation**, and no timer of the bed's own.
- **`input.js` remains the only module that listens for input**, including the overlay
  buttons.
- **No dependency, no build step, no `package.json`, no audio file.**
- **Console stays clean**, including on the audio-unavailable path and on the first gesture.
- **Every screen is unchanged when the bed is off.**

---

## Files

| File | Change |
| --- | --- |
| `src/audio.js` | The bed: three layers, the lookahead scheduler, the duck, the music bus |
| `src/config.js` | `MUSIC`, `MUSIC_KEYS`, and the widened settings shape |
| `src/storage.js` | `loadSettings` / `saveSettings` replacing `loadMuted` / `saveMuted` |
| `src/main.js` | The bed's start/stop at the existing phase seams, `tick` in the frame, the second setting |
| `src/input.js` | `N`, the `[data-music]` buttons, and the focused-control rule below |
| `index.html` | One Music button per overlay |
| `css/main.css` | The overlay control |
| `docs/decisions/002-background-music.md` | **New.** Why the deferral is reversed |
| `docs/tasks/005-audio-and-feedback.md` | The deferral entry now points here; the settings section widens |
| `README.md` | The control table, the audio paragraph, the structure, the roadmap |

---

## Verification

Measured, not asserted:

1. **The bed is audible.** Rendered through an `OfflineAudioContext` with a stubbed clock and
   asserted non-silent, with a peak inside a sane range — the same method 005 used for the
   voices, for the same reason: I cannot hear it.
2. **It grows.** Steps scheduled at length 3 and at length 40 are counted over the same
   window; the faster run schedules measurably more of them.
3. **It layers.** At length 3 the upper figure is absent; at length 13 it is present.
4. **It stops.** After a terminal outcome nothing further is scheduled, and the bus is back
   at zero.
5. **The duck exists.** The music bus gain is measurably lower immediately after a voice.
6. **It does not burst.** With the clock jumped forward — a simulated stall — the number of
   steps scheduled in that tick stays bounded instead of discharging every missed step.
7. **The master mute still silences everything.** With `muted` set, neither the voices nor
   the bed produce anything.
8. **The toggle round-trips** through storage, and each malformed settings value reads as the
   defaults.
9. **No burst, no warning, no regression.** Zero console output across a full session: start,
   play to a death, pause, resume, toggle both toggles, reload. Cell size and layout unchanged
   at every reference viewport with a Music button now on three overlays — **this is the item
   most likely to fail**, because the ready panel gains a 44px control and the narrowest
   layout is 320×568.
10. **The focused control.** With an overlay's Music button focused, Enter and Space each
    toggle the music and neither starts a run; with nothing focused, Enter starts one as
    before. Asserted, because the failure is silent in both directions.
11. **The bed survives a pause.** Pausing leaves it audible and does not reset the figure's
    position; resuming continues from where it was.

### Not verifiable here

- **Whether the bed is pleasant.** Amplitude, tempo and layering are measurable; the music
  is not. This needs the owner's ear, and it is the one thing that could still send the task
  back.
- **Whether it wears out** over a long session.

---

## Definition of Done

1. It works, including its edge cases — audio unavailable, muted, music off, a stall, a
   hidden tab, a reload between runs.
2. `polish-pass` has been run, and it has subtracted as much as it added.
3. Verified in a browser at narrow and wide viewports, and with reduced motion.
4. No console errors, dead code, or placeholders.
5. The invariants above hold.
6. The bed stops when the run stops. Music over a settled board is the one failure that would
   make the whole feature worse than silence.

**Not committing** — the owner commits. A commit message will be supplied.
